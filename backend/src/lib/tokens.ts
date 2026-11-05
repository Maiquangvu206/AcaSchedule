import { randomUUID } from 'node:crypto';
import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from './errors';

export type UserRole = 'student' | 'admin';

export interface TokenUser {
  id: string;
  email: string;
  role: UserRole;
}

export interface AccessTokenPayload extends JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  type: 'access';
}

export interface RefreshTokenPayload extends JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  type: 'refresh';
  jti: string;
}

const COMMON_OPTIONS = {
  issuer: 'acaschedule',
  audience: 'acaschedule-web',
} satisfies SignOptions;

export function signAccessToken(user: TokenUser): string {
  return jwt.sign(
    { email: user.email, role: user.role, type: 'access' },
    env.JWT_ACCESS_SECRET,
    {
      ...COMMON_OPTIONS,
      subject: user.id,
      expiresIn: env.JWT_ACCESS_TTL as SignOptions['expiresIn'],
    },
  );
}

export function signRefreshToken(user: TokenUser): string {
  return jwt.sign(
    { email: user.email, role: user.role, type: 'refresh' },
    env.JWT_REFRESH_SECRET,
    {
      ...COMMON_OPTIONS,
      subject: user.id,
      jwtid: randomUUID(),
      expiresIn: env.JWT_REFRESH_TTL as SignOptions['expiresIn'],
    },
  );
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, COMMON_OPTIONS);
    if (typeof payload === 'string' || payload.type !== 'access') {
      throw new Error('Wrong token type');
    }
    return payload as AccessTokenPayload;
  } catch {
    throw AppError.unauthorized('Invalid or expired access token');
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    const payload = jwt.verify(token, env.JWT_REFRESH_SECRET, COMMON_OPTIONS);
    if (typeof payload === 'string' || payload.type !== 'refresh') {
      throw new Error('Wrong token type');
    }
    return payload as RefreshTokenPayload;
  } catch {
    throw AppError.unauthorized('Invalid or expired refresh token');
  }
}
