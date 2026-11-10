import type { PoolClient } from 'pg';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { hashPassword } from '../lib/password';
import { pool } from './pool';

/**
 * Minimal production seed.
 *
 * Keeps the database clean: only the admin account (from environment) plus
 * reference data (grade scales, period slots) are ensured. Business data
 * (students, subjects, semesters, tuition, enrolments, …) is created by
 * admins through the UI — nothing demo is inserted here.
 */

interface GradeScaleSeed {
  minScore: number;
  letter: string;
  grade4: number;
  isPass: boolean;
}

const GRADE_SCALES: GradeScaleSeed[] = [
];

interface PeriodSlotSeed {
  period: number;
  startTime: string;
  endTime: string;
  label: string;
}

const PERIOD_SLOTS: PeriodSlotSeed[] = [
];

/** Reference data: keep default period times available on any database. */
async function seedPeriodSlots(client: PoolClient): Promise<void> {
  for (const slot of PERIOD_SLOTS) {
    await client.query(
      `INSERT INTO period_slots (period, start_time, end_time, label)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (period) DO NOTHING`,
      [slot.period, slot.startTime, slot.endTime, slot.label],
    );
  }
}

async function seedGradeScales(client: PoolClient): Promise<void> {
  for (const scale of GRADE_SCALES) {
    await client.query(
      `INSERT INTO grade_scales (min_score_10, letter_grade, grade_4, is_pass)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (min_score_10) DO UPDATE
         SET letter_grade = EXCLUDED.letter_grade,
             grade_4 = EXCLUDED.grade_4,
             is_pass = EXCLUDED.is_pass`,
      [scale.minScore, scale.letter, scale.grade4, scale.isPass],
    );
  }
}

/** Ensure the single admin account exists (never overwrites its password). */
async function ensureAdmin(client: PoolClient): Promise<string> {
  const email = env.SEED_ADMIN_EMAIL.toLowerCase();
  const existing = await client.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [
    email,
  ]);
  if (existing.rows[0]) {
    const id = existing.rows[0].id;
    // One-time password recovery: set SEED_RESET_ADMIN_PASSWORD=true to copy
    // the env password into the existing admin account, then set it back to false.
    if (env.SEED_RESET_ADMIN_PASSWORD) {
      await client.query(
        `UPDATE users
            SET password_hash = $1, must_change_password = false, is_active = true
          WHERE id = $2`,
        [await hashPassword(env.SEED_ADMIN_PASSWORD), id],
      );
      logger.warn({ admin: email }, 'admin password reset from seed env (SEED_RESET_ADMIN_PASSWORD=true)');
    }
    return id;
  }

  const result = await client.query<{ id: string }>(
    `INSERT INTO users (email, password_hash, full_name, role)
     VALUES ($1, $2, $3, 'admin')
     RETURNING id`,
    [email, await hashPassword(env.SEED_ADMIN_PASSWORD), 'AcaSchedule Admin'],
  );
  const id = result.rows[0]?.id;
  if (!id) throw new Error(`Failed to seed admin ${email}`);
  return id;
}

export async function runSeed(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await seedPeriodSlots(client);
    await seedGradeScales(client);
    const adminId = await ensureAdmin(client);
    await client.query('COMMIT');
    logger.info({ admin: env.SEED_ADMIN_EMAIL, adminId }, 'seed ready (admin + reference data only)');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  await runSeed();
}

if (require.main === module) {
  main()
    .catch((error) => {
      logger.error({ err: error }, 'seed failed');
      process.exitCode = 1;
    })
    .finally(async () => {
      await pool.end();
    });
}
