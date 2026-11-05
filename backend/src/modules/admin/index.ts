import { Router } from 'express';

/**
 * Admin module — grade scales, subject catalogue and user management.
 * TODO: implement CRUD with role-based authorization.
 */
export const adminRouter = Router();

adminRouter.get('/', (_req, res) => {
  res.status(501).json({
    module: 'admin',
    status: 'not-implemented',
    planned: ['/api/admin/grade-scales', '/api/admin/subjects', '/api/admin/users'],
  });
});
