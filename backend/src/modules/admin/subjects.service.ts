import { AppError } from '../../lib/errors';
import * as repository from './subjects.repository';

export async function listSubjects() {
  return repository.list();
}

function ensureWeights(processWeight: number, finalWeight: number) {
  if (Math.abs(processWeight + finalWeight - 1) >= 0.001) {
    throw AppError.badRequest('processWeight + finalWeight must equal 1');
  }
}

export async function createSubject(input: {
  code: string;
  name: string;
  credits: number;
  knowledgeBlock: string;
  managingUnit: string;
  processWeight: number;
  finalWeight: number;
}) {
  if (await repository.findByCode(input.code)) {
    throw AppError.conflict(`Subject code ${input.code} already exists`);
  }
  ensureWeights(input.processWeight, input.finalWeight);
  return repository.create(input);
}

export async function updateSubject(
  id: string,
  input: {
    code?: string;
    name?: string;
    credits?: number;
    knowledgeBlock?: string;
    managingUnit?: string;
    processWeight?: number;
    finalWeight?: number;
    isActive?: boolean;
  },
) {
  const existing = await repository.findById(id);
  if (!existing) throw AppError.notFound('Subject not found');

  const next = {
    code: input.code ?? existing.code,
    name: input.name ?? existing.name,
    credits: input.credits ?? existing.credits,
    knowledgeBlock: input.knowledgeBlock ?? existing.knowledgeBlock,
    managingUnit: input.managingUnit ?? existing.managingUnit,
    processWeight: input.processWeight ?? existing.processWeight,
    finalWeight: input.finalWeight ?? existing.finalWeight,
    isActive: input.isActive ?? existing.isActive,
  };

  const sameCode = await repository.findByCode(next.code);
  if (sameCode && sameCode.id !== id) {
    throw AppError.conflict(`Subject code ${next.code} already exists`);
  }

  ensureWeights(next.processWeight, next.finalWeight);

  const updated = await repository.update(id, next);
  if (!updated) throw AppError.notFound('Subject not found');
  return updated;
}

export async function deactivateSubject(id: string) {
  const existing = await repository.findById(id);
  if (!existing) throw AppError.notFound('Subject not found');
  await repository.deactivate(id);
}
