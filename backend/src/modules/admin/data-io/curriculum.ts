import { randomUUID } from 'node:crypto';
import { pool } from '../../../database/pool';
import { normalizeHeader, parseCsv, toCsvWithBom, trimEmptyRows } from './csv';
import type { ImportIssue, ImportReport } from './transcript';

/**
 * Nhập / xuất chương trình đào tạo (khoa → ngành → môn học + cấu hình).
 *
 * Mục tiêu: admin không phải thêm từng môn một mà có thể tải file Excel
 * lên; khoa, ngành và môn chưa có sẽ được tạo luôn.
 */

const CURRICULUM_HEADERS = [
  'Mã khoa',
  'Tên khoa',
  'Mã ngành',
  'Tên ngành',
  'Mã môn',
  'Tên môn',
  'Tín chỉ',
  'Bắt buộc',
  'Học kỳ',
  'Tính điểm',
  'Tỉ lệ Process',
  'Tỉ lệ Final',
];

type ColumnKey =
  | 'departmentCode'
  | 'departmentName'
  | 'majorCode'
  | 'majorName'
  | 'subjectCode'
  | 'subjectName'
  | 'credits'
  | 'isRequired'
  | 'semesterNo'
  | 'calculateGrade'
  | 'processWeight'
  | 'finalWeight';

const COLUMN_ALIASES: Record<ColumnKey, string[]> = {
  departmentCode: ['makhoa', 'codekhoa', 'departmentcode', 'khoa'],
  departmentName: ['tenkhoa', 'namekhoa', 'departmentname'],
  majorCode: ['manganh', 'codenganh', 'majorcode', 'nganh'],
  majorName: ['tennganh', 'namenganh', 'majorname'],
  subjectCode: ['mamon', 'codemon', 'subjectcode', 'mon'],
  subjectName: ['tenmon', 'subjectname', 'tenmonhoc'],
  credits: ['tinchi', 'credits', 'sotc'],
  isRequired: ['batbuoc', 'required', 'isrequired'],
  semesterNo: ['hocky', 'semesterno', 'semester', 'ky'],
  calculateGrade: ['tinhdiem', 'calculategrade', 'tinhcpa'],
  processWeight: ['tileprocess', 'processweight', 'process', 'typrocess'],
  finalWeight: ['tilefinal', 'finalweight', 'final', 'tyfinal'],
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
  const parsed = Number(value.replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function toBoolean(value: string, fallback: boolean): boolean {
  if (!value) return fallback;
  const normalized = normalizeHeader(value);
  if (['co', 'true', '1', 'yes', 'y', 'x'].includes(normalized)) return true;
  if (['khong', 'false', '0', 'no', 'n'].includes(normalized)) return false;
  return fallback;
}

interface CurriculumExportRow {
  department_code: string | null;
  department_name: string | null;
  major_code: string;
  major_name: string;
  subject_code: string;
  subject_name: string;
  credits: number;
  is_required: boolean;
  semester_no: number | null;
  calculate_grade: boolean;
  process_weight: number;
  final_weight: number;
}

export async function exportCurriculumCsv(filters: {
  majorId?: string;
}): Promise<string> {
  const result = await pool.query<CurriculumExportRow>(
    `SELECT d.code AS department_code, d.name AS department_name,
            m.code AS major_code, m.name AS major_name,
            s.code AS subject_code, s.name AS subject_name, s.credits,
            cs.is_required, cs.semester_no, cs.calculate_grade,
            cs.process_weight, cs.final_weight
       FROM curriculum_subjects cs
       JOIN majors m ON m.id = cs.major_id
       JOIN subjects s ON s.id = cs.subject_id
       LEFT JOIN departments d ON d.id = m.department_id
      WHERE ($1::uuid IS NULL OR m.id = $1)
      ORDER BY d.code NULLS LAST, m.code, cs.semester_no NULLS LAST, s.code`,
    [filters.majorId ?? null],
  );

  const rows: (string | number | null)[][] = [CURRICULUM_HEADERS];
  for (const row of result.rows) {
    rows.push([
      row.department_code ?? '',
      row.department_name ?? '',
      row.major_code,
      row.major_name,
      row.subject_code,
      row.subject_name,
      row.credits,
      row.is_required ? 'Có' : 'Không',
      row.semester_no ?? '',
      row.calculate_grade ? 'Có' : 'Không',
      row.process_weight,
      row.final_weight,
    ]);
  }

  return toCsvWithBom(rows);
}

/**
 * Nhập chương trình đào tạo từ CSV.
 *
 * Khoa / ngành / môn chưa tồn tại sẽ được tạo mới. Môn đã tồn tại giữ nguyên
 * tín chỉ (chỉ ghi đè khi file có cột tín chỉ khác và báo cảnh báo).
 */
export async function importCurriculumCsv(
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
  if (columns.majorCode === undefined) {
    report.errors.push({ row: 1, message: 'Thiếu cột "Mã ngành".' });
    return report;
  }
  if (columns.subjectCode === undefined) {
    report.errors.push({ row: 1, message: 'Thiếu cột "Mã môn".' });
    return report;
  }

  const departmentCache = new Map<string, string>();
  const majorCache = new Map<string, string>();
  const subjectCache = new Map<string, { id: string; credits: number }>();
  /**
   * Bản ghi chương trình đào tạo đã "giả lập" trong lần chạy hiện tại.
   *
   * Khi kiểm tra (dry run) không ghi gì vào database nên các dòng trùng môn
   * trong cùng file cần được đối chiếu với trạng thái giả lập để báo cáo
   * khớp đúng với kết quả thật (tạo mới / cập nhật / không đổi).
   */
  const simulatedRows = new Map<string, CurriculumRowState>();

  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const lineNumber = index + 1;
    report.total += 1;

    const majorCode = cell(row, columns.majorCode);
    const majorName = cell(row, columns.majorName);
    const subjectCode = cell(row, columns.subjectCode);
    const subjectName = cell(row, columns.subjectName);

    if (!majorCode) {
      report.errors.push({ row: lineNumber, message: 'Thiếu mã ngành.' });
      report.skipped += 1;
      continue;
    }
    if (!subjectCode) {
      report.errors.push({ row: lineNumber, message: 'Thiếu mã môn.' });
      report.skipped += 1;
      continue;
    }

    /* Kiểm tra số liệu TRƯỚC khi tạo khoa / ngành / môn — dòng lỗi không được
       để lại dữ liệu mồ côi trong database. */
    const isRequired = toBoolean(cell(row, columns.isRequired), true);
    const calculateGrade = toBoolean(cell(row, columns.calculateGrade), true);
    const semesterNo = toNumber(cell(row, columns.semesterNo));
    if (semesterNo !== null && (semesterNo < 1 || semesterNo > 20)) {
      report.errors.push({ row: lineNumber, message: 'Học kỳ trong chương trình phải từ 1 đến 20.' });
      report.skipped += 1;
      continue;
    }

    const processWeight = toNumber(cell(row, columns.processWeight)) ?? 0.4;
    const finalWeight = toNumber(cell(row, columns.finalWeight)) ?? 0.6;
    if (
      processWeight < 0 ||
      processWeight > 1 ||
      finalWeight < 0 ||
      finalWeight > 1 ||
      Math.abs(processWeight + finalWeight - 1) > 0.001
    ) {
      report.errors.push({
        row: lineNumber,
        message: 'Tỉ lệ Process + Final phải bằng 1 (ví dụ 0.4 và 0.6).',
      });
      report.skipped += 1;
      continue;
    }

    const departmentId = await resolveDepartment(
      cell(row, columns.departmentCode),
      cell(row, columns.departmentName),
      departmentCache,
      report,
      lineNumber,
      dryRun,
    );

    const majorId = await resolveMajor(
      majorCode,
      majorName,
      departmentId,
      majorCache,
      report,
      lineNumber,
      dryRun,
    );
    if (!majorId) {
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

    const rowKey = `${majorId}|${subject.id}`;
    const existing = await pool.query<{
      is_required: boolean;
      semester_no: number | null;
      calculate_grade: boolean;
      process_weight: number | string;
      final_weight: number | string;
    }>(
      `SELECT is_required, semester_no, calculate_grade, process_weight, final_weight
         FROM curriculum_subjects
        WHERE major_id = $1 AND subject_id = $2`,
      [majorId, subject.id],
    );

    const next: CurriculumRowState = {
      isRequired,
      semesterNo,
      calculateGrade,
      processWeight,
      finalWeight,
    };
    const current = existing.rows[0] ?? simulatedRows.get(rowKey) ?? null;

    if (current) {
      if (isSameRow(current, next)) {
        report.unchanged += 1;
        continue;
      }

      if (dryRun) {
        report.updated += 1;
      } else {
      await pool.query(
        `UPDATE curriculum_subjects
            SET is_required = $3, semester_no = $4, calculate_grade = $5,
                process_weight = $6, final_weight = $7
          WHERE major_id = $1 AND subject_id = $2`,
        [
          majorId,
          subject.id,
          isRequired,
          semesterNo,
          calculateGrade,
          processWeight,
          finalWeight,
        ],
      );
      report.updated += 1;
      }
    } else if (dryRun) {
      report.created += 1;
      simulatedRows.set(rowKey, next);
    } else {
      await pool.query(
        `INSERT INTO curriculum_subjects
           (major_id, subject_id, is_required, semester_no, calculate_grade,
            process_weight, final_weight)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [majorId, subject.id, isRequired, semesterNo, calculateGrade, processWeight, finalWeight],
      );
      report.created += 1;
    }

    if (dryRun) {
      // Ghi nhận trạng thái sau khi cập nhật để dòng trùng môn sau đó so sánh đúng.
      simulatedRows.set(rowKey, next);
    }
  }

  return report;
}

/** Trạng thái một bản ghi chương trình đào tạo (môn của một ngành). */
interface CurriculumRowState {
  isRequired: boolean;
  semesterNo: number | null;
  calculateGrade: boolean;
  processWeight: number;
  finalWeight: number;
}

/** So sánh bản ghi trong database với bản ghi trong file (numeric trả về chuỗi). */
function isSameRow(current: {
  is_required: boolean;
  semester_no: number | null;
  calculate_grade: boolean;
  process_weight: number | string;
  final_weight: number | string;
}, next: CurriculumRowState): boolean {
  return (
    current.is_required === next.isRequired &&
    (current.semester_no ?? null) === next.semesterNo &&
    current.calculate_grade === next.calculateGrade &&
    Number(current.process_weight) === next.processWeight &&
    Number(current.final_weight) === next.finalWeight
  );
}

async function resolveDepartment(
  code: string,
  name: string,
  cache: Map<string, string>,
  report: ImportReport,
  lineNumber: number,
  dryRun: boolean,
): Promise<string | null> {
  const key = code.trim().toLowerCase();
  if (!key) return null;

  const cached = cache.get(key);
  if (cached) return cached;

  const found = await pool.query<{ id: string }>(
    `SELECT id FROM departments WHERE code = $1 LIMIT 1`,
    [code],
  );
  if (found.rows[0]) {
    cache.set(key, found.rows[0].id);
    return found.rows[0].id;
  }

  if (dryRun) {
    // Chỉ kiểm tra — không tạo khoa thật, dùng id tạm để nối các dòng sau.
    const syntheticId = randomUUID();
    cache.set(key, syntheticId);
    report.warnings.push({ row: lineNumber, message: `Sẽ tạo mới khoa "${code}".` });
    return syntheticId;
  }

  const created = await pool.query<{ id: string }>(
    `INSERT INTO departments (code, name) VALUES ($1, $2) RETURNING id`,
    [code, name || code],
  );
  cache.set(key, created.rows[0].id);
  report.warnings.push({ row: lineNumber, message: `Đã tạo mới khoa "${code}".` });
  return created.rows[0].id;
}

async function resolveMajor(
  code: string,
  name: string,
  departmentId: string | null,
  cache: Map<string, string>,
  report: ImportReport,
  lineNumber: number,
  dryRun: boolean,
): Promise<string | null> {
  const key = code.trim().toLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;

  const found = await pool.query<{ id: string; department_id: string | null }>(
    `SELECT id, department_id FROM majors WHERE code = $1 LIMIT 1`,
    [code],
  );
  if (found.rows[0]) {
    cache.set(key, found.rows[0].id);
    if (departmentId && !found.rows[0].department_id) {
      if (dryRun) {
        report.warnings.push({ row: lineNumber, message: `Sẽ gán khoa cho ngành "${code}".` });
      } else {
        await pool.query(
          `UPDATE majors SET department_id = $2 WHERE id = $1 AND department_id IS NULL`,
          [found.rows[0].id, departmentId],
        );
      }
    }
    return found.rows[0].id;
  }

  if (dryRun) {
    // Chỉ kiểm tra — không tạo ngành thật, dùng id tạm để nối các dòng sau.
    const syntheticId = randomUUID();
    cache.set(key, syntheticId);
    report.warnings.push({ row: lineNumber, message: `Sẽ tạo mới ngành "${code}".` });
    return syntheticId;
  }

  const created = await pool.query<{ id: string }>(
    `INSERT INTO majors (code, name, department_id) VALUES ($1, $2, $3) RETURNING id`,
    [code, name || code, departmentId],
  );
  cache.set(key, created.rows[0].id);
  report.warnings.push({ row: lineNumber, message: `Đã tạo mới ngành "${code}".` });
  return created.rows[0].id;
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
    cache.set(key, found.rows[0]);
    return found.rows[0];
  }

  const credits = toNumber(creditsText);
  if (credits === null || credits <= 0) {
    report.errors.push({
      row: lineNumber,
      message: `Môn "${subjectCode}" chưa tồn tại và thiếu cột "Tín chỉ" hợp lệ để tạo mới.`,
    });
    return null;
  }

  if (dryRun) {
    // Chỉ kiểm tra — không tạo môn thật, dùng id tạm để nối các dòng sau.
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
  cache.set(key, created.rows[0]);
  report.warnings.push({
    row: lineNumber,
    message: `Đã tạo mới môn "${subjectCode}" (${credits} tín chỉ).`,
  });
  return created.rows[0];
}
