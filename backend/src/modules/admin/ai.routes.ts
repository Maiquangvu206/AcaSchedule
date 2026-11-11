import { Router } from 'express';
import { z } from 'zod';
import { env } from '../../config/env';
import { pool } from '../../database/pool';
import { encryptSecret, isKeyEncryptionConfigured, keyHint } from '../../lib/crypto';
import { AppError, asyncHandler } from '../../lib/errors';
import { logger } from '../../lib/logger';

/**
 * Admin → AI provider management.
 *
 * Mounted under `/api/admin/ai` (admin role enforced by the parent router).
 * Provides usage analytics, per-user daily quotas, provider settings and an
 * encrypted key store. The AI service pulls keys from
 * `/api/internal/ai/config` (see `internal.routes.ts`); it never talks to
 * Supabase directly.
 */
export const adminAiRouter = Router();

const PROVIDERS = ['gemini', 'openrouter'] as const;

const providerSchema = z.enum(PROVIDERS);

const settingsSchema = z
  .object({
    isEnabled: z.boolean(),
    providerOrder: z
      .string()
      .trim()
      .regex(/^(gemini|openrouter)(,(gemini|openrouter))*$/, 'Thứ tự provider không hợp lệ'),
    geminiModel: z.string().trim().min(1).max(120),
    openrouterModel: z.string().trim().min(1).max(160),
    dailyLimit: z.coerce.number().int().min(0).max(100_000),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Không có thay đổi nào',
  });

const createKeySchema = z.object({
  provider: providerSchema,
  label: z.string().trim().max(80).default(''),
  key: z.string().trim().min(20, 'API key quá ngắn').max(500),
  priority: z.coerce.number().int().min(0).max(1000).default(100),
});

const updateKeySchema = z
  .object({
    label: z.string().trim().max(80),
    key: z.string().trim().min(20, 'API key quá ngắn').max(500),
    isActive: z.boolean(),
    priority: z.coerce.number().int().min(0).max(1000),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Không có thay đổi nào',
  });

const userLimitSchema = z.object({
  dailyLimit: z.union([z.coerce.number().int().min(0).max(100_000), z.null()]),
});

interface SettingsRow {
  is_enabled: boolean;
  provider_order: string;
  gemini_model: string;
  openrouter_model: string;
  daily_limit_per_user: number;
  updated_at: Date;
}

interface KeyRow {
  id: string;
  provider: string;
  label: string;
  key_hint: string;
  is_active: boolean;
  priority: number;
  last_used_at: Date | null;
  last_error: string | null;
  created_at: Date;
}

function mapSettings(row: SettingsRow) {
  return {
    isEnabled: row.is_enabled,
    providerOrder: row.provider_order,
    geminiModel: row.gemini_model,
    openrouterModel: row.openrouter_model,
    dailyLimit: row.daily_limit_per_user,
    updatedAt: row.updated_at,
  };
}

function mapKey(row: KeyRow) {
  return {
    id: row.id,
    provider: row.provider,
    label: row.label,
    hint: row.key_hint,
    isActive: row.is_active,
    priority: row.priority,
    lastUsedAt: row.last_used_at,
    lastError: row.last_error,
    createdAt: row.created_at,
  };
}

function isMissingTable(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === '42P01';
}

/** Fail with an actionable message instead of a generic 500 when 024 is missing. */
adminAiRouter.use(
  asyncHandler(async (_req, _res, next) => {
    try {
      await pool.query('SELECT 1 FROM ai_settings LIMIT 1');
    } catch (error) {
      if (isMissingTable(error)) {
        throw new AppError(
          503,
          'AiSchemaMissing',
          'Database chưa có bảng AI. Hãy chạy migration 024_ai_admin.sql rồi tải lại trang.',
        );
      }
      throw error;
    }
    next();
  }),
);

async function loadSettings(): Promise<SettingsRow> {
  const result = await pool.query<SettingsRow>(
    `SELECT is_enabled, provider_order, gemini_model, openrouter_model,
            daily_limit_per_user, updated_at
       FROM ai_settings
      WHERE id = 1`,
  );
  if (!result.rows[0]) {
    throw new AppError(503, 'AiSettingsMissing', 'Chưa khởi tạo cấu hình AI (ai_settings).');
  }
  return result.rows[0];
}

/* ── Overview ──────────────────────────────────────────────────────────── */

adminAiRouter.get(
  '/overview',
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days ?? 14) || 14, 1), 90);

    const [settings, keyCounts, totals, providers, series] = await Promise.all([
      loadSettings(),
      pool.query<{ provider: string; total: number; active: number }>(
        `SELECT provider,
                count(*)::int AS total,
                count(*) FILTER (WHERE is_active)::int AS active
           FROM ai_provider_keys
          GROUP BY provider`,
      ),
      pool.query<{
        today: number;
        week: number;
        month: number;
        fallback_month: number;
        avg_latency: number;
      }>(
        `SELECT
           count(*) FILTER (WHERE created_at >= date_trunc('day', now()))::int AS today,
           count(*) FILTER (WHERE created_at >= now() - interval '7 days')::int AS week,
           count(*) FILTER (WHERE created_at >= now() - interval '30 days')::int AS month,
           count(*) FILTER (WHERE used_fallback AND created_at >= now() - interval '30 days')::int AS fallback_month,
           coalesce(round(avg(latency_ms) FILTER (WHERE created_at >= now() - interval '30 days')), 0)::int AS avg_latency
         FROM ai_usage_logs`,
      ),
      pool.query<{ provider: string; count: number; fallback: number }>(
        `SELECT provider,
                count(*)::int AS count,
                count(*) FILTER (WHERE used_fallback)::int AS fallback
           FROM ai_usage_logs
          WHERE created_at >= now() - interval '30 days'
          GROUP BY provider
          ORDER BY count DESC`,
      ),
      pool.query<{ day: string; total: number; fallback: number }>(
        `SELECT to_char(d::date, 'YYYY-MM-DD') AS day,
                count(l.id)::int AS total,
                count(l.id) FILTER (WHERE l.used_fallback)::int AS fallback
           FROM generate_series(
                  date_trunc('day', now()) - ($1::int - 1) * interval '1 day',
                  date_trunc('day', now()),
                  interval '1 day'
                ) AS d
           LEFT JOIN ai_usage_logs l
                  ON l.created_at >= d AND l.created_at < d + interval '1 day'
          GROUP BY d
          ORDER BY d`,
        [days],
      ),
    ]);

    const keys = Object.fromEntries(
      PROVIDERS.map((provider) => {
        const row = keyCounts.rows.find((item) => item.provider === provider);
        return [provider, { total: row?.total ?? 0, active: row?.active ?? 0 }];
      }),
    );

    res.json({
      settings: mapSettings(settings),
      keys,
      keyStorageConfigured: isKeyEncryptionConfigured(env.AI_KEYS_SECRET),
      usage: {
        today: totals.rows[0]?.today ?? 0,
        week: totals.rows[0]?.week ?? 0,
        month: totals.rows[0]?.month ?? 0,
        fallbackMonth: totals.rows[0]?.fallback_month ?? 0,
        avgLatencyMs: totals.rows[0]?.avg_latency ?? 0,
      },
      providers: providers.rows,
      series: series.rows,
    });
  }),
);

/* ── Per-user usage ────────────────────────────────────────────────────── */

adminAiRouter.get(
  '/usage',
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days ?? 30) || 30, 1), 365);
    const limit = Math.min(Math.max(Number(req.query.limit ?? 100) || 100, 1), 500);
    const search = String(req.query.search ?? '').trim();

    const result = await pool.query<{
      id: string;
      email: string;
      full_name: string | null;
      student_code: string | null;
      ai_daily_limit: number | null;
      today: number;
      week: number;
      total: number;
      fallback: number;
      last_used_at: Date | null;
      avg_latency: number;
    }>(
      `SELECT u.id, u.email, u.full_name, u.student_code, u.ai_daily_limit,
              count(l.id) FILTER (WHERE l.created_at >= date_trunc('day', now()))::int AS today,
              count(l.id) FILTER (WHERE l.created_at >= now() - interval '7 days')::int AS week,
              count(l.id) FILTER (WHERE l.created_at >= now() - make_interval(days => $2::int))::int AS total,
              count(l.id) FILTER (WHERE l.used_fallback
                                   AND l.created_at >= now() - make_interval(days => $2::int))::int AS fallback,
              max(l.created_at) AS last_used_at,
              coalesce(round(avg(l.latency_ms)
                             FILTER (WHERE l.created_at >= now() - make_interval(days => $2::int))), 0)::int AS avg_latency
         FROM users u
         LEFT JOIN ai_usage_logs l ON l.user_id = u.id
        WHERE u.role = 'student'
          AND ($1 = '' OR u.email ILIKE '%' || $1 || '%'
                        OR coalesce(u.full_name, '') ILIKE '%' || $1 || '%'
                        OR coalesce(u.student_code, '') ILIKE '%' || $1 || '%')
        GROUP BY u.id
        ORDER BY total DESC, u.email ASC
        LIMIT $3`,
      [search, days, limit],
    );

    res.json({
      days,
      users: result.rows.map((row) => ({
        id: row.id,
        email: row.email,
        fullName: row.full_name,
        studentCode: row.student_code,
        dailyLimit: row.ai_daily_limit,
        today: row.today,
        week: row.week,
        total: row.total,
        fallback: row.fallback,
        lastUsedAt: row.last_used_at,
        avgLatencyMs: row.avg_latency,
      })),
    });
  }),
);

adminAiRouter.get(
  '/logs',
  asyncHandler(async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit ?? 100) || 100, 1), 500);
    const userIdRaw = String(req.query.userId ?? '').trim();
    const provider = String(req.query.provider ?? '').trim();

    if (userIdRaw && !z.string().uuid().safeParse(userIdRaw).success) {
      throw AppError.badRequest('userId không hợp lệ');
    }
    if (provider && !PROVIDERS.includes(provider as (typeof PROVIDERS)[number])) {
      throw AppError.badRequest('provider không hợp lệ');
    }

    const result = await pool.query<{
      id: string;
      endpoint: string;
      provider: string;
      used_fallback: boolean;
      latency_ms: number;
      status_code: number | null;
      created_at: Date;
      email: string | null;
      full_name: string | null;
    }>(
      `SELECT l.id, l.endpoint, l.provider, l.used_fallback, l.latency_ms,
              l.status_code, l.created_at, u.email, u.full_name
         FROM ai_usage_logs l
         LEFT JOIN users u ON u.id = l.user_id
        WHERE ($1::uuid IS NULL OR l.user_id = $1::uuid)
          AND ($2 = '' OR l.provider = $2)
        ORDER BY l.created_at DESC
        LIMIT $3`,
      [userIdRaw || null, provider, limit],
    );

    res.json({
      logs: result.rows.map((row) => ({
        id: row.id,
        endpoint: row.endpoint,
        provider: row.provider,
        usedFallback: row.used_fallback,
        latencyMs: row.latency_ms,
        statusCode: row.status_code,
        createdAt: row.created_at,
        email: row.email,
        fullName: row.full_name,
      })),
    });
  }),
);

/* ── Provider settings ─────────────────────────────────────────────────── */

adminAiRouter.patch(
  '/settings',
  asyncHandler(async (req, res) => {
    const input = settingsSchema.parse(req.body);

    const result = await pool.query<SettingsRow>(
      `UPDATE ai_settings
          SET is_enabled = COALESCE($1, is_enabled),
              provider_order = COALESCE($2, provider_order),
              gemini_model = COALESCE($3, gemini_model),
              openrouter_model = COALESCE($4, openrouter_model),
              daily_limit_per_user = COALESCE($5, daily_limit_per_user),
              updated_at = now()
        WHERE id = 1
        RETURNING is_enabled, provider_order, gemini_model, openrouter_model,
                  daily_limit_per_user, updated_at`,
      [
        input.isEnabled ?? null,
        input.providerOrder ?? null,
        input.geminiModel ?? null,
        input.openrouterModel ?? null,
        input.dailyLimit ?? null,
      ],
    );

    if (!result.rows[0]) {
      throw new AppError(503, 'AiSettingsMissing', 'Chưa khởi tạo cấu hình AI (ai_settings).');
    }

    logger.info({ updatedBy: req.user?.id }, 'AI settings updated');
    res.json({ settings: mapSettings(result.rows[0]) });
  }),
);

/* ── API keys ──────────────────────────────────────────────────────────── */

adminAiRouter.get(
  '/keys',
  asyncHandler(async (_req, res) => {
    const result = await pool.query<KeyRow>(
      `SELECT id, provider, label, key_hint, is_active, priority,
              last_used_at, last_error, created_at
         FROM ai_provider_keys
        ORDER BY provider, priority, created_at`,
    );

    res.json({
      keyStorageConfigured: isKeyEncryptionConfigured(env.AI_KEYS_SECRET),
      keys: result.rows.map(mapKey),
    });
  }),
);

adminAiRouter.post(
  '/keys',
  asyncHandler(async (req, res) => {
    if (!isKeyEncryptionConfigured(env.AI_KEYS_SECRET)) {
      throw new AppError(
        503,
        'KeyStorageDisabled',
        'Chưa cấu hình AI_KEYS_SECRET trên backend nên không thể lưu API key.',
      );
    }

    const input = createKeySchema.parse(req.body);
    const result = await pool.query<KeyRow>(
      `INSERT INTO ai_provider_keys (provider, label, encrypted_key, key_hint, priority)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, provider, label, key_hint, is_active, priority,
                 last_used_at, last_error, created_at`,
      [
        input.provider,
        input.label,
        encryptSecret(input.key, env.AI_KEYS_SECRET),
        keyHint(input.key),
        input.priority,
      ],
    );

    logger.info(
      { provider: input.provider, keyId: result.rows[0].id, by: req.user?.id },
      'AI provider key added',
    );
    res.status(201).json({ key: mapKey(result.rows[0]) });
  }),
);

adminAiRouter.patch(
  '/keys/:id',
  asyncHandler(async (req, res) => {
    const keyId = z.string().uuid().parse(req.params.id);
    const input = updateKeySchema.parse(req.body);

    if (input.key !== undefined && !isKeyEncryptionConfigured(env.AI_KEYS_SECRET)) {
      throw new AppError(
        503,
        'KeyStorageDisabled',
        'Chưa cấu hình AI_KEYS_SECRET trên backend nên không thể cập nhật API key.',
      );
    }

    const encrypted = input.key ? encryptSecret(input.key, env.AI_KEYS_SECRET) : null;
    const hint = input.key ? keyHint(input.key) : null;

    const result = await pool.query<KeyRow>(
      `UPDATE ai_provider_keys
          SET label = COALESCE($2, label),
              is_active = COALESCE($3, is_active),
              priority = COALESCE($4, priority),
              encrypted_key = COALESCE($5, encrypted_key),
              key_hint = COALESCE($6, key_hint),
              last_error = CASE WHEN $5::text IS NULL THEN last_error ELSE NULL END,
              updated_at = now()
        WHERE id = $1
        RETURNING id, provider, label, key_hint, is_active, priority,
                  last_used_at, last_error, created_at`,
      [
        keyId,
        input.label ?? null,
        input.isActive ?? null,
        input.priority ?? null,
        encrypted,
        hint,
      ],
    );

    if (!result.rows[0]) {
      throw AppError.notFound('Không tìm thấy API key');
    }

    logger.info({ keyId, by: req.user?.id }, 'AI provider key updated');
    res.json({ key: mapKey(result.rows[0]) });
  }),
);

adminAiRouter.delete(
  '/keys/:id',
  asyncHandler(async (req, res) => {
    const keyId = z.string().uuid().parse(req.params.id);
    const result = await pool.query('DELETE FROM ai_provider_keys WHERE id = $1', [keyId]);

    if (!result.rowCount) {
      throw AppError.notFound('Không tìm thấy API key');
    }

    logger.info({ keyId, by: req.user?.id }, 'AI provider key deleted');
    res.status(204).end();
  }),
);

/* ── Per-user quota override ───────────────────────────────────────────── */

adminAiRouter.patch(
  '/users/:userId/limit',
  asyncHandler(async (req, res) => {
    const userId = z.string().uuid().parse(req.params.userId);
    const { dailyLimit } = userLimitSchema.parse(req.body);

    const result = await pool.query<{ id: string; ai_daily_limit: number | null }>(
      `UPDATE users
          SET ai_daily_limit = $2
        WHERE id = $1 AND role = 'student'
        RETURNING id, ai_daily_limit`,
      [userId, dailyLimit],
    );

    if (!result.rows[0]) {
      throw AppError.notFound('Không tìm thấy sinh viên');
    }

    logger.info({ userId, dailyLimit, by: req.user?.id }, 'AI daily limit updated');
    res.json({ userId, dailyLimit: result.rows[0].ai_daily_limit });
  }),
);
