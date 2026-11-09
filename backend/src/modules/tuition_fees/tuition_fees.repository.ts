import type { Pool, PoolClient } from 'pg';
import { pool } from '../../database/pool';
import type { TuitionFee } from './tuition_fees.types';

export type Queryable = Pool | PoolClient;

interface TuitionFeeRow {
  id: string;
  semester: string;
  major_id: string | null;
  major_code: string | null;
  major_name: string | null;
  fee_per_credit: number;
  currency: string;
  created_at: Date;
  updated_at: Date;
}

function mapTuitionFee(row: TuitionFeeRow): TuitionFee {
  return {
    id: row.id,
    semester: row.semester,
    majorId: row.major_id,
    majorCode: row.major_code,
    majorName: row.major_name,
    feePerCredit: row.fee_per_credit,
    currency: row.currency,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function listTuitionFees(userId?: string, db: Queryable = pool): Promise<TuitionFee[]> {
  const result = await db.query<TuitionFeeRow>(
    `SELECT tf.*, m.code AS major_code, m.name AS major_name
       FROM tuition_fees tf
       LEFT JOIN majors m ON m.id = tf.major_id
      ${userId ? `WHERE tf.major_id IS NULL
          OR NOT EXISTS (SELECT 1 FROM user_majors WHERE user_id = $1)
          OR tf.major_id IN (SELECT major_id FROM user_majors WHERE user_id = $1)` : ''}
      ORDER BY tf.semester DESC, m.code NULLS FIRST`,
    userId ? [userId] : [],
  );
  return result.rows.map(mapTuitionFee);
}

export async function getTuitionFee(
  semester: string,
  userId?: string,
  db: Queryable = pool,
): Promise<TuitionFee | null> {
  const result = await db.query<TuitionFeeRow>(
    `SELECT tf.*, m.code AS major_code, m.name AS major_name
       FROM tuition_fees tf LEFT JOIN majors m ON m.id = tf.major_id
      WHERE tf.semester = $1
        ${userId ? `AND (tf.major_id IS NULL
          OR NOT EXISTS (SELECT 1 FROM user_majors WHERE user_id = $2)
          OR tf.major_id IN (SELECT major_id FROM user_majors WHERE user_id = $2))` : ''}
      ORDER BY (tf.major_id IS NULL), m.code
      LIMIT 1`,
    userId ? [semester, userId] : [semester],
  );
  const row = result.rows[0];
  return row ? mapTuitionFee(row) : null;
}

export async function upsertTuitionFee(
  semester: string,
  majorId: string | null,
  feePerCredit: number,
  currency: string,
  db: Queryable = pool,
): Promise<TuitionFee> {
  const result = await db.query<TuitionFeeRow>(
    `INSERT INTO tuition_fees (semester, major_id, fee_per_credit, currency)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (semester, COALESCE(major_id, '00000000-0000-0000-0000-000000000000'::uuid))
      DO UPDATE SET fee_per_credit = EXCLUDED.fee_per_credit,
                    currency = EXCLUDED.currency, updated_at = now()
      RETURNING id, semester, major_id, fee_per_credit, currency, created_at, updated_at,
                NULL::text AS major_code, NULL::text AS major_name`,
    [semester, majorId, feePerCredit, currency]
  );
  return mapTuitionFee(result.rows[0]);
}
