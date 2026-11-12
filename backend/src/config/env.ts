import 'dotenv/config';
import { z } from 'zod';

/**
 * Normalize an object-storage host.
 *
 * Accepts `host`, `host:port`, `https://host/bucket` and returns just the
 * host. The MinIO client only accepts a bare host name; a leftover path or
 * scheme makes it throw `InvalidEndpointError` while the module is imported,
 * which used to take the whole API down.
 */
export function normalizeStorageHost(value: unknown): unknown {
  if (typeof value !== 'string') return value;

  let host = value.trim();
  if (!host) return host;

  // Drop the scheme (https://, http://, s3://…).
  host = host.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  // Drop everything after the host: path, bucket suffix, query string.
  host = host.split('/')[0];
  // Drop a trailing port — the client takes it as a separate option.
  host = host.replace(/:\d+$/, '');

  return host;
}

/**
 * Environment schema — fail fast at boot when a required value is invalid.
 * Defaults match .env.example so `npm run dev` works without a .env file.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8000),
  CORS_ORIGIN: z.string().default('http://localhost'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  DATABASE_URL: z
    .string()
    .url()
    .default('postgresql://acaschedule:acaschedule@localhost:5432/acaschedule'),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Object storage host only — never a URL with a path.
  // Cloudflare R2 is often pasted as
  // `https://<account>.r2.cloudflarestorage.com/<bucket>`; the trailing
  // bucket path is stripped here because MinIO rejects it with
  // `InvalidEndpointError` (and that error used to crash the whole backend).
  MINIO_ENDPOINT: z.preprocess(normalizeStorageHost, z.string().default('localhost')),
  MINIO_PORT: z.coerce.number().int().positive().default(9000),
  MINIO_USE_SSL: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  // Browser-facing endpoint used only to sign upload/download URLs.
  // In Docker the backend talks to `minio:9000` while the browser needs `localhost:9000`.
  MINIO_PUBLIC_ENDPOINT: z.preprocess(
    (value) => (value === undefined || value === '' ? undefined : normalizeStorageHost(value)),
    z.string().optional(),
  ),
  MINIO_PUBLIC_PORT: z.coerce.number().int().positive().optional(),
  MINIO_PUBLIC_USE_SSL: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
  MINIO_ACCESS_KEY: z.string().default('minioadmin'),
  MINIO_SECRET_KEY: z.string().default('minioadmin'),
  MINIO_BUCKET: z.string().default('documents'),
  /**
   * Storage region. Cloudflare R2 only accepts `auto`; any other value makes
   * every presigned URL fail with 403 SignatureDoesNotMatch. When the endpoint
   * points at R2 and no region is configured, fall back to `auto` instead of
   * the generic default.
   */
  MINIO_REGION: z.preprocess(
    (value) => {
      if (typeof value === 'string' && value.trim()) return value.trim();
      return undefined;
    },
    z.string().optional(),
  ),

  GEMINI_API_KEY: z.string().optional().default(''),
  AI_SERVICE_URL: z.string().url().default('http://localhost:8001'),
  // Secret used to encrypt AI provider keys stored in PostgreSQL (AES-256-GCM).
  // Leave empty to disable key management from the admin UI (env keys still work).
  AI_KEYS_SECRET: z.string().optional().default(''),
  // Shared secret for the AI service → backend config endpoint (/api/internal/ai).
  AI_INTERNAL_TOKEN: z.string().optional().default(''),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  // Resend HTTPS API key (Render blocks SMTP on free plans — preferred).
  RESEND_API_KEY: z.string().optional().default(''),
  // Brevo HTTPS API key — alternative to Resend that verifies a single sender
  // email instead of a whole domain (useful without an owned domain).
  BREVO_API_KEY: z.string().optional().default(''),
  SMTP_FROM: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().email().optional(),
  ),

  JWT_ACCESS_SECRET: z.string().min(16).default('dev-access-secret-change-me'),
  JWT_REFRESH_SECRET: z.string().min(16).default('dev-refresh-secret-change-me'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),

  SEED_ADMIN_EMAIL: z.string().email().default('admin@acaschedule.local'),
  SEED_ADMIN_PASSWORD: z.string().min(8).default('Admin@123'),
  SEED_RESET_ADMIN_PASSWORD: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment configuration');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;

/**
 * Effective storage region.
 *
 * R2 only signs with `auto`; the generic default would break every presigned
 * URL, so derive it from the endpoint when the variable is not set.
 */
export const storageRegion =
  env.MINIO_REGION ??
  (/\.r2\.cloudflarestorage\.com$/i.test(env.MINIO_ENDPOINT) ? 'auto' : 'us-east-1');

if (env.NODE_ENV === 'production') {
  // Fail hard on insecure defaults in production.
  if (env.JWT_ACCESS_SECRET.startsWith('dev-') || env.JWT_REFRESH_SECRET.startsWith('dev-')) {
    console.error('❌ Production requires JWT_ACCESS_SECRET and JWT_REFRESH_SECRET (32+ random chars).');
    process.exit(1);
  }
  if (env.SEED_ADMIN_PASSWORD === 'Admin@123') {
    console.error('❌ Production requires a unique SEED_ADMIN_PASSWORD.');
    process.exit(1);
  }
}
