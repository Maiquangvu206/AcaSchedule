import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGPA } from './useGPA';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// useGPA đọc token từ useAuth nên mock module này thay vì bọc AuthProvider.
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: '1', email: 'test@test.com', fullName: 'Test User', role: 'student' },
    token: 'test-access-token',
    login: vi.fn(),
    logout: vi.fn(),
    updateUser: vi.fn(),
  }),
}));

const mockTranscript = {
  student: { id: '1', email: 'test@test.com', fullName: 'Test User' },
  summary: {
    cpa: 3.2,
    creditsAttempted: 30,
    creditsEarned: 30,
    creditsStudied: 33,
    countedSubjects: 6,
    totalAttempts: 6,
  },
  semesters: [
    { semester: '2024-1', gpa: 3.0, credits: 15, earnedCredits: 15, attempts: [] },
    { semester: '2024-2', gpa: 3.5, credits: 15, earnedCredits: 15, attempts: [] },
  ],
};

function renderGPA() {
  return renderHook(() => useGPA());
}

describe('useGPA', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('fetches transcript on mount', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(mockTranscript), { status: 200 })
    );

    const { result } = renderGPA();

    expect(result.current.loading).toBe(true);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.transcript).toEqual(mockTranscript);
    expect(result.current.loading).toBe(false);
  });

  it('handles fetch error', async () => {
    // safeFetch thử lại 3 lần (800ms + 1600ms) nên phải tua timer.
    vi.useFakeTimers();
    mockFetch.mockRejectedValue(new Error('Network error'));

    const { result } = renderGPA();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    vi.useRealTimers();

    // apiRequest bọc lỗi mạng thành ApiError với message tiếng Việt.
    expect(result.current.error).toBeTruthy();
    expect(result.current.transcript).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('returns sorted semesters', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(mockTranscript), { status: 200 })
    );

    const { result } = renderGPA();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.semesters[0].semester).toBe('2024-2');
    expect(result.current.semesters[1].semester).toBe('2024-1');
  });
});
