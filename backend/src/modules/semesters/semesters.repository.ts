import type { Pool, PoolClient } from 'pg';
import { pool } from '../../database/pool';

export type Queryable = Pool | PoolClient;

export interface SemesterRecord {
  code: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  sortNo: number;
}

interface SemesterRow {
  code: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  sort_no: number;
}

function mapRow(row: SemesterRow): SemesterRecord {
  return {
    code: row.code,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    isActive: row.is_active,
    sortNo: row.sort_no,
  };
}

const SELECT_ALL = `
  SELECT code, name, start_date, end_date, is_active, sort_no
    FROM semesters
`;

export async function listSemesters(
  onlyActive = false,
  db: Queryable = pool,
): Promise<SemesterRecord[]> {
  const result = await db.query<SemesterRow>(
    `${SELECT_ALL} ${onlyActive ? 'WHERE is_active = true' : ''}
     ORDER BY sort_no, code`,
  );
  return result.rows.map(mapRow);
}

export async function findSemester(
  code: string,
  db: Queryable = pool,
): Promise<SemesterRecord | null> {
  const result = await db.query<SemesterRow>(`${SELECT_ALL} WHERE code = $1`, [code]);
  const row = result.rows[0];
  return row ? mapRow(row) : null;
}

export async function createSemester(
  input: Omit<SemesterRecord, 'startDate' | 'endDate'> & {
    startDate: string | null;
    endDate: string | null;
  },
  db: Queryable = pool,
): Promise<SemesterRecord> {
  const result = await db.query<SemesterRow>(
    `INSERT INTO semesters (code, name, start_date, end_date, is_active, sort_no)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING code, name, start_date, end_date, is_active, sort_no`,
    [
      input.code,
      input.name,
      input.startDate,
      input.endDate,
      input.isActive,
      input.sortNo,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new Error('Failed to create semester');
  return mapRow(row);
}

export async function updateSemester(
  code: string,
  input: Partial<Omit<SemesterRecord, 'code'>>,
  db: Queryable = pool,
): Promise<SemesterRecord | null> {
  const existing = await findSemester(code, db);
  if (!existing) return null;

  const result = await db.query<SemesterRow>(
    `UPDATE semesters
        SET name = $2,
            start_date = $3,
            end_date = $4,
            is_active = $5,
            sort_no = $6
      WHERE code = $1
      RETURNING code, name, start_date, end_date, is_active, sort_no`,
    [
      code,
      input.name ?? existing.name,
      input.startDate !== undefined ? input.startDate : existing.startDate,
      input.endDate !== undefined ? input.endDate : existing.endDate,
      input.isActive ?? existing.isActive,
      input.sortNo ?? existing.sortNo,
    ],
  );
  const row = result.rows[0];
  return row ? mapRow(row) : null;
}

export async function deleteSemester(code: string, db: Queryable = pool): Promise<boolean> {
  const result = await db.query('DELETE FROM semesters WHERE code = $1', [code]);
  return (result.rowCount ?? 0) > 0;
}
