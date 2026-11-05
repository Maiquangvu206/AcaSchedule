import { Router } from 'express';

/**
 * GPA/CPA engine — BR-RETENTION.
 *
 * Rules to implement:
 *  - Retake (F → Pass): keep the old F attempt, flip is_counted_in_cpa=false;
 *    count the newest passing attempt.
 *  - Improvement: count only the attempt with the highest 4-point grade;
 *    credits are counted once.
 *  - Weighted CPA = Σ(grade4 × credits) / Σ(credits) over counted attempts.
 */
export const gpaRouter = Router();

gpaRouter.get('/', (_req, res) => {
  res.status(501).json({
    module: 'gpa',
    status: 'not-implemented',
    planned: ['/api/gpa/calculate', '/api/gpa/forecast'],
  });
});
