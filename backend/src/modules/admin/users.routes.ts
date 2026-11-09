import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../../database/pool';
import { AppError, asyncHandler } from '../../lib/errors';
import { hashPassword } from '../../lib/password';
import { sendTemporaryPasswordEmail } from '../../lib/mail';
import { randomBytes } from 'node:crypto';

export const usersRouter = Router();

const userSchema = z.object({
  email: z.string().email().max(255),
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(30).nullable().optional(),
  studentCode: z.string().trim().max(30).nullable().optional(),
  role: z.enum(['student', 'admin']).default('student'),
});

const updateUserSchema = userSchema.omit({ role: true }).partial().refine(
  (value) => Object.keys(value).length > 0,
  'Cần có ít nhất một thông tin để cập nhật',
);

function generateTemporaryPassword(): string {
  return randomBytes(12).toString('base64url');
}

usersRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const result = await pool.query<{
      id: string;
      email: string;
      full_name: string;
      phone: string | null;
      student_code: string | null;
      role: string;
      is_active: boolean;
      created_at: Date;
      majors: Array<{ id: string; code: string; name: string; departmentName: string | null; isPrimary: boolean }>;
    }>(
      `SELECT u.id, u.email, u.full_name, u.phone, u.student_code, u.role, u.is_active, u.created_at,
         COALESCE(json_agg(json_build_object(
           'id', m.id, 'code', m.code, 'name', m.name,
           'departmentName', d.name, 'isPrimary', um.is_primary
         ) ORDER BY um.is_primary DESC, m.code) FILTER (WHERE m.id IS NOT NULL), '[]') AS majors
         FROM users
         u LEFT JOIN user_majors um ON um.user_id = u.id
         LEFT JOIN majors m ON m.id = um.major_id
         LEFT JOIN departments d ON d.id = m.department_id
        GROUP BY u.id
        ORDER BY created_at DESC`,
    );

    res.json({
      users: result.rows.map((row) => ({
        id: row.id,
        email: row.email,
        fullName: row.full_name,
        phone: row.phone,
        studentCode: row.student_code,
        role: row.role,
        isActive: row.is_active,
        createdAt: row.created_at.toISOString(),
        majors: row.majors,
      })),
    });
  }),
);

usersRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = userSchema.parse(req.body);
    const password = generateTemporaryPassword();
    let row;
    try {
      const result = await pool.query(
        `INSERT INTO users (email, password_hash, full_name, phone, student_code, role, must_change_password)
         VALUES ($1, $2, $3, $4, $5, $6, true)
         RETURNING id, email, full_name, phone, student_code, role, is_active, created_at`,
        [input.email, await hashPassword(password), input.fullName, input.phone || null, input.studentCode || null, input.role],
      );
      row = result.rows[0];
    } catch (error) {
      if ((error as { code?: string }).code === '23505') throw AppError.conflict('Email hoặc mã sinh viên đã tồn tại');
      throw error;
    }
    // Email is best-effort: when SMTP is not configured (or sending fails) we keep the
    // account and hand the temporary password back to the admin so they can share it
    // through another channel instead of losing the account entirely.
    let emailSent = false;
    try {
      await sendTemporaryPasswordEmail({ recipient: row.email, fullName: row.full_name, password, reset: false });
      emailSent = true;
    } catch {
      // best-effort email: keep the account, return password to admin instead
    }
    res.status(201).json({
      user: { id: row.id, email: row.email, fullName: row.full_name, phone: row.phone, studentCode: row.student_code, role: row.role, isActive: row.is_active, createdAt: row.created_at.toISOString(), majors: [] },
      temporaryPassword: emailSent ? null : password,
      emailSent,
    });
  }),
);

usersRouter.patch(
  '/:userId',
  asyncHandler(async (req, res) => {
    const input = updateUserSchema.parse(req.body);
    const result = await pool.query(
      `UPDATE users
          SET email = COALESCE($1, email), full_name = COALESCE($2, full_name),
              phone = COALESCE($3, phone), student_code = COALESCE($4, student_code),
              updated_at = now()
        WHERE id = $5
        RETURNING id, email, full_name, phone, student_code, role, is_active, created_at`,
      [input.email ?? null, input.fullName ?? null, input.phone ?? null, input.studentCode ?? null, req.params.userId],
    );
    if (!result.rowCount) throw AppError.notFound('Không tìm thấy tài khoản');
    const row = result.rows[0];
    res.json({ user: { id: row.id, email: row.email, fullName: row.full_name, phone: row.phone, studentCode: row.student_code, role: row.role, isActive: row.is_active, createdAt: row.created_at.toISOString() } });
  }),
);

usersRouter.patch(
  '/:userId/status',
  asyncHandler(async (req, res) => {
    const input = z.object({ isActive: z.boolean() }).parse(req.body);
    const result = await pool.query(
      'UPDATE users SET is_active = $1, updated_at = now() WHERE id = $2 RETURNING is_active',
      [input.isActive, req.params.userId],
    );
    if (!result.rowCount) throw AppError.notFound('Không tìm thấy tài khoản');
    res.json({ isActive: result.rows[0].is_active });
  }),
);

usersRouter.delete(
  '/:userId',
  asyncHandler(async (req, res) => {
    const result = await pool.query('DELETE FROM users WHERE id = $1 AND role = $2', [req.params.userId, 'student']);
    if (!result.rowCount) throw AppError.notFound('Không tìm thấy tài khoản sinh viên');
    res.status(204).send();
  }),
);

usersRouter.post(
  '/:userId/reset-password',
  asyncHandler(async (req, res) => {
    const password = generateTemporaryPassword();
    const result = await pool.query(
      'UPDATE users SET password_hash = $1, must_change_password = true, updated_at = now() WHERE id = $2 RETURNING email, full_name',
      [await hashPassword(password), req.params.userId],
    );
    if (!result.rowCount) throw AppError.notFound('Không tìm thấy tài khoản');
    let emailSent = false;
    try {
      await sendTemporaryPasswordEmail({ recipient: result.rows[0].email, fullName: result.rows[0].full_name, password, reset: true });
      emailSent = true;
    } catch {
      // best-effort email: keep the new password, return it to admin instead
    }
    res.json({ temporaryPassword: emailSent ? null : password, emailSent });
  }),
);
