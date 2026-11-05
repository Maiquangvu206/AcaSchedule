import { createClient } from 'redis';
import { env } from '../config/env';
import { logger } from './logger';

export type RedisClient = ReturnType<typeof createClient>;

let client: RedisClient | null = null;

/**
 * Connect once at boot. Redis is optional: if unavailable the API keeps running
 * in degraded mode (quota helpers become no-ops) instead of crash-looping.
 */
export async function connectRedis(): Promise<void> {
  const candidate = createClient({
    url: env.REDIS_URL,
    socket: {
      reconnectStrategy: (retries) => (retries < 3 ? 500 : false),
    },
  });

  candidate.on('error', (error) => {
    logger.warn({ err: error }, 'Redis error');
  });

  try {
    await candidate.connect();
    client = candidate;
    logger.info('Redis connected');
  } catch (error) {
    logger.warn({ err: error }, 'Redis unavailable — continuing without cache/quota');
    try {
      await candidate.disconnect();
    } catch {
      // Already closed.
    }
  }
}

export function getRedis(): RedisClient | null {
  return client;
}

export function isRedisReady(): boolean {
  return client?.isReady ?? false;
}

export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}
