import { Router } from 'express';
import { env } from '../../config/env';
import { pool } from '../../database/pool';
import { asyncHandler, AppError } from '../../lib/errors';
import { getCalculation } from '../gpa/gpa.service';
import { listGradeScales } from '../gpa/gpa.repository';
import { getRedis } from '../../lib/redis';
import { redactPii } from '../../lib/pii';
import { logger } from '../../lib/logger';
import { createHash } from 'node:crypto';

/**
 * AI Advisor — proxy to the dedicated Python AI service (`ai/`).
 *
 * The `/advice` endpoint no longer trusts the client for grade data: it loads the
 * authenticated student's transcript from PostgreSQL, redacts PII, and caches
 * answers in Redis before forwarding to the AI service. Every request is logged
 * in `ai_usage_logs` and checked against the admin-configured daily quota.
 * Other routes (`/documents/summarize`, `/qa`) pass through with PII redaction and
 * sanitized logging.
 */
export const aiRouter = Router();

const upstreamBase = () => env.AI_SERVICE_URL.replace(/\/+$/, '');
const CACHE_TTL_SECONDS = 10 * 60; // 10 minutes
const CACHE_VERSION = 'v5';
/** Delay before a single retry when the AI upstream reports 429/503. */
const AI_RETRY_DELAY_MS = 1500;
/** Start of "today" in Vietnam time (quotas reset at local midnight). */
const VN_DAY_START =
  "(date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh')";

interface AiUsageEvent {
  userId: string;
  endpoint: string;
  provider: string;
  usedFallback: boolean;
  latencyMs: number;
  statusCode: number | null;
}

/**
 * Persist one AI request for the admin dashboard. Best-effort: a logging
 * failure (e.g. 024 not migrated yet) must never break the student's request.
 */
async function recordAiUsage(event: AiUsageEvent): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO ai_usage_logs
         (user_id, endpoint, provider, used_fallback, latency_ms, status_code)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        event.userId,
        event.endpoint,
        event.provider,
        event.usedFallback,
        event.latencyMs,
        event.statusCode,
      ],
    );
  } catch (error) {
    logger.warn({ err: error, endpoint: event.endpoint }, 'Failed to record AI usage');
  }
}

/**
 * Reject when the admin disabled the AI or the student exhausted today's quota.
 * Fails open when the schema is missing or the database is unreachable so an
 * unmigrated environment keeps working exactly as before.
 */
async function assertAiAllowed(userId: string): Promise<void> {
  try {
    const result = await pool.query<{
      is_enabled: boolean;
      daily_limit_per_user: number;
      user_limit: number | null;
    }>(
      `SELECT s.is_enabled, s.daily_limit_per_user, u.ai_daily_limit AS user_limit
         FROM ai_settings s
         JOIN users u ON u.id = $1
        WHERE s.id = 1`,
      [userId],
    );

    const row = result.rows[0];
    if (!row) return;
    if (!row.is_enabled) {
      throw new AppError(
        503,
        'AIDisabled',
        'Trợ lý AI đang tạm tắt để bảo trì. Vui lòng quay lại sau.',
      );
    }

    const limit = row.user_limit ?? row.daily_limit_per_user;
    if (limit <= 0) return;

    const counted = await pool.query<{ total: number }>(
      `SELECT count(*)::int AS total
         FROM ai_usage_logs
        WHERE user_id = $1 AND created_at >= ${VN_DAY_START}`,
      [userId],
    );

    if ((counted.rows[0]?.total ?? 0) >= limit) {
      throw new AppError(
        429,
        'AIQuotaExceeded',
        `Bạn đã dùng hết ${limit} lượt trợ lý AI hôm nay. Hạn mức sẽ được đặt lại vào 0 giờ ngày mai.`,
      );
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.warn({ err: error, userId }, 'AI quota check skipped (database unavailable)');
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function stableGradesKey(grades: unknown[]): string {
  return JSON.stringify(
    grades.map((g) => ({
      subject: (g as { subject?: string }).subject,
      credits: (g as { credits?: number }).credits,
      grade4: (g as { grade4?: number }).grade4,
      is_counted_in_cpa: (g as { is_counted_in_cpa?: boolean }).is_counted_in_cpa,
    })),
  );
}

/** Proxy a JSON body to the AI service and relay the raw response. */
async function proxyToAi(path: string, body: unknown): Promise<Response> {
  try {
    return await fetch(`${upstreamBase()}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
  } catch (error) {
    logger.error({ err: error, path }, 'AI service request failed');
    throw new AppError(502, 'AIUnavailable', 'Dịch vụ AI không khả dụng. Vui lòng thử lại sau.');
  }
}

/** Cache GET/POST AI answers keyed by a stable hash of the request identity. */
async function getCached<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const raw = await redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function setCached<T>(key: string, value: T): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.setEx(key, CACHE_TTL_SECONDS, JSON.stringify(value));
  } catch {
    // Best-effort cache: continue without caching.
  }
}

/** Read the provider that answered from a raw AI service JSON payload. */
function providerFromBody(bodyText: string): { provider: string; usedFallback: boolean } {
  try {
    const parsed = JSON.parse(bodyText) as { model?: string; used_fallback?: boolean };
    return {
      provider: parsed.model ?? 'fallback',
      usedFallback: parsed.used_fallback ?? true,
    };
  } catch {
    return { provider: 'fallback', usedFallback: true };
  }
}

/**
 * POST /api/ai/advice
 *
 * Builds the advice request from the authenticated student's real transcript so the
 * client cannot forge grades. Applies PII redaction, Redis cache, daily quota and
 * usage logging.
 */
aiRouter.post(
  '/advice',
  asyncHandler(async (req, res) => {
    const studentId = req.user!.id;
    const { targetCpa, question } = (req.body ?? {}) as {
      targetCpa?: number;
      question?: string;
    };

    await assertAiAllowed(studentId);

    const startedAt = Date.now();
    let provider = 'none';
    let usedFallback = true;

    try {
      // Load real transcript data from PostgreSQL.
      const calculation = await getCalculation(studentId);
      // The admin-managed grading scale (score 10 → letter → GPA4) must be part
      // of the prompt, otherwise the model invents thresholds that disagree
      // with the transcript page.
      const gradeScale = await listGradeScales();

      const grades = calculation.subjects.map((subject) => {
        const counted = subject.attempts.find((attempt) => attempt.id === subject.countedAttemptId);
        return {
          subject: subject.subjectName || subject.subjectCode,
          credits: subject.credits,
          grade4: subject.countedGrade4 ?? 0,
          score10: counted?.totalScore10 ?? null,
          letter: counted?.letterGrade ?? null,
          is_counted_in_cpa: subject.countedAttemptId !== null,
        };
      });

      // Số liệu tổng hợp gửi thẳng cho AI để câu trả lời khớp với
      // trang bảng điểm (AI không tự tính lại từ danh sách môn).
      const summary = {
        cpa: calculation.cpa,
        credits_counted: calculation.creditsAttempted,
        credits_earned: calculation.creditsEarned,
        credits_studied: calculation.creditsStudied,
        counted_subjects: calculation.countedSubjects,
        total_attempts: calculation.totalAttempts,
      };

      const safeQuestion = question ? redactPii(question) : undefined;

      const cacheKey = `ai:advice:${sha256(
        `${CACHE_VERSION}|${studentId}|${stableGradesKey(grades)}|${summary.cpa}|${summary.credits_earned}|${targetCpa ?? ''}|${safeQuestion ?? ''}`,
      )}`;

      const cached = await getCached<{ advice: string; model: string; used_fallback: boolean }>(
        cacheKey,
      );
      if (cached) {
        logger.info({ studentId, cached: true }, 'AI advice served from cache');
        provider = 'cache';
        usedFallback = false;
        res.json({
          advice: cached.advice,
          model: cached.model,
          used_fallback: cached.used_fallback,
        });
        return;
      }

      const body = {
        target_cpa: targetCpa ?? null,
        grades,
        summary,
        grade_scale: gradeScale,
        question: safeQuestion,
      };

      // Log only metadata — never raw question or grades (PII).
      logger.info(
        { studentId, gradesCount: grades.length, hasQuestion: Boolean(safeQuestion) },
        'Requesting AI advice',
      );

      let upstream = await proxyToAi('/advice', body);

      // Gemini free-tier quota (429) and cold starts (503) are transient:
      // give the AI service one more chance before degrading.
      if (upstream.status === 429 || upstream.status === 503) {
        logger.warn(
          { studentId, status: upstream.status },
          'AI upstream busy, retrying once',
        );
        await new Promise((resolve) => setTimeout(resolve, AI_RETRY_DELAY_MS));
        upstream = await proxyToAi('/advice', body);
      }

      if (!upstream.ok) {
        // Never leak a raw 429 (Gemini quota) to the browser: the UI would show
        // "Yeu cau that bai (HTTP 429)" with no explanation.
        logger.error(
          { studentId, status: upstream.status },
          'AI service failed after retry',
        );
        res.set('Retry-After', '60');
        res.status(503).json({
          error: 'AIUnavailable',
          message:
            'Trợ lý AI đang tạm quá tải hoặc đã hết hạn mức gọi Gemini. ' +
            'Vui lòng thử lại sau 1–2 phút.',
        });
        return;
      }

      const bodyText = await upstream.text();
      let parsed: { advice?: string; model?: string; used_fallback?: boolean };
      try {
        parsed = bodyText ? JSON.parse(bodyText) : {};
      } catch {
        parsed = {};
      }

      const result = {
        advice: parsed.advice ?? '',
        model: parsed.model ?? 'fallback',
        used_fallback: parsed.used_fallback ?? true,
      };

      provider = result.model;
      usedFallback = result.used_fallback;

      if (!result.advice.trim()) {
        res.set('Retry-After', '60');
        res.status(503).json({
          error: 'AIUnavailable',
          message: 'Trợ lý AI chưa trả về nội dung. Vui lòng thử lại sau ít phút.',
        });
        return;
      }

      if (!result.used_fallback) {
        await setCached(cacheKey, result);
      }

      res.status(200).type('application/json').json(result);
    } finally {
      void recordAiUsage({
        userId: studentId,
        endpoint: '/advice',
        provider,
        usedFallback,
        latencyMs: Date.now() - startedAt,
        statusCode: res.statusCode,
      });
    }
  }),
);

aiRouter.get(
  '/status',
  asyncHandler(async (_req, res) => {
    try {
      const upstream = await fetch(`${upstreamBase()}/health`, {
        headers: { Accept: 'application/json' },
      });
      const body = await upstream.text();
      res.status(upstream.status).type('application/json').send(body);
    } catch {
      res.status(502).json({ error: 'AIUnavailable', status: 'down' });
    }
  }),
);

aiRouter.post(
  '/documents/summarize',
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    await assertAiAllowed(userId);

    const startedAt = Date.now();
    let provider = 'none';
    let usedFallback = true;

    try {
      const body = req.body as { text?: string };
      const safeBody = { ...body, text: redactPii(body.text ?? '') };
      logger.info({ path: '/documents/summarize' }, 'Summarize request (text redacted)');
      const upstream = await proxyToAi('/documents/summarize', safeBody);
      const bodyText = await upstream.text();
      ({ provider, usedFallback } = providerFromBody(bodyText));
      res.status(upstream.status).type('application/json').send(bodyText);
    } finally {
      void recordAiUsage({
        userId,
        endpoint: '/documents/summarize',
        provider,
        usedFallback,
        latencyMs: Date.now() - startedAt,
        statusCode: res.statusCode,
      });
    }
  }),
);

aiRouter.post(
  '/qa',
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    await assertAiAllowed(userId);

    const startedAt = Date.now();
    let provider = 'none';
    let usedFallback = true;

    try {
      const body = req.body as {
        question?: string;
        documents?: Array<{ title?: string; text?: string }>;
      };
      const safeBody = {
        ...body,
        question: redactPii(body.question ?? ''),
        documents: (body.documents ?? []).map((doc) => ({
          ...doc,
          text: redactPii(doc.text ?? ''),
          title: redactPii(doc.title ?? ''),
        })),
      };
      logger.info({ path: '/qa' }, 'QA request (text redacted)');
      const upstream = await proxyToAi('/qa', safeBody);
      const bodyText = await upstream.text();
      ({ provider, usedFallback } = providerFromBody(bodyText));
      res.status(upstream.status).type('application/json').send(bodyText);
    } finally {
      void recordAiUsage({
        userId,
        endpoint: '/qa',
        provider,
        usedFallback,
        latencyMs: Date.now() - startedAt,
        statusCode: res.statusCode,
      });
    }
  }),
);
