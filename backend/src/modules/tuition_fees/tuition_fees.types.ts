export interface TuitionFee {
  id: string;
  semester: string;
  majorId: string | null;
  majorCode: string | null;
  majorName: string | null;
  feePerCredit: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}
