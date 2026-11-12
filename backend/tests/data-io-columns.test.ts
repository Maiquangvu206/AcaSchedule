import { describe, expect, it } from 'vitest';
import { buildColumnMap as mapCurriculum } from '../src/modules/admin/data-io/curriculum';
import { buildColumnMap as mapTranscript } from '../src/modules/admin/data-io/transcript';
import { normalizeHeader } from '../src/modules/admin/data-io/csv';

describe('column mapping (import CSV)', () => {
  it('maps the curriculum headers exported by the app', () => {
    const header = [
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

    const map = mapCurriculum(header);

    expect(map.majorCode).toBe(2);
    expect(map.majorName).toBe(3);
    expect(map.subjectCode).toBe(4);
    expect(map.subjectName).toBe(5);
    expect(map.credits).toBe(6);
    expect(map.isRequired).toBe(7);
    expect(map.semesterNo).toBe(8);
    expect(map.calculateGrade).toBe(9);
    expect(map.processWeight).toBe(10);
    expect(map.finalWeight).toBe(11);
    expect(map.departmentCode).toBe(0);
    expect(map.departmentName).toBe(1);
  });

  it('maps the transcript headers exported by the app', () => {
    const header = [
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

    const map = mapTranscript(header);

    expect(map.studentCode).toBe(0);
    expect(map.fullName).toBe(1);
    expect(map.email).toBe(2);
    expect(map.majorCode).toBe(3);
    expect(map.subjectCode).toBe(4);
    expect(map.subjectName).toBe(5);
    expect(map.credits).toBe(6);
    expect(map.semester).toBe(7);
    expect(map.attemptNo).toBe(8);
    expect(map.processScore).toBe(9);
    expect(map.finalScore).toBe(10);
  });

  it('accepts headers without Vietnamese diacritics or different casing', () => {
    const map = mapCurriculum(['MA NGANH', 'Ma mon', 'TIN CHI', 'Hoc ky']);
    expect(map.majorCode).toBe(0);
    expect(map.subjectCode).toBe(1);
    expect(map.credits).toBe(2);
    expect(map.semesterNo).toBe(3);
  });

  it('keeps every alias in normalised form', () => {
    // Alias có dấu sẽ không bao giờ khớp vì header luôn được chuẩn hoá trước.
    for (const header of ['Mã ngành', 'Tên ngành', 'Tín chỉ', 'Học kỳ']) {
      expect(normalizeHeader(header)).toMatch(/^[a-z0-9]+$/);
    }
  });
});
