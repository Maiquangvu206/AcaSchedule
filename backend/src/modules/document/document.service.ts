import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { env } from '../../config/env';
import { pool } from '../../database/pool';
import { AppError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { minioClient, minioPublicClient } from '../../lib/minio';
import { validateUploadMetadata } from './document.engine';
import * as repository from './document.repository';
import type { DocumentDownload, DocumentView, UploadTicket } from './document.types';
import type {
  CreateDocumentInput,
  ListDocumentsQuery,
  PresignUploadInput,
} from './document.schemas';

const UPLOAD_URL_TTL_SECONDS = 10 * 60;
const DOWNLOAD_URL_TTL_SECONDS = 10 * 60;

async function withTransaction<T>(handler: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await handler(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function assertEnrolledSubject(studentId: string, subjectId: string) {
  const subject = await repository.findEnrolledSubject(studentId, subjectId);
  if (!subject) {
    throw AppError.forbidden('You can only access documents for subjects you are enrolled in');
  }
  return subject;
}

function assertValidUpload(input: PresignUploadInput) {
  const validation = validateUploadMetadata(input);
  if (!validation.ok) {
    throw AppError.badRequest(validation.message, { code: validation.code });
  }
  return validation;
}

function normalizeMime(value: unknown): string {
  return typeof value === 'string' ? value.split(';')[0]?.trim().toLowerCase() ?? '' : '';
}

function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: string }).code;
  return code === 'NotFound' || code === 'NoSuchKey' || code === 'NoSuchObject';
}

async function removeObjectQuietly(objectKey: string): Promise<void> {
  try {
    await minioClient.removeObject(env.MINIO_BUCKET, objectKey);
  } catch {
    // Best effort cleanup: an orphaned pending upload is harmless.
  }
}

/**
 * Tạo URL upload có thời hạn để trình duyệt PUT trực tiếp lên object storage.
 *
 * Presign chỉ là ký URL (không gọi mạng), nhưng vẫn log lỗi gốc nếu thư viện
 * ném ngoại lệ để dễ truy vết cấu hình sai (endpoint/region/key).
 */
export async function presignUpload(
  studentId: string,
  input: PresignUploadInput,
): Promise<UploadTicket> {
  await assertEnrolledSubject(studentId, input.subjectId);
  const validation = assertValidUpload(input);

  const objectKey = `subjects/${input.subjectId}/${studentId}/${randomUUID()}.${validation.extension}`;

  let uploadUrl: string;
  try {
    uploadUrl = await minioPublicClient.presignedPutObject(
      env.MINIO_BUCKET,
      objectKey,
      UPLOAD_URL_TTL_SECONDS,
    );
  } catch (error) {
    logger.error(
      {
        err: error,
        bucket: env.MINIO_BUCKET,
        objectKey,
        studentId,
        endpoint: env.MINIO_PUBLIC_ENDPOINT ?? env.MINIO_ENDPOINT,
      },
      'Presign upload URL failed (object storage)',
    );
    throw AppError.serviceUnavailable('Object storage is unavailable');
  }

  return {
    uploadUrl,
    objectKey,
    method: 'PUT',
    expiresIn: UPLOAD_URL_TTL_SECONDS,
    requiredHeaders: { 'Content-Type': validation.mimeType },
  };
}

/**
 * Confirm an upload after the browser PUT the file directly to MinIO.
 * Re-validates the real object metadata before writing the database row.
 */
export async function createDocument(
  studentId: string,
  input: CreateDocumentInput,
): Promise<DocumentView> {
  await assertEnrolledSubject(studentId, input.subjectId);
  const validation = assertValidUpload(input);

  const existing = await repository.findOwnedDocumentByObjectKey(studentId, input.objectKey);
  if (existing) return existing;

  const prefix = `subjects/${input.subjectId}/${studentId}/`;
  if (!input.objectKey.startsWith(prefix)) {
    throw AppError.badRequest('Object key does not belong to this upload');
  }

  const relative = input.objectKey.slice(prefix.length);
  if (
    !relative ||
    relative.startsWith('.') ||
    relative.includes('/') ||
    relative.includes('\\') ||
    !relative.toLowerCase().endsWith(`.${validation.extension}`)
  ) {
    throw AppError.badRequest('Object key is invalid for this upload');
  }

  let stat;
  try {
    // Backend kiểm tra file thật sự đã nằm trên storage trước khi ghi DB.
    // Dùng client nội bộ trước; nếu môi trường cloud cấu hình endpoint nội bộ
    // không tới được (trong khi endpoint public hoạt động — presign/PUT đã OK),
    // thử lại bằng public client rồi mới báo lỗi.
    try {
      stat = await minioClient.statObject(env.MINIO_BUCKET, input.objectKey);
    } catch (primaryError) {
      if (isNotFoundError(primaryError)) throw primaryError;
      logger.warn(
        {
          err: primaryError,
          bucket: env.MINIO_BUCKET,
          objectKey: input.objectKey,
          studentId,
          endpoint: env.MINIO_ENDPOINT,
          client: 'internal',
        },
        'statObject failed on internal storage client, retrying with public client',
      );
      stat = await minioPublicClient.statObject(env.MINIO_BUCKET, input.objectKey);
    }
  } catch (error) {
    if (isNotFoundError(error)) {
      throw AppError.badRequest('Uploaded object was not found in storage');
    }
    logger.error(
      {
        err: error,
        bucket: env.MINIO_BUCKET,
        objectKey: input.objectKey,
        studentId,
        endpoint: env.MINIO_ENDPOINT,
        publicEndpoint: env.MINIO_PUBLIC_ENDPOINT ?? env.MINIO_ENDPOINT,
      },
      'Confirm upload failed: cannot stat object in storage',
    );
    throw AppError.serviceUnavailable('Object storage is unavailable');
  }

  const actualSize = Number(stat.size);
  if (actualSize !== input.sizeBytes) {
    await removeObjectQuietly(input.objectKey);
    throw AppError.badRequest('Uploaded file size does not match the declared size');
  }

  if (actualSize > 0 && !validateUploadMetadata({ ...input, sizeBytes: actualSize }).ok) {
    await removeObjectQuietly(input.objectKey);
    throw AppError.badRequest('Uploaded file does not pass validation');
  }

  const actualMime = normalizeMime(
    (stat.metaData as Record<string, unknown> | undefined)?.['content-type'],
  );
  if (actualMime !== validation.mimeType) {
    await removeObjectQuietly(input.objectKey);
    throw AppError.badRequest('Uploaded file content type does not match the declared type');
  }

  const id = await repository.insertDocument({
    subjectId: input.subjectId,
    uploaderId: studentId,
    title: input.title,
    originalName: input.fileName,
    objectKey: input.objectKey,
    mimeType: validation.mimeType,
    sizeBytes: actualSize,
  });

  const document = await repository.findAccessibleDocument(studentId, id);
  if (!document) throw new Error('Created document could not be loaded');
  return document;
}

export async function listSubjects(studentId: string) {
  return repository.listEnrolledSubjects(studentId);
}

export async function listDocuments(studentId: string, filters: ListDocumentsQuery) {
  return repository.listDocuments(studentId, filters);
}

export async function voteDocument(studentId: string, documentId: string, value: -1 | 0 | 1) {
  return withTransaction(async (client) => {
    const document = await repository.findAccessibleDocument(studentId, documentId, client);
    if (!document) throw AppError.notFound('Document not found');
    if (document.isLocked) {
      throw AppError.forbidden('Tài liệu đã bị khóa, không thể bình chọn');
    }

    if (value === 0) {
      await repository.deleteVote(studentId, documentId, client);
    } else {
      await repository.upsertVote(studentId, documentId, value, client);
    }

    await repository.recalculateVoteCounts(documentId, client);
    const updated = await repository.findAccessibleDocument(studentId, documentId, client);
    if (!updated) throw AppError.notFound('Document not found');
    return updated;
  });
}

function sanitizeFileName(title: string, extension: string): string {
  const base = title
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return `${base || 'document'}.${extension}`;
}

/** Issue a short-lived download/view URL after checking subject access. */
export async function getDownload(
  studentId: string,
  documentId: string,
  inline: boolean,
): Promise<DocumentDownload> {
  const document = await repository.findAccessibleDocument(studentId, documentId);
  if (!document) throw AppError.notFound('Document not found');
  if (document.isLocked) {
    throw AppError.forbidden('Tài liệu đã bị khóa, không thể xem hoặc tải xuống');
  }

  const objectKey = await repository.findAccessibleDocumentObjectKey(studentId, documentId);
  if (!objectKey) throw AppError.notFound('Document not found');

  const extension = objectKey.slice(objectKey.lastIndexOf('.') + 1).toLowerCase();
  const fileName = sanitizeFileName(document.title, extension);
  const disposition = inline ? 'inline' : 'attachment';
  const contentDisposition = `${disposition}; filename="document.${extension}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;

  let url: string;
  try {
    url = await minioPublicClient.presignedGetObject(
      env.MINIO_BUCKET,
      objectKey,
      DOWNLOAD_URL_TTL_SECONDS,
      {
        'response-content-type': document.mimeType,
        'response-content-disposition': contentDisposition,
      },
    );
  } catch (error) {
    logger.error(
      {
        err: error,
        bucket: env.MINIO_BUCKET,
        objectKey,
        documentId,
        studentId,
        endpoint: env.MINIO_PUBLIC_ENDPOINT ?? env.MINIO_ENDPOINT,
      },
      'Presign download URL failed (object storage)',
    );
    throw AppError.serviceUnavailable('Object storage is unavailable');
  }

  return {
    url,
    expiresIn: DOWNLOAD_URL_TTL_SECONDS,
    disposition,
    document,
  };
}

/* ── Quản trị (admin) ─────────────────────────────────────────────────── */

export async function adminUpdateDocumentFlags(
  documentId: string,
  flags: { isHidden?: boolean; isLocked?: boolean },
): Promise<DocumentView> {
  const updated = await repository.updateDocumentFlags(documentId, flags);
  if (!updated) throw AppError.notFound('Document not found');
  return updated;
}

export async function adminDeleteDocument(documentId: string): Promise<void> {
  const removed = await repository.deleteDocumentById(documentId);
  if (!removed) throw AppError.notFound('Document not found');
  // Xóa file trên storage (best-effort: metadata đã xóa, object mồ côi không
  // ảnh hưởng hiển thị; log nếu lỗi để dọn thủ công nếu cần).
  try {
    await minioClient.removeObject(env.MINIO_BUCKET, removed.objectKey);
  } catch (error) {
    logger.warn(
      { err: error, bucket: env.MINIO_BUCKET, objectKey: removed.objectKey, documentId },
      'Document metadata deleted but failed to remove object from storage',
    );
  }
}
