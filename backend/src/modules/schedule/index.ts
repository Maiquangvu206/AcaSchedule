import { Router } from 'express';

/**
 * Schedule module — registration simulator and conflict detection engine.
 * TODO: detect overlapping day/period ranges between selected sections.
 */
export const scheduleRouter = Router();

scheduleRouter.get('/', (_req, res) => {
  res.status(501).json({
    module: 'schedule',
    status: 'not-implemented',
    planned: ['/api/schedule/items', '/api/schedule/simulate'],
  });
});
