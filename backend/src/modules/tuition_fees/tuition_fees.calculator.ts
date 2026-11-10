import type { TuitionFee } from './tuition_fees.types';

/** One semester of tuition for one major (or for the whole school). */
export interface TuitionRow {
  semester: string;
  /** Registered credits in that semester (retakes are charged again). */
  credits: number;
  /** Fee that was applied. `null` when the school has not configured one yet. */
  feePerCredit: number | null;
  currency: string;
  amount: number;
  /** True when the semester had no exact configuration and the latest fee was reused. */
  isFallback: boolean;
  /** Curriculum the credits belong to; null for subjects outside every programme. */
  majorId: string | null;
}

/** Credits to charge, already attributed to a major. */
export interface TuitionSource {
  semester: string;
  credits: number;
  majorId: string | null;
}

interface ResolvedFee {
  feePerCredit: number;
  currency: string;
  isFallback: boolean;
}

function latestByUpdate(fees: TuitionFee[]): TuitionFee | null {
  return fees.reduce<TuitionFee | null>(
    (latest, fee) =>
      !latest || new Date(fee.updatedAt).getTime() > new Date(latest.updatedAt).getTime()
        ? fee
        : latest,
    null,
  );
}

/**
 * Fee lookup order:
 *  1. exact configuration for (semester, major)
 *  2. exact configuration for the semester as "toàn trường" (major_id NULL)
 *  3. most recently updated configuration for that major (or toàn trường)
 */
export function resolveFee(
  semester: string,
  majorId: string | null,
  fees: TuitionFee[],
): ResolvedFee | null {
  const exactMajor = majorId === null
    ? null
    : fees.find((fee) => fee.semester === semester && fee.majorId === majorId);
  if (exactMajor) {
    return { feePerCredit: exactMajor.feePerCredit, currency: exactMajor.currency, isFallback: false };
  }

  const exactGlobal = fees.find((fee) => fee.semester === semester && fee.majorId === null);
  if (exactGlobal) {
    return {
      feePerCredit: exactGlobal.feePerCredit,
      currency: exactGlobal.currency,
      isFallback: majorId !== null,
    };
  }

  const fallback = latestByUpdate(
    fees.filter((fee) => fee.majorId === null || fee.majorId === majorId),
  );
  return fallback
    ? { feePerCredit: fallback.feePerCredit, currency: fallback.currency, isFallback: true }
    : null;
}

/**
 * Tuition per (semester, major). Credits are summed from every attempt, so a
 * failed subject that is taken again is charged twice — the way universities
 * actually bill. Semesters without any configuration still appear with
 * `feePerCredit: null` so the student sees the registered credits.
 */
export function buildTuitionRows(
  sources: TuitionSource[],
  fees: TuitionFee[],
): TuitionRow[] {
  const groups = new Map<string, { semester: string; majorId: string | null; credits: number }>();

  for (const source of sources) {
    if (!Number.isFinite(source.credits) || source.credits <= 0) continue;
    const key = `${source.semester}||${source.majorId ?? 'all'}`;
    const group = groups.get(key) ?? {
      semester: source.semester,
      majorId: source.majorId,
      credits: 0,
    };
    group.credits += source.credits;
    groups.set(key, group);
  }

  return [...groups.values()]
    .map((group) => {
      const resolved = resolveFee(group.semester, group.majorId, fees);
      return {
        semester: group.semester,
        credits: group.credits,
        feePerCredit: resolved?.feePerCredit ?? null,
        currency: resolved?.currency ?? 'VND',
        amount: resolved ? resolved.feePerCredit * group.credits : 0,
        isFallback: resolved?.isFallback ?? false,
        majorId: group.majorId,
      };
    })
    .sort((a, b) => {
      const bySemester = a.semester.localeCompare(b.semester);
      if (bySemester !== 0) return bySemester;
      return (a.majorId ?? '').localeCompare(b.majorId ?? '');
    });
}

export function sumTuition(rows: TuitionRow[]): number {
  return rows.reduce((total, row) => total + row.amount, 0);
}
