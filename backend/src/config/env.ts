import 'dotenv/config';
import { z } from 'zod';

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

  MINIO_ENDPOINT: z.string().default('localhost'),
  MINIO_PORT: z.coerce.number().int().positive().default(9000),
  MINIO_USE_SSL: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  // Browser-facing endpoint used only to sign upload/download URLs.
  // In Docker the backend talks to `minio:9000` while the browser needs `localhost:9000`.
  MINIO_PUBLIC_ENDPOINT: z.string().optional(),
  MINIO_PUBLIC_PORT: z.coerce.number().int().positive().optional(),
  MINIO_PUBLIC_USE_SSL: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
  MINIO_ACCESS_KEY: z.string().default('minioadmin'),
  MINIO_SECRET_KEY: z.string().default('minioadmin'),
  MINIO_BUCKET: z.string().default('documents'),
  MINIO_REGION: z.string().default('us-east-1'),

  GEMINI_API_KEY: z.string().optional().default(''),
  AI_SERVICE_URL: z.string().url().default('http://localhost:8001'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
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
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment configuration');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;

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
