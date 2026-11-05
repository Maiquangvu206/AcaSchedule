/**
 * PII redaction helpers.
 *
 * Redacts personally identifiable information before text is sent to an external
 * AI model, and ensures logs never contain the raw (unredacted) content.
 *
 * Patterns covered:
 *  - email addresses
 *  - Vietnamese/international phone numbers
 *  - student ids / uuid-like tokens (kept as stable placeholders so the model can
 *    still reason about relationships without learning real identifiers)
 */
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE_RE = /(?:\+?84|0)\d{9,10}/g;
const UUID_RE = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g;

/** Vietnamese full-name heuristic: 2–4 words, each starting with an uppercase
 * letter followed by lowercase letters (Unicode-aware so "Nguyễn Văn A" matches). */
const NAME_RE = /\b\p{Lu}\p{Ll}+(?:\s+\p{Lu}\p{Ll}+){1,3}\b/gu;

const EMAIL_TOKEN = '[email]';
const PHONE_TOKEN = '[số điện thoại]';
const UUID_TOKEN = '[mã]';
const NAME_TOKEN = '[họ tên]';

/** Redact PII from `text`. Safe to call on user-provided questions, answers and
 * anything that will leave the service boundary. */
export function redactPii(text: string): string {
  if (typeof text !== 'string') return text;

  return text
    .replace(EMAIL_RE, EMAIL_TOKEN)
    .replace(PHONE_RE, PHONE_TOKEN)
    .replace(UUID_RE, UUID_TOKEN)
    .replace(NAME_RE, NAME_TOKEN);
}

/** Redact every string value inside an object recursively, leaving other types
 * untouched. Used to sanitize request/response payloads before logging. */
export function redactPiiObject(value: unknown): unknown {
  if (typeof value === 'string') return redactPii(value);
  if (Array.isArray(value)) return value.map(redactPiiObject);
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = redactPiiObject(val);
    }
    return result;
  }
  return value;
}

/** Returns `true` when `text` contains patterns that look like PII. */
export function containsPii(text: string): boolean {
  if (typeof text !== 'string') return false;
  return EMAIL_RE.test(text) || PHONE_RE.test(text) || UUID_RE.test(text) || NAME_RE.test(text);
}
