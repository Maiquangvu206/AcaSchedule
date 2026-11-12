import { randomInt } from 'node:crypto';
import { AppError } from '../../lib/errors';
import { pool } from '../../database/pool';
import { hashPassword, verifyPassword } from '../../lib/password';
import { hashToken } from '../../lib/token-hash';
import { sendPasswordResetCodeEmail } from '../../lib/mail';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  type TokenUser,
  type UserRole,
} from '../../lib/tokens';
import {
  bumpPasswordResetCodeAttempts,
  createPasswordResetCode,
  createUser,
  deleteUserPasswordResetCodes,
  findActiveRefreshToken,
  findLatestPasswordResetCode,
  findUserByEmail,
  findUserById,
  markPasswordResetCodeUsed,
  revokeAllUserTokens,
  revokePasswordResetCode,
  revokeRefreshToken,
  storeRefreshToken,
  type UserRecord,
} from './auth.repository';
import type { LoginInput, RegisterInput, ResetPasswordInput } from './auth.schemas';

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
  if (!user || !(await verifyPassword(input.password, user.password_hash))) {
    throw AppError.unauthorized('Email hoặc mật khẩu không đúng');
  }

  // Chỉ báo khóa khi mật khẩu ĐÚNG — người ngoài không dò được trạng thái
  // tài khoản, chỉ chủ tài khoản (biết mật khẩu) mới thấy thông báo khóa.
  if (!user.is_active) {
    throw AppError.forbidden('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên để mở khóa.');
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

/* ─────────── Quên mật khẩu bằng mã xác nhận (2 bước) ─────────── */

/** Thời hạn mã xác nhận quên mật khẩu (phút). */
export const PASSWORD_RESET_CODE_TTL_MINUTES = 15;
/** Nhập sai tối đa 5 lần thì mã bị thu hồi. */
export const PASSWORD_RESET_MAX_ATTEMPTS = 5;

/**
 * Bước 1 của luồng quên mật khẩu: sinh mã xác nhận 6 số gửi qua email.
 *
 * KHÔNG đổi mật khẩu ở bước này — ai đó biết email của bạn không thể làm
 * mất quyền truy cập tài khoản; chỉ người đọc được email mới đổi được.
 * Email không tồn tại → trả null, không tiết lộ sự tồn tại của tài khoản.
 */
export async function requestPasswordResetCode(email: string): Promise<string | null> {
  const user = await findUserByEmail(normalizeEmail(email));
  if (!user || !user.is_active) return null;

  // Mã 6 số an toàn về mặt mật mã học (randomInt, không phải Math.random).
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_CODE_TTL_MINUTES * 60_000);

  // Mã cũ (nếu còn) bị thay thế — luôn chỉ có 1 mã hiệu lực mỗi user.
  await deleteUserPasswordResetCodes(user.id);
  await createPasswordResetCode({ userId: user.id, codeHash: hashToken(code), expiresAt });

  await sendPasswordResetCodeEmail({
    recipient: user.email,
    fullName: user.full_name,
    code,
    expiresInMinutes: PASSWORD_RESET_CODE_TTL_MINUTES,
  });

  return code;
}

/**
 * Bước 2: đổi mật khẩu bằng mã xác nhận đã nhận qua email.
 *
 * - Mã sai / hết hạn / đã dùng → cùng một thông báo, không tiết lộ lý do.
 * - Nhập sai quá 5 lần → mã bị thu hồi, phải xin mã mới.
 * - Đổi thành công → thu hồi mọi phiên đăng nhập hiện có của tài khoản.
 */
export async function resetPasswordWithCode(input: ResetPasswordInput): Promise<void> {
  const user = await findUserByEmail(normalizeEmail(input.email));
  // Thông báo giống nhau để không dò được email nào có tài khoản.
  const genericError = () => AppError.badRequest('Mã xác nhận không đúng hoặc đã hết hạn. Vui lòng thử lại hoặc yêu cầu mã mới.');
  if (!user || !user.is_active) throw genericError();

  const record = await findLatestPasswordResetCode(user.id);
  if (!record) throw genericError();
  if (record.expires_at.getTime() <= Date.now()) {
    await revokePasswordResetCode(record.id);
    throw genericError();
  }
  if (record.attempts >= PASSWORD_RESET_MAX_ATTEMPTS) {
    await revokePasswordResetCode(record.id);
    throw genericError();
  }

  if (hashToken(input.code) !== record.code_hash) {
    const attempts = await bumpPasswordResetCodeAttempts(record.id);
    if (attempts >= PASSWORD_RESET_MAX_ATTEMPTS) {
      await revokePasswordResetCode(record.id);
    }
    throw genericError();
  }

  await pool.query(
    'UPDATE users SET password_hash = $1, must_change_password = false, updated_at = now() WHERE id = $2',
    [await hashPassword(input.newPassword), user.id],
  );
  await markPasswordResetCodeUsed(record.id);
  // Mật khẩu mới → mọi phiên đăng nhập cũ không còn an toàn, thu hồi hết.
  await revokeAllUserTokens(user.id);
}

export async function getCurrentUser(userId: string): Promise<PublicUser> {
  const user = await findUserById(userId);
  if (!user) {
    throw AppError.unauthorized('User no longer exists');
  }
  return toPublicUser(user);
}
