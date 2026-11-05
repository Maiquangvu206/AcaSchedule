import { describe, expect, it } from 'vitest';
import {
  MAX_DOCUMENT_SIZE_BYTES,
  compareDocuments,
  rankScore,
  validateUploadMetadata,
} from '../src/modules/document/document.engine';

describe('validateUploadMetadata', () => {
  it('accepts a PDF with a matching extension and MIME type', () => {
    expect(
      validateUploadMetadata({
        fileName: 'de-thi-giua-ky.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
      }),
    ).toMatchObject({ ok: true, extension: 'pdf', mimeType: 'application/pdf' });
  });

  it('accepts office documents and strips MIME parameters', () => {
    expect(
      validateUploadMetadata({
        fileName: 'SLIDE.PPTX',
        mimeType:
          'application/vnd.openxmlformats-officedocument.presentationml.presentation; charset=binary',
        sizeBytes: 2048,
      }),
    ).toMatchObject({ ok: true, extension: 'pptx' });
  });

  it('blocks executable extensions even when the client lies about MIME', () => {
    expect(
      validateUploadMetadata({
        fileName: 'malware.exe',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
      }),
    ).toMatchObject({ ok: false, code: 'blocked_type' });
  });

  it('rejects an extension that does not match the MIME type', () => {
    expect(
      validateUploadMetadata({
        fileName: 'notes.pdf',
        mimeType: 'text/plain',
        sizeBytes: 1024,
      }),
    ).toMatchObject({ ok: false, code: 'mime_mismatch' });
  });

  it('rejects unsupported MIME types', () => {
    expect(
      validateUploadMetadata({
        fileName: 'archive.rar',
        mimeType: 'application/x-rar-compressed',
        sizeBytes: 1024,
      }),
    ).toMatchObject({ ok: false, code: 'unsupported_type' });
  });

  it('rejects path separators in the file name', () => {
    expect(
      validateUploadMetadata({
        fileName: '../../secret.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
      }),
    ).toMatchObject({ ok: false, code: 'invalid_name' });
  });

  it('rejects empty and oversized files', () => {
    expect(
      validateUploadMetadata({ fileName: 'a.pdf', mimeType: 'application/pdf', sizeBytes: 0 }),
    ).toMatchObject({ ok: false, code: 'empty_file' });

    expect(
      validateUploadMetadata({
        fileName: 'a.pdf',
        mimeType: 'application/pdf',
        sizeBytes: MAX_DOCUMENT_SIZE_BYTES + 1,
      }),
    ).toMatchObject({ ok: false, code: 'too_large' });
  });
});

describe('ranking', () => {
  it('computes a ratio score and gives no-vote documents zero', () => {
    expect(rankScore(0, 0)).toBe(0);
    expect(rankScore(1, 0)).toBe(0.5);
    expect(rankScore(0, 1)).toBe(-0.5);
    expect(rankScore(5, 0)).toBeGreaterThan(rankScore(1, 0));
  });

  it('sorts by score, then upvotes, then newest', () => {
    const documents = [
      {
        id: 'old-popular',
        upvotes: 10,
        downvotes: 1,
        createdAt: '2025-01-01T00:00:00.000Z',
      },
      {
        id: 'new-tied',
        upvotes: 10,
        downvotes: 1,
        createdAt: '2025-02-01T00:00:00.000Z',
      },
      {
        id: 'controversial',
        upvotes: 3,
        downvotes: 3,
        createdAt: '2025-03-01T00:00:00.000Z',
      },
      {
        id: 'no-votes-new',
        upvotes: 0,
        downvotes: 0,
        createdAt: '2025-04-01T00:00:00.000Z',
      },
    ];

    expect([...documents].sort(compareDocuments).map((document) => document.id)).toEqual([
      'new-tied',
      'old-popular',
      'controversial',
      'no-votes-new',
    ]);
  });
});
