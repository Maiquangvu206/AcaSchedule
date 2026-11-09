import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import {
  ApiError,
  createScheduleItem, registerScheduleSections,
  deleteScheduleItem,
  fetchCourseSections,
  fetchScheduleItems,
  fetchSchedulePeriods,
  fetchScheduleSemesters,
  fetchRegistrationConfig,
  runScheduleSimulation,
  updateScheduleItem,
  type CourseSection,
  type PeriodSlot,
  type ScheduleItem,
  type ScheduleSimulation,
} from '../lib/api';

const DAYS = [
  { value: 2, label: 'Thứ 2' },
  { value: 3, label: 'Thứ 3' },
  { value: 4, label: 'Thứ 4' },
  { value: 5, label: 'Thứ 5' },
  { value: 6, label: 'Thứ 6' },
  { value: 7, label: 'Thứ 7' },
  { value: 8, label: 'Chủ nhật' },
];

const SUBJECT_COLORS = [
  'border-sky-400/40 bg-sky-500/15 text-sky-700',
  'border-emerald-400/40 bg-emerald-500/15 text-emerald-700',
  'border-violet-400/40 bg-violet-500/15 text-violet-700',
  'border-rose-400/40 bg-rose-500/15 text-rose-700',
  'border-cyan-400/40 bg-cyan-500/15 text-cyan-700',
  'border-lime-400/40 bg-lime-500/15 text-lime-700',
];

const DEFAULT_PERIOD_TIMES = [
  ['07:00', '07:50'],
  ['07:55', '08:45'],
  ['08:50', '09:40'],
  ['09:45', '10:35'],
  ['10:40', '11:30'],
  ['13:00', '13:50'],
  ['13:55', '14:45'],
  ['14:50', '15:40'],
  ['15:45', '16:35'],
  ['16:40', '17:30'],
  ['17:35', '18:25'],
  ['18:30', '19:20'],
] as const;

function dayLabel(day: number): string {
  return DAYS.find((item) => item.value === day)?.label ?? `Ngày ${day}`;
}

function subjectColor(code: string): string {
  const hash = [...code].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return SUBJECT_COLORS[hash % SUBJECT_COLORS.length] ?? SUBJECT_COLORS[0];
}

function formatTimeRange(periods: PeriodSlot[], start: number, end: number): string {
  const startSlot = periods.find((slot) => slot.period === start);
  const endSlot = periods.find((slot) => slot.period === end);
  if (!startSlot || !endSlot) return `Tiết ${start}–${end}`;
  return `${startSlot.startTime}–${endSlot.endTime}`;
}

function startOfWeek(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + offset);
  result.setHours(0, 0, 0, 0);
  return result;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' }).format(date);
}

function dateValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

interface CalendarEvent {
  key: string;
  kind: 'section' | 'item';
  id: string;
  code: string;
  title: string;
  subtitle: string;
  day: number;
  start: number;
  end: number;
  room: string | null;
  item: ScheduleItem | null;
  conflict: boolean;
}

export function SchedulePage() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const gridRef = useRef<HTMLDivElement | null>(null);

  const [semester, setSemester] = useState('');
  const [semesters, setSemesters] = useState<string[]>([]);
  const [includeCancelled, setIncludeCancelled] = useState(false);
  const [sections, setSections] = useState<CourseSection[]>([]);
  const [periods, setPeriods] = useState<PeriodSlot[]>([]);
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [registering, setRegistering] = useState(false);
  const [simulation, setSimulation] = useState<ScheduleSimulation | null>(null);
  const [registrationOpen, setRegistrationOpen] = useState<boolean | null>(null);

  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));

  const [title, setTitle] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState('2');
  const [startTime, setStartTime] = useState('07:00');
  const [endTime, setEndTime] = useState('08:00');
  const [room, setRoom] = useState('');
  const [saving, setSaving] = useState(false);
  const [itemsVersion, setItemsVersion] = useState(0);

  const handleAuthError = useCallback(
    (loadError: unknown, fallback: string) => {
      if (loadError instanceof ApiError && loadError.status === 401) {
        logout();
        navigate('/login', { replace: true, state: { from: '/schedule' } });
        return;
      }
      setError(loadError instanceof Error ? loadError.message : fallback);
    },
    [logout, navigate],
  );

  useEffect(() => {
    if (!token) {
      navigate('/login', { replace: true, state: { from: '/schedule' } });
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setSelected([]);
    setSimulation(null);

    Promise.all([
      fetchCourseSections(token, { semester, includeCancelled }),
      fetchSchedulePeriods(token),
      fetchScheduleItems(token, semester, dateValue(weekStart)),
      // Registration status must not block the timetable if it fails.
      fetchRegistrationConfig(token, semester).catch(() => ({
        isOpen: true,
        openedAt: null,
        closedAt: null,
      })),
    ])
      .then(([nextSections, nextPeriods, nextItems, nextRegConfig]) => {
        if (cancelled) return;
        setSections(nextSections);
        setPeriods(nextPeriods);
        setItems(nextItems);
        setRegistrationOpen(nextRegConfig.isOpen);
      })
      .catch((loadError) => {
        if (!cancelled) handleAuthError(loadError, 'Không tải được dữ liệu thời khóa biểu');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, semester, includeCancelled, weekStart, handleAuthError, navigate]);

  useEffect(() => {
    if (!token) return;
    fetchScheduleSemesters(token)
      .then((options) => {
        setSemesters(options);
        if (!semester && options[0]) setSemester(options[0]);
      })
      .catch((loadError) => handleAuthError(loadError, 'Không tải được danh sách học kỳ'));
  }, [token, semester, handleAuthError]);

  const selectedKey = selected.join(',');
  const selectedIds = useMemo(
    () => (selectedKey ? selectedKey.split(',') : []),
    [selectedKey],
  );

  useEffect(() => {
    if (!token || selectedIds.length === 0) {
      setSimulation(null);
      setSimulating(false);
      return;
    }

    let cancelled = false;
    setSimulating(true);

    runScheduleSimulation(token, { semester, sectionIds: selectedIds, weekStart: dateValue(weekStart) })
      .then((result) => {
        if (!cancelled) setSimulation(result);
      })
      .catch((simulationError) => {
        if (cancelled) return;
        setSimulation(null);
        handleAuthError(simulationError, 'Không mô phỏng được thời khóa biểu');
      })
      .finally(() => {
        if (!cancelled) setSimulating(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, semester, selectedIds, itemsVersion, weekStart, handleAuthError]);

  const groups = useMemo(() => {
    const map = new Map<
      string,
      { code: string; name: string; credits: number; sections: CourseSection[] }
    >();

    for (const section of sections) {
      const group = map.get(section.subjectCode) ?? {
        code: section.subjectCode,
        name: section.subjectName,
        credits: section.credits,
        sections: [],
      };
      group.sections.push(section);
      map.set(section.subjectCode, group);
    }

    return [...map.values()].sort((left, right) => left.code.localeCompare(right.code));
  }, [sections]);

  const conflicts = simulation?.conflicts ?? [];
  const conflictedSections = useMemo(() => {
    const ids = new Set<string>();
    for (const conflict of conflicts) {
      if (conflict.first.kind === 'section') ids.add(conflict.first.id);
      if (conflict.second.kind === 'section') ids.add(conflict.second.id);
    }
    return ids;
  }, [conflicts]);

  const conflictedItems = useMemo(() => {
    const ids = new Set<string>();
    for (const conflict of conflicts) {
      if (conflict.first.kind === 'item') ids.add(conflict.first.id);
      if (conflict.second.kind === 'item') ids.add(conflict.second.id);
    }
    return ids;
  }, [conflicts]);

  const events = useMemo<CalendarEvent[]>(() => {
    const sectionEvents: CalendarEvent[] = (simulation?.sections ?? [])
      .filter((section) => !section.isCancelled)
      .map((section) => ({
        key: `section-${section.id}`,
        kind: 'section' as const,
        id: section.id,
        code: section.sectionCode,
        title: section.subjectName,
        subtitle: `${section.subjectCode} · ${section.credits} TC`,
        day: section.dayOfWeek,
        start: section.startPeriod,
        end: section.endPeriod,
        room: section.room,
        item: null,
        conflict: conflictedSections.has(section.id),
      }));

    const itemEvents: CalendarEvent[] = items.map((item) => ({
      key: `item-${item.id}`,
      kind: 'item' as const,
      id: item.id,
      code: 'CÁ NHÂN',
      title: item.title,
      subtitle: item.note ?? '',
      day: item.dayOfWeek,
      start: item.startPeriod,
      end: item.endPeriod,
      room: item.room,
      item,
      conflict: conflictedItems.has(item.id),
    }));

    return [...sectionEvents, ...itemEvents].sort((left, right) => {
      if (left.day !== right.day) return left.day - right.day;
      if (left.start !== right.start) return left.start - right.start;
      return left.kind.localeCompare(right.kind);
    });
  }, [simulation, items, conflictedSections, conflictedItems]);

  const toggleSection = (sectionId: string) => {
    setSelected((current) =>
      current.includes(sectionId)
        ? current.filter((id) => id !== sectionId)
        : [...current, sectionId],
    );
  };

  const registerSelected = async () => {
    if (!token || !simulation?.summary.feasible || selectedIds.length === 0) return;
    setRegistering(true);
    try {
      await registerScheduleSections(token, { semester, sectionIds: selectedIds });
      setNotice('Đã đăng ký lớp học phần. Bảng điểm đã được cập nhật với trạng thái Chờ điểm.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể đăng ký lớp học phần.');
    } finally { setRegistering(false); }
  };

  const handleCreateItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !title.trim()) return;

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const result = await createScheduleItem(token, {
        title: title.trim(),
        semester,
        weekStart: dateValue(weekStart),
        dayOfWeek: Number(dayOfWeek),
        startPeriod: 1,
        endPeriod: 1,
        startTime,
        endTime,
        room: room.trim() || null,
      });
      setItems((current) => [...current, result.item]);
      setItemsVersion((value) => value + 1);
      setTitle('');
      setRoom('');
      setNotice(
        result.conflicts.length > 0
          ? `Đã thêm lịch cá nhân, nhưng có ${result.conflicts.length} xung đột cần kiểm tra.`
          : 'Đã thêm lịch cá nhân.',
      );
    } catch (createError) {
      handleAuthError(createError, 'Không thêm được lịch cá nhân');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!token) return;
    setError(null);
    setNotice(null);

    try {
      await deleteScheduleItem(token, itemId);
      setItems((current) => current.filter((item) => item.id !== itemId));
      setItemsVersion((value) => value + 1);
      setNotice('Đã xóa lịch cá nhân.');
    } catch (deleteError) {
      handleAuthError(deleteError, 'Không xóa được lịch cá nhân');
    }
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!token || !gridRef.current) return;

    const itemId = event.dataTransfer.getData('text/plain');
    const current = items.find((item) => item.id === itemId);
    if (!current) return;

    const rect = gridRef.current.getBoundingClientRect();
    const timeColumn = 76;
    const headerHeight = 40;
    const rowHeight = 52;
    const columnWidth = (rect.width - timeColumn) / DAYS.length;
    const x = event.clientX - rect.left - timeColumn;
    const y = event.clientY - rect.top - headerHeight;

    const dayIndex = Math.min(6, Math.max(0, Math.floor(x / columnWidth)));
    const periodIndex = Math.min(11, Math.max(0, Math.floor(y / rowHeight)));
    const duration = current.endPeriod - current.startPeriod;
    const start = Math.min(periodIndex + 1, 12 - duration);
    const end = start + duration;

    setError(null);
    try {
      const result = await updateScheduleItem(token, itemId, {
        dayOfWeek: dayIndex + 2,
        startPeriod: start,
        endPeriod: end,
      });
      setItems((existing) =>
        existing.map((item) => (item.id === itemId ? result.item : item)),
      );
      setItemsVersion((value) => value + 1);
    } catch (moveError) {
      handleAuthError(moveError, 'Không di chuyển được lịch cá nhân');
    }
  };

  const periodOptions = periods.length > 0
    ? periods
    : DEFAULT_PERIOD_TIMES.map(([startTime, endTime], index) => ({
        period: index + 1,
        startTime,
        endTime,
        label: `Tiết ${index + 1}`,
      }));

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Thời khóa biểu</h1>
          {registrationOpen !== null && (
            <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
              {registrationOpen
                ? 'Đăng ký đang mở'
                : 'Đăng ký đã khóa'}
            </p>
          )}
          <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
            Chọn lớp học phần để mô phỏng đăng ký. Hệ thống phát hiện trùng thứ và giao tiết, đồng thời
            so sánh với lịch cá nhân đã lưu.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block min-w-[190px] space-y-1.5 text-xs font-semibold tracking-wide text-slate-600">
            <span className="ml-1">Học kỳ</span>
            <select
              value={semester}
              onChange={(event) => setSemester(event.target.value)}
              disabled={semesters.length === 0}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium tracking-normal text-slate-900 shadow-sm outline-none transition hover:border-slate-300 focus:border-brand-400/60 focus:ring-4 focus:ring-brand-500/10 disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              {semesters.length === 0 ? <option value="">Chưa có học kỳ</option> : null}
              {semesters.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="flex h-11 cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50">
            <input
              type="checkbox"
              checked={includeCancelled}
              onChange={(event) => setIncludeCancelled(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 bg-white accent-brand-500 focus:ring-2 focus:ring-brand-500/20"
            />
            <span className="whitespace-nowrap">Hiện lớp đã huỷ</span>
          </label>
        </div>
      </header>

      {error ? (
        <p role="alert" className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-2xl border border-brand-400/30 bg-brand-500/10 px-4 py-3 text-sm text-brand-700">
          {notice}
        </p>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Lớp đã chọn"
          value={String(simulation?.summary.sectionCount ?? 0)}
          suffix="lớp"
        />
        <SummaryCard
          label="Tín chỉ dự kiến"
          value={String(simulation?.summary.credits ?? 0)}
          suffix="TC"
        />
        <SummaryCard
          label="Xung đột"
          value={String(simulation?.summary.conflictCount ?? 0)}
          suffix="vụ"
          danger={Boolean(simulation && simulation.summary.conflictCount > 0)}
        />
        <SummaryCard
          label="Trạng thái"
          value={
            selectedIds.length === 0
              ? 'Chưa chọn'
              : simulating
                ? 'Đang tính'
                : simulation?.summary.feasible
                  ? 'Hợp lệ'
                  : 'Có xung đột'
          }
          suffix={selectedIds.length === 0 ? '' : `${selectedIds.length} lớp`}
          success={Boolean(simulation?.summary.feasible)}
        />
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-4">
        <p className="text-sm text-slate-700">Đăng ký lớp hợp lệ sẽ tự tạo môn trong bảng điểm ở trạng thái <span className="font-semibold">Chờ điểm</span>.</p>
        <button type="button" onClick={registerSelected} disabled={registering || !simulation?.summary.feasible || selectedIds.length === 0} className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
          {registering ? 'Đang đăng ký…' : 'Đăng ký lớp đã chọn'}
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[330px_1fr]">
        <aside className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Lớp học phần</h2>
            <span className="text-xs text-slate-500">{sections.length} lớp</span>
          </div>

          {loading ? (
            <p className="py-8 text-center text-sm text-slate-500">Đang tải lớp học phần…</p>
          ) : groups.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              Không có lớp cho học kỳ {semester}.
            </p>
          ) : (
            <div className="max-h-[620px] space-y-4 overflow-y-auto pr-1">
              {groups.map((group) => (
                <div key={group.code} className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{group.name}</p>
                      <p className="text-[11px] text-slate-500">
                        {group.code} · {group.credits} tín chỉ
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {group.sections.map((section) => {
                      const checked = selected.includes(section.id);
                      return (
                        <label
                          key={section.id}
                          className={`flex cursor-pointer items-start gap-2 rounded-xl border p-2.5 text-xs transition ${
                            section.isCancelled
                              ? 'cursor-not-allowed border-gray-200/50 bg-gray-100/40 text-slate-600'
                              : checked
                                ? 'border-brand-400/40 bg-brand-500/10 text-slate-900'
                                : 'border-gray-200/50 bg-gray-100/40 text-slate-600 hover:border-gray-300/50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 rounded border-gray-300 bg-white accent-brand-500"
                            checked={checked}
                            disabled={section.isCancelled}
                            onChange={() => toggleSection(section.id)}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-1.5 font-medium text-slate-900">
                              {section.sectionCode}
                              {section.isCancelled ? (
                                <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-600 ring-1 ring-inset ring-rose-500/30">
                                  Đã huỷ
                                </span>
                              ) : null}
                            </span>
                            <span className="mt-1 block text-[11px] leading-4 text-slate-500">
                              {dayLabel(section.dayOfWeek)} · Tiết {section.startPeriod}–{section.endPeriod}
                              <br />
                              {formatTimeRange(periods, section.startPeriod, section.endPeriod)}
                              {section.room ? ` · ${section.room}` : ''}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900">Lịch tuần</h2>
              <span className="text-xs text-slate-500">
                {formatDate(weekStart)} – {formatDate(new Date(weekStart.getTime() + 6 * 86400000))}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setWeekStart((date) => new Date(date.getTime() - 7 * 86400000))} className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">‹</button>
              <button type="button" onClick={() => setWeekStart(startOfWeek(new Date()))} className="rounded-lg bg-brand-500 px-3 py-1 text-xs font-medium text-white hover:bg-brand-400">Tuần này</button>
              <button type="button" onClick={() => setWeekStart((date) => new Date(date.getTime() + 7 * 86400000))} className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">›</button>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-brand-400" /> Lớp học phần
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-amber-400" /> Lịch cá nhân
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-rose-400" /> Xung đột
              </span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white p-1">
            <div
              ref={gridRef}
              className="grid min-w-[820px]"
              style={{
                gridTemplateColumns: '76px repeat(7, minmax(0, 1fr))',
                gridTemplateRows: '40px repeat(12, 52px)',
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => void handleDrop(event)}
            >
              <div
                className="flex items-center justify-center border-b border-gray-200 text-[10px] uppercase tracking-wide text-slate-600"
                style={{ gridColumn: '1', gridRow: '1' }}
              >
                Tiết
              </div>
              {DAYS.map((day, index) => (
                <div
                  key={day.value}
                  className="flex flex-col items-center justify-center gap-0.5 border-b border-l border-gray-200 text-xs font-medium text-slate-600"
                  style={{ gridColumn: `${index + 2}`, gridRow: '1' }}
                >
                  <span>{day.label}</span>
                  <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium leading-none text-slate-400">
                    {formatDate(new Date(weekStart.getTime() + index * 86400000))}
                  </span>
                </div>
              ))}

              {periodOptions.map((slot, index) => (
                <Fragment key={slot.period}>
                  <div
                    className="flex flex-col items-center justify-center border-b border-gray-200 text-[10px] text-slate-500"
                    style={{ gridColumn: '1', gridRow: `${index + 2}` }}
                  >
                    <span className="font-semibold text-slate-600">Tiết {slot.period}</span>
                    <span>{slot.startTime} – {slot.endTime}</span>
                  </div>
                  {DAYS.map((day, dayIndex) => (
                    <div
                      key={`${slot.period}-${day.value}`}
                      className="border-b border-l border-gray-200"
                      style={{
                        gridColumn: `${dayIndex + 2}`,
                        gridRow: `${index + 2}`,
                      }}
                    />
                  ))}
                </Fragment>
              ))}

              {events.map((event, index) => {
                const overlapIndex = events
                  .slice(0, index)
                  .filter(
                    (other) =>
                      other.day === event.day &&
                      other.start <= event.end &&
                      event.start <= other.end,
                  ).length;
                const offset = overlapIndex % 2 === 0 ? '0%' : '14%';

                return (
                  <div
                    key={event.key}
                    draggable={event.kind === 'item'}
                    onDragStart={(dragEvent) => {
                      if (event.kind !== 'item') return;
                      dragEvent.dataTransfer.setData('text/plain', event.id);
                    }}
                    className={`pointer-events-auto relative m-0.5 flex min-h-0 cursor-default flex-col overflow-hidden rounded-lg border px-2 py-1 text-left text-[11px] shadow-lg shadow-gray-200/30 ${
                      event.kind === 'item'
                        ? 'cursor-move border-amber-400/50 bg-amber-500/15 text-amber-700'
                        : subjectColor(event.code)
                    } ${event.conflict ? 'ring-2 ring-rose-400/80' : ''}`}
                    style={{
                      gridColumn: `${event.day}`,
                      gridRow: `${event.start + 1} / span ${Math.max(1, event.end - event.start + 1)}`,
                      marginLeft: offset,
                      zIndex: 10 + index,
                    }}
                    title={`${event.title} · ${dayLabel(event.day)} · Tiết ${event.start}–${event.end}`}
                  >
                    <p className="truncate font-semibold leading-4">{event.title}</p>
                    <p className="truncate text-[10px] opacity-80">{event.code}</p>
                    <p className="truncate text-[10px] opacity-70">
                      {event.item ? `${event.item.startTime}–${event.item.endTime}` : formatTimeRange(periods, event.start, event.end)}
                      {event.room ? ` · ${event.room}` : ''}
                    </p>
                    {event.kind === 'item' && event.item ? (
                      <button
                        type="button"
                        onClick={() => void handleDeleteItem(event.id)}
                        className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded bg-gray-200 text-[10px] text-slate-600 hover:text-slate-900"
                        aria-label={`Xóa ${event.title}`}
                      >
                        ×
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            Kéo lịch cá nhân (màu vàng) đến ô khác để đổi ngày/tiết. Lớp học phần được thêm bằng cách
            chọn ở cột bên trái.
          </p>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">

        <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Thêm lịch cá nhân</h2>
          <form onSubmit={handleCreateItem} className="space-y-3">
            <label className="block space-y-1 text-xs font-medium text-slate-600">
              Tên hoạt động
              <input
                required
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Tên lịch cá nhân"
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-brand-400/60 focus:ring-2 focus:ring-brand-500/20"
              />
            </label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <label className="block space-y-1 text-xs font-medium text-slate-600">
                Thứ
                <select
                  value={dayOfWeek}
                  onChange={(event) => setDayOfWeek(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-2 py-2 text-sm text-slate-900 outline-none focus:border-brand-400/60"
                >
                  {DAYS.map((day) => (
                    <option key={day.value} value={day.value}>
                      {day.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1 text-xs font-medium text-slate-600">
                Từ giờ
                <input type="time" required value={startTime} onChange={(event) => setStartTime(event.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-2 py-2 text-sm text-slate-900 outline-none focus:border-brand-400/60" />
              </label>
              <label className="block space-y-1 text-xs font-medium text-slate-600">
                Đến giờ
                <input type="time" required value={endTime} onChange={(event) => setEndTime(event.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-2 py-2 text-sm text-slate-900 outline-none focus:border-brand-400/60" />
              </label>
              <label className="block space-y-1 text-xs font-medium text-slate-600">
                Phòng
                <input
                  value={room}
                  onChange={(event) => setRoom(event.target.value)}
                  placeholder="A101"
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-2 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-brand-400/60"
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Đang thêm…' : 'Thêm lịch'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  suffix,
  danger = false,
  success = false,
}: {
  label: string;
  value: string;
  suffix?: string;
  danger?: boolean;
  success?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        danger
          ? 'border-rose-400/30 bg-rose-500/10'
          : success
            ? 'border-emerald-400/30 bg-emerald-500/10'
            : 'border-gray-200 bg-white'
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
        {value}
        {suffix ? <span className="ml-1 text-sm font-medium text-slate-500">{suffix}</span> : null}
      </p>
    </div>
  );
}
