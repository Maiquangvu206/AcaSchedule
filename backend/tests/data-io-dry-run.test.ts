import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Database in-memory đủ dùng cho luồng import CSV.
 *
 * Mục tiêu của bộ test này: bảo đảm nút "Kiểm tra trước (dry run)" thực sự
 * KHÔNG ghi gì vào database và báo cáo khớp với lần import thật.
 */

interface DepartmentRow { id: string }
interface MajorRow { id: string; name: string; department_id: string | null }
interface SubjectRow { id: string; name: string; credits: number }
interface CurriculumRow {
  is_required: boolean;
  semester_no: number | null;
  calculate_grade: boolean;
  /** Postgres trả `numeric` về dạng chuỗi — mô phỏng đúng để bắt lỗi so sánh. */
  process_weight: string;
  final_weight: string;
}
interface EnrollmentRow {
  id: string;
  student_id: string;
  subject_id: string;
  semester: string;
  attempt_no: number;
  process_score: string | null;
  final_score: string | null;
  letter_grade: string | null;
  grade_4: number | null;
  is_counted_in_cpa: boolean;
}

const state = {
  departments: new Map<string, DepartmentRow>(),
  majors: new Map<string, MajorRow>(),
  subjects: new Map<string, SubjectRow>(),
  curriculum: new Map<string, CurriculumRow>(),
  enrollments: [] as EnrollmentRow[],
  users: [{ id: 'user-1', student_code: 'SV001', email: 'sv@test.local' }],
};

let statements: string[] = [];
let idCounter = 0;
const nextId = () => `id-${++idCounter}`;

const pool = {
  query: vi.fn(async (sql: string, params: unknown[] = []) => {
    const s = sql.replace(/\s+/g, ' ').trim();
    statements.push(s);

    if (s.includes('AS default_process')) {
      const subject = [...state.subjects.values()].find((row) => row.id === params[0]);
      return {
        rows: subject
          ? [{ default_process: '0.40', default_final: '0.60', process_weight: null, final_weight: null }]
          : [],
      };
    }
    if (s.includes("FROM users WHERE role = 'student'")) {
      return { rows: state.users };
    }
    if (s.startsWith('SELECT id FROM departments')) {
      const row = state.departments.get(String(params[0]));
      return { rows: row ? [row] : [] };
    }
    if (s.startsWith('INSERT INTO departments')) {
      const row = { id: nextId() };
      state.departments.set(String(params[0]), row);
      return { rows: [row] };
    }
    if (s.includes('FROM majors')) {
      const row = state.majors.get(String(params[0]));
      return { rows: row ? [row] : [] };
    }
    if (s.startsWith('INSERT INTO majors')) {
      const row = { id: nextId(), name: String(params[1]), department_id: (params[2] as string) ?? null };
      state.majors.set(String(params[0]), row);
      return { rows: [row] };
    }
    if (s.startsWith('UPDATE majors')) {
      const row = state.majors.get(String(params[1]));
      if (row) row.department_id = String(params[0]);
      return { rows: [] };
    }
    if (s.includes('FROM subjects')) {
      const row = state.subjects.get(String(params[0]));
      return { rows: row ? [row] : [] };
    }
    if (s.startsWith('INSERT INTO subjects')) {
      const row = { id: nextId(), name: String(params[1]), credits: Number(params[2]) };
      state.subjects.set(String(params[0]), row);
      return { rows: [row] };
    }
    if (s.includes('FROM curriculum_subjects')) {
      const row = state.curriculum.get(`${params[0]}|${params[1]}`);
      return { rows: row ? [row] : [] };
    }
    if (s.startsWith('INSERT INTO curriculum_subjects')) {
      const row: CurriculumRow = {
        is_required: Boolean(params[2]),
        semester_no: params[3] === null ? null : Number(params[3]),
        calculate_grade: Boolean(params[4]),
        process_weight: Number(params[5]).toFixed(2),
        final_weight: Number(params[6]).toFixed(2),
      };
      state.curriculum.set(`${params[0]}|${params[1]}`, row);
      return { rows: [row] };
    }
    if (s.startsWith('UPDATE curriculum_subjects')) {
      const row: CurriculumRow = {
        is_required: Boolean(params[2]),
        semester_no: params[3] === null ? null : Number(params[3]),
        calculate_grade: Boolean(params[4]),
        process_weight: Number(params[5]).toFixed(2),
        final_weight: Number(params[6]).toFixed(2),
      };
      state.curriculum.set(`${params[0]}|${params[1]}`, row);
      return { rows: [row] };
    }
    if (s.startsWith('SELECT id, process_score')) {
      const row = state.enrollments.find(
        (item) =>
          item.student_id === params[0] &&
          item.subject_id === params[1] &&
          item.semester === params[2] &&
          item.attempt_no === Number(params[3]),
      );
      return { rows: row ? [row] : [] };
    }
    if (s.startsWith('INSERT INTO student_enrollments')) {
      const row: EnrollmentRow = {
        id: nextId(),
        student_id: String(params[0]),
        subject_id: String(params[1]),
        semester: String(params[2]),
        attempt_no: Number(params[7]),
        process_score: params[3] === null ? null : Number(params[3]).toFixed(2),
        final_score: params[4] === null ? null : Number(params[4]).toFixed(2),
        letter_grade: (params[5] as string) ?? null,
        grade_4: params[6] === null ? null : Number(params[6]),
        is_counted_in_cpa: false,
      };
      state.enrollments.push(row);
      return { rows: [row] };
    }
    if (s.startsWith('UPDATE student_enrollments SET process_score')) {
      const row = state.enrollments.find((item) => item.id === params[0]);
      if (row) {
        row.process_score = params[2] === null ? null : Number(params[2]).toFixed(2);
        row.final_score = params[3] === null ? null : Number(params[3]).toFixed(2);
        row.letter_grade = (params[4] as string) ?? null;
        row.grade_4 = params[5] === null ? null : Number(params[5]);
      }
      return { rows: [] };
    }
    if (s.startsWith('UPDATE student_enrollments SET is_counted_in_cpa')) {
      const row = state.enrollments.find((item) => item.id === params[1]);
      if (row) row.is_counted_in_cpa = Boolean(params[0]);
      return { rows: [] };
    }
    if (s.includes('FROM student_enrollments')) {
      return { rows: state.enrollments };
    }
    return { rows: [] };
  }),
};

vi.mock('../src/database/pool', () => ({ pool }));

vi.mock('../src/modules/gpa/gpa.repository', () => ({
  listGradeScales: vi.fn(async () => [
    { minScore10: 9, letterGrade: 'A+', grade4: 4, isPass: true },
    { minScore10: 8, letterGrade: 'A', grade4: 3.5, isPass: true },
    { minScore10: 6.5, letterGrade: 'C', grade4: 2, isPass: true },
    { minScore10: 5, letterGrade: 'D+', grade4: 1.5, isPass: true },
    { minScore10: 0, letterGrade: 'F', grade4: 0, isPass: false },
  ]),
  listSubjectAttempts: vi.fn(async () =>
    state.enrollments.map((row) => ({
      id: row.id,
      subjectId: row.subject_id,
      subjectCode: 'ZZ001',
      subjectName: 'Kiểm thử 1',
      credits: 3,
      semester: row.semester,
      attemptNo: row.attempt_no,
      processScore: row.process_score === null ? null : Number(row.process_score),
      finalScore: row.final_score === null ? null : Number(row.final_score),
      totalScore10: null,
      letterGrade: row.letter_grade,
      grade4: row.grade_4,
      isCountedInCpa: row.is_counted_in_cpa,
    })),
  ),
}));

const { importCurriculumCsv } = await import('../src/modules/admin/data-io/curriculum');
const { importTranscriptCsv } = await import('../src/modules/admin/data-io/transcript');

const CURRICULUM_CSV = [
  'Mã khoa,Tên khoa,Mã ngành,Tên ngành,Mã môn,Tên môn,Tín chỉ,Bắt buộc,Học kỳ,Tính điểm,Tỉ lệ Process,Tỉ lệ Final',
  'KT,Kiểm thử,SEKT,Kiểm thử tự động,ZZ001,Kiểm thử 1,3,Có,1,Có,0.4,0.6',
  'KT,Kiểm thử,SEKT,Kiểm thử tự động,ZZ002,Kiểm thử 2,4,Không,2,Không,0.3,0.7',
  'KT,Kiểm thử,SEKT,Kiểm thử tự động,ZZ001,Kiểm thử 1,3,Có,1,Có,0.5,0.5',
].join('\n');

/** Cùng nội dung nhưng không có môn trùng — dùng để kiểm tra "không đổi". */
const CURRICULUM_CSV_STABLE = [
  'Mã khoa,Tên khoa,Mã ngành,Tên ngành,Mã môn,Tên môn,Tín chỉ,Bắt buộc,Học kỳ,Tính điểm,Tỉ lệ Process,Tỉ lệ Final',
  'KT,Kiểm thử,SEKT,Kiểm thử tự động,ZZ001,Kiểm thử 1,3,Có,1,Có,0.4,0.6',
  'KT,Kiểm thử,SEKT,Kiểm thử tự động,ZZ002,Kiểm thử 2,4,Không,2,Không,0.3,0.7',
].join('\n');

const TRANSCRIPT_CSV = [
  'MSSV,Họ tên,Email,Mã môn,Tên môn,Tín chỉ,Học kỳ,Lần học,Điểm quá trình,Điểm thi',
  'SV001,Nguyễn Văn A,sv@test.local,ZZ001,Kiểm thử 1,3,HK1 2026-2027,1,7.5,8.5',
  'SV001,Nguyễn Văn A,sv@test.local,ZZ001,Kiểm thử 1,3,HK1 2026-2027,2,6,7',
].join('\n');

const writeStatements = () =>
  statements.filter(
    (sql) =>
      sql.startsWith('INSERT') ||
      sql.startsWith('UPDATE') ||
      sql.startsWith('DELETE'),
  );

beforeEach(() => {
  statements = [];
  idCounter = 0;
  pool.query.mockClear();
  state.departments.clear();
  state.majors.clear();
  state.subjects.clear();
  state.curriculum.clear();
  state.enrollments.length = 0;
});

describe('import chương trình đào tạo', () => {
  it('dry run KHÔNG ghi bất kỳ dữ liệu nào vào database', async () => {
    const report = await importCurriculumCsv(CURRICULUM_CSV, true);

    expect(writeStatements()).toEqual([]);
    expect(state.departments.size).toBe(0);
    expect(state.majors.size).toBe(0);
    expect(state.subjects.size).toBe(0);
    expect(state.curriculum.size).toBe(0);
    expect(report.created).toBe(2);
    expect(report.updated).toBe(1);
    expect(report.errors).toEqual([]);
  });

  it('báo cáo dry run khớp với kết quả import thật', async () => {
    const dry = await importCurriculumCsv(CURRICULUM_CSV, true);
    const real = await importCurriculumCsv(CURRICULUM_CSV, false);

    expect({ created: dry.created, updated: dry.updated, unchanged: dry.unchanged }).toEqual({
      created: real.created,
      updated: real.updated,
      unchanged: real.unchanged,
    });
    expect(real.created).toBe(2);
    expect(real.updated).toBe(1);
  });

  it('dòng lỗi không để lại khoa / ngành / môn mồ côi', async () => {
    const badCsv = [
      'Mã khoa,Tên khoa,Mã ngành,Tên ngành,Mã môn,Tên môn,Tín chỉ,Tỉ lệ Process,Tỉ lệ Final',
      'KT,Kiểm thử,SEKTBAD,X,ZZBAD,Tên,3,0.4,0.9',
    ].join('\n');

    const report = await importCurriculumCsv(badCsv, false);

    expect(report.errors).toHaveLength(1);
    expect(report.skipped).toBe(1);
    expect(state.departments.size).toBe(0);
    expect(state.majors.size).toBe(0);
    expect(state.subjects.size).toBe(0);
  });

  it('import lại dữ liệu không đổi thì báo "không đổi"', async () => {
    await importCurriculumCsv(CURRICULUM_CSV_STABLE, false);
    const second = await importCurriculumCsv(CURRICULUM_CSV_STABLE, false);

    expect(second.created).toBe(0);
    expect(second.updated).toBe(0);
    expect(second.unchanged).toBe(2);
  });

  it('môn trùng trong cùng file: dòng sau ghi đè và báo đúng', async () => {
    const first = await importCurriculumCsv(CURRICULUM_CSV, false);
    expect(first.created).toBe(2);
    expect(first.updated).toBe(1);

    // File có môn trùng với tỉ lệ khác nhau → chạy lại vẫn phải cập nhật, không phải "không đổi".
    const second = await importCurriculumCsv(CURRICULUM_CSV, false);
    expect(second.created).toBe(0);
    expect(second.unchanged).toBe(1);
    expect(second.updated).toBe(2);
  });
});

describe('import bảng điểm', () => {
  it('dry run KHÔNG ghi bất kỳ dữ liệu nào vào database', async () => {
    const report = await importTranscriptCsv(TRANSCRIPT_CSV, true);

    expect(writeStatements()).toEqual([]);
    expect(state.subjects.size).toBe(0);
    expect(state.enrollments).toHaveLength(0);
    expect(report.created).toBe(2);
    expect(report.errors).toEqual([]);
  });

  it('điểm lưu trong DB là numeric nên nhập lại phải báo "không đổi"', async () => {
    await importTranscriptCsv(TRANSCRIPT_CSV, false);
    expect(state.enrollments).toHaveLength(2);

    const second = await importTranscriptCsv(TRANSCRIPT_CSV, false);

    expect(second.created).toBe(0);
    expect(second.updated).toBe(0);
    expect(second.unchanged).toBe(2);
  });

  it('điểm khác thì báo "cập nhật"', async () => {
    await importTranscriptCsv(TRANSCRIPT_CSV, false);

    const changed = TRANSCRIPT_CSV.replace('7.5,8.5', '9,9');
    const report = await importTranscriptCsv(changed, false);

    expect(report.updated).toBe(1);
    expect(report.unchanged).toBe(1);
  });

  it('báo cáo dry run khớp với kết quả import thật', async () => {
    const dry = await importTranscriptCsv(TRANSCRIPT_CSV, true);
    const real = await importTranscriptCsv(TRANSCRIPT_CSV, false);

    expect({ created: dry.created, updated: dry.updated }).toEqual({
      created: real.created,
      updated: real.updated,
    });
  });
});
