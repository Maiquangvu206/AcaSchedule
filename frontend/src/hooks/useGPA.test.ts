import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGPA } from './useGPA';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockTranscript = {
  student: { id: '1', email: 'test@test.com', fullName: 'Test User' },
  summary: { cpa: 3.2, creditsAttempted: 30, creditsEarned: 30, countedSubjects: 6, totalAttempts: 6 },
  semesters: [
    { semester: '2024-1', gpa: 3.0, credits: 15, earnedCredits: 15, attempts: [] },
    { semester: '2024-2', gpa: 3.5, credits: 15, earnedCredits: 15, attempts: [] },
  ],
};

describe('useGPA', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('fetches transcript on mount', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(mockTranscript), { status: 200 })
    );

    const { result } = renderHook(() => useGPA());

    expect(result.current.loading).toBe(true);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.transcript).toEqual(mockTranscript);
    expect(result.current.loading).toBe(false);
  });

  it('handles fetch error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useGPA());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.loading).toBe(false);
  });

  it('returns sorted semesters', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(mockTranscript), { status: 200 })
    );

    const { result } = renderHook(() => useGPA());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.semesters[0].semester).toBe('2024-2');
    expect(result.current.semesters[1].semester).toBe('2024-1');
  });
});
