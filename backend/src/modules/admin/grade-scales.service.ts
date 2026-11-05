import { AppError } from '../../lib/errors';
import * as repository from './grade-scales.repository';

export async function listGradeScales() {
  return repository.list();
}

function ensureNoDuplicateThreshold(
  existing: Awaited<ReturnType<typeof repository.findByMinScore>>,
  id?: string,
) {
  if (existing && existing.id !== id) {
    throw AppError.conflict(
      `A grade scale starting at ${existing.minScore10} already exists (overlapping range)`,
    );
  }
}

export async function createGradeScale(input: {
  minScore10: number;
  letterGrade: string;
  grade4: number;
  isPass: boolean;
}) {
  ensureNoDuplicateThreshold(await repository.findByMinScore(input.minScore10));
  return repository.create(input);
}

export async function updateGradeScale(
  id: string,
  input: {
    minScore10?: number;
    letterGrade?: string;
    grade4?: number;
    isPass?: boolean;
  },
) {
  const existing = await repository.findById(id);
  if (!existing) throw AppError.notFound('Grade scale not found');

  const next = {
    minScore10: input.minScore10 ?? existing.minScore10,
    letterGrade: input.letterGrade ?? existing.letterGrade,
    grade4: input.grade4 ?? existing.grade4,
    isPass: input.isPass ?? existing.isPass,
  };

  ensureNoDuplicateThreshold(await repository.findByMinScore(next.minScore10), id);
  const updated = await repository.update(id, next);
  if (!updated) throw AppError.notFound('Grade scale not found');
  return updated;
}

export async function deleteGradeScale(id: string) {
  const deleted = await repository.remove(id);
  if (!deleted) throw AppError.notFound('Grade scale not found');
}
