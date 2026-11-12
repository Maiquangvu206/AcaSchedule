import { describe, expect, it } from 'vitest';
import { semesterSortKey } from './api';

describe('semesterSortKey', () => {
  it('parses the "HK1 2024-2025" shape', () => {
    expect(semesterSortKey('HK1 2024-2025')).toEqual([2024, 1]);
    expect(semesterSortKey('HK2 2025-2026')).toEqual([2025, 2]);
  });

  it('parses the "2024-2025-1" shape', () => {
    expect(semesterSortKey('2024-2025-1')).toEqual([2024, 1]);
    expect(semesterSortKey('2024-2025-2')).toEqual([2024, 2]);
  });

  it('parses the short "2024-1" shape', () => {
    expect(semesterSortKey('2024-1')).toEqual([2024, 1]);
    expect(semesterSortKey('2024-2')).toEqual([2024, 2]);
  });

  it('parses a two-digit term in the short shape', () => {
    expect(semesterSortKey('2025-10')).toEqual([2025, 10]);
    expect(semesterSortKey('2025-2')).toEqual([2025, 2]);
  });

  it('does not treat "2024-2025" as a short shape', () => {
    expect(semesterSortKey('2024-2025')).toEqual([2024, 1]);
  });

  it('falls back to [0, 0] for unknown shapes', () => {
    expect(semesterSortKey('abc')).toEqual([0, 0]);
  });

  it('sorts semesters chronologically, newest first', () => {
    const semesters = ['2024-1', '2024-2', '2023-2', '2025-1'];
    const sorted = [...semesters].sort(
      (a, b) =>
        semesterSortKey(b)[0] - semesterSortKey(a)[0] ||
        semesterSortKey(b)[1] - semesterSortKey(a)[1],
    );

    expect(sorted).toEqual(['2025-1', '2024-2', '2024-1', '2023-2']);
  });

  it('orders HK1 before HK2 of the same academic year', () => {
    const sorted = ['HK2 2024-2025', 'HK1 2024-2025'].sort(
      (a, b) =>
        semesterSortKey(b)[0] - semesterSortKey(a)[0] ||
        semesterSortKey(b)[1] - semesterSortKey(a)[1],
    );

    expect(sorted).toEqual(['HK2 2024-2025', 'HK1 2024-2025']);
  });
});
