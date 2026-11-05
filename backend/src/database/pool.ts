import { Pool } from 'pg';
import { env } from '../config/env';

/**
 * Shared PostgreSQL connection pool.
 * Migrations will live in src/database/migrations and run at deploy time.
 */
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error', error);
});

export async function pingDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}
