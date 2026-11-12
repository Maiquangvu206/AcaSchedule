import { describe, expect, it } from 'vitest';
import { z } from 'zod';

/**
 * Bản sao của schema trong `modules/admin/ai.routes.ts` — dùng để chặn việc
 * dán nhầm API key vào ô "model".
 */
const modelSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .refine(
    (value) => !/^(AIza|AQ\.|sk-|sk-or-)/i.test(value),
    'Đây là API key, không phải tên model',
  );

describe('AI model name validation', () => {
  it('accepts real model names', () => {
    expect(modelSchema.parse('gemini-3.5-flash')).toBe('gemini-3.5-flash');
    expect(modelSchema.parse('google/gemini-3.5-flash')).toBe('google/gemini-3.5-flash');
  });

  it('rejects a Gemini API key pasted into the model field', () => {
    expect(() => modelSchema.parse('AIzaSyExampleKey0123456789')).toThrow(/API key/);
  });

  it('rejects an OpenRouter API key pasted into the model field', () => {
    expect(() => modelSchema.parse('sk-or-v1-fc8f7f9adea91be3ee9d0a')).toThrow(/API key/);
  });

  it('rejects other key-like values', () => {
    expect(() => modelSchema.parse('AQ.Ab8RN6LfvPPClE4Mchnb_j2zGpV')).toThrow(/API key/);
    expect(() => modelSchema.parse('sk-1234567890')).toThrow(/API key/);
  });

  it('rejects an empty model name', () => {
    expect(() => modelSchema.parse('   ')).toThrow();
  });
});
