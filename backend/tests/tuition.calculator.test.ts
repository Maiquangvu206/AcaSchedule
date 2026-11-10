import { describe, expect, it } from 'vitest';
import {
  buildTuitionRows,
  resolveFee,
  sumTuition,
  type TuitionSource,
} from '../src/modules/tuition_fees/tuition_fees.calculator';
import type { TuitionFee } from '../src/modules/tuition_fees/tuition_fees.types';

let counter = 0;

function fee(overrides: Partial<TuitionFee> = {}): TuitionFee {
  counter += 1;
  return {
    id: `fee-${counter}`,
    semester: '2024-1',
    majorId: null,
    majorCode: null,
    majorName: null,
    feePerCredit: 1_000_000,
    currency: 'VND',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function source(overrides: Partial<TuitionSource> = {}): TuitionSource {
  return { semester: '2024-1', credits: 3, majorId: 'major-a', ...overrides };
}

describe('resolveFee', () => {
  it('prefers the fee configured for the major', () => {
    const fees = [
      fee({ semester: '2024-1', majorId: null, feePerCredit: 900_000 }),
      fee({ semester: '2024-1', majorId: 'major-a', feePerCredit: 1_500_000 }),
    ];

    expect(resolveFee('2024-1', 'major-a', fees)).toEqual({
      feePerCredit: 1_500_000,
      currency: 'VND',
      isFallback: false,
    });
  });

  it('falls back to the school-wide fee of the same semester', () => {
    const fees = [fee({ semester: '2024-1', majorId: null, feePerCredit: 900_000 })];

    expect(resolveFee('2024-1', 'major-a', fees)).toEqual({
      feePerCredit: 900_000,
      currency: 'VND',
      isFallback: true,
    });
  });

  it('reuses the latest configured fee when the semester has no configuration', () => {
    const fees = [
      fee({ semester: '2023-1', majorId: 'major-a', feePerCredit: 700_000, updatedAt: '2023-01-01T00:00:00.000Z' }),
      fee({ semester: '2023-2', majorId: 'major-a', feePerCredit: 800_000, updatedAt: '2023-06-01T00:00:00.000Z' }),
    ];

    expect(resolveFee('2024-1', 'major-a', fees)).toEqual({
      feePerCredit: 800_000,
      currency: 'VND',
      isFallback: true,
    });
  });

  it('returns null when nothing is configured for the major', () => {
    const fees = [fee({ semester: '2024-1', majorId: 'major-b' })];

    expect(resolveFee('2024-1', 'major-a', fees)).toBeNull();
  });
});

describe('buildTuitionRows', () => {
  it('charges every registered attempt, including retakes', () => {
    const fees = [fee({ semester: '2024-1', majorId: 'major-a', feePerCredit: 500_000 })];

    const rows = buildTuitionRows(
      [
        source({ credits: 3 }),
        source({ credits: 3 }),
        source({ credits: 3 }),
      ],
      fees,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ semester: '2024-1', credits: 9, amount: 4_500_000 });
  });

  it('keeps one row per curriculum so dual-major fees stay separate', () => {
    const fees = [
      fee({ semester: '2024-1', majorId: 'major-a', feePerCredit: 500_000 }),
      fee({ semester: '2024-1', majorId: 'major-b', feePerCredit: 700_000 }),
    ];

    const rows = buildTuitionRows(
      [
        source({ credits: 3, majorId: 'major-a' }),
        source({ credits: 3, majorId: 'major-b' }),
      ],
      fees,
    );

    expect(rows).toEqual([
      expect.objectContaining({ majorId: 'major-a', credits: 3, amount: 1_500_000 }),
      expect.objectContaining({ majorId: 'major-b', credits: 3, amount: 2_100_000 }),
    ]);
  });

  it('shows the credits even when no fee is configured', () => {
    const rows = buildTuitionRows([source({ credits: 4 })], []);

    expect(rows[0]).toEqual({
      semester: '2024-1',
      credits: 4,
      feePerCredit: null,
      currency: 'VND',
      amount: 0,
      isFallback: false,
      majorId: 'major-a',
    });
  });

  it('ignores zero or invalid credits and sorts by semester', () => {
    const fees = [fee({ semester: '2024-1', majorId: null }), fee({ semester: '2023-2', majorId: null })];

    const rows = buildTuitionRows(
      [
        source({ semester: '2024-1', credits: 0 }),
        source({ semester: '2024-1', credits: 2, majorId: null }),
        source({ semester: '2023-2', credits: 3, majorId: null }),
      ],
      fees,
    );

    expect(rows.map((row) => row.semester)).toEqual(['2023-2', '2024-1']);
    expect(sumTuition(rows)).toBe(5_000_000);
  });
});
