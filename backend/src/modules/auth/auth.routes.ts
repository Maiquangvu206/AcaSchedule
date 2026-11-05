import { Router } from 'express';
import { asyncHandler } from '../../lib/errors';
import { authenticate } from './auth.middleware';
import { loginSchema, logoutSchema, refreshSchema, registerSchema } from './auth.schemas';
import * as authService from './auth.service';
import { authRateLimit } from '../../lib/rate-limit';

export const authRouter = Router();

authRouter.post(
  '/register',
  authRateLimit,
  asyncHandler(async (req, res) => {
    const input = registerSchema.parse(req.body);
    const result = await authService.register(input);
    res.status(201).json(result);
  }),
);

authRouter.post(
  '/login',
  authRateLimit,
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const result = await authService.login(input);
    res.json(result);
  }),
);

authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    const result = await authService.refresh(refreshToken);
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
