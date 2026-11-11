import { describe, expect, it } from 'vitest';
import {
  decryptSecret,
  encryptSecret,
  isKeyEncryptionConfigured,
  keyHint,
} from '../../src/lib/crypto';

const SECRET = 'test-secret-at-least-16-characters';

describe('AI key encryption', () => {
  it('round-trips a provider key', () => {
    const key = 'sk-or-v1-abcdef0123456789';

    const encrypted = encryptSecret(key, SECRET);

    expect(encrypted).not.toContain(key);
    expect(encrypted.startsWith('v1:')).toBe(true);
    expect(decryptSecret(encrypted, SECRET)).toBe(key);
  });

  it('uses a fresh IV for every encryption', () => {
    const key = 'AIzaSyExampleKey0123456789';

    expect(encryptSecret(key, SECRET)).not.toBe(encryptSecret(key, SECRET));
  });

  it('fails to decrypt with the wrong secret', () => {
    const encrypted = encryptSecret('sk-or-v1-abcdef', SECRET);

    expect(() => decryptSecret(encrypted, 'another-secret-at-least-16-chars')).toThrow();
  });

  it('rejects malformed payloads', () => {
    expect(() => decryptSecret('v1:not:enough', SECRET)).toThrow(/Unsupported/);
    expect(() => decryptSecret('v2:a:b:c', SECRET)).toThrow(/Unsupported/);
  });

  it('requires a long enough secret', () => {
    expect(isKeyEncryptionConfigured('')).toBe(false);
    expect(isKeyEncryptionConfigured('short')).toBe(false);
    expect(isKeyEncryptionConfigured(undefined)).toBe(false);
    expect(isKeyEncryptionConfigured(SECRET)).toBe(true);
  });

  it('shows only the last four characters as a hint', () => {
    expect(keyHint('sk-or-v1-abcdef1234')).toBe('••••1234');
    expect(keyHint('abc')).toBe('••••');
  });
});
