import { useCallback, useEffect, useState } from 'react';

export interface HealthResponse {
  status: 'ok' | 'degraded';
  service: string;
  version: string;
  uptime: number;
  timestamp: string;
  checks: Record<string, 'up' | 'down'>;
}

interface HealthState {
  loading: boolean;
  data: HealthResponse | null;
  error: string | null;
}

export function useHealth(pollIntervalMs = 30_000) {
  const [state, setState] = useState<HealthState>({
    loading: true,
    data: null,
    error: null,
  });

  const refresh = useCallback(async () => {
    setState((previous) => ({ ...previous, loading: true }));

    try {
      const response = await fetch('/api/health', {
        headers: { Accept: 'application/json' },
      });
      const data = (await response.json()) as HealthResponse;

      setState({
        loading: false,
        data,
        error: response.ok ? null : `API trả về HTTP ${response.status}`,
      });
    } catch (error) {
      setState({
        loading: false,
        data: null,
        error: error instanceof Error ? error.message : 'Không kết nối được API',
      });
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), pollIntervalMs);
    return () => window.clearInterval(timer);
  }, [refresh, pollIntervalMs]);

  return { ...state, refresh };
}
