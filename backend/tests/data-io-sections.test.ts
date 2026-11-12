import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Import / export cấu hình lịch học (lớp học phần) qua CSV.
 *
 * Bảo đảm các quy tắc quan trọng:
 * - Dry run KHÔNG ghi database nhưng báo cáo khớp với lần import thật.
 * - Lớp xác định bằng (học kỳ, mã lớp): đã có → cập nhật.
 * - Dòng lỗi không được để lại dữ liệu mồ côi (validate số liệu trước resolve).
 * - Không tự tạo môn mới — môn thiếu phải báo lỗi.
 */

interface SubjectRow { id: string }

interface SectionRow {
  id: string;
  subject_id: string;
  day_of_week: number;
  start_period: number;
  end_period: number;
  class_type: 'lecture' | 'practical';
  start_date: string | null;
  end_date: string | null;
  meeting_count: number;
  second_day_of_week: number | null;
  second_start_period: number | null;
  second_end_period: number | null;
  room: string | null;
  lecturer: string | null;
  capacity: number | null;
  is_cancelled: boolean;
  skipped_weeks: number[];
}

const state = {
  subjects: new Map<string, SubjectRow>(),
  sections: new Map<string, SectionRow>(),
};

let statements: string[] = [];
let idCounter = 0;
const nextId = () => `id-${++idCounter}`;

const pool = {
  query: vi.fn(async (sql: string, params: unknown[] = []) => {
    const s = sql.replace(/\s+/g, ' ').trim();
    statements.push(s);

    if (s.includes('FROM subjects WHERE code')) {
      const row = state.subjects.get(String(params[0]));
      return { rows: row ? [row] : [] };
    }
    if (s.includes('FROM course_sections WHERE semester')) {
      const key = `${params[0]}|${String(params[1]).toLowerCase()}`;
      const row = state.sections.get(key);
      return { rows: row ? [row] : [] };
    }
    if (s.startsWith('UPDATE course_sections')) {
      const key = `${params[0]}|${String(params[1]).toLowerCase()}`;
      const row = state.sections.get(key);
      if (!row) return { rows: [] };
      row.subject_id = String(params[2]);
      row.day_of_week = Number(params[3]);
      row.start_period = Number(params[4]);
      row.end_period = Number(params[5]);
      row.class_type = params[6] as 'lecture' | 'practical';
      row.start_date = (params[7] as string | null) ?? null;
      row.end_date = (params[8] as string | null) ?? null;
      row.second_day_of_week = (params[9] as number | null) ?? null;
      row.second_start_period = (params[10] as number | null) ?? null;
      row.second_end_period = (params[11] as number | null) ?? null;
      row.room = (params[12] as string | null) ?? null;
      row.lecturer = (params[13] as string | null) ?? null;
      row.capacity = (params[14] as number | null) ?? null;
      row.is_cancelled = Boolean(params[15]);
      row.meeting_count = Number(params[16]);
      row.skipped_weeks = JSON.parse(String(params[17])) as number[];
      return { rows: [row] };
    }
    if (s.startsWith('INSERT INTO course_sections')) {
      const key = `${params[1]}|${String(params[2]).toLowerCase()}`;
      const row: SectionRow = {
        id: nextId(),
        subject_id: String(params[0]),
        day_of_week: Number(params[3]),
        start_period: Number(params[4]),
        end_period: Number(params[5]),
        class_type: params[6] as 'lecture' | 'practical',
        start_date: (params[7] as string | null) ?? null,
        end_date: (params[8] as string | null) ?? null,
        second_day_of_week: (params[9] as number | null) ?? null,
        second_start_period: (params[10] as number | null) ?? null,
        second_end_period: (params[11] as number | null) ?? null,
        room: (params[12] as string | null) ?? null,
        lecturer: (params[13] as string | null) ?? null,
        capacity: (params[14] as number | null) ?? null,
        is_cancelled: Boolean(params[15]),
        meeting_count: Number(params[16]),
        skipped_weeks: JSON.parse(String(params[17])) as number[],
      };
      state.sections.set(key, row);
      return { rows: [row] };
    }
    return { rows: [] };
  }),
};

vi.mock('../src/database/pool', () => ({ pool }));

const { importSectionsCsv } = await import('../src/modules/admin/data-io/sections');
const { buildColumnMap } = await import('../src/modules/admin/data-io/sections');

/** Dựng file CSV: dòng đầu là tiêu đề, các dòng sau là dữ liệu. */
function csv(...rows: string[][]): string {
  return rows.map((row) => row.join(',')).join('\r\n');
}

const HEADER = [
  'Học kỳ', 'Mã môn', 'Tên môn', 'Mã lớp', 'Số buổi', 'Thứ',
  'Tiết bắt đầu', 'Tiết kết thúc', 'Loại lớp', 'Ngày bắt đầu', 'Ngày kết thúc',
  'Thứ buổi 2', 'Tiết bắt đầu buổi 2', 'Tiết kết thúc buổi 2',
  'Phòng', 'Giảng viên', 'Sĩ số', 'Tuần nghỉ', 'Bị huỷ',
];

const basicRow = [
  'HK1-2026', 'INT2208', 'Phát triển phần mềm', 'INT2208-01', '1', '2',
  '1', '3', 'LT', '2026-01-05', '', '', '', '',
  'A1.01', 'Nguyễn Văn A', '60', '2;3', 'Không',
];

beforeEach(() => {
  statements = [];
  idCounter = 0;
  pool.query.mockClear();
  state.subjects.clear();
  state.sections.clear();
  state.subjects.set('INT2208', { id: 'subject-int2208' });
});

describe('import cấu hình lịch học', () => {
  it('tạo lớp mới và lưu đúng các cấu hình', async () => {
    const report = await importSectionsCsv(csv(HEADER, basicRow));

    expect(report.errors).toEqual([]);
    expect(report.created).toBe(1);
    expect(report.updated).toBe(0);
    expect(report.unchanged).toBe(0);

    const row = state.sections.get('HK1-2026|int2208-01');
    expect(row).toMatchObject({
      subject_id: 'subject-int2208',
      day_of_week: 2,
      start_period: 1,
      end_period: 3,
      class_type: 'lecture',
      room: 'A1.01',
      capacity: 60,
      skipped_weeks: [2, 3],
      meeting_count: 1,
    });
  });

  it('import lại nguyên file → toàn bộ không đổi', async () => {
    await importSectionsCsv(csv(HEADER, basicRow));
    const second = await importSectionsCsv(csv(HEADER, basicRow));

    expect(second.created).toBe(0);
    expect(second.updated).toBe(0);
    expect(second.unchanged).toBe(1);
    expect(state.sections.size).toBe(1);
  });

  it('dry run KHÔNG ghi database nhưng báo cáo khớp với import thật', async () => {
    const dry = await importSectionsCsv(csv(HEADER, basicRow), true);

    expect(dry.created).toBe(1);
    expect(state.sections.size).toBe(0);
    // Không có lệnh INSERT/UPDATE nào.
    expect(statements.some((s) => s.startsWith('INSERT INTO course_sections'))).toBe(false);
    expect(statements.some((s) => s.startsWith('UPDATE course_sections'))).toBe(false);

    // Import thật sau đó cho cùng kết quả.
    const real = await importSectionsCsv(csv(HEADER, basicRow));
    expect(real.created).toBe(dry.created);
    expect(real.updated).toBe(dry.updated);
    expect(real.unchanged).toBe(dry.unchanged);
    expect(state.sections.size).toBe(1);
  });

  it('dry run với 2 dòng trùng lớp: dòng 2 là cập nhật, báo cáo khớp import thật', async () => {
    const secondRow = [...basicRow];
    secondRow[6] = '2'; // đổi tiết bắt đầu
    const file = csv(HEADER, basicRow, secondRow);

    const dry = await importSectionsCsv(file, true);
    expect(dry.created).toBe(1);
    expect(dry.updated).toBe(1);

    const real = await importSectionsCsv(file);
    expect(real.created).toBe(1);
    expect(real.updated).toBe(1);

    const row = state.sections.get('HK1-2026|int2208-01');
    expect(row?.start_period).toBe(2);
  });

  it('cập nhật lớp đã có khi cấu hình thay đổi', async () => {
    await importSectionsCsv(csv(HEADER, basicRow));

    const changed = [...basicRow];
    changed[7] = '4'; // đổi tiết kết thúc
    changed[14] = 'B2.02';
    const report = await importSectionsCsv(csv(HEADER, changed));

    expect(report.updated).toBe(1);
    const row = state.sections.get('HK1-2026|int2208-01');
    expect(row?.end_period).toBe(4);
    expect(row?.room).toBe('B2.02');
  });

  it('dòng lỗi không để lại dữ liệu mồ côi', async () => {
    const badRow = [...basicRow];
    badRow[5] = '9'; // Thứ 9 không hợp lệ
    const file = csv(HEADER, basicRow, badRow);
    const report = await importSectionsCsv(file);

    expect(report.skipped).toBe(1);
    expect(report.created).toBe(1); // dòng hợp lệ vẫn được nhập
    expect(state.sections.size).toBe(1);
  });

  it('môn chưa tồn tại → báo lỗi, không tự tạo môn', async () => {
    state.subjects.delete('INT2208');
    const report = await importSectionsCsv(csv(HEADER, basicRow));

    expect(report.created).toBe(0);
    expect(report.errors.some((e) => e.message.includes('Chương trình đào tạo'))).toBe(true);
    expect(statements.some((s) => s.startsWith('INSERT INTO subjects'))).toBe(false);
    expect(state.sections.size).toBe(0);
  });

  it('lớp 2 buổi sai cặp thứ → bị bỏ qua', async () => {
    const twoMeetings = [...basicRow];
    twoMeetings[4] = '2'; // 2 buổi
    twoMeetings[5] = '2'; // Thứ 2
    twoMeetings[11] = '3'; // buổi 2 là Thứ 3 — sai cặp (phải là 5)
    twoMeetings[12] = '6';
    twoMeetings[13] = '8';
    const report = await importSectionsCsv(csv(HEADER, twoMeetings));

    expect(report.skipped).toBe(1);
    expect(report.errors.some((e) => e.message.includes('2-5, 3-6 hoặc 4-7'))).toBe(true);
    expect(state.sections.size).toBe(0);
  });

  it('lớp thực hành 2 buổi hợp lệ cặp 2-5', async () => {
    const twoMeetings = [...basicRow];
    twoMeetings[4] = '2';
    twoMeetings[5] = '2';
    twoMeetings[8] = 'TH';
    twoMeetings[11] = '5';
    twoMeetings[12] = '6';
    twoMeetings[13] = '8';
    const report = await importSectionsCsv(csv(HEADER, twoMeetings));

    expect(report.errors).toEqual([]);
    const row = state.sections.get('HK1-2026|int2208-01');
    expect(row).toMatchObject({
      class_type: 'practical',
      meeting_count: 2,
      second_day_of_week: 5,
      second_start_period: 6,
      second_end_period: 8,
    });
  });

  it('ngày dd/mm/yyyy được đổi thành yyyy-mm-dd', async () => {
    const withDate = [...basicRow];
    withDate[9] = '05/01/2026';
    withDate[10] = '20/04/2026';
    const report = await importSectionsCsv(csv(HEADER, withDate));

    expect(report.errors).toEqual([]);
    expect(state.sections.get('HK1-2026|int2208-01')).toMatchObject({
      start_date: '2026-01-05',
      end_date: '2026-04-20',
    });
  });

  it('nhận alias tiêu đề tiếng Việt viết thường không dấu', async () => {
    const aliasHeader = [
      'hocky', 'mamon', 'tenmon', 'malop', 'sobuoi', 'thu',
      'tietbatdau', 'tietketthuc', 'loailop', 'ngaybatdau', 'ngayketthuc',
      'thubuoi2', 'tietbatdaubuoi2', 'tietketthucbuoi2',
      'phong', 'giangvien', 'siso', 'tuannghi', 'bihuy',
    ];
    const report = await importSectionsCsv(csv(aliasHeader, basicRow));

    expect(report.errors).toEqual([]);
    expect(report.created).toBe(1);
    expect(buildColumnMap(aliasHeader)).toMatchObject({
      semester: 0,
      subjectCode: 1,
      sectionCode: 3,
      dayOfWeek: 5,
      skippedWeeks: 17,
    });
  });

  it('cột "Thứ" nhận dạng chữ ("Thứ 2") lẫn số (2)', async () => {
    const withText = [...basicRow];
    withText[5] = 'Thứ 2';
    const report = await importSectionsCsv(csv(HEADER, withText));

    expect(report.errors).toEqual([]);
    expect(state.sections.get('HK1-2026|int2208-01')?.day_of_week).toBe(2);
  });
});
