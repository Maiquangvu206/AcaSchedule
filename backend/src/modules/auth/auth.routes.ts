import { Router } from 'express';
import { AppError, asyncHandler } from '../../lib/errors';
import { authenticate } from './auth.middleware';
import { changePasswordSchema, forgotPasswordSchema, loginSchema, logoutSchema, refreshSchema, registerSchema, resetPasswordSchema } from './auth.schemas';
import { pool } from '../../database/pool';
import { hashPassword, verifyPassword } from '../../lib/password';
import { isMailConfigured } from '../../lib/mail';
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
  // Without a configured mail provider we cannot deliver the confirmation code —
  // do not lock the user out. Ask them to contact an admin instead.
  if (!isMailConfigured()) {
    throw AppError.badRequest('Hệ thống chưa cấu hình máy chủ gửi thư. Vui lòng liên hệ quản trị viên để đặt lại mật khẩu.');
  }
  // Bước 1: chỉ sinh mã 6 số gửi qua email — KHÔNG đổi mật khẩu ở đây.
  // Email không tồn tại → response vẫn 204 (không tiết lộ tài khoản nào có thật).
  try {
    await authService.requestPasswordResetCode(email);
  } catch (sendError) {
    // Lỗi nhà cung cấp mail (hết quota, key sai…) → 503 rõ ràng thay vì 500 chung.
    throw AppError.serviceUnavailable(
      `Không gửi được email mã xác nhận: ${sendError instanceof Error ? sendError.message : String(sendError)}`,
    );
  }
  res.status(204).send();
}));

authRouter.post('/reset-password', authRateLimit, asyncHandler(async (req, res) => {
  const input = resetPasswordSchema.parse(req.body);
  // Bước 2: mã xác nhận (6 số) + mật khẩu mới → đổi mật khẩu, thu hồi mọi phiên.
  await authService.resetPasswordWithCode(input);
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
