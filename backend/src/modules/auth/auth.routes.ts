import { Router } from 'express';
import { AppError, asyncHandler } from '../../lib/errors';
import { authenticate } from './auth.middleware';
import { changePasswordSchema, forgotPasswordSchema, loginSchema, logoutSchema, refreshSchema, registerSchema } from './auth.schemas';
import { pool } from '../../database/pool';
import { hashPassword, verifyPassword } from '../../lib/password';
import { sendTemporaryPasswordEmail } from '../../lib/mail';
import { randomBytes } from 'node:crypto';
import * as authService from './auth.service';
import { authRateLimit } from '../../lib/rate-limit';

export const authRouter = Router();

authRouter.post(
  '/register',
  authRateLimit,
  asyncHandler(async (req, res) => {
    const input = registerSchema.parse(req.body);
    const result = await authService.register(input);
    req.user = result.user;
    res.status(201).json(result);
  }),
);

authRouter.post('/forgot-password', authRateLimit, asyncHandler(async (req, res) => {
  const { email } = forgotPasswordSchema.parse(req.body);
  const result = await pool.query<{ id: string; email: string; full_name: string }>(
    'SELECT id, email, full_name FROM users WHERE email = $1 AND is_active = true',
    [email.trim().toLowerCase()],
  );
  if (result.rows[0]) {
    const password = randomBytes(12).toString('base64url');
    await pool.query('UPDATE users SET password_hash = $1, must_change_password = true, updated_at = now() WHERE id = $2', [
      await hashPassword(password),
      result.rows[0].id,
    ]);
    await sendTemporaryPasswordEmail({
      recipient: result.rows[0].email,
      fullName: result.rows[0].full_name,
      password,
      reset: true,
    });
  }
  res.status(204).send();
}));

authRouter.post(
  '/login',
  authRateLimit,
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const result = await authService.login(input);
    req.user = result.user;
    res.json(result);
  }),
);

authRouter.post(
  '/change-password',
  authenticate,
  asyncHandler(async (req, res) => {
    const input = changePasswordSchema.parse(req.body);
    const result = await pool.query<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE id = $1 AND is_active = true',
      [req.user!.id],
    );
    const user = result.rows[0];
    if (!user || !(await verifyPassword(input.currentPassword, user.password_hash))) {
      throw AppError.unauthorized('Mật khẩu hiện tại không đúng');
    }
    await pool.query(
      'UPDATE users SET password_hash = $1, must_change_password = false, updated_at = now() WHERE id = $2',
      [await hashPassword(input.newPassword), req.user!.id],
    );
    res.json({ user: await authService.getCurrentUser(req.user!.id) });
  }),
);

authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    const result = await authService.refresh(refreshToken);
    req.user = result.user;
    res.json(result);
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const { refreshToken } = logoutSchema.parse(req.body);
    await authService.logout(refreshToken);
    res.status(204).send();
  }),
);

authRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await authService.getCurrentUser(req.user!.id);
    res.json({ user });
  }),
);
