import { getRedis } from './redis';

export interface QuotaResult {
  allowed: boolean;
  count: number;
  remaining: number;
  /** True when Redis is unavailable and the limit could not be enforced. */
  degraded: boolean;
}

/**
 * Fixed-window counter used for per-user AI quotas / rate limiting.
 * Returns allowed=false once `limit` is exceeded within `ttlSeconds`.
 */
export async function consumeQuota(
  key: string,
  limit: number,
  ttlSeconds: number,
): Promise<QuotaResult> {
  const redis = getRedis();

  if (!redis) {
    return { allowed: true, count: 0, remaining: limit, degraded: true };
  }

  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, ttlSeconds);
  }

  return {
    allowed: count <= limit,
    count,
    remaining: Math.max(0, limit - count),
    degraded: false,
  };
}
