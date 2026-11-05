import { NextFunction, Request, Response } from 'express';
import { consumeQuota } from './quota';
import { AppError } from './errors';

/**
 * Middleware rate limiting cố định cửa sổ (fixed-window) dựa trên IP client.
 * Redis không khả dụng → cho qua (degraded) để không chặn luồng chính.
 */
export function rateLimit(
  keyPrefix: string,
  limit: number,
  ttlSeconds: number,
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const identifier =
      req.ip ??
      (req.headers['x-forwarded-for'] as string) ??
      'unknown';

    const quota = await consumeQuota(`${keyPrefix}:${identifier}`, limit, ttlSeconds);

    res.set('X-RateLimit-Limit', String(limit));
    res.set('X-RateLimit-Remaining', String(quota.remaining));

    if (!quota.allowed) {
      throw new AppError(
        429,
        'TooManyRequests',
        'Quá nhiều yêu cầu. Vui lòng thử lại sau.',
        { remaining: quota.remaining, retryAfter: quota.remaining > 0 ? 0 : ttlSeconds },
      );
    }

    next();
  };
}
