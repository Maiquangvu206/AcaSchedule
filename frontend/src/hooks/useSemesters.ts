import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { fetchSemesters, type SemesterConfig } from '../lib/api';

/**
 * Shared hook for the central semester catalogue.
 * Every combo box in the app reads from this hook so semester codes stay
 * consistent everywhere.
 */
export function useSemesters(): { semesters: SemesterConfig[]; codes: string[] } {
  const { token } = useAuth();
  const [semesters, setSemesters] = useState<SemesterConfig[]>([]);

  useEffect(() => {
    if (!token) return;
    fetchSemesters(token).then(setSemesters).catch(() => setSemesters([]));
  }, [token]);

  return { semesters, codes: semesters.map((semester) => semester.code) };
}
