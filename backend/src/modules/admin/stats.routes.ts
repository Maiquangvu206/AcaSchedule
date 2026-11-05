import { Router } from 'express';
import { asyncHandler } from '../../lib/errors';
import { pool } from '../../database/pool';

export const statsRouter = Router();

statsRouter.get('/', asyncHandler(async (_req, res) => {
  const result = await pool.query<{ students: string; subjects: string; documents: string; accounts: string }>(
    `SELECT
       (SELECT count(*) FROM users WHERE role = 'student') AS students,
       (SELECT count(*) FROM subjects WHERE is_active = true) AS subjects,
       (SELECT count(*) FROM subject_documents) AS documents,
       (SELECT count(*) FROM users) AS accounts`,
  );
  const row = result.rows[0];
  res.json({
    students: Number(row.students),
    subjects: Number(row.subjects),
    documents: Number(row.documents),
    accounts: Number(row.accounts),
  });
}));
