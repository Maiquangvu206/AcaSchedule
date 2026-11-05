import { pool } from '../../database/pool';
import type { UserRole } from '../../lib/tokens';

export interface UserRecord {
  id: string;
  email: string;
  full_name: string;
  password_hash: string;
  role: UserRole;
  is_active: boolean;
  must_change_password: boolean;
  created_at: Date;
}

export interface RefreshTokenRecord {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const result = await pool.query<UserRecord>(
    `SELECT id, email, full_name, password_hash, role, is_active, must_change_password, created_at
       FROM users
      WHERE email = $1`,
    [email],
  );
  return result.rows[0] ?? null;
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  const result = await pool.query<UserRecord>(
    `SELECT id, email, full_name, password_hash, role, is_active, must_change_password, created_at
       FROM users
      WHERE id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function createUser(input: {
  email: string;
  passwordHash: string;
  fullName: string;
  role: UserRole;
}): Promise<UserRecord> {
  const result = await pool.query<UserRecord>(
    `INSERT INTO users (email, password_hash, full_name, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, full_name, password_hash, role, is_active, must_change_password, created_at`,
    [input.email, input.passwordHash, input.fullName, input.role],
  );

  const user = result.rows[0];
  if (!user) {
    throw new Error('Failed to create user');
  }
  return user;
}

export async function storeRefreshToken(input: {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}): Promise<void> {
  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [input.userId, input.tokenHash, input.expiresAt],
  );
}

export async function findActiveRefreshToken(tokenHash: string): Promise<RefreshTokenRecord | null> {
  const result = await pool.query<RefreshTokenRecord>(
    `SELECT id, user_id, token_hash, expires_at, revoked_at
       FROM refresh_tokens
      WHERE token_hash = $1
        AND revoked_at IS NULL
        AND expires_at > now()`,
    [tokenHash],
  );
  return result.rows[0] ?? null;
}

export async function revokeRefreshToken(tokenHash: string): Promise<void> {
  await pool.query(
    `UPDATE refresh_tokens
        SET revoked_at = now()
      WHERE token_hash = $1
        AND revoked_at IS NULL`,
    [tokenHash],
  );
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  await pool.query(
    `UPDATE refresh_tokens
        SET revoked_at = now()
      WHERE user_id = $1
        AND revoked_at IS NULL`,
    [userId],
  );
}

/** Housekeeping for expired/revoked tokens (called by a future cron job). */
export async function deleteExpiredRefreshTokens(): Promise<number> {
  const result = await pool.query(
    `DELETE FROM refresh_tokens
      WHERE expires_at < now() - interval '30 days'
         OR revoked_at < now() - interval '30 days'`,
  );
  return result.rowCount ?? 0;
}
