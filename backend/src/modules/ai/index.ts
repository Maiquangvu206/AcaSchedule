import { Router, Request } from 'express';
import { env } from '../../config/env';
import { asyncHandler, AppError } from '../../lib/errors';
import { getCalculation } from '../gpa/gpa.service';
import { consumeQuota } from '../../lib/quota';
import { getRedis } from '../../lib/redis';
import { redactPii } from '../../lib/pii';
import { logger } from '../../lib/logger';
import { createHash } from 'node:crypto';

/**
 * AI Advisor — proxy to the dedicated Python AI service (`ai/`).
 *
 * The `/advice` endpoint no longer trusts the client for grade data: it loads the
 * authenticated student's transcript from PostgreSQL, redacts PII, enforces a
 * per-user quota and caches answers in Redis before forwarding to the AI service.
 * Other routes (`/documents/summarize`, `/qa`) pass through with PII redaction and
 * sanitized logging.
 */
export const aiRouter = Router();

const upstreamBase = () => env.AI_SERVICE_URL.replace(/\/+$/, '');
const CACHE_TTL_SECONDS = 10 * 60; // 10 minutes
const QUOTA_LIMIT = 20;            // requests per window
const QUOTA_TTL_SECONDS = 60 * 60; // 1 hour

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

/**
 * POST /api/ai/advice
 *
 * Builds the advice request from the authenticated student's real transcript so the
 * client cannot forge grades. Applies PII redaction, per-user quota and Redis cache.
 */
aiRouter.post(
  '/advice',
  asyncHandler(async (req, res) => {
    const studentId = req.user!.id;
    const { targetCpa, question } = (req.body ?? {}) as {
      targetCpa?: number;
      question?: string;
    };

    // Quota check (degrades to allow when Redis is down).
    const quota = await consumeQuota(`ai:advice:${studentId}`, QUOTA_LIMIT, QUOTA_TTL_SECONDS);
    if (!quota.allowed) {
      throw new AppError(
        429,
        'TooManyRequests',
        `Đã đạt giới hạn ${QUOTA_LIMIT} lần tư vấn AI mỗi giờ. Vui lòng thử lại sau.`,
        { remaining: quota.remaining },
      );
    }

    // Load real transcript data from PostgreSQL.
    const calculation = await getCalculation(studentId);

    const grades = calculation.subjects.map((subject) => ({
      subject: subject.subjectName || subject.subjectCode,
      credits: subject.credits,
      grade4: subject.countedGrade4 ?? 0,
      is_counted_in_cpa: subject.countedAttemptId !== null,
    }));

    const safeQuestion = question ? redactPii(question) : undefined;

    const cacheKey = `ai:advice:${sha256(
      `${studentId}|${stableGradesKey(grades)}|${targetCpa ?? ''}|${safeQuestion ?? ''}`,
    )}`;

    const cached = await getCached<{ advice: string; model: string; used_fallback: boolean }>(
      cacheKey,
    );
    if (cached) {
      logger.info({ studentId, cached: true }, 'AI advice served from cache');
      res.json({ advice: cached.advice, model: cached.model, used_fallback: cached.used_fallback });
      return;
    }

    const body = {
      target_cpa: targetCpa ?? null,
      grades,
      question: safeQuestion,
    };

    // Log only metadata — never raw question or grades (PII).
    logger.info(
      { studentId, gradesCount: grades.length, hasQuestion: Boolean(safeQuestion) },
      'Requesting AI advice',
    );

    const upstream = await proxyToAi('/advice', body);
    const bodyText = await upstream.text();
    let parsed: { advice?: string; model?: string; used_fallback?: boolean };
    try {
      parsed = bodyText ? JSON.parse(bodyText) : {};
    } catch {
      parsed = {};
    }

    const result = {
      advice: redactPii(parsed.advice ?? ''),
      model: parsed.model ?? 'fallback',
      used_fallback: parsed.used_fallback ?? true,
    };

    await setCached(cacheKey, result);

    res.status(upstream.status).type('application/json').json(result);
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
    const body = req.body as { text?: string };
    const safeBody = { ...body, text: redactPii(body.text ?? '') };
    logger.info({ path: '/documents/summarize' }, 'Summarize request (text redacted)');
    const upstream = await proxyToAi('/documents/summarize', safeBody);
    const bodyText = await upstream.text();
    res.status(upstream.status).type('application/json').send(bodyText);
  }),
);

aiRouter.post(
  '/qa',
  asyncHandler(async (req, res) => {
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
    res.status(upstream.status).type('application/json').send(bodyText);
  }),
);
