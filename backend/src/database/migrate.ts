import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { logger } from '../lib/logger';
import { pool } from './pool';

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

interface AppliedMigration {
  name: string;
  checksum: string;
}

async function ensureMigrationsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       text PRIMARY KEY,
      checksum   text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function listMigrationFiles(): Promise<string[]> {
  const entries = await readdir(MIGRATIONS_DIR);
  return entries.filter((file) => file.endsWith('.sql')).sort();
}

function checksum(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

export async function runMigrations(): Promise<{ applied: string[]; skipped: string[] }> {
  await ensureMigrationsTable();

  const result = await pool.query<AppliedMigration>(
    'SELECT name, checksum FROM schema_migrations ORDER BY name',
  );
  const applied = new Map(result.rows.map((row) => [row.name, row.checksum]));

  const files = await listMigrationFiles();
  const appliedNow: string[] = [];
  const skipped: string[] = [];

  for (const file of files) {
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
    const fileChecksum = checksum(sql);
    const previousChecksum = applied.get(file);

    if (previousChecksum) {
      if (previousChecksum !== fileChecksum) {
        throw new Error(
          `Migration ${file} was modified after being applied. ` +
            'Create a new migration instead of editing history.',
        );
      }
      skipped.push(file);
      continue;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)',
        [file, fileChecksum],
      );
      await client.query('COMMIT');
      appliedNow.push(file);
      logger.info({ migration: file }, 'migration applied');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  return { applied: appliedNow, skipped };
}

async function main(): Promise<void> {
  const result = await runMigrations();
  logger.info(
    { applied: result.applied.length, skipped: result.skipped.length },
    'migrations complete',
  );
}

if (require.main === module) {
  main()
    .catch((error) => {
      logger.error({ err: error }, 'migration failed');
      process.exitCode = 1;
    })
    .finally(async () => {
      await pool.end();
    });
}
