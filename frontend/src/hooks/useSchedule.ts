import { useCallback, useState, useEffect, useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  fetchSchedulePeriods,
  fetchCourseSections,
  fetchScheduleItems,
  runScheduleSimulation,
  createScheduleItem,
  updateScheduleItem,
  deleteScheduleItem,
  type PeriodSlot,
  type CourseSection,
  type ScheduleItem,
  type ScheduleSimulation,
} from '../lib/api';

export interface UseScheduleState {
  periods: PeriodSlot[];
  sections: CourseSection[];
  items: ScheduleItem[];
  semester: string;
  setSemester: (value: string) => void;
  includeCancelled: boolean;
  setIncludeCancelled: (value: boolean) => void;
  selected: string[];
  toggleSection: (sectionId: string) => void;
  simulation: ScheduleSimulation | null;
  simulating: boolean;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  createItem: (input: {
    title: string;
    semester: string | null;
    weekStart: string;
    dayOfWeek: number;
    startPeriod: number;
    endPeriod: number;
    room?: string | null;
    note?: string | null;
  }) => Promise<void>;
  updateItem: (
    itemId: string,
    input: {
      title?: string;
      semester?: string | null;
      dayOfWeek?: number;
      startPeriod?: number;
      endPeriod?: number;
      room?: string | null;
      note?: string | null;
      sectionId?: string | null;
    },
  ) => Promise<void>;
  deleteItem: (itemId: string) => Promise<void>;
}

/** Data layer hook for schedule planner. Encapsulates periods, sections,
 *  simulation, and personal items CRUD. */
export function useSchedule(initialSemester = '2025-2'): UseScheduleState {
  const { token } = useAuth();
  const [periods, setPeriods] = useState<PeriodSlot[]>([]);
  const [sections, setSections] = useState<CourseSection[]>([]);
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [semester, setSemester] = useState(initialSemester);
  const [includeCancelled, setIncludeCancelled] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [simulation, setSimulation] = useState<ScheduleSimulation | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const weekStart = new Date();
  const day = weekStart.getDay();
  weekStart.setDate(weekStart.getDate() + (day === 0 ? -6 : 1 - day));
  const weekStartValue = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [nextPeriods, nextSections, nextItems] = await Promise.all([
        fetchSchedulePeriods(token),
        fetchCourseSections(token, { semester, includeCancelled }),
        fetchScheduleItems(token, semester, weekStartValue),
      ]);
      setPeriods(nextPeriods);
      setSections(nextSections);
      setItems(nextItems);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không tải được dữ liệu lịch');
    } finally {
      setLoading(false);
    }
  }, [token, semester, includeCancelled, weekStartValue]);

  useEffect(() => {
    load();
    setSelected([]);
    setSimulation(null);
  }, [token, semester, includeCancelled, load]);

  const toggleSection = useCallback((sectionId: string) => {
    setSelected((current) =>
      current.includes(sectionId)
        ? current.filter((id) => id !== sectionId)
        : [...current, sectionId],
    );
    setSimulation(null);
  }, []);

  const selectedIds = useMemo(() => selected, [selected]);

  useEffect(() => {
    if (!token || selectedIds.length === 0) {
      setSimulation(null);
      setSimulating(false);
      return;
    }
    let cancelled = false;
    setSimulating(true);
    runScheduleSimulation(token, { semester, sectionIds: selectedIds })
      .then((result) => {
        if (!cancelled) setSimulation(result);
      })
      .catch((caught) => {
        if (!cancelled) {
          setSimulation(null);
          setError(
            caught instanceof Error ? caught.message : 'Không mô phỏng được lịch',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setSimulating(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, semester, selectedIds]);

  const createItem = useCallback(
    async (input: {
      title: string;
      semester: string | null;
      weekStart: string;
      dayOfWeek: number;
      startPeriod: number;
      endPeriod: number;
      room?: string | null;
      note?: string | null;
    }) => {
      if (!token) return;
      try {
        const result = await createScheduleItem(token, input);
        setItems((current) => [...current, result.item]);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Không thêm được lịch cá nhân');
        throw caught;
      }
    },
    [token],
  );

  const updateItem = useCallback(
    async (
      itemId: string,
      input: {
        title?: string;
        semester?: string | null;
        dayOfWeek?: number;
        startPeriod?: number;
        endPeriod?: number;
        room?: string | null;
        note?: string | null;
        sectionId?: string | null;
      },
    ) => {
      if (!token) return;
      try {
        const result = await updateScheduleItem(token, itemId, input);
        setItems((current) =>
          current.map((item) => (item.id === itemId ? result.item : item)),
        );
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Không cập nhật được lịch cá nhân');
        throw caught;
      }
    },
    [token],
  );

  const deleteItem = useCallback(
    async (itemId: string) => {
      if (!token) return;
      try {
        await deleteScheduleItem(token, itemId);
        setItems((current) => current.filter((item) => item.id !== itemId));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Không xóa được lịch cá nhân');
        throw caught;
      }
    },
    [token],
  );

  const refetch = useCallback(() => {
    load();
  }, [load]);

  return {
    periods,
    sections,
    items,
    semester,
    setSemester,
    includeCancelled,
    setIncludeCancelled,
    selected,
    toggleSection,
    simulation,
    simulating,
    loading,
    error,
    refetch,
    createItem,
    updateItem,
    deleteItem,
  };
}
