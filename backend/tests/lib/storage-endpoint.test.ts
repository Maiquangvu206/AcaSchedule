import { describe, expect, it } from 'vitest';
import { normalizeStorageHost } from '../../src/config/env';

describe('normalizeStorageHost', () => {
  it('keeps a bare host untouched', () => {
    expect(normalizeStorageHost('d9ed49d5.r2.cloudflarestorage.com')).toBe(
      'd9ed49d5.r2.cloudflarestorage.com',
    );
  });

  it('strips the https:// scheme', () => {
    expect(normalizeStorageHost('https://d9ed49d5.r2.cloudflarestorage.com')).toBe(
      'd9ed49d5.r2.cloudflarestorage.com',
    );
  });

  it('strips a trailing bucket path (the Cloudflare R2 paste format)', () => {
    expect(normalizeStorageHost('d9ed49d5.r2.cloudflarestorage.com/acaschedule')).toBe(
      'd9ed49d5.r2.cloudflarestorage.com',
    );
    expect(normalizeStorageHost('https://d9ed49d5.r2.cloudflarestorage.com/acaschedule/')).toBe(
      'd9ed49d5.r2.cloudflarestorage.com',
    );
  });

  it('strips a trailing port', () => {
    expect(normalizeStorageHost('localhost:9000')).toBe('localhost');
    expect(normalizeStorageHost('https://localhost:9000/minio')).toBe('localhost');
  });

  it('keeps non-string values untouched', () => {
    expect(normalizeStorageHost(undefined)).toBeUndefined();
    expect(normalizeStorageHost(42)).toBe(42);
  });
});
