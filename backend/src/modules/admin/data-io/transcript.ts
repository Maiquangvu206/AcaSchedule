import { randomUUID } from 'node:crypto';
import { pool } from '../../../database/pool';
import { listGradeScales, listSubjectAttempts } from '../../gpa/gpa.repository';
import { calculateGpa, compositeScore, scoreToGrade } from '../../gpa/gpa.engine';
import { normalizeHeader, parseCsv, toCsvWithBom, trimEmptyRows } from './csv';

/**
 * Nhập / xuất bảng điểm hàng loạt.
 *
 * Mục tiêu: admin không phải cấu hình từng lượt một mà có thể tải file Excel
 * lên rồi hệ thống tự tạo môn / điểm và báo cáo dòng lỗi.
 */

export interface ImportIssue {
  /** Số dòng trong file (2 = dòng đầu tiên sau tiêu đề). */
  row: number;
  message: string;
}

export interface ImportReport {
  total: number;
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  errors: ImportIssue[];
  warnings: ImportIssue[];
}

const TRANSCRIPT_HEADERS = [
  'MSSV',
  'Họ tên',
  'Email',
  'Mã ngành',
  'Mã môn',
  'Tên môn',
  'Tín chỉ',
  'Học kỳ',
  'Lần học',
  'Điểm quá trình',
  'Điểm thi',
  'Điểm hệ 10',
  'Điểm chữ',
  'Điểm hệ 4',
  'Tính vào CPA',
];

type ColumnKey =
  | 'studentCode'
  | 'fullName'
  | 'email'
  | 'majorCode'
  | 'subjectCode'
  | 'subjectName'
  | 'credits'
  | 'semester'
  | 'attemptNo'
  | 'processScore'
  | 'finalScore';

const COLUMN_ALIASES: Record<ColumnKey, string[]> = {
  studentCode: ['mssv', 'masinhvien', 'sinhviencode', 'studentcode', 'code'],
  fullName: ['hoten', 'ten', 'tennguoidung', 'fullname', 'name'],
  email: ['email', 'mail', 'emailnguoidung'],
  majorCode: ['manganh', 'codenganh', 'majorcode', 'nganh'],
  subjectCode: ['mamon', 'codemon', 'subjectcode', 'mon'],
  subjectName: ['tenmon', 'subjectname', 'tenmonhoc'],
  credits: ['tinchi', 'credits', 'sotc'],
  semester: ['hocky', 'semester', 'ky', 'hocphanky'],
  attemptNo: ['lanhoc', 'lan', 'attemptno', 'attempt', 'solan'],
  processScore: ['diemqt', 'diemquatrinh', 'processscore', 'process', 'qt'],
  finalScore: ['diemthi', 'diemcuoi', 'finalscore', 'final', 'thi'],
};

/** Tên cột trong file CSV (đã bỏ dấu) → cột của hệ thống. */
export function buildColumnMap(header: string[]): Partial<Record<ColumnKey, number>> {
  const map: Partial<Record<ColumnKey, number>> = {};
  header.forEach((raw, index) => {
    const key = normalizeHeader(raw);
    for (const [column, aliases] of Object.entries(COLUMN_ALIASES) as [ColumnKey, string[]][]) {
      if (map[column] !== undefined) continue;
      if (aliases.includes(key)) {
        map[column] = index;
        break;
      }
    }
  });
  return map;
}

function cell(row: string[], index: number | undefined): string {
  if (index === undefined) return '';
  return (row[index] ?? '').trim();
}

function toNumber(value: string): number | null {
  if (!value) return null;
  const normalized = value.replace(',', '.').trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * `numeric` trong Postgres trả về chuỗi ("7.50") nên cần chuẩn hoá về number
 * trước khi so sánh — nếu không, mọi lượt đã có điểm sẽ bị coi là "đã cập nhật".
 */
function sameScore(a: unknown, b: number | null): boolean {
  if (a === null || a === undefined || a === '') return b === null;
  if (b === null) return false;
  return Number(a) === b;
}

interface TranscriptExportRow {
  student_code: string | null;
  full_name: string;
  email: string;
  major_code: string | null;
  subject_code: string;
  subject_name: string;
  credits: number;
  semester: string;
  attempt_no: number;
  process_score: number | null;
  final_score: number | null;
  total_score_10: number | null;
  letter_grade: string | null;
  grade_4: number | null;
  is_counted_in_cpa: boolean;
}

/** Toàn bộ lượt học, kèm điểm hệ 10 / chữ / hệ 4 theo thang điểm hiện tại. */
export async function exportTranscriptCsv(filters: {
  semester?: string;
  majorId?: string;
  studentId?: string;
}): Promise<string> {
  const result = await pool.query<TranscriptExportRow>(
    `SELECT t.student_code, t.full_name, t.email, t.major_code, t.subject_code,
            t.subject_name, t.credits, t.semester, t.attempt_no,
            t.process_score, t.final_score, t.total_score_10,
            g.letter_grade, g.grade_4, t.is_counted_in_cpa
       FROM (
         SELECT e.student_id,
                u.student_code,
                u.full_name,
                u.email,
                s.code AS subject_code,
                s.name AS subject_name,
                s.credits,
                e.semester,
                e.attempt_no,
                e.process_score,
                e.final_score,
                e.is_counted_in_cpa,
                m.major_code,
                CASE
                  WHEN e.process_score IS NOT NULL AND e.final_score IS NOT NULL
                  THEN ROUND(
                    e.process_score * COALESCE(m.process_weight, s.process_weight)
                    + e.final_score * COALESCE(m.final_weight, s.final_weight), 2)
                  ELSE NULL
                END AS total_score_10
           FROM student_enrollments e
           JOIN users u ON u.id = e.student_id
           JOIN subjects s ON s.id = e.subject_id
           LEFT JOIN LATERAL (
             SELECT cm.code AS major_code, cs.process_weight, cs.final_weight
               FROM user_majors um
               JOIN majors cm ON cm.id = um.major_id
               LEFT JOIN curriculum_subjects cs
                 ON cs.major_id = cm.id AND cs.subject_id = e.subject_id
              WHERE um.user_id = e.student_id
              ORDER BY um.is_primary DESC, cm.code
              LIMIT 1
           ) m ON true
          WHERE ($1::text IS NULL OR e.semester = $1)
            AND ($2::uuid IS NULL OR u.id = $2)
            AND ($3::uuid IS NULL OR EXISTS (
                  SELECT 1 FROM user_majors um2
                   WHERE um2.user_id = u.id AND um2.major_id = $3))
       ) t
       LEFT JOIN LATERAL (
         SELECT gs.letter_grade, gs.grade_4
           FROM grade_scales gs
          WHERE t.total_score_10 IS NOT NULL
            AND gs.min_score_10 <= t.total_score_10
          ORDER BY gs.min_score_10 DESC
          LIMIT 1
       ) g ON true
      ORDER BY t.full_name, t.subject_code, t.semester, t.attempt_no`,
    [filters.semester ?? null, filters.studentId ?? null, filters.majorId ?? null],
  );

  const rows: (string | number | null)[][] = [TRANSCRIPT_HEADERS];
  for (const row of result.rows) {
    rows.push([
      row.student_code ?? '',
      row.full_name,
      row.email,
      row.major_code ?? '',
      row.subject_code,
      row.subject_name,
      row.credits,
      row.semester,
      row.attempt_no,
      row.process_score ?? '',
      row.final_score ?? '',
      row.total_score_10 ?? '',
      row.letter_grade ?? '',
      row.grade_4 ?? '',
      row.is_counted_in_cpa ? 'Có' : 'Không',
    ]);
  }

  return toCsvWithBom(rows);
}

interface StudentRow {
  id: string;
  student_code: string | null;
  email: string;
}

/**
 * Nhập bảng điểm từ CSV.
 *
 * - Tìm sinh viên theo MSSV, nếu không có thì theo email.
 * - Môn chưa tồn tại sẽ được tạo mới (lấy tên + tín chỉ trong file).
 * - Lượt đã có (cùng sinh viên / môn / học kỳ / lần học) sẽ được cập nhật điểm.
 * - Điểm chữ / hệ 4 được tính lại theo thang điểm và tỉ lệ của ngành chính.
 */
export async function importTranscriptCsv(
  csv: string,
  dryRun = false,
): Promise<ImportReport> {
  const report: ImportReport = {
    total: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    skipped: 0,
    errors: [],
    warnings: [],
  };

  const rows = trimEmptyRows(parseCsv(csv));
  if (rows.length < 2) {
    report.errors.push({ row: 0, message: 'File trống hoặc thiếu dòng tiêu đề.' });
    return report;
  }

  const columns = buildColumnMap(rows[0]);
  if (columns.subjectCode === undefined) {
    report.errors.push({ row: 1, message: 'Thiếu cột "Mã môn".' });
    return report;
  }
  if (columns.semester === undefined) {
    report.errors.push({ row: 1, message: 'Thiếu cột "Học kỳ".' });
    return report;
  }
  if (columns.studentCode === undefined && columns.email === undefined) {
    report.errors.push({
      row: 1,
      message: 'Thiếu cột định danh sinh viên ("MSSV" hoặc "Email").',
    });
    return report;
  }

  const scales = await listGradeScales();
  const students = await loadStudents();
  const studentsByCode = new Map<string, StudentRow>();
  const studentsByEmail = new Map<string, StudentRow>();
  for (const student of students) {
    if (student.student_code) studentsByCode.set(student.student_code.trim().toLowerCase(), student);
    studentsByEmail.set(student.email.trim().toLowerCase(), student);
  }

  const subjectCache = new Map<string, { id: string; credits: number }>();

  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const lineNumber = index + 1;
    report.total += 1;

    const studentCode = cell(row, columns.studentCode);
    const email = cell(row, columns.email);
    const subjectCode = cell(row, columns.subjectCode);
    const subjectName = cell(row, columns.subjectName);
    const semester = cell(row, columns.semester);
    const attemptNo = toNumber(cell(row, columns.attemptNo)) ?? 1;

    if (!studentCode && !email) {
      report.errors.push({ row: lineNumber, message: 'Thiếu MSSV hoặc email.' });
      report.skipped += 1;
      continue;
    }
    if (!subjectCode) {
      report.errors.push({ row: lineNumber, message: 'Thiếu mã môn.' });
      report.skipped += 1;
      continue;
    }
    if (!semester) {
      report.errors.push({ row: lineNumber, message: 'Thiếu học kỳ.' });
      report.skipped += 1;
      continue;
    }

    const student = studentCode
      ? studentsByCode.get(studentCode.toLowerCase())
      : undefined;
    const resolvedStudent =
      student ?? (email ? studentsByEmail.get(email.toLowerCase()) : undefined);
    if (!resolvedStudent) {
      report.errors.push({
        row: lineNumber,
        message: `Không tìm thấy sinh viên "${studentCode || email}".`,
      });
      report.skipped += 1;
      continue;
    }

    const processScore = toNumber(cell(row, columns.processScore));
    const finalScore = toNumber(cell(row, columns.finalScore));
    if (processScore !== null && (processScore < 0 || processScore > 10)) {
      report.errors.push({ row: lineNumber, message: 'Điểm quá trình phải từ 0 đến 10.' });
      report.skipped += 1;
      continue;
    }
    if (finalScore !== null && (finalScore < 0 || finalScore > 10)) {
      report.errors.push({ row: lineNumber, message: 'Điểm thi phải từ 0 đến 10.' });
      report.skipped += 1;
      continue;
    }
    if ((processScore === null) !== (finalScore === null)) {
      report.errors.push({
        row: lineNumber,
        message: 'Phải nhập cả điểm quá trình và điểm thi, hoặc để trống cả hai.',
      });
      report.skipped += 1;
      continue;
    }

    const subject = await resolveSubject(
      subjectCode,
      subjectName,
      cell(row, columns.credits),
      subjectCache,
      report,
      lineNumber,
      dryRun,
    );
    if (!subject) {
      report.skipped += 1;
      continue;
    }

    const weights = await resolveWeights(subject.id, resolvedStudent.id);
    const totalScore10 =
      processScore !== null && finalScore !== null
        ? compositeScore(processScore, finalScore, weights.processWeight)
        : null;
    const scale = totalScore10 !== null ? scoreToGrade(totalScore10, scales) : null;
    if (totalScore10 !== null && !scale) {
      report.errors.push({
        row: lineNumber,
        message: 'Điểm không nằm trong thang điểm đã cấu hình.',
      });
      report.skipped += 1;
      continue;
    }

    const existing = await pool.query<{
      id: string;
      process_score: number | null;
      final_score: number | null;
    }>(
      `SELECT id, process_score, final_score
         FROM student_enrollments
        WHERE student_id = $1 AND subject_id = $2 AND semester = $3 AND attempt_no = $4
        LIMIT 1`,
      [resolvedStudent.id, subject.id, semester, attemptNo],
    );

    if (existing.rows[0]) {
      const current = existing.rows[0];
      const unchanged =
        sameScore(current.process_score, processScore) &&
        sameScore(current.final_score, finalScore);
      if (unchanged) {
        report.unchanged += 1;
        continue;
      }
      if (dryRun) {
        report.updated += 1;
      } else {
      await pool.query(
        `UPDATE student_enrollments
            SET process_score = $2, final_score = $3, letter_grade = $4, grade_4 = $5
          WHERE id = $1`,
        [
          current.id,
          processScore,
          finalScore,
          scale?.letterGrade ?? null,
          scale?.grade4 ?? null,
        ],
      );
      report.updated += 1;
      }
    } else if (dryRun) {
      report.created += 1;
    } else {
      await pool.query(
        `INSERT INTO student_enrollments
           (student_id, subject_id, semester, process_score, final_score,
            letter_grade, grade_4, is_counted_in_cpa, attempt_no)
         VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8)`,
        [
          resolvedStudent.id,
          subject.id,
          semester,
          processScore,
          finalScore,
          scale?.letterGrade ?? null,
          scale?.grade4 ?? null,
          attemptNo,
        ],
      );
      report.created += 1;
    }

    if (!dryRun) {
      await recomputeCountedFlags(resolvedStudent.id, subject.id);
    }
  }

  return report;
}

async function loadStudents(): Promise<StudentRow[]> {
  const result = await pool.query<StudentRow>(
    `SELECT id, student_code, email FROM users WHERE role = 'student'`,
  );
  return result.rows;
}

async function resolveSubject(
  subjectCode: string,
  subjectName: string,
  creditsText: string,
  cache: Map<string, { id: string; credits: number }>,
  report: ImportReport,
  lineNumber: number,
  dryRun: boolean,
): Promise<{ id: string; credits: number } | null> {
  const key = subjectCode.trim().toLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;

  const found = await pool.query<{ id: string; credits: number }>(
    `SELECT id, credits FROM subjects WHERE code = $1 LIMIT 1`,
    [subjectCode],
  );
  if (found.rows[0]) {
    const subject = found.rows[0];
    cache.set(key, subject);
    return subject;
  }

  const credits = toNumber(creditsText);
  if (credits === null || credits < 0) {
    report.errors.push({
      row: lineNumber,
      message: `Môn "${subjectCode}" chưa tồn tại và thiếu cột "Tín chỉ" hợp lệ để tạo mới.`,
    });
    return null;
  }

  if (dryRun) {
    // Chỉ kiểm tra — không ghi môn mới vào database.
    const subject = { id: randomUUID(), credits };
    cache.set(key, subject);
    report.warnings.push({
      row: lineNumber,
      message: `Sẽ tạo mới môn "${subjectCode}" (${credits} tín chỉ).`,
    });
    return subject;
  }

  const created = await pool.query<{ id: string; credits: number }>(
    `INSERT INTO subjects (code, name, credits, knowledge_block)
     VALUES ($1, $2, $3, 'Khác') RETURNING id, credits`,
    [subjectCode, subjectName || subjectCode, credits],
  );
  const subject = created.rows[0];
  cache.set(key, subject);
  report.warnings.push({
    row: lineNumber,
    message: `Đã tạo mới môn "${subjectCode}" (${credits} tín chỉ).`,
  });
  return subject;
}

/** Tỉ lệ process/final của ngành chính, fallback về tỉ lệ mặc định của môn. */
async function resolveWeights(
  subjectId: string,
  studentId: string,
): Promise<{ processWeight: number; finalWeight: number }> {
  const result = await pool.query<{
    process_weight: number | null;
    final_weight: number | null;
    default_process: number;
    default_final: number;
  }>(
    `SELECT s.process_weight AS default_process, s.final_weight AS default_final,
            cs.process_weight, cs.final_weight
       FROM subjects s
       LEFT JOIN LATERAL (
         SELECT c.process_weight, c.final_weight
           FROM user_majors um
           JOIN majors cm ON cm.id = um.major_id
           LEFT JOIN curriculum_subjects c
             ON c.major_id = cm.id AND c.subject_id = s.id
          WHERE um.user_id = $2
          ORDER BY um.is_primary DESC, cm.code
          LIMIT 1
       ) cs ON true
      WHERE s.id = $1`,
    [subjectId, studentId],
  );

  const row = result.rows[0];
  return {
    processWeight: Number(row?.process_weight ?? row?.default_process ?? 0.4),
    finalWeight: Number(row?.final_weight ?? row?.default_final ?? 0.6),
  };
}

/** Tính lại lượt nào được tính vào CPA cho một môn của sinh viên. */
async function recomputeCountedFlags(studentId: string, subjectId: string): Promise<void> {
  const attempts = await listSubjectAttempts(studentId, subjectId);
  if (!attempts.length) return;

  const calculation = calculateGpa(attempts);
  const countedId = calculation.subjects[0]?.countedAttemptId ?? null;

  for (const attempt of attempts) {
    await pool.query(
      `UPDATE student_enrollments SET is_counted_in_cpa = $1 WHERE id = $2`,
      [attempt.id === countedId, attempt.id],
    );
  }
}
