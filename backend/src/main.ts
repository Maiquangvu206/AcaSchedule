import { createApp } from './app';
import { env } from './config/env';
import { closeDatabase } from './database/pool';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`🚀 AcaSchedule API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n${signal} received — shutting down gracefully...`);

  server.close(async () => {
    try {
      await closeDatabase();
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown', error);
      process.exit(1);
    }
  });

  // Force exit if connections do not drain in time.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection', reason);
});
