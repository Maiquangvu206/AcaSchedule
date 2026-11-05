import { Router } from 'express';
import { pingDatabase } from '../../database/pool';

export const healthRouter = Router();

/** Liveness probe: does not touch dependencies. */
healthRouter.get('/live', (_req, res) => {
  res.json({ status: 'ok', service: 'acaschedule-api' });
});

/** Readiness probe: verifies the database connection. */
healthRouter.get('/', async (_req, res) => {
  const checks: Record<string, 'up' | 'down'> = { database: 'down' };

  try {
    await pingDatabase();
    checks.database = 'up';
  } catch {
    checks.database = 'down';
  }

  const healthy = Object.values(checks).every((value) => value === 'up');

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    service: 'acaschedule-api',
    version: '0.1.0',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    checks,
  });
});
