import { NextFunction, Request, Response } from 'express';
import { AppError } from '../../lib/errors';
import { verifyAccessToken, type UserRole } from '../../lib/tokens';

/** Require a valid Bearer access token and attach the user to the request. */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.header('authorization');

  if (!header?.startsWith('Bearer ')) {
    next(AppError.unauthorized('Missing access token'));
    return;
  }

  const token = header.slice('Bearer '.length).trim();

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
    next();
  } catch (error) {
    next(error);
  }
}

/** Require one of the given roles. Must run after `authenticate`. */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(AppError.unauthorized());
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(AppError.forbidden());
      return;
    }

    next();
  };
}
