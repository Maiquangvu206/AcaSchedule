import { describe, expect, it } from 'vitest';
import { containsPii, redactPii, redactPiiObject } from '../src/lib/pii';

describe('redactPii', () => {
  it('redacts email addresses', () => {
    expect(redactPii('Liên hệ: vu@example.com')).toContain('[email]');
    expect(redactPii('Liên hệ: vu@example.com')).not.toContain('vu@example.com');
  });

  it('redacts phone numbers', () => {
    expect(redactPii('SĐT: 0912345678')).toContain('[số điện thoại]');
    expect(redactPii('SĐT: +84912345678')).toContain('[số điện thoại]');
    expect(redactPii('SĐT: 0912345678')).not.toContain('0912345678');
  });

  it('redacts uuid tokens', () => {
    const uuid = '6b1f6dfc-bc24-4b7f-875e-6b2dca6f161c';
    expect(redactPii(`id: ${uuid}`)).toContain('[mã]');
    expect(redactPii(`id: ${uuid}`)).not.toContain(uuid);
  });

  it('redacts vietnamese names', () => {
    expect(redactPii('Nguyễn Văn A học tốt')).toContain('[họ tên]');
    expect(redactPii('Nguyễn Văn A học tốt')).not.toContain('Nguyễn Văn A');
  });

  it('leaves ordinary subject text unchanged', () => {
    const input = 'Giải tích 2: môn khó, cần ôn tập tích phân.';
    expect(redactPii(input)).toBe(input);
  });

  it('handles empty and non-string input', () => {
    expect(redactPii('')).toBe('');
    expect(redactPiiObject(null)).toBeNull();
    expect(redactPiiObject(42)).toBe(42);
  });

  it('redacts nested objects recursively', () => {
    const input = {
      user: 'Nguyễn Văn B',
      contact: 'b@example.com',
      nested: { phone: '0909090909', note: 'không có PII' },
    };
    const redacted = redactPiiObject(input);
    expect(JSON.stringify(redacted)).not.toContain('Nguyễn Văn B');
    expect(JSON.stringify(redacted)).not.toContain('b@example.com');
    expect(JSON.stringify(redacted)).not.toContain('0909090909');
    expect(JSON.stringify(redacted)).toContain('không có PII');
  });

  it('detects PII presence', () => {
    expect(containsPii('mail: a@b.com')).toBe(true);
    expect(containsPii('sdt: 0912345678')).toBe(true);
    expect(containsPii('Môn học: Giải tích')).toBe(false);
  });
});
