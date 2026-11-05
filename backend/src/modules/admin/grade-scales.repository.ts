import type { Pool, PoolClient } from 'pg';
import { pool } from '../../database/pool';

export type Queryable = Pool | PoolClient;

export interface GradeScaleRecord {
  id: string;
  minScore10: number;
  letterGrade: string;
  grade4: number;
  isPass: boolean;
}

interface GradeScaleRow {
  id: string;
  min_score_10: string;
  letter_grade: string;
  grade_4: string;
  is_pass: boolean;
}

function mapRow(row: GradeScaleRow): GradeScaleRecord {
  return {
    id: row.id,
    minScore10: Number(row.min_score_10),
    letterGrade: row.letter_grade,
    grade4: Number(row.grade_4),
    isPass: row.is_pass,
  };
}

export async function list(db: Queryable = pool): Promise<GradeScaleRecord[]> {
  const result = await db.query<GradeScaleRow>(
    `SELECT id, min_score_10, letter_grade, grade_4, is_pass
       FROM grade_scales
      ORDER BY min_score_10 DESC`,
  );
  return result.rows.map(mapRow);
}

export async function findById(id: string, db: Queryable = pool): Promise<GradeScaleRecord | null> {
  const result = await db.query<GradeScaleRow>(
    `SELECT id, min_score_10, letter_grade, grade_4, is_pass
       FROM grade_scales
      WHERE id = $1`,
    [id],
  );
  const row = result.rows[0];
  return row ? mapRow(row) : null;
}

export async function findByMinScore(
  minScore10: number,
  db: Queryable = pool,
): Promise<GradeScaleRecord | null> {
  const result = await db.query<GradeScaleRow>(
    `SELECT id, min_score_10, letter_grade, grade_4, is_pass
       FROM grade_scales
      WHERE min_score_10 = $1`,
    [minScore10],
  );
  const row = result.rows[0];
  return row ? mapRow(row) : null;
}

export async function create(
  input: { minScore10: number; letterGrade: string; grade4: number; isPass: boolean },
  db: Queryable = pool,
): Promise<GradeScaleRecord> {
  const result = await db.query<GradeScaleRow>(
    `INSERT INTO grade_scales (min_score_10, letter_grade, grade_4, is_pass)
     VALUES ($1, $2, $3, $4)
     RETURNING id, min_score_10, letter_grade, grade_4, is_pass`,
    [input.minScore10, input.letterGrade, input.grade4, input.isPass],
  );
  const row = result.rows[0];
  if (!row) throw new Error('Failed to create grade scale');
  return mapRow(row);
}

export async function update(
  id: string,
  input: { minScore10: number; letterGrade: string; grade4: number; isPass: boolean },
  db: Queryable = pool,
): Promise<GradeScaleRecord | null> {
  const result = await db.query<GradeScaleRow>(
    `UPDATE grade_scales
        SET min_score_10 = $2,
            letter_grade = $3,
            grade_4 = $4,
            is_pass = $5
      WHERE id = $1
      RETURNING id, min_score_10, letter_grade, grade_4, is_pass`,
    [id, input.minScore10, input.letterGrade, input.grade4, input.isPass],
  );
  const row = result.rows[0];
  return row ? mapRow(row) : null;
}

export async function remove(id: string, db: Queryable = pool): Promise<boolean> {
  const result = await db.query('DELETE FROM grade_scales WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}
