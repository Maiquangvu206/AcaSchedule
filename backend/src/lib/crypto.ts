import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

/**
 * Symmetric encryption for third-party API keys stored in PostgreSQL.
 *
 * Keys are encrypted with AES-256-GCM using a secret derived from
 * `AI_KEYS_SECRET` (scrypt). The ciphertext is self-describing:
 *
 *     v1:<iv base64url>:<auth tag base64url>:<cipher base64url>
 *
 * `AI_KEYS_SECRET` never leaves the backend (Render Environment). Even if the
 * database dump leaks, stored keys cannot be decrypted without it.
 */

const VERSION = 'v1';
const SALT = 'acaschedule/ai-provider-keys/v1';
const MIN_SECRET_LENGTH = 16;

/** True when AI_KEYS_SECRET is long enough to derive a key. */
export function isKeyEncryptionConfigured(secret: string | undefined | null): boolean {
  return typeof secret === 'string' && secret.trim().length >= MIN_SECRET_LENGTH;
}

function deriveKey(secret: string): Buffer {
  if (!isKeyEncryptionConfigured(secret)) {
    throw new Error(
      `AI_KEYS_SECRET is missing or shorter than ${MIN_SECRET_LENGTH} characters`,
    );
  }
  return scryptSync(secret.trim(), SALT, 32);
}

export function encryptSecret(plainText: string, secret: string): string {
  const key = deriveKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const cipherText = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString('base64url'),
    tag.toString('base64url'),
    cipherText.toString('base64url'),
  ].join(':');
}

export function decryptSecret(payload: string, secret: string): string {
  const parts = payload.split(':');
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('Unsupported secret payload format');
  }

  const key = deriveKey(secret);
  const iv = Buffer.from(parts[1], 'base64url');
  const tag = Buffer.from(parts[2], 'base64url');
  const cipherText = Buffer.from(parts[3], 'base64url');

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(cipherText), decipher.final()]).toString('utf8');
}

/** Last 4 characters, used to recognise a key in the admin UI. */
export function keyHint(plainText: string): string {
  const trimmed = plainText.trim();
  return trimmed.length <= 4 ? '••••' : `••••${trimmed.slice(-4)}`;
}
