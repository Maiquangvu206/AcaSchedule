import { useCallback, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { fetchAiAdvice, type AiAdviceRequest, type AiAdviceResponse } from '../lib/api';

export interface UseAIState {
  advice: AiAdviceResponse | null;
  loading: boolean;
  error: string | null;
  ask: (input: AiAdviceRequest) => Promise<void>;
}

/** Data layer hook for AI advisor. Encapsulates the /api/ai/advice call. */
export function useAI(): UseAIState {
  const { token } = useAuth();
  const [advice, setAdvice] = useState<AiAdviceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = useCallback(
    async (input: AiAdviceRequest) => {
      if (!token) return;
      setLoading(true);
      setError(null);
      setAdvice(null);
      try {
        const result = await fetchAiAdvice(token, input);
        setAdvice(result);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Không nhận được tư vấn từ AI');
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  return { advice, loading, error, ask };
}
