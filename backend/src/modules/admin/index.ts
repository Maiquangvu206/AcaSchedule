import { Router } from 'express';
import { gradeScalesRouter } from './grade-scales.routes';
import { subjectsRouter } from './subjects.routes';
import { usersRouter } from './users.routes';

/**
 * Admin module — grade scales, subject catalogue and user listing.
 * Authentication + `admin` role are enforced by the parent router in app.ts.
 */
export const adminRouter = Router();

adminRouter.use('/grade-scales', gradeScalesRouter);
adminRouter.use('/subjects', subjectsRouter);
adminRouter.use('/users', usersRouter);

adminRouter.get('/', (_req, res) => {
  res.json({
    module: 'admin',
    endpoints: [
      '/api/admin/grade-scales',
      '/api/admin/subjects',
      '/api/admin/users',
    ],
  });
});
