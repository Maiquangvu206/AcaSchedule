import { AppError } from '../../lib/errors';
import { hashPassword, verifyPassword } from '../../lib/password';
import { hashToken } from '../../lib/token-hash';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  type TokenUser,
  type UserRole,
} from '../../lib/tokens';
import {
  createUser,
  findActiveRefreshToken,
  findUserByEmail,
  findUserById,
  revokeRefreshToken,
  storeRefreshToken,
  type UserRecord,
} from './auth.repository';
import type { LoginInput, RegisterInput } from './auth.schemas';

export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  createdAt: string;
  mustChangePassword: boolean;
}

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
    createdAt: user.created_at.toISOString(),
    mustChangePassword: user.must_change_password,
  };
}

function toTokenUser(user: UserRecord): TokenUser {
  return { id: user.id, email: user.email, role: user.role };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function issueTokens(user: UserRecord): Promise<{ accessToken: string; refreshToken: string }> {
  const tokenUser = toTokenUser(user);
  const accessToken = signAccessToken(tokenUser);
  const refreshToken = signRefreshToken(tokenUser);
  const decoded = verifyRefreshToken(refreshToken);

  await storeRefreshToken({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date((decoded.exp ?? 0) * 1000),
  });

  return { accessToken, refreshToken };
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const email = normalizeEmail(input.email);
  const existing = await findUserByEmail(email);

  if (existing) {
    throw AppError.conflict('Email is already registered');
  }

  const user = await createUser({
    email,
    passwordHash: await hashPassword(input.password),
    fullName: input.fullName.trim(),
    role: 'student',
  });

  const tokens = await issueTokens(user);
  return { user: toPublicUser(user), ...tokens };
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const email = normalizeEmail(input.email);
  const user = await findUserByEmail(email);

  // Same message for unknown email and wrong password to avoid user enumeration.
  if (!user || !user.is_active || !(await verifyPassword(input.password, user.password_hash))) {
    throw AppError.unauthorized('Email hoặc mật khẩu không đúng');
  }

  const tokens = await issueTokens(user);
  return { user: toPublicUser(user), ...tokens };
}

export async function refresh(refreshToken: string): Promise<AuthResult> {
  verifyRefreshToken(refreshToken);

  const tokenHash = hashToken(refreshToken);
  const stored = await findActiveRefreshToken(tokenHash);

  if (!stored) {
    throw AppError.unauthorized('Refresh token has been revoked or expired');
  }

  const user = await findUserById(stored.user_id);
  if (!user || !user.is_active) {
    throw AppError.unauthorized('User no longer exists');
  }

  // Rotate: the old token can never be used again.
  await revokeRefreshToken(tokenHash);
  const tokens = await issueTokens(user);

  return { user: toPublicUser(user), ...tokens };
}

export async function logout(refreshToken: string): Promise<void> {
  // Do not fail on malformed/expired tokens: logout is idempotent.
  await revokeRefreshToken(hashToken(refreshToken));
}

export async function getCurrentUser(userId: string): Promise<PublicUser> {
  const user = await findUserById(userId);
  if (!user) {
    throw AppError.unauthorized('User no longer exists');
  }
  return toPublicUser(user);
}
