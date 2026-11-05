import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../src/lib/errors';
import { minioClient, minioPublicClient } from '../src/lib/minio';
import * as repository from '../src/modules/document/document.repository';
import * as documentService from '../src/modules/document/document.service';

vi.mock('../src/config/env', () => ({
  env: { MINIO_BUCKET: 'documents' },
}));

vi.mock('../src/database/pool', () => ({
  pool: { connect: vi.fn(async () => ({ query: vi.fn(), release: vi.fn() })) },
}));

vi.mock('../src/lib/minio', () => ({
  minioClient: { statObject: vi.fn(), removeObject: vi.fn() },
  minioPublicClient: { presignedPutObject: vi.fn(), presignedGetObject: vi.fn() },
}));

vi.mock('../src/modules/document/document.repository', () => ({
  findEnrolledSubject: vi.fn(),
  findAccessibleDocument: vi.fn(),
  findAccessibleDocumentObjectKey: vi.fn(),
  findOwnedDocumentByObjectKey: vi.fn(),
  insertDocument: vi.fn(),
  deleteVote: vi.fn(),
  upsertVote: vi.fn(),
  recalculateVoteCounts: vi.fn(),
  listEnrolledSubjects: vi.fn(),
  listDocuments: vi.fn(),
}));

const STUDENT_ID = '11111111-1111-4111-8111-111111111111';
const SUBJECT_ID = '22222222-2222-4222-8222-222222222222';
const DOCUMENT_ID = '33333333-3333-4333-8333-333333333333';

const pdfInput = {
  subjectId: SUBJECT_ID,
  fileName: 'de-thi-giua-ky.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 1024,
};

const documentView = {
  id: DOCUMENT_ID,
  subjectId: SUBJECT_ID,
  subjectCode: 'IT101',
  subjectName: 'Nhập môn lập trình',
  title: 'Đề thi giữa kỳ',
  originalName: 'de-thi-giua-ky.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 1024,
  upvotes: 1,
  downvotes: 0,
  score: 0.5,
  myVote: 1 as const,
  uploaderId: STUDENT_ID,
  uploaderName: 'Sinh viên demo',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

const enrolledSubject = { id: SUBJECT_ID, code: 'IT101', name: 'Nhập môn lập trình', credits: 3 };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('presignUpload', () => {
  it('blocks upload for a subject the student is not enrolled in', async () => {
    vi.mocked(repository.findEnrolledSubject).mockResolvedValue(null);

    await expect(documentService.presignUpload(STUDENT_ID, pdfInput)).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(minioPublicClient.presignedPutObject).not.toHaveBeenCalled();
  });

  it('rejects executable files before signing any URL', async () => {
    vi.mocked(repository.findEnrolledSubject).mockResolvedValue(enrolledSubject);

    await expect(
      documentService.presignUpload(STUDENT_ID, { ...pdfInput, fileName: 'setup.exe' }),
    ).rejects.toMatchObject({ statusCode: 400, details: { code: 'blocked_type' } });
    expect(minioPublicClient.presignedPutObject).not.toHaveBeenCalled();
  });

  it('issues a PUT ticket scoped to subject and uploader', async () => {
    vi.mocked(repository.findEnrolledSubject).mockResolvedValue(enrolledSubject);
    vi.mocked(minioPublicClient.presignedPutObject).mockResolvedValue('https://minio.local/put');

    const ticket = await documentService.presignUpload(STUDENT_ID, pdfInput);

    expect(ticket.uploadUrl).toBe('https://minio.local/put');
    expect(ticket.method).toBe('PUT');
    expect(ticket.requiredHeaders).toEqual({ 'Content-Type': 'application/pdf' });
    expect(ticket.objectKey).toMatch(
      new RegExp(`^subjects/${SUBJECT_ID}/${STUDENT_ID}/[0-9a-f-]+\\.pdf$`),
    );
  });
});

describe('createDocument', () => {
  const createInput = {
    ...pdfInput,
    title: 'Đề thi giữa kỳ',
    objectKey: `subjects/${SUBJECT_ID}/${STUDENT_ID}/abc.pdf`,
  };

  it('removes the object and rejects when stored size differs from the declared size', async () => {
    vi.mocked(repository.findEnrolledSubject).mockResolvedValue(enrolledSubject);
    vi.mocked(repository.findOwnedDocumentByObjectKey).mockResolvedValue(null);
    vi.mocked(minioClient.statObject).mockResolvedValue({
      size: 9999,
      metaData: { 'content-type': 'application/pdf' },
    } as never);

    await expect(documentService.createDocument(STUDENT_ID, createInput)).rejects.toBeInstanceOf(
      AppError,
    );
    expect(minioClient.removeObject).toHaveBeenCalledWith('documents', createInput.objectKey);
    expect(repository.insertDocument).not.toHaveBeenCalled();
  });

  it('stores metadata when the object matches the declared size and type', async () => {
    vi.mocked(repository.findEnrolledSubject).mockResolvedValue(enrolledSubject);
    vi.mocked(repository.findOwnedDocumentByObjectKey).mockResolvedValue(null);
    vi.mocked(minioClient.statObject).mockResolvedValue({
      size: 1024,
      metaData: { 'content-type': 'application/pdf' },
    } as never);
    vi.mocked(repository.insertDocument).mockResolvedValue(DOCUMENT_ID);
    vi.mocked(repository.findAccessibleDocument).mockResolvedValue(documentView);

    const document = await documentService.createDocument(STUDENT_ID, createInput);

    expect(repository.insertDocument).toHaveBeenCalledWith(
      expect.objectContaining({ uploaderId: STUDENT_ID, sizeBytes: 1024, mimeType: 'application/pdf' }),
    );
    expect(document.id).toBe(DOCUMENT_ID);
  });
});

describe('voteDocument', () => {
  it('upserts an upvote and recalculates counters', async () => {
    vi.mocked(repository.findAccessibleDocument).mockResolvedValue(documentView);

    const result = await documentService.voteDocument(STUDENT_ID, DOCUMENT_ID, 1);

    expect(repository.upsertVote).toHaveBeenCalledWith(STUDENT_ID, DOCUMENT_ID, 1, expect.anything());
    expect(repository.deleteVote).not.toHaveBeenCalled();
    expect(repository.recalculateVoteCounts).toHaveBeenCalledWith(DOCUMENT_ID, expect.anything());
    expect(result.myVote).toBe(1);
  });

  it('changes an existing vote instead of creating a second one', async () => {
    vi.mocked(repository.findAccessibleDocument).mockResolvedValue(documentView);

    await documentService.voteDocument(STUDENT_ID, DOCUMENT_ID, -1);

    expect(repository.upsertVote).toHaveBeenCalledWith(STUDENT_ID, DOCUMENT_ID, -1, expect.anything());
  });

  it('removes the vote when value is 0', async () => {
    vi.mocked(repository.findAccessibleDocument).mockResolvedValue(documentView);

    await documentService.voteDocument(STUDENT_ID, DOCUMENT_ID, 0);

    expect(repository.deleteVote).toHaveBeenCalledWith(STUDENT_ID, DOCUMENT_ID, expect.anything());
    expect(repository.upsertVote).not.toHaveBeenCalled();
  });

  it('returns 404 and writes nothing when the student cannot access the document', async () => {
    vi.mocked(repository.findAccessibleDocument).mockResolvedValue(null);

    await expect(documentService.voteDocument(STUDENT_ID, DOCUMENT_ID, 1)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(repository.upsertVote).not.toHaveBeenCalled();
    expect(repository.recalculateVoteCounts).not.toHaveBeenCalled();
  });
});

