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
  MINIO_ACCESS_KEY: z.string().default('minioadmin'),
  MINIO_SECRET_KEY: z.string().default('minioadmin'),
  MINIO_BUCKET: z.string().default('documents'),

  GEMINI_API_KEY: z.string().optional().default(''),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment configuration');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
