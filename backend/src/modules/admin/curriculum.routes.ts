import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, AppError } from '../../lib/errors';
import { pool } from '../../database/pool';

const majorSchema = z.object({
  code: z.string().trim().min(1).max(30),
  name: z.string().trim().min(1).max(255),
  departmentId: z.string().uuid(),
});

const departmentSchema = z.object({
  code: z.string().trim().min(1).max(30),
  name: z.string().trim().min(1).max(255),
});

const assignmentSchema = z.object({
  subjectId: z.string().uuid(),
  isRequired: z.boolean().default(true),
  semesterNo: z.number().int().min(1).max(20).nullable().optional(),
});

export const curriculumRouter = Router();

curriculumRouter.get('/departments', asyncHandler(async (_req, res) => {
  const result = await pool.query(`
    SELECT d.id, d.code, d.name, count(m.id)::int AS "majorCount"
    FROM departments d
    LEFT JOIN majors m ON m.department_id = d.id
    GROUP BY d.id
    ORDER BY d.code
  `);
  res.json({ departments: result.rows });
}));

curriculumRouter.post('/departments', asyncHandler(async (req, res) => {
  const input = departmentSchema.parse(req.body);
  try {
    const result = await pool.query(
      'INSERT INTO departments (code, name) VALUES ($1, $2) RETURNING id, code, name',
      [input.code, input.name],
    );
    res.status(201).json({ department: { ...result.rows[0], majorCount: 0 } });
  } catch (error) {
    if ((error as { code?: string }).code === '23505') throw AppError.conflict('Mã khoa đã tồn tại');
    throw error;
  }
}));

curriculumRouter.get('/majors', asyncHandler(async (_req, res) => {
  const result = await pool.query(`
    SELECT m.id, m.code, m.name, m.department_id AS "departmentId",
           d.code AS "departmentCode", d.name AS "departmentName",
           count(cs.subject_id)::int AS "subjectCount"
    FROM majors m
    LEFT JOIN departments d ON d.id = m.department_id
    LEFT JOIN curriculum_subjects cs ON cs.major_id = m.id
    GROUP BY m.id, d.code, d.name
    ORDER BY m.code
  `);
  res.json({ majors: result.rows });
}));

curriculumRouter.post('/majors', asyncHandler(async (req, res) => {
  const input = majorSchema.parse(req.body);
  try {
    const result = await pool.query(
      'INSERT INTO majors (code, name, department_id) VALUES ($1, $2, $3) RETURNING id, code, name, department_id AS "departmentId"',
      [input.code, input.name, input.departmentId],
    );
    res.status(201).json({ major: { ...result.rows[0], subjectCount: 0, departmentCode: null, departmentName: null } });
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      throw AppError.conflict('Mã ngành đã tồn tại');
    }
    throw error;
  }
}));

curriculumRouter.patch('/majors/:majorId', asyncHandler(async (req, res) => {
  const input = majorSchema.partial().parse(req.body);
  if (!Object.keys(input).length) throw AppError.badRequest('Cần có thông tin cập nhật');
  try {
    const result = await pool.query(`
      UPDATE majors
      SET code = COALESCE($1, code),
          name = COALESCE($2, name),
          department_id = COALESCE($3, department_id),
          updated_at = now()
      WHERE id = $4
      RETURNING id, code, name, department_id AS "departmentId"
    `, [input.code ?? null, input.name ?? null, input.departmentId ?? null, req.params.majorId]);
    if (!result.rowCount) throw AppError.notFound('Không tìm thấy ngành');
    res.json({ major: { ...result.rows[0], subjectCount: 0, departmentCode: null, departmentName: null } });
  } catch (error) {
    if ((error as { code?: string }).code === '23505') throw AppError.conflict('Mã ngành đã tồn tại');
    throw error;
  }
}));

curriculumRouter.get('/majors/:majorId/subjects', asyncHandler(async (req, res) => {
  const result = await pool.query(`
    SELECT s.id, s.code, s.name, s.credits, s.knowledge_block AS "knowledgeBlock",
           s.managing_unit AS "managingUnit",
           cs.is_required AS "isRequired", cs.semester_no AS "semesterNo"
    FROM curriculum_subjects cs
    JOIN subjects s ON s.id = cs.subject_id
    WHERE cs.major_id = $1
    ORDER BY cs.semester_no NULLS LAST, s.code
  `, [req.params.majorId]);
  res.json({ subjects: result.rows });
}));

curriculumRouter.post('/majors/:majorId/subjects', asyncHandler(async (req, res) => {
  const input = assignmentSchema.parse(req.body);
  const result = await pool.query(`
    INSERT INTO curriculum_subjects (major_id, subject_id, is_required, semester_no)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (major_id, subject_id)
    DO UPDATE SET is_required = EXCLUDED.is_required, semester_no = EXCLUDED.semester_no
    RETURNING major_id AS "majorId", subject_id AS "subjectId", is_required AS "isRequired", semester_no AS "semesterNo"
  `, [req.params.majorId, input.subjectId, input.isRequired, input.semesterNo ?? null]);
  res.status(201).json({ assignment: result.rows[0] });
}));

curriculumRouter.get('/majors/:majorId/students', asyncHandler(async (req, res) => {
  const result = await pool.query(`
    SELECT u.id, u.email, u.full_name AS "fullName",
           um.is_primary AS "isPrimary"
    FROM user_majors um
    JOIN users u ON u.id = um.user_id
    WHERE um.major_id = $1 AND u.role = 'student'
    ORDER BY u.full_name
  `, [req.params.majorId]);
  res.json({ students: result.rows });
}));

curriculumRouter.post('/majors/:majorId/students', asyncHandler(async (req, res) => {
  const input = z.object({
    userId: z.string().uuid(),
    isPrimary: z.boolean().default(false),
  }).parse(req.body);
  const count = await pool.query<{ count: string }>(
    'SELECT count(*)::text AS count FROM user_majors WHERE user_id = $1 AND major_id <> $2',
    [input.userId, req.params.majorId],
  );
  if (Number(count.rows[0]?.count ?? 0) >= 2) {
    throw AppError.conflict('Mỗi sinh viên chỉ được gán tối đa hai ngành');
  }
  if (input.isPrimary) {
    await pool.query('UPDATE user_majors SET is_primary = false WHERE user_id = $1', [input.userId]);
  }
  const result = await pool.query(`
    INSERT INTO user_majors (user_id, major_id, is_primary)
    VALUES ($1, $2, $3)
    ON CONFLICT (user_id, major_id)
    DO UPDATE SET is_primary = EXCLUDED.is_primary
    RETURNING user_id AS "userId", major_id AS "majorId", is_primary AS "isPrimary"
  `, [input.userId, req.params.majorId, input.isPrimary]);
  res.status(201).json({ assignment: result.rows[0] });
}));

curriculumRouter.delete('/majors/:majorId/students/:userId', asyncHandler(async (req, res) => {
  await pool.query('DELETE FROM user_majors WHERE major_id = $1 AND user_id = $2', [
    req.params.majorId, req.params.userId,
  ]);
  res.status(204).send();
}));

curriculumRouter.delete('/majors/:majorId/subjects/:subjectId', asyncHandler(async (req, res) => {
  await pool.query('DELETE FROM curriculum_subjects WHERE major_id = $1 AND subject_id = $2', [
    req.params.majorId, req.params.subjectId,
  ]);
  res.status(204).send();
}));
