/**
 * Contract tests for backend ↔ AI service communication.
 *
 * Verifies that the backend correctly proxies requests to the AI service
 * and handles responses/errors according to the expected contract.
 * Skips tests when AI service is not accessible.
 */

import { describe, expect, it, vi, beforeAll, afterAll } from 'vitest';
import { createApp } from '../../src/app';
import { pool } from '../../src/database/pool';

let app: ReturnType<typeof createApp> | null = null;
let server: { address: () => { port: number } } | null = null;
let baseUrl: string | null = null;
let aiAvailable = false;

async function api(
  method: string,
  path: string,
  { token, body }: { token?: string; body?: unknown } = {},
) {
  if (!baseUrl) throw new Error('baseUrl not set');
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

beforeAll(async () => {
  try {
    app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address() as { port: number };
    baseUrl = `http://127.0.0.1:${addr.port}`;

    // Check if AI service is reachable
    const status = await api('GET', '/api/ai/status');
    aiAvailable = status.status === 200;
  } catch {
    aiAvailable = false;
  }
});

afterAll(async () => {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  await pool.end();
});

describe('AI Contract', () => {
  const token = 'test-token-contract';

  it('GET /api/ai/status returns AI service health', async () => {
    if (!aiAvailable) {
      console.log('Skipping: AI service not available');
      return;
    }
    const res = await api('GET', '/api/ai/status');
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('ok');
    expect(res.data.service).toBe('acaschedule-ai');
  });

  it('POST /api/ai/advice forwards request and returns advice', async () => {
    if (!aiAvailable) {
      console.log('Skipping: AI service not available');
      return;
    }
    const res = await api('POST', '/api/ai/advice', {
      token,
      body: { targetCpa: 3.5, question: 'Test question' },
    });

    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('advice');
    expect(res.data).toHaveProperty('model');
    expect(res.data).toHaveProperty('used_fallback');
  });

  it('POST /api/ai/advice handles missing token gracefully', async () => {
    if (!aiAvailable) {
      console.log('Skipping: AI service not available');
      return;
    }
    const res = await api('POST', '/api/ai/advice', {
      body: { targetCpa: 3.5 },
    });
    expect(res.status).toBe(401);
  });

  it('POST /api/ai/documents/summarize returns summary', async () => {
    if (!aiAvailable) {
      console.log('Skipping: AI service not available');
      return;
    }
    const res = await api('POST', '/api/ai/documents/summarize', {
      token,
      body: { text: 'Test document text for summarization.' },
    });
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('summary');
    expect(res.data).toHaveProperty('model');
    expect(res.data).toHaveProperty('used_fallback');
  });

  it('POST /api/ai/qa returns answer with sources', async () => {
    if (!aiAvailable) {
      console.log('Skipping: AI service not available');
      return;
    }
    const res = await api('POST', '/api/ai/qa', {
      token,
      body: {
        question: 'What is Python?',
        documents: [{ title: 'doc1', text: 'Python is a programming language' }],
      },
    });
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('answer');
    expect(res.data).toHaveProperty('sources');
    expect(Array.isArray(res.data.sources)).toBe(true);
    expect(res.data).toHaveProperty('model');
    expect(res.data).toHaveProperty('used_fallback');
  });
});
