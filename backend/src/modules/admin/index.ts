import { Router } from 'express';
import { gradeScalesRouter } from './grade-scales.routes';
import { subjectsRouter } from './subjects.routes';
import { usersRouter } from './users.routes';
import { asyncHandler } from '../../lib/errors';
import { listAuditLogs } from './audit.repository';
import { statsRouter } from './stats.routes';
import { curriculumRouter } from './curriculum.routes';
import { adminScheduleRouter } from './schedule.routes';

/**
 * Admin module — grade scales, subject catalogue and user listing.
 * Authentication + `admin` role are enforced by the parent router in app.ts.
 */
export const adminRouter = Router();

adminRouter.use('/grade-scales', gradeScalesRouter);
adminRouter.use('/subjects', subjectsRouter);
adminRouter.use('/users', usersRouter);
adminRouter.use('/curriculum', curriculumRouter);
adminRouter.use('/schedule', adminScheduleRouter);
adminRouter.use('/stats', statsRouter);
adminRouter.get('/activity', asyncHandler(async (req, res) => {
  const limit = Number(req.query.limit ?? 100);
  res.json({ logs: await listAuditLogs(Number.isFinite(limit) ? limit : 100) });
}));

adminRouter.get('/', (_req, res) => {
  res.json({
    module: 'admin',
    endpoints: [
      '/api/admin/grade-scales',
      '/api/admin/subjects',
      '/api/admin/users',
      '/api/admin/activity',
    ],
  });
});
