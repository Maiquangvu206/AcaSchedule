import { timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { env } from '../../config/env';
import { pool } from '../../database/pool';
import { decryptSecret, isKeyEncryptionConfigured } from '../../lib/crypto';
import { AppError, asyncHandler } from '../../lib/errors';
import { logger } from '../../lib/logger';

/**
 * Internal configuration feed for the Python AI service.
 *
 * The AI service calls this endpoint (every ~30s, cached) to learn which keys,
 * models and provider order to use. Authentication is a shared secret
 * (`AI_INTERNAL_TOKEN`) — never exposed to the browser.
 *
 * If the token is not configured the endpoint is disabled. If the DB schema is
 * missing the response is 503 and the AI service keeps using its env keys.
 */
export const aiInternalRouter = Router();

function providedToken(headers: Record<string, string | string[] | undefined>): string {
  const direct = headers['x-internal-token'];
  if (typeof direct === 'string' && direct) return direct;

  const authorization = headers.authorization;
  if (typeof authorization === 'string') {
    return authorization.replace(/^Bearer\s+/i, '').trim();
  }
  return '';
}

function tokensMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

interface KeyRow {
  provider: string;
  encrypted_key: string;
  key_hint: string;
}

interface SettingsRow {
  is_enabled: boolean;
  provider_order: string;
  gemini_model: string;
  openrouter_model: string;
  daily_limit_per_user: number;
}

aiInternalRouter.get(
  '/config',
  asyncHandler(async (req, res) => {
    if (!env.AI_INTERNAL_TOKEN) {
      throw new AppError(
        503,
        'InternalAuthNotConfigured',
        'AI_INTERNAL_TOKEN chưa được cấu hình trên backend.',
      );
    }

    if (!tokensMatch(providedToken(req.headers), env.AI_INTERNAL_TOKEN)) {
      throw new AppError(401, 'Unauthorized', 'Invalid internal token');
    }

    const settingsResult = await pool.query<SettingsRow>(
      `SELECT is_enabled, provider_order, gemini_model, openrouter_model, daily_limit_per_user
         FROM ai_settings
        WHERE id = 1`,
    );
    const settings = settingsResult.rows[0];
    if (!settings) {
      throw new AppError(503, 'AiSettingsMissing', 'ai_settings chưa được khởi tạo.');
    }

    let keys: KeyRow[] = [];
    if (isKeyEncryptionConfigured(env.AI_KEYS_SECRET)) {
      const keyResult = await pool.query<KeyRow>(
        `SELECT provider, encrypted_key, key_hint
           FROM ai_provider_keys
          WHERE is_active = true
          ORDER BY priority, created_at`,
      );
      keys = keyResult.rows;
    }

    const geminiKeys: string[] = [];
    const openrouterKeys: string[] = [];

    for (const row of keys) {
      try {
        const plain = decryptSecret(row.encrypted_key, env.AI_KEYS_SECRET);
        if (row.provider === 'gemini') geminiKeys.push(plain);
        else if (row.provider === 'openrouter') openrouterKeys.push(plain);
      } catch (error) {
        logger.warn(
          { provider: row.provider, hint: row.key_hint, err: error },
          'Stored AI key could not be decrypted (AI_KEYS_SECRET changed?)',
        );
      }
    }

    res.set('Cache-Control', 'no-store');
    res.json({
      enabled: settings.is_enabled,
      provider_order: settings.provider_order,
      gemini_model: settings.gemini_model,
      openrouter_model: settings.openrouter_model,
      daily_limit_per_user: settings.daily_limit_per_user,
      gemini_keys: geminiKeys,
      openrouter_keys: openrouterKeys,
    });
  }),
);
