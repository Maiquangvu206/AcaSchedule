import { describe, expect, it } from 'vitest';
import {
  isSectionActiveInWeek,
  parseDateOnly,
  toDateString,
  weekRangeFor,
} from '../src/modules/schedule/schedule.range';

const week = (start: string, end: string): [Date, Date] => [
  parseDateOnly(start),
  parseDateOnly(end),
];

describe('parseDateOnly', () => {
  it('parses a YYYY-MM-DD value as a local date', () => {
    const date = parseDateOnly('2026-03-02');

    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(2);
    expect(date.getDate()).toBe(2);
  });
});

describe('weekRangeFor', () => {
  it('returns the Monday to Sunday range of the given date', () => {
    // 2026-03-04 is a Wednesday.
    const range = weekRangeFor(new Date(2026, 2, 4));

    expect(range.start.getDay()).toBe(1);
    expect(range.start.getDate()).toBe(2);
    expect(range.end.getDate()).toBe(8);
  });

  it('keeps Sunday inside the same Monday-based week', () => {
    // 2026-03-08 is a Sunday.
    const range = weekRangeFor(new Date(2026, 2, 8));

    expect(range.start.getDate()).toBe(2);
    expect(range.end.getDate()).toBe(8);
  });
});

describe('isSectionActiveInWeek', () => {
  it('is always active without a date range', () => {
    expect(isSectionActiveInWeek({}, ...week('2026-01-05', '2026-01-11'))).toBe(true);
  });

  it('is active in a week fully inside the range', () => {
    const section = { startDate: '2026-01-01', endDate: '2026-03-31' };

    expect(isSectionActiveInWeek(section, ...week('2026-02-02', '2026-02-08'))).toBe(true);
  });

  it('is inactive in a week fully before the start date', () => {
    const section = { startDate: '2026-03-01', endDate: '2026-05-31' };

    expect(isSectionActiveInWeek(section, ...week('2026-02-02', '2026-02-08'))).toBe(false);
  });

  it('is inactive in a week fully after the end date', () => {
    const section = { startDate: '2026-01-01', endDate: '2026-02-28' };

    expect(isSectionActiveInWeek(section, ...week('2026-03-02', '2026-03-08'))).toBe(false);
  });

  it('is active in the boundary weeks (partial overlap)', () => {
    const section = { startDate: '2026-03-04', endDate: '2026-03-20' };

    expect(isSectionActiveInWeek(section, ...week('2026-03-02', '2026-03-08'))).toBe(true);
    expect(isSectionActiveInWeek(section, ...week('2026-03-09', '2026-03-15'))).toBe(true);
    expect(isSectionActiveInWeek(section, ...week('2026-03-16', '2026-03-22'))).toBe(true);
  });

  it('supports a single-sided range', () => {
    expect(isSectionActiveInWeek({ startDate: '2026-03-04' }, ...week('2026-03-02', '2026-03-08'))).toBe(true);
    expect(isSectionActiveInWeek({ startDate: '2026-03-04' }, ...week('2026-02-23', '2026-03-01'))).toBe(false);
    expect(isSectionActiveInWeek({ endDate: '2026-03-08' }, ...week('2026-03-09', '2026-03-15'))).toBe(false);
    expect(isSectionActiveInWeek({ endDate: '2026-03-08' }, ...week('2026-03-02', '2026-03-08'))).toBe(true);
  });

  it('chấp nhận chuỗi ISO đầy đủ từ API cũ (trước đây thành Invalid Date → luôn "đang học")', () => {
    const section = { startDate: '2026-03-01T00:00:00.000Z', endDate: '2026-05-31T00:00:00.000Z' };

    expect(isSectionActiveInWeek(section, ...week('2026-02-02', '2026-02-08'))).toBe(false);
    expect(isSectionActiveInWeek(section, ...week('2026-04-06', '2026-04-12'))).toBe(true);
  });

  it('chấp nhận Date object từ node-pg (cột date) — nguồn cơn lỗi 500 trong simulate', () => {
    const section = { startDate: new Date(2026, 2, 1), endDate: new Date(2026, 4, 31) };

    expect(isSectionActiveInWeek(section, ...week('2026-02-02', '2026-02-08'))).toBe(false);
    expect(isSectionActiveInWeek(section, ...week('2026-03-02', '2026-03-08'))).toBe(true);
  });
});

describe('toDateString', () => {
  it('chuỗi yyyy-mm-dd giữ nguyên', () => {
    expect(toDateString('2026-11-09')).toBe('2026-11-09');
  });

  it('chuỗi ISO đầy đủ → cắt còn yyyy-mm-dd', () => {
    expect(toDateString('2026-11-09T00:00:00.000Z')).toBe('2026-11-09');
  });

  it('Date object (node-pg cột date) → yyyy-mm-dd giờ local, không lệch múi giờ', () => {
    // node-pg trả cột `date` là Date nửa đêm giờ local.
    expect(toDateString(new Date(2026, 10, 9))).toBe('2026-11-09');
  });

  it('null/undefined → null', () => {
    expect(toDateString(null)).toBeNull();
    expect(toDateString(undefined)).toBeNull();
  });
});
