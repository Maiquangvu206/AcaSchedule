import type { Pool, PoolClient } from 'pg';
import { pool } from '../../database/pool';

export type Queryable = Pool | PoolClient;

export interface SubjectRecord {
  id: string;
  code: string;
  name: string;
  credits: number;
  knowledgeBlock: string;
  managingUnit: string;
  isActive: boolean;
  processWeight: number;
  finalWeight: number;
}

interface SubjectRow {
  id: string;
  code: string;
  name: string;
  credits: number;
  knowledge_block: string;
  managing_unit: string;
  is_active: boolean;
  process_weight: string;
  final_weight: string;
}

function mapRow(row: SubjectRow): SubjectRecord {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    credits: row.credits,
    knowledgeBlock: row.knowledge_block,
    managingUnit: row.managing_unit ?? '',
    isActive: row.is_active,
    processWeight: Number(row.process_weight),
    finalWeight: Number(row.final_weight),
  };
}

const SELECT = `
  SELECT id, code, name, credits, knowledge_block, managing_unit, is_active, process_weight, final_weight
    FROM subjects
`;

export async function list(db: Queryable = pool): Promise<SubjectRecord[]> {
  const result = await db.query<SubjectRow>(`${SELECT} ORDER BY code`);
  return result.rows.map(mapRow);
}

export async function findById(id: string, db: Queryable = pool): Promise<SubjectRecord | null> {
  const result = await db.query<SubjectRow>(`${SELECT} WHERE id = $1`, [id]);
  const row = result.rows[0];
  return row ? mapRow(row) : null;
}

export async function findByCode(
  code: string,
  db: Queryable = pool,
): Promise<SubjectRecord | null> {
  const result = await db.query<SubjectRow>(`${SELECT} WHERE code = $1`, [code]);
  const row = result.rows[0];
  return row ? mapRow(row) : null;
}

export async function create(
  input: {
    code: string;
    name: string;
    credits: number;
    knowledgeBlock: string;
    managingUnit: string;
    processWeight: number;
    finalWeight: number;
  },
  db: Queryable = pool,
): Promise<SubjectRecord> {
  const result = await db.query<SubjectRow>(
    `INSERT INTO subjects (code, name, credits, knowledge_block, managing_unit, process_weight, final_weight)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, code, name, credits, knowledge_block, managing_unit, is_active, process_weight, final_weight`,
    [
      input.code,
      input.name,
      input.credits,
      input.knowledgeBlock,
      input.managingUnit,
      input.processWeight,
      input.finalWeight,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new Error('Failed to create subject');
  return mapRow(row);
}

export async function update(
  id: string,
  input: {
    code: string;
    name: string;
    credits: number;
    knowledgeBlock: string;
    managingUnit: string;
    processWeight: number;
    finalWeight: number;
    isActive: boolean;
  },
  db: Queryable = pool,
): Promise<SubjectRecord | null> {
  const result = await db.query<SubjectRow>(
    `UPDATE subjects
        SET code = $2,
            name = $3,
            credits = $4,
            knowledge_block = $5,
            managing_unit = $6,
            process_weight = $7,
            final_weight = $8,
            is_active = $9
      WHERE id = $1
      RETURNING id, code, name, credits, knowledge_block, managing_unit, is_active, process_weight, final_weight`,
    [
      id,
      input.code,
      input.name,
      input.credits,
      input.knowledgeBlock,
      input.managingUnit,
      input.processWeight,
      input.finalWeight,
      input.isActive,
    ],
  );
  const row = result.rows[0];
  return row ? mapRow(row) : null;
}

export async function deactivate(id: string, db: Queryable = pool): Promise<boolean> {
  const result = await db.query(
    'UPDATE subjects SET is_active = false WHERE id = $1 AND is_active = true',
    [id],
  );
  return (result.rowCount ?? 0) > 0;
}
