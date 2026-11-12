import { pool } from '../../../database/pool';
import { normalizeHeader, parseCsv, toCsvWithBom, trimEmptyRows } from './csv';
import type { ImportReport } from './transcript';

/**
 * Nhập / xuất cấu hình lịch học (lớp học phần) hàng loạt.
 *
 * Mục tiêu: admin không phải thêm từng lớp một mà có thể tải file CSV
 * (mở bằng Excel được) rồi nhập lại; lớp đã tồn tại (cùng học kỳ + mã lớp)
 * sẽ được cập nhật thay vì báo lỗi trùng.
 *
 * Khác với bảng điểm / chương trình đào tạo, import lịch học **không tự tạo
 * môn mới** — môn phải có sẵn (hãy nhập Chương trình đào tạo trước).
 */

const SECTION_HEADERS = [
  'Học kỳ',
  'Mã môn',
  'Tên môn',
  'Mã lớp',
  'Số buổi',
  'Thứ',
  'Tiết bắt đầu',
  'Tiết kết thúc',
  'Loại lớp',
  'Ngày bắt đầu',
  'Ngày kết thúc',
  'Thứ buổi 2',
  'Tiết bắt đầu buổi 2',
  'Tiết kết thúc buổi 2',
  'Phòng',
  'Giảng viên',
  'Sĩ số',
  'Tuần nghỉ',
  'Bị huỷ',
];

type ColumnKey =
  | 'semester'
  | 'subjectCode'
  | 'subjectName'
  | 'sectionCode'
  | 'meetingCount'
  | 'dayOfWeek'
  | 'startPeriod'
  | 'endPeriod'
  | 'classType'
  | 'startDate'
  | 'endDate'
  | 'secondDayOfWeek'
  | 'secondStartPeriod'
  | 'secondEndPeriod'
  | 'room'
  | 'lecturer'
  | 'capacity'
  | 'skippedWeeks'
  | 'isCancelled';

/** Alias phải khai báo KHÔNG DẤU (header được normalizeHeader trước khi đối chiếu). */
const COLUMN_ALIASES: Record<ColumnKey, string[]> = {
  semester: ['hocky', 'semester', 'ky'],
  subjectCode: ['mamon', 'codemon', 'subjectcode', 'monhoc', 'mon'],
  subjectName: ['tenmon', 'tenmonhoc', 'subjectname'],
  sectionCode: ['malop', 'mãlop', 'malophoc', 'sectioncode', 'lop'],
  meetingCount: ['sobuoi', 'meetingcount', 'buoi'],
  dayOfWeek: ['thu', 'dayofweek', 'day'],
  startPeriod: ['tietbatdau', 'startperiod', 'tietbd'],
  endPeriod: ['tietketthuc', 'endperiod', 'tietkt'],
  classType: ['loailop', 'classtype', 'loai'],
  startDate: ['ngaybatdau', 'startdate', 'tungay'],
  endDate: ['ngayketthuc', 'enddate', 'denngay'],
  secondDayOfWeek: ['thubuoi2', 'thu2', 'seconddayofweek'],
  secondStartPeriod: ['tietbatdaubuoi2', 'tietbd2', 'secondstartperiod'],
  secondEndPeriod: ['tietketthucbuoi2', 'tietkt2', 'secondendperiod'],
  room: ['phong', 'phonghoc', 'room'],
  lecturer: ['giangvien', 'gv', 'lecturer'],
  capacity: ['siso', 'capacity'],
  skippedWeeks: ['tuannghi', 'skippedweeks', 'nghi'],
  isCancelled: ['bihuy', 'huy', 'iscancelled', 'cancelled'],
};

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

function toInt(value: string): number | null {
  const parsed = toNumber(value);
  return parsed !== null && Number.isInteger(parsed) ? parsed : null;
}

function toBoolean(value: string, fallback: boolean): boolean {
  if (!value) return fallback;
  const normalized = normalizeHeader(value);
  if (['co', 'true', '1', 'yes', 'y', 'x'].includes(normalized)) return true;
  if (['khong', 'false', '0', 'no', 'n'].includes(normalized)) return false;
  return fallback;
}

/**
 * Ngày trong lịch (date) có thể được Postgres trả về dưới dạng Date object.
 * Chuẩn hoá về chuỗi `yyyy-mm-dd` để so sánh với giá trị trong file.
 */
function toDateString(value: Date | string | null): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  return value.toISOString().slice(0, 10);
}

/** Nhận `yyyy-mm-dd` hoặc `dd/mm/yyyy` (cùng `dd-mm-yyyy`, `dd.mm.yyyy`). */
export function toIsoDate(value: string): string | null {
  if (!value) return null;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  if (iso) {
    const [, y, m, d] = iso.map(Number) as unknown as number[];
    return buildDate(y, m, d);
  }
  const dmy = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/.exec(value);
  if (dmy) {
    const [, d, m, y] = dmy.map(Number) as unknown as number[];
    return buildDate(y, m, d);
  }
  return null;
}

function buildDate(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Cột "Thứ": nhận `2`..`7` (2 = Thứ 2 … 7 = Thứ 7) hoặc chữ
 * ("Thứ 2", "Thu 2", "T2", "Thứ Hai"…).
 */
export function parseDayOfWeek(value: string): number | null {
  if (!value) return null;
  const normalized = normalizeHeader(value);
  const names: Record<string, number> = {
    thu2: 2, thu3: 3, thu4: 4, thu5: 5, thu6: 6, thu7: 7,
    t2: 2, t3: 3, t4: 4, t5: 5, t6: 6, t7: 7,
    thuha: 2, thuba: 3, thutu: 4, thunam: 5, thusau: 6, thubay: 7,
    monday: 2, tuesday: 3, wednesday: 4, thursday: 5, friday: 6, saturday: 7,
  };
  if (names[normalized] !== undefined) return names[normalized];
  const digits = normalized.match(/\d/);
  if (digits) {
    const day = Number(digits[0]);
    if (day >= 2 && day <= 7) return day;
  }
  return null;
}

/** Cột "Loại lớp": `LT`/`Lý thuyết` → lecture, `TH`/`Thực hành` → practical. */
export function parseClassType(value: string): 'lecture' | 'practical' | null {
  if (!value) return 'lecture';
  const normalized = normalizeHeader(value);
  if (['lt', 'lythuyet', 'lecture', 'ltlythuyet'].includes(normalized)) return 'lecture';
  if (['th', 'thuchanh', 'practical', 'ththuchanh'].includes(normalized)) return 'practical';
  return null;
}

/** Cột "Tuần nghỉ": `2;3` hoặc `2,3` hoặc `2 3` → mảng số tuần. */
export function parseSkippedWeeks(value: string): number[] | null {
  if (!value) return [];
  const weeks: number[] = [];
  for (const part of value.split(/[;,\s]+/)) {
    if (!part) continue;
    const week = toInt(part);
    if (week === null || week < 1 || week > 60) return null;
    weeks.push(week);
  }
  return [...new Set(weeks)].sort((a, b) => a - b);
}

/* ──────────────────────────── Export ──────────────────────────── */

interface SectionExportRow {
  semester: string;
  subject_code: string;
  subject_name: string;
  section_code: string;
  meeting_count: number;
  day_of_week: number;
  start_period: number;
  end_period: number;
  class_type: 'lecture' | 'practical';
  start_date: string | null;
  end_date: string | null;
  second_day_of_week: number | null;
  second_start_period: number | null;
  second_end_period: number | null;
  room: string | null;
  lecturer: string | null;
  capacity: number | null;
  skipped_weeks: unknown;
  is_cancelled: boolean;
}

export async function exportSectionsCsv(filters: { semester?: string }): Promise<string> {
  const result = await pool.query<SectionExportRow>(
    `SELECT cs.semester, s.code AS subject_code, s.name AS subject_name,
            cs.section_code, cs.meeting_count, cs.day_of_week,
            cs.start_period, cs.end_period, cs.class_type,
            to_char(cs.start_date, 'YYYY-MM-DD') AS start_date,
            to_char(cs.end_date, 'YYYY-MM-DD') AS end_date,
            cs.second_day_of_week, cs.second_start_period, cs.second_end_period,
            cs.room, cs.lecturer, cs.capacity,
            cs.skipped_weeks, cs.is_cancelled
       FROM course_sections cs
       JOIN subjects s ON s.id = cs.subject_id
      WHERE ($1::text IS NULL OR cs.semester = $1)
      ORDER BY cs.semester, cs.section_code, cs.day_of_week, cs.start_period`,
    [filters.semester ?? null],
  );

  const rows: (string | number | null)[][] = [SECTION_HEADERS];
  for (const row of result.rows) {
    const weeks = Array.isArray(row.skipped_weeks) ? (row.skipped_weeks as number[]) : [];
    rows.push([
      row.semester,
      row.subject_code,
      row.subject_name,
      row.section_code,
      row.meeting_count,
      row.day_of_week,
      row.start_period,
      row.end_period,
      row.class_type === 'practical' ? 'TH' : 'LT',
      row.start_date ?? '',
      row.end_date ?? '',
      row.second_day_of_week ?? '',
      row.second_start_period ?? '',
      row.second_end_period ?? '',
      row.room ?? '',
      row.lecturer ?? '',
      row.capacity ?? '',
      weeks.length ? weeks.join(';') : '',
      row.is_cancelled ? 'Có' : 'Không',
    ]);
  }

  return toCsvWithBom(rows);
}

/* ──────────────────────────── Import ──────────────────────────── */

/** Trạng thái một lớp học phần sau khi áp dụng một dòng trong file. */
interface SectionRowState {
  subjectId: string;
  dayOfWeek: number;
  startPeriod: number;
  endPeriod: number;
  classType: 'lecture' | 'practical';
  startDate: string | null;
  endDate: string | null;
  meetingCount: number;
  secondDayOfWeek: number | null;
  secondStartPeriod: number | null;
  secondEndPeriod: number | null;
  room: string | null;
  lecturer: string | null;
  capacity: number | null;
  isCancelled: boolean;
  skippedWeeks: number[];
}

interface SectionDbRow {
  id: string;
  subject_id: string;
  day_of_week: number;
  start_period: number;
  end_period: number;
  class_type: 'lecture' | 'practical';
  start_date: Date | string | null;
  end_date: Date | string | null;
  meeting_count: number;
  second_day_of_week: number | null;
  second_start_period: number | null;
  second_end_period: number | null;
  room: string | null;
  lecturer: string | null;
  capacity: number | null;
  is_cancelled: boolean;
  skipped_weeks: unknown;
}

function isSameSection(current: SectionRowState, next: SectionRowState): boolean {
  return (
    current.subjectId === next.subjectId &&
    current.dayOfWeek === next.dayOfWeek &&
    current.startPeriod === next.startPeriod &&
    current.endPeriod === next.endPeriod &&
    current.classType === next.classType &&
    toDateString(current.startDate) === next.startDate &&
    toDateString(current.endDate) === next.endDate &&
    current.meetingCount === next.meetingCount &&
    current.secondDayOfWeek === next.secondDayOfWeek &&
    current.secondStartPeriod === next.secondStartPeriod &&
    current.secondEndPeriod === next.secondEndPeriod &&
    current.room === next.room &&
    current.lecturer === next.lecturer &&
    current.capacity === next.capacity &&
    current.isCancelled === next.isCancelled &&
    JSON.stringify(current.skippedWeeks) === JSON.stringify(next.skippedWeeks)
  );
}

function fromDbRow(row: SectionDbRow): SectionRowState {
  return {
    subjectId: row.subject_id,
    dayOfWeek: row.day_of_week,
    startPeriod: row.start_period,
    endPeriod: row.end_period,
    classType: row.class_type,
    startDate: toDateString(row.start_date),
    endDate: toDateString(row.end_date),
    meetingCount: row.meeting_count,
    secondDayOfWeek: row.second_day_of_week,
    secondStartPeriod: row.second_start_period,
    secondEndPeriod: row.second_end_period,
    room: row.room,
    lecturer: row.lecturer,
    capacity: row.capacity,
    isCancelled: row.is_cancelled,
    skippedWeeks: Array.isArray(row.skipped_weeks) ? (row.skipped_weeks as number[]) : [],
  };
}

/**
 * Nhập cấu hình lịch học từ CSV.
 *
 * - Lớp xác định bằng (Học kỳ, Mã lớp): đã có → cập nhật, chưa có → tạo mới.
 * - Môn phải tồn tại sẵn (không tự tạo môn — nhập Chương trình đào tạo trước).
 * - `dryRun` chỉ kiểm tra, không ghi gì vào database nhưng báo cáo khớp
 *   100% với lần import thật.
 */
export async function importSectionsCsv(csv: string, dryRun = false): Promise<ImportReport> {
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
  if (columns.semester === undefined) {
    report.errors.push({ row: 1, message: 'Thiếu cột "Học kỳ".' });
    return report;
  }
  if (columns.subjectCode === undefined) {
    report.errors.push({ row: 1, message: 'Thiếu cột "Mã môn".' });
    return report;
  }
  if (columns.sectionCode === undefined) {
    report.errors.push({ row: 1, message: 'Thiếu cột "Mã lớp".' });
    return report;
  }
  if (columns.dayOfWeek === undefined) {
    report.errors.push({ row: 1, message: 'Thiếu cột "Thứ".' });
    return report;
  }
  if (columns.startPeriod === undefined || columns.endPeriod === undefined) {
    report.errors.push({ row: 1, message: 'Thiếu cột "Tiết bắt đầu" hoặc "Tiết kết thúc".' });
    return report;
  }

  const subjectCache = new Map<string, string | null>();
  /**
   * Lớp đã "giả lập" trong lần chạy hiện tại: dry-run không ghi database nên
   * các dòng trùng lớp trong cùng file phải đối chiếu với trạng thái giả lập
   * để báo cáo khớp đúng với kết quả import thật.
   */
  const simulatedSections = new Map<string, SectionRowState>();

  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const lineNumber = index + 1;
    report.total += 1;

    const semester = cell(row, columns.semester);
    const subjectCode = cell(row, columns.subjectCode);
    const sectionCode = cell(row, columns.sectionCode);

    if (!semester) {
      report.errors.push({ row: lineNumber, message: 'Thiếu học kỳ.' });
      report.skipped += 1;
      continue;
    }
    if (semester.length > 20) {
      report.errors.push({ row: lineNumber, message: 'Học kỳ tối đa 20 ký tự.' });
      report.skipped += 1;
      continue;
    }
    if (!subjectCode) {
      report.errors.push({ row: lineNumber, message: 'Thiếu mã môn.' });
      report.skipped += 1;
      continue;
    }
    if (!sectionCode) {
      report.errors.push({ row: lineNumber, message: 'Thiếu mã lớp.' });
      report.skipped += 1;
      continue;
    }
    if (sectionCode.length > 30) {
      report.errors.push({ row: lineNumber, message: 'Mã lớp tối đa 30 ký tự.' });
      report.skipped += 1;
      continue;
    }

    /* Kiểm tra toàn bộ số liệu TRƯỚC khi tra database — dòng lỗi không được
       để lại dữ liệu mồ côi nào. */

    const meetingCount = toInt(cell(row, columns.meetingCount)) ?? 1;
    if (meetingCount !== 1 && meetingCount !== 2) {
      report.errors.push({ row: lineNumber, message: '"Số buổi" phải là 1 hoặc 2.' });
      report.skipped += 1;
      continue;
    }

    const dayOfWeek = parseDayOfWeek(cell(row, columns.dayOfWeek));
    if (dayOfWeek === null) {
      report.errors.push({
        row: lineNumber,
        message: 'Cột "Thứ" phải là Thứ 2..Thứ 7 (điền 2..7 hoặc "Thứ 2").',
      });
      report.skipped += 1;
      continue;
    }

    const startPeriod = toInt(cell(row, columns.startPeriod));
    const endPeriod = toInt(cell(row, columns.endPeriod));
    if (
      startPeriod === null ||
      endPeriod === null ||
      startPeriod < 1 ||
      startPeriod > 12 ||
      endPeriod < 1 ||
      endPeriod > 12
    ) {
      report.errors.push({ row: lineNumber, message: 'Tiết học phải từ 1 đến 12.' });
      report.skipped += 1;
      continue;
    }
    if (endPeriod < startPeriod) {
      report.errors.push({
        row: lineNumber,
        message: 'Tiết kết thúc phải lớn hơn hoặc bằng tiết bắt đầu.',
      });
      report.skipped += 1;
      continue;
    }

    const classType = parseClassType(cell(row, columns.classType));
    if (classType === null) {
      report.errors.push({ row: lineNumber, message: '"Loại lớp" phải là LT (lý thuyết) hoặc TH (thực hành).' });
      report.skipped += 1;
      continue;
    }

    const startDateText = cell(row, columns.startDate);
    const startDate = startDateText ? toIsoDate(startDateText) : null;
    if (startDateText && !startDate) {
      report.errors.push({
        row: lineNumber,
        message: `"${startDateText}" không phải ngày hợp lệ (dùng yyyy-mm-dd hoặc dd/mm/yyyy).`,
      });
      report.skipped += 1;
      continue;
    }
    const endDateText = cell(row, columns.endDate);
    const endDate = endDateText ? toIsoDate(endDateText) : null;
    if (endDateText && !endDate) {
      report.errors.push({
        row: lineNumber,
        message: `"${endDateText}" không phải ngày hợp lệ (dùng yyyy-mm-dd hoặc dd/mm/yyyy).`,
      });
      report.skipped += 1;
      continue;
    }
    if (startDate && endDate && startDate > endDate) {
      report.errors.push({ row: lineNumber, message: 'Ngày kết thúc phải sau ngày bắt đầu.' });
      report.skipped += 1;
      continue;
    }

    let secondDayOfWeek: number | null = null;
    let secondStartPeriod: number | null = null;
    let secondEndPeriod: number | null = null;
    if (meetingCount === 2) {
      secondDayOfWeek = parseDayOfWeek(cell(row, columns.secondDayOfWeek));
      secondStartPeriod = toInt(cell(row, columns.secondStartPeriod));
      secondEndPeriod = toInt(cell(row, columns.secondEndPeriod));
      if (secondDayOfWeek === null) {
        report.errors.push({
          row: lineNumber,
          message: 'Lớp 2 buổi phải có "Thứ buổi 2" (cặp 2-5, 3-6 hoặc 4-7).',
        });
        report.skipped += 1;
        continue;
      }
      const allowedSecond =
        (dayOfWeek === 2 && secondDayOfWeek === 5) ||
        (dayOfWeek === 3 && secondDayOfWeek === 6) ||
        (dayOfWeek === 4 && secondDayOfWeek === 7);
      if (!allowedSecond) {
        report.errors.push({
          row: lineNumber,
          message: 'Lịch 2 buổi chỉ hỗ trợ cặp 2-5, 3-6 hoặc 4-7.',
        });
        report.skipped += 1;
        continue;
      }
      if (
        secondStartPeriod === null ||
        secondEndPeriod === null ||
        secondStartPeriod < 1 ||
        secondStartPeriod > 12 ||
        secondEndPeriod < secondStartPeriod ||
        secondEndPeriod > 12
      ) {
        report.errors.push({
          row: lineNumber,
          message: 'Tiết buổi 2 phải từ 1 đến 12 và kết thúc sau khi bắt đầu.',
        });
        report.skipped += 1;
        continue;
      }
    }

    const skippedWeeks = parseSkippedWeeks(cell(row, columns.skippedWeeks));
    if (skippedWeeks === null) {
      report.errors.push({
        row: lineNumber,
        message: 'Cột "Tuần nghỉ" phải là danh sách số tuần cách nhau bởi dấu ; hoặc , (ví dụ 2;3).',
      });
      report.skipped += 1;
      continue;
    }

    const capacity = toInt(cell(row, columns.capacity));
    if (cell(row, columns.capacity) && (capacity === null || capacity <= 0)) {
      report.errors.push({ row: lineNumber, message: '"Sĩ số" phải là số nguyên dương.' });
      report.skipped += 1;
      continue;
    }

    const room = cell(row, columns.room) || null;
    const lecturer = cell(row, columns.lecturer) || null;
    const isCancelled = toBoolean(cell(row, columns.isCancelled), false);

    /* Resolve môn (không tự tạo môn mới). */
    const subjectKey = subjectCode.toLowerCase();
    if (!subjectCache.has(subjectKey)) {
      const found = await pool.query<{ id: string }>(
        `SELECT id FROM subjects WHERE code = $1 LIMIT 1`,
        [subjectCode],
      );
      subjectCache.set(subjectKey, found.rows[0]?.id ?? null);
    }
    const subjectId = subjectCache.get(subjectKey);
    if (!subjectId) {
      report.errors.push({
        row: lineNumber,
        message: `Môn "${subjectCode}" chưa tồn tại — hãy nhập Chương trình đào tạo trước.`,
      });
      report.skipped += 1;
      continue;
    }

    const next: SectionRowState = {
      subjectId,
      dayOfWeek,
      startPeriod,
      endPeriod,
      classType,
      startDate,
      endDate,
      meetingCount,
      secondDayOfWeek,
      secondStartPeriod,
      secondEndPeriod,
      room,
      lecturer,
      capacity: capacity ?? null,
      isCancelled,
      skippedWeeks,
    };

    const rowKey = `${semester}|${sectionCode.toLowerCase()}`;
    const existingRows = await pool.query<SectionDbRow>(
      `SELECT id, subject_id, day_of_week, start_period, end_period, class_type,
              start_date, end_date, meeting_count, second_day_of_week,
              second_start_period, second_end_period, room, lecturer, capacity,
              is_cancelled, skipped_weeks
         FROM course_sections
        WHERE semester = $1 AND section_code = $2`,
      [semester, sectionCode],
    );
    const current = existingRows.rows[0] ? fromDbRow(existingRows.rows[0]) : simulatedSections.get(rowKey) ?? null;

    if (current) {
      if (isSameSection(current, next)) {
        report.unchanged += 1;
        continue;
      }

      if (dryRun) {
        report.updated += 1;
      } else {
        await pool.query(
          `UPDATE course_sections
              SET subject_id = $3, day_of_week = $4, start_period = $5, end_period = $6,
                  class_type = $7, start_date = $8, end_date = $9,
                  second_day_of_week = $10, second_start_period = $11, second_end_period = $12,
                  room = $13, lecturer = $14, capacity = $15, is_cancelled = $16,
                  meeting_count = $17, skipped_weeks = $18::jsonb
            WHERE semester = $1 AND section_code = $2`,
          [
            semester,
            sectionCode,
            next.subjectId,
            next.dayOfWeek,
            next.startPeriod,
            next.endPeriod,
            next.classType,
            next.startDate,
            next.endDate,
            next.secondDayOfWeek,
            next.secondStartPeriod,
            next.secondEndPeriod,
            next.room,
            next.lecturer,
            next.capacity,
            next.isCancelled,
            next.meetingCount,
            JSON.stringify(next.skippedWeeks),
          ],
        );
        report.updated += 1;
      }
    } else if (dryRun) {
      report.created += 1;
      report.warnings.push({ row: lineNumber, message: `Sẽ tạo mới lớp "${sectionCode}".` });
    } else {
      try {
        await pool.query(
          `INSERT INTO course_sections
             (subject_id, semester, section_code, day_of_week, start_period, end_period,
              class_type, start_date, end_date, second_day_of_week, second_start_period,
              second_end_period, room, lecturer, capacity, is_cancelled, meeting_count,
              skipped_weeks)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb)`,
          [
            next.subjectId,
            semester,
            sectionCode,
            next.dayOfWeek,
            next.startPeriod,
            next.endPeriod,
            next.classType,
            next.startDate,
            next.endDate,
            next.secondDayOfWeek,
            next.secondStartPeriod,
            next.secondEndPeriod,
            next.room,
            next.lecturer,
            next.capacity,
            next.isCancelled,
            next.meetingCount,
            JSON.stringify(next.skippedWeeks),
          ],
        );
      } catch (error) {
        if ((error as { code?: string }).code === '23505') {
          report.errors.push({
            row: lineNumber,
            message: `Mã lớp "${sectionCode}" đã tồn tại trong học kỳ ${semester}.`,
          });
          report.skipped += 1;
          continue;
        }
        throw error;
      }
      report.created += 1;
    }

    if (dryRun) {
      // Ghi nhận trạng thái sau khi áp dụng để dòng trùng lớp sau đó so sánh đúng.
      simulatedSections.set(rowKey, next);
    } else if (!current) {
      report.warnings.push({ row: lineNumber, message: `Đã tạo mới lớp "${sectionCode}".` });
    }
  }

  return report;
}
