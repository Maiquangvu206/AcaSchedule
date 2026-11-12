import * as repository from './tuition_fees.repository';
import type { TuitionFee } from './tuition_fees.types';
import type { TuitionFeeInput } from './tuition_fees.schemas';

export async function listTuitionFees(userId?: string) {
  return repository.listTuitionFees(userId);
}

export async function getTuitionFee(semester: string, userId?: string) {
  return repository.getTuitionFee(semester, userId);
}

export async function upsertTuitionFee(
  input: TuitionFeeInput,
): Promise<TuitionFee> {
  return repository.upsertTuitionFee(input.semester, input.majorId ?? null, input.feePerCredit, input.currency);
}

export async function getTuitionFeeForSemester(semester: string, userId?: string) {
  return repository.getTuitionFee(semester, userId);
}
