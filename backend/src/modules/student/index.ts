import { Router } from 'express';

/**
 * Student module — profile, enrollments and transcript.
 * TODO: implement enrollments CRUD scoped to the authenticated student.
 */
export const studentRouter = Router();

studentRouter.get('/', (_req, res) => {
  res.status(501).json({
    module: 'student',
    status: 'not-implemented',
    planned: ['/api/student/enrollments', '/api/student/transcript'],
  });
});
