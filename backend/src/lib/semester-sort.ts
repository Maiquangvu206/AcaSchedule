/**
 * Sort key for a semester string so semesters are ordered chronologically
 * instead of lexicographically (e.g. "2025-10" must come after "2025-2").
 *
 * Accepts the "HK1 2024-2025", "2024-2025-1" and "2024-1" shapes.
 */
export function semesterSortKey(semester: string): [number, number] {
  const hk = semester.match(/HK(\d)\s+(\d{4})/);
  if (hk) return [Number(hk[2]), Number(hk[1])];
  // "2024-2025-1" → [2024, 1]
  const plain = semester.match(/(\d{4})-\d{4}(?:-(\d+))?/);
  if (plain) return [Number(plain[1]), plain[2] ? Number(plain[2]) : 1];
  // "2024-1" / "2025-10" → [2024, 1] / [2025, 10]
  const short = semester.match(/(\d{4})-(\d{1,2})(?![\d-])/);
  if (short) return [Number(short[1]), Number(short[2])];
  return [0, 0];
}

/** Compare two semesters chronologically (oldest first). */
export function compareSemesters(a: string, b: string): number {
  const [aYear, aTerm] = semesterSortKey(a);
  const [bYear, bTerm] = semesterSortKey(b);
  if (aYear !== bYear) return aYear - bYear;
  return aTerm - bTerm;
}

/** Compare two semesters chronologically (newest first). */
export function compareSemestersDesc(a: string, b: string): number {
  return compareSemesters(b, a);
}
