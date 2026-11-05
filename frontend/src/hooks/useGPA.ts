import { useCallback, useState, useEffect, useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  fetchTranscript,
  fetchForecast,
  type Transcript,
  type ForecastResult,
} from '../lib/api';

export interface UseGPAState {
  transcript: Transcript | null;
  forecast: ForecastResult | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  semesters: Transcript['semesters'];
  handleForecast: (
    input: { targetCpa: number; additionalCredits: number; plannedGrade4?: number },
  ) => Promise<void>;
}

/** Data layer hook for GPA / transcript. Encapsulates all fetch calls so
 *  components stay thin and data logic lives in one place. */
export function useGPA(): UseGPAState {
  const { token } = useAuth();
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTranscript(token);
      setTranscript(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không tải được bảng điểm');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [token, load]);

  const handleForecast = useCallback(
    async (input: { targetCpa: number; additionalCredits: number; plannedGrade4?: number }) => {
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        const result = await fetchForecast(token, input);
        setForecast(result);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Không dự báo được CPA');
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  const semesters = useMemo(
    () =>
      transcript
        ? [...transcript.semesters].sort(
            (a, b) => b.semester.localeCompare(a.semester),
          )
        : [],
    [transcript],
  );

  return {
    transcript,
    forecast,
    loading,
    error,
    refetch: load,
    semesters,
    handleForecast,
  };
}
