import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Hồi quy cho lỗi 500 trên trang mô phỏng đăng ký lớp:
 *
 *   TypeError: value.split is not a function (parseDateOnly)
 *
 * Nguyên nhân: node-pg trả cột `date` (start_date/end_date của lớp, start_date
 * của học kỳ) là **Date object** — lọt vào `isSectionActiveInWeek` /
 * `semesterStartMonday` thay vì chuỗi `yyyy-mm-dd`. Chỉ nổ với lớp ĐIỀN NGÀY
 * bắt đầu/kết thúc; lớp không điền ngày thì chạy bình thường nên khó phát hiện.
 */

const sectionFixture = {
  id: 'section-1',
  subjectId: 'subject-1',
  subjectCode: 'CSE392',
  subjectName: 'Quản lý dự án công nghệ thông tin',
  credits: 3,
  semester: 'HK1 2026-2027',
  sectionCode: '66HTTT2',
  dayOfWeek: 7,
  startPeriod: 10,
  endPeriod: 12,
  classType: 'lecture' as const,
  meetingCount: 1,
  linkedSectionId: null,
  // Giống node-pg: cột `date` về dạng Date object (nửa đêm giờ local).
  startDate: new Date(2026, 10, 9),
  endDate: new Date(2027, 0, 3),
  secondDayOfWeek: 7,
  secondStartPeriod: 10,
  secondEndPeriod: 12,
  skippedWeeks: [1],
  skippedWeekDates: [],
  room: '333-A2',
  lecturer: null,
  capacity: null,
  isCancelled: false,
};

const repository = vi.hoisted(() => ({
  findCourseSectionsByIds: vi.fn(async () => [sectionFixture]),
  listPeriodSlots: vi.fn(async () => []),
  listScheduleItems: vi.fn(async () => []),
  listSemesterStartDates: vi.fn(async () => new Map([['HK1 2026-2027', new Date(2026, 10, 2)]])),
  findRegistrationConfig: vi.fn(async () => null),
}));

vi.mock('../src/modules/schedule/schedule.repository', () => repository);

const { simulate } = await import('../src/modules/schedule/schedule.service');

beforeEach(() => {
  repository.findCourseSectionsByIds.mockClear();
  repository.listSemesterStartDates.mockClear();
});

describe('simulate với ngày dạng Date object (cột date của Postgres)', () => {
  it('không nổ 500 và trả kết quả mô phỏng đầy đủ', async () => {
    const result = await simulate('student-1', {
      semester: 'HK1 2026-2027',
      sectionIds: ['section-1'],
      weekStart: '2026-11-09',
    });

    expect(result.semester).toBe('HK1 2026-2027');
    expect(result.summary.selectedCount).toBe(1);
    expect(result.summary.credits).toBe(3);
    expect(result.sections[0]).toMatchObject({ sectionCode: '66HTTT2' });
  });

  it('tính đúng ngày tuần nghỉ từ mốc học kỳ (cả 2 giá trị đều là Date object)', async () => {
    const result = await simulate('student-1', {
      semester: 'HK1 2026-2027',
      sectionIds: ['section-1'],
      weekStart: '2026-11-09',
    });

    // Học kỳ bắt đầu 2026-11-02 (thứ Hai) → tuần 1 = 2026-11-02.
    expect(result.sections[0]?.skippedWeekDates).toEqual(['2026-11-02']);
  });

  it('lớp 1 buổi còn dư lịch buổi 2 (dữ liệu rác cũ) → xung đột với chính nó, không crash', async () => {
    // Cả hai buổi cùng Thứ 7 tiết 10-12 → trùng chính lớp mình.
    const result = await simulate('student-1', {
      semester: 'HK1 2026-2027',
      sectionIds: ['section-1'],
      weekStart: '2026-11-09',
    });

    expect(result.summary.conflictCount).toBe(1);
    expect(result.summary.feasible).toBe(false);
  });

  it('lớp ngoài tuần xem (sau ngày kết thúc) không tham gia xung đột', async () => {
    const result = await simulate('student-1', {
      semester: 'HK1 2026-2027',
      sectionIds: ['section-1'],
      weekStart: '2027-01-11',
    });

    // Tuần 2027-01-11 nằm sau endDate 2027-01-03 → lớp không chạy → 0 xung đột.
    expect(result.summary.conflictCount).toBe(0);
    expect(result.summary.feasible).toBe(true);
  });
});
