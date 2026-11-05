import { createApp } from './app';
import { env } from './config/env';
import { closeDatabase } from './database/pool';
import { ensureBucket } from './lib/minio';
import { logger } from './lib/logger';
import { closeRedis, connectRedis } from './lib/redis';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'AcaSchedule API listening');
});

/** Best-effort infrastructure init; failures degrade the service, they do not crash it. */
async function bootstrap(): Promise<void> {
  await connectRedis();

  try {
    await ensureBucket();
  } catch (error) {
    logger.warn({ err: error }, 'MinIO unavailable — document features will fail until it is up');
  }
}

void bootstrap();

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'shutting down gracefully');

  server.close(async () => {
    try {
      await Promise.allSettled([closeDatabase(), closeRedis()]);
      process.exit(0);
    } catch (error) {
      logger.error({ err: error }, 'error during shutdown');
      process.exit(1);
    }
  });

  // Force exit if connections do not drain in time.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'unhandled rejection');
});
