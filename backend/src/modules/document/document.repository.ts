import type { Pool, PoolClient } from 'pg';
import { pool } from '../../database/pool';
import { rankScore } from './document.engine';
import type { DocumentSubject, DocumentView } from './document.types';

export type Queryable = Pool | PoolClient;
export type VoteValue = -1 | 0 | 1;

interface DocumentRow {
  id: string;
  subject_id: string;
  subject_code: string;
  subject_name: string;
  title: string;
  original_name: string | null;
  mime_type: string;
  size_bytes: string | number;
  upvotes: number;
  downvotes: number;
  my_vote: number;
  uploader_id: string;
  uploader_name: string;
  created_at: Date;
  updated_at: Date;
  is_hidden: boolean;
  is_locked: boolean;
}

interface SubjectRow {
  id: string;
  code: string;
  name: string;
  credits: number;
  document_count: string | number;
}

function mapDocument(row: DocumentRow): DocumentView {
  const upvotes = Number(row.upvotes);
  const downvotes = Number(row.downvotes);

  return {
    id: row.id,
    subjectId: row.subject_id,
    subjectCode: row.subject_code,
    subjectName: row.subject_name,
    title: row.title,
    originalName: row.original_name,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    upvotes,
    downvotes,
    score: rankScore(upvotes, downvotes),
    myVote: row.my_vote === 1 ? 1 : row.my_vote === -1 ? -1 : 0,
    uploaderId: row.uploader_id,
    uploaderName: row.uploader_name,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    isHidden: row.is_hidden,
    isLocked: row.is_locked,
  };
}

export async function findEnrolledSubject(
  studentId: string,
  subjectId: string,
  db: Queryable = pool,
): Promise<{ id: string; code: string; name: string; credits: number } | null> {
  const result = await db.query<{ id: string; code: string; name: string; credits: number }>(
    `SELECT s.id, s.code, s.name, s.credits
       FROM subjects s
      WHERE s.id = $2
        AND EXISTS (
          SELECT 1 FROM student_enrollments e
           WHERE e.student_id = $1 AND e.subject_id = s.id
        )`,
    [studentId, subjectId],
  );

  return result.rows[0] ?? null;
}

export async function listEnrolledSubjects(
  studentId: string,
  db: Queryable = pool,
): Promise<DocumentSubject[]> {
  const result = await db.query<SubjectRow>(
    `SELECT s.id,
            s.code,
            s.name,
            s.credits,
            (SELECT count(*) FROM subject_documents d WHERE d.subject_id = s.id AND d.is_hidden = false) AS document_count
       FROM subjects s
      WHERE EXISTS (
        SELECT 1 FROM student_enrollments e
         WHERE e.student_id = $1 AND e.subject_id = s.id
      )
      ORDER BY s.code`,
    [studentId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    credits: row.credits,
    documentCount: Number(row.document_count),
  }));
}

const DOCUMENT_SELECT = `
  SELECT d.id,
         d.subject_id,
         s.code AS subject_code,
         s.name AS subject_name,
         d.title,
         d.original_name,
         d.mime_type,
         d.size_bytes,
         d.upvotes,
         d.downvotes,
         COALESCE(v.value, 0)::int AS my_vote,
         d.uploader_id,
         u.full_name AS uploader_name,
         d.created_at,
         d.updated_at,
         d.is_hidden,
         d.is_locked
    FROM subject_documents d
    JOIN subjects s ON s.id = d.subject_id
    JOIN users u ON u.id = d.uploader_id
    LEFT JOIN document_votes v ON v.document_id = d.id AND v.user_id = $1
`;

const ENROLLMENT_FILTER = `
  EXISTS (
    SELECT 1 FROM student_enrollments e
     WHERE e.student_id = $1 AND e.subject_id = d.subject_id
  )
`;

/** Tài liệu hiển thị cho sinh viên: đã đăng ký môn và chưa bị ẩn. */
const STUDENT_VISIBLE_FILTER = `${ENROLLMENT_FILTER} AND d.is_hidden = false`;

const ORDER_BY: Record<'rank' | 'newest', string> = {
  rank:
    '((d.upvotes - d.downvotes)::numeric / (d.upvotes + d.downvotes + 1)) DESC, d.upvotes DESC, d.created_at DESC, d.id',
  newest: 'd.created_at DESC, d.id',
};

export interface ListDocumentFilters {
  subjectId?: string;
  q?: string;
  sort: 'rank' | 'newest';
}

export async function listDocuments(
  studentId: string,
  filters: ListDocumentFilters,
  db: Queryable = pool,
): Promise<DocumentView[]> {
  const conditions = [STUDENT_VISIBLE_FILTER];
  const values: unknown[] = [studentId];

  if (filters.subjectId) {
    values.push(filters.subjectId);
    conditions.push(`d.subject_id = $${values.length}`);
  }

  if (filters.q) {
    values.push(`%${filters.q}%`);
    const param = `$${values.length}`;
    conditions.push(
      `(d.title ILIKE ${param} OR s.code ILIKE ${param} OR s.name ILIKE ${param} OR u.full_name ILIKE ${param})`,
    );
  }

  const result = await db.query<DocumentRow>(
    `${DOCUMENT_SELECT}
      WHERE ${conditions.join(' AND ')}
      ORDER BY ${ORDER_BY[filters.sort]}`,
    values,
  );

  return result.rows.map(mapDocument);
}

/**
 * Every document in the system — used by the admin management page, which must
 * not be limited to the subjects the admin happens to be enrolled in.
 */
export async function listAllDocuments(
  filters: ListDocumentFilters,
  db: Queryable = pool,
): Promise<DocumentView[]> {
  const conditions: string[] = [];
  // `$1` trong DOCUMENT_SELECT là user id cho bảng vote; admin không có vote
  // nên truyền null (LEFT JOIN → my_vote = 0).
  const values: unknown[] = [null];

  if (filters.subjectId) {
    values.push(filters.subjectId);
    conditions.push(`d.subject_id = $${values.length}`);
  }

  if (filters.q) {
    values.push(`%${filters.q}%`);
    const param = `$${values.length}`;
    conditions.push(
      `(d.title ILIKE ${param}
        OR d.original_name ILIKE ${param}
        OR s.code ILIKE ${param}
        OR s.name ILIKE ${param}
        OR u.full_name ILIKE ${param})`,
    );
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await db.query<DocumentRow>(
    `${DOCUMENT_SELECT} ${where} ORDER BY ${ORDER_BY[filters.sort]}`,
    values,
  );

  return result.rows.map(mapDocument);
}

export async function findAccessibleDocument(
  studentId: string,
  documentId: string,
  db: Queryable = pool,
): Promise<DocumentView | null> {
  const result = await db.query<DocumentRow>(
    `${DOCUMENT_SELECT}
      WHERE d.id = $2 AND ${STUDENT_VISIBLE_FILTER}`,
    [studentId, documentId],
  );

  const row = result.rows[0];
  return row ? mapDocument(row) : null;
}

export async function findAccessibleDocumentObjectKey(
  studentId: string,
  documentId: string,
  db: Queryable = pool,
): Promise<string | null> {
  const result = await db.query<{ object_key: string }>(
    `SELECT d.object_key
       FROM subject_documents d
      WHERE d.id = $2 AND ${STUDENT_VISIBLE_FILTER}`,
    [studentId, documentId],
  );

  return result.rows[0]?.object_key ?? null;
}

export async function findOwnedDocumentByObjectKey(
  studentId: string,
  objectKey: string,
  db: Queryable = pool,
): Promise<DocumentView | null> {
  const result = await db.query<DocumentRow>(
    `${DOCUMENT_SELECT}
      WHERE d.object_key = $2 AND d.uploader_id = $1 AND ${STUDENT_VISIBLE_FILTER}`,
    [studentId, objectKey],
  );

  const row = result.rows[0];
  return row ? mapDocument(row) : null;
}

export interface InsertDocumentInput {
  subjectId: string;
  uploaderId: string;
  title: string;
  originalName: string;
  objectKey: string;
  mimeType: string;
  sizeBytes: number;
}

export async function insertDocument(
  input: InsertDocumentInput,
  db: Queryable = pool,
): Promise<string> {
  const result = await db.query<{ id: string }>(
    `INSERT INTO subject_documents
       (subject_id, uploader_id, title, original_name, object_key, mime_type, size_bytes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      input.subjectId,
      input.uploaderId,
      input.title,
      input.originalName,
      input.objectKey,
      input.mimeType,
      input.sizeBytes,
    ],
  );

  const id = result.rows[0]?.id;
  if (!id) throw new Error('Failed to create document metadata');
  return id;
}

export async function findVote(
  studentId: string,
  documentId: string,
  db: Queryable = pool,
): Promise<VoteValue> {
  const result = await db.query<{ value: number }>(
    'SELECT value FROM document_votes WHERE document_id = $1 AND user_id = $2',
    [documentId, studentId],
  );

  const value = result.rows[0]?.value;
  return value === 1 ? 1 : value === -1 ? -1 : 0;
}

export async function upsertVote(
  studentId: string,
  documentId: string,
  value: 1 | -1,
  db: Queryable = pool,
): Promise<void> {
  await db.query(
    `INSERT INTO document_votes (document_id, user_id, value)
     VALUES ($1, $2, $3)
     ON CONFLICT (document_id, user_id) DO UPDATE
       SET value = EXCLUDED.value`,
    [documentId, studentId, value],
  );
}

export async function deleteVote(
  studentId: string,
  documentId: string,
  db: Queryable = pool,
): Promise<void> {
  await db.query('DELETE FROM document_votes WHERE document_id = $1 AND user_id = $2', [
    documentId,
    studentId,
  ]);
}

/** Keep the denormalised counters in sync with the unique per-user votes. */
export async function recalculateVoteCounts(
  documentId: string,
  db: Queryable = pool,
): Promise<void> {
  await db.query(
    `UPDATE subject_documents
        SET upvotes = (
              SELECT count(*)::int FROM document_votes
               WHERE document_id = $1 AND value = 1
            ),
            downvotes = (
              SELECT count(*)::int FROM document_votes
               WHERE document_id = $1 AND value = -1
            )
      WHERE id = $1`,
    [documentId],
  );
}

/* ── Quản trị (admin, không giới hạn theo môn đã đăng ký) ─────────────── */

export async function findDocumentById(
  documentId: string,
  db: Queryable = pool,
): Promise<DocumentView | null> {
  const result = await db.query<DocumentRow>(
    `${DOCUMENT_SELECT}
      WHERE d.id = $2`,
    [null, documentId],
  );
  const row = result.rows[0];
  return row ? mapDocument(row) : null;
}

export async function findDocumentObjectKeyById(
  documentId: string,
  db: Queryable = pool,
): Promise<string | null> {
  const result = await db.query<{ object_key: string }>(
    'SELECT object_key FROM subject_documents WHERE id = $1',
    [documentId],
  );
  return result.rows[0]?.object_key ?? null;
}

export async function updateDocumentFlags(
  documentId: string,
  flags: { isHidden?: boolean; isLocked?: boolean },
  db: Queryable = pool,
): Promise<DocumentView | null> {
  const updated = await db.query<{ id: string }>(
    `UPDATE subject_documents
        SET is_hidden = COALESCE($2, is_hidden),
            is_locked = COALESCE($3, is_locked),
            updated_at = now()
      WHERE id = $1
      RETURNING id`,
    [documentId, flags.isHidden ?? null, flags.isLocked ?? null],
  );
  if (!updated.rows[0]) return null;
  return findDocumentById(documentId, db);
}

export async function deleteDocumentById(
  documentId: string,
  db: Queryable = pool,
): Promise<{ objectKey: string } | null> {
  const result = await db.query<{ object_key: string }>(
    'DELETE FROM subject_documents WHERE id = $1 RETURNING object_key',
    [documentId],
  );
  const row = result.rows[0];
  return row ? { objectKey: row.object_key } : null;
}
