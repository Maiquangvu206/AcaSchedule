export const MAX_DOCUMENT_SIZE_BYTES = 20 * 1024 * 1024;

/** MIME type → allowed extensions. Anything outside this map is rejected. */
export const ALLOWED_FILE_TYPES: Readonly<Record<string, readonly string[]>> = {
  'application/pdf': ['pdf'],
  'application/msword': ['doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
  'application/vnd.ms-powerpoint': ['ppt'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['pptx'],
  'application/vnd.ms-excel': ['xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
  'text/plain': ['txt'],
  'text/csv': ['csv'],
  'image/png': ['png'],
  'image/jpeg': ['jpg', 'jpeg'],
};

/** Explicitly blocked even if a client lies about the MIME type. */
const BLOCKED_EXTENSIONS = new Set([
  'exe',
  'msi',
  'bat',
  'cmd',
  'com',
  'scr',
  'pif',
  'dll',
  'jar',
  'sh',
  'bash',
  'ps1',
  'vbs',
  'js',
  'mjs',
  'cjs',
  'php',
  'py',
  'rb',
  'pl',
  'apk',
  'dmg',
]);

export interface UploadMetadata {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export type UploadValidation =
  | { ok: true; extension: string; mimeType: string }
  | {
      ok: false;
      code: 'invalid_name' | 'empty_file' | 'too_large' | 'blocked_type' | 'unsupported_type' | 'mime_mismatch';
      message: string;
    };

function normalizeMimeType(value: string): string {
  return value.split(';')[0]?.trim().toLowerCase() ?? '';
}

function extensionOf(fileName: string): string | null {
  const name = fileName.trim();

  if (!name || name.includes('/') || name.includes('\\') || name.includes('\0')) {
    return null;
  }

  const separator = name.lastIndexOf('.');
  if (separator <= 0 || separator === name.length - 1) {
    return null;
  }

  return name.slice(separator + 1).toLowerCase();
}

/**
 * Validate file metadata before signing an upload URL and again after the object
 * lands in MinIO. Extension and MIME type must agree, and executables are blocked.
 */
export function validateUploadMetadata(input: UploadMetadata): UploadValidation {
  if (!Number.isFinite(input.sizeBytes) || !Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0) {
    return { ok: false, code: 'empty_file', message: 'File must not be empty' };
  }

  if (input.sizeBytes > MAX_DOCUMENT_SIZE_BYTES) {
    return {
      ok: false,
      code: 'too_large',
      message: `File must be at most ${Math.floor(MAX_DOCUMENT_SIZE_BYTES / (1024 * 1024))} MB`,
    };
  }

  const extension = extensionOf(input.fileName);
  if (!extension) {
    return {
      ok: false,
      code: 'invalid_name',
      message: 'File name must contain a valid extension and no path separators',
    };
  }

  if (BLOCKED_EXTENSIONS.has(extension)) {
    return { ok: false, code: 'blocked_type', message: 'Executable files are not allowed' };
  }

  const mimeType = normalizeMimeType(input.mimeType);
  const allowedExtensions = ALLOWED_FILE_TYPES[mimeType];

  if (!allowedExtensions) {
    return { ok: false, code: 'unsupported_type', message: 'Unsupported file type' };
  }

  if (!allowedExtensions.includes(extension)) {
    return {
      ok: false,
      code: 'mime_mismatch',
      message: 'File extension does not match its MIME type',
    };
  }

  return { ok: true, extension, mimeType };
}

/**
 * Ranking score used by the default sort. It favours a high upvote ratio while
 * still surfacing documents with more total votes. No votes → 0.
 *
 * score = (up - down) / (up + down + 1)
 */
export function rankScore(upvotes: number, downvotes: number): number {
  const total = Math.max(0, upvotes) + Math.max(0, downvotes);
  return (Math.max(0, upvotes) - Math.max(0, downvotes)) / (total + 1);
}

interface RankableDocument {
  id: string;
  upvotes: number;
  downvotes: number;
  createdAt: string;
}

/** Rank desc, then raw upvotes desc, then newest, then id (stable tie-break). */
export function compareDocuments(left: RankableDocument, right: RankableDocument): number {
  const scoreDiff = rankScore(right.upvotes, right.downvotes) - rankScore(left.upvotes, left.downvotes);
  if (scoreDiff !== 0) return scoreDiff;

  if (left.upvotes !== right.upvotes) return right.upvotes - left.upvotes;

  const timeDiff = new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  if (timeDiff !== 0) return timeDiff;

  return left.id.localeCompare(right.id);
}
