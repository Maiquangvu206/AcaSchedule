import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Combobox } from '../components/Combobox';
import {
  createAdminScheduleSection, deleteAdminScheduleSection, fetchAdminScheduleSections,
  fetchAdminSubjects, updateAdminScheduleSection,
  fetchAdminSemesters, fetchScheduleSemesters,
  type AdminCourseSection, type AdminCourseSectionInput, type AdminSubject,
  type SemesterConfig,
} from '../lib/api';
import { AdminListPage } from './AdminUsers';

const days = ['', '', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
const pairedDay: Record<number, number> = { 2: 5, 3: 6, 4: 7 };

const emptyForm: AdminCourseSectionInput = {
  subjectId: '', semester: '', sectionCode: '', dayOfWeek: 2, startPeriod: 1, endPeriod: 2,
  classType: 'lecture', meetingCount: 1, linkedSectionId: null, startDate: null, endDate: null, secondDayOfWeek: 5,
  secondStartPeriod: 1, secondEndPeriod: 2, room: null, lecturer: null, capacity: null, isCancelled: false,
  skippedWeeks: [],
};

export function AdminSchedulePage() {
  const { token } = useAuth();
  const [sections, setSections] = useState<AdminCourseSection[]>([]);
  const [subjects, setSubjects] = useState<AdminSubject[]>([]);
  const [semester, setSemester] = useState('');
  const [semesters, setSemesters] = useState<SemesterConfig[]>([]);
  const [form, setForm] = useState<AdminCourseSectionInput>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [hasPractical, setHasPractical] = useState(false);
  const [practicalDay, setPracticalDay] = useState(6);
  const [practicalStart, setPracticalStart] = useState(1);
  const [practicalEnd, setPracticalEnd] = useState(2);
  // Lớp thực hành có thể học 1 hoặc 2 buổi mỗi tuần.
  const [practicalMeetingCount, setPracticalMeetingCount] = useState(1);
  const [practicalSecondDay, setPracticalSecondDay] = useState(7);
  const [practicalSecondStart, setPracticalSecondStart] = useState(1);
  const [practicalSecondEnd, setPracticalSecondEnd] = useState(2);
  // Các tuần (1-based) mà lớp không học.
  const [skippedWeeks, setSkippedWeeks] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = () => {
    if (!token) return;
    fetchAdminScheduleSections(token, semester || undefined).then(setSections).catch(() => setError('Không tải được lịch học.'));
  };

  useEffect(() => {
    if (!token) return;
    fetchAdminSubjects(token).then(setSubjects).catch(() => setError('Không tải được môn học.'));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    // Danh sách học kỳ lấy từ bảng `semesters` (dùng chung toàn hệ thống).
    // Fallback sang danh sách kỳ đang có trong lịch học để không bị mất dữ liệu.
    fetchAdminSemesters(token)
      .then((catalogue) => {
        if (catalogue.length) {
          setSemesters(catalogue);
          return null;
        }
        return fetchScheduleSemesters(token).then((options) => {
          setSemesters(options.map((code) => ({
            code, name: '', startDate: null, endDate: null, isActive: true, sortNo: 0,
          })));
        });
      })
      .catch(() => setError('Không tải được danh sách học kỳ.'));
  }, [token]);

  // Chọn học kỳ mặc định ngay khi danh sách vừa tải xong.
  useEffect(() => {
    if (semester || !semesters.length) return;
    setSemester(semesters[0].code);
    setForm((current) => ({ ...current, semester: current.semester || semesters[0].code }));
  }, [semester, semesters]);

  useEffect(load, [token, semester]);

  /** Ngày bắt đầu học kỳ dùng làm mốc đánh số tuần (tuần 1 = tuần chứa ngày này). */
  const semesterStart = useMemo(
    () =>
      semesters.find((item) => item.code === form.semester)?.startDate ??
      form.startDate ??
      null,
    [semesters, form.semester, form.startDate],
  );

  /** Ngày kết thúc học kỳ — chặn dải tuần theo đúng thời lượng của kỳ. */
  const semesterEnd = useMemo(
    () => semesters.find((item) => item.code === form.semester)?.endDate ?? null,
    [semesters, form.semester],
  );

  /**
   * Danh sách tuần có thể chọn nghỉ, tính theo thời gian thực của học kỳ:
   * tuần 1 = tuần (bắt đầu Thứ 2) chứa ngày bắt đầu học kỳ, tuần cuối =
   * tuần chứa ngày kết thúc — khớp quy tắc đánh số tuần của backend
   * (schedule.service.ts → semesterStartMonday). Backend chấp nhận tối đa
   * tuần 60; nếu học kỳ chưa có ngày kết thúc thì dùng 20 tuần như cũ.
   *
   * Lưu ý: API có thể trả ngày dạng ISO đầy đủ (`2024-09-01T00:00:00.000Z`)
   * nên luôn cắt 10 ký tự đầu để parse — ghép `T00:00:00` vào chuỗi đầy đủ
   * sẽ cho Invalid Date.
   */
  const weekOptions = useMemo(() => {
    const FALLBACK_WEEKS = 20;
    const MAX_WEEKS = 60;
    const mondayOf = (isoDate: string): Date | null => {
      const date = new Date(`${isoDate.slice(0, 10)}T00:00:00`);
      if (Number.isNaN(date.getTime())) return null;
      const day = date.getDay();
      date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
      return date;
    };
    const startMonday = semesterStart ? mondayOf(semesterStart) : null;
    if (!startMonday) return Array.from({ length: FALLBACK_WEEKS }, (_, i) => i + 1);

    const endMonday = semesterEnd ? mondayOf(semesterEnd) : null;
    const total = endMonday
      ? Math.floor((endMonday.getTime() - startMonday.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
      : FALLBACK_WEEKS;
    const count = Math.min(Math.max(total, 1), MAX_WEEKS);
    return Array.from({ length: count }, (_, i) => i + 1);
  }, [semesterStart, semesterEnd]);

  // Học kỳ đổi → dải tuần co lại → bỏ các tuần đã chọn vượt quá thời lượng.
  useEffect(() => {
    setSkippedWeeks((current) => {
      const max = weekOptions.length;
      const next = current.filter((week) => week >= 1 && week <= max);
      return next.length === current.length ? current : next;
    });
  }, [weekOptions]);

  const setField = <K extends keyof AdminCourseSectionInput>(key: K, value: AdminCourseSectionInput[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  /** Combo box data: tìm nhanh theo mã hoặc tên môn. */
  const subjectOptions = useMemo(
    () =>
      subjects.map((subject) => ({
        value: subject.id,
        label: `${subject.code} - ${subject.name}`,
        keywords: `${subject.code} ${subject.name}`,
        hint: `${subject.credits} tín chỉ`,
      })),
    [subjects],
  );

  const semesterOptions = useMemo(
    () =>
      semesters.map((item) => ({
        value: item.code,
        label: item.name ? `${item.code} - ${item.name}` : item.code,
        keywords: `${item.code} ${item.name}`,
      })),
    [semesters],
  );

  const reset = () => {
    setForm({ ...emptyForm, semester });
    setEditingId(null);
    setSkippedWeeks([]);
    setPracticalMeetingCount(1);
    setPracticalSecondDay(7);
    setPracticalSecondStart(1);
    setPracticalSecondEnd(2);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return;
    try {
      const payload: AdminCourseSectionInput = { ...form, skippedWeeks };
      const saved = editingId
        ? await updateAdminScheduleSection(token, editingId, payload)
        : await createAdminScheduleSection(token, payload);
      setSections((items) => editingId ? items.map((item) => item.id === saved.id ? saved : item) : [saved, ...items]);
      if (!editingId && hasPractical) {
        await createAdminScheduleSection(token, {
          ...payload,
          classType: 'practical',
          meetingCount: practicalMeetingCount,
          sectionCode: `${form.sectionCode}-TH`,
          dayOfWeek: practicalDay,
          startPeriod: practicalStart,
          endPeriod: practicalEnd,
          secondDayOfWeek: practicalMeetingCount === 2 ? practicalSecondDay : null,
          secondStartPeriod: practicalMeetingCount === 2 ? practicalSecondStart : null,
          secondEndPeriod: practicalMeetingCount === 2 ? practicalSecondEnd : null,
          linkedSectionId: saved.id,
        });
        load();
      }
      setMessage(editingId ? 'Đã cập nhật lịch học.' : 'Đã thêm lịch học cho học kỳ.');
      reset();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể lưu lịch học.');
    }
  };

  const edit = (section: AdminCourseSection) => {
    setEditingId(section.id);
    setForm({
      subjectId: section.subjectId, semester: section.semester, sectionCode: section.sectionCode,
      dayOfWeek: section.dayOfWeek, startPeriod: section.startPeriod, endPeriod: section.endPeriod,
      classType: section.classType, startDate: section.startDate, endDate: section.endDate,
      meetingCount: section.meetingCount, linkedSectionId: section.linkedSectionId,
      secondDayOfWeek: section.secondDayOfWeek, secondStartPeriod: section.secondStartPeriod,
      secondEndPeriod: section.secondEndPeriod,
      room: section.room, lecturer: section.lecturer, capacity: section.capacity, isCancelled: section.isCancelled,
      skippedWeeks: section.skippedWeeks ?? [],
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remove = async (id: string) => {
    if (!token || !window.confirm('Xóa lớp học phần này khỏi lịch học?')) return;
    await deleteAdminScheduleSection(token, id);
    setSections((items) => items.filter((item) => item.id !== id));
  };

  return (
    <AdminListPage title="Lịch học theo kỳ" description="Cấu hình lớp học phần, ngày học và tiết học cho từng học kỳ.">
      {error ? <p role="alert" className="m-5 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
      {message ? <p className="m-5 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p> : null}
      <form onSubmit={submit} className="grid gap-3 border-b border-slate-100 bg-slate-50/70 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm font-medium text-slate-700">Học kỳ<Combobox options={semesterOptions} value={form.semester} onChange={(value) => { setField('semester', value); setSemester(value); }} placeholder="Chọn học kỳ" emptyLabel="— Chọn học kỳ —" className="mt-1" /></label>
        <label className="text-sm font-medium text-slate-700">Môn học<Combobox options={subjectOptions} value={form.subjectId} onChange={(value) => setField('subjectId', value)} placeholder="Nhập mã hoặc tên môn…" emptyLabel="— Chọn môn học —" className="mt-1" /></label>
        <label className="text-sm font-medium text-slate-700">Mã lớp<input value={form.sectionCode} onChange={(e) => setField('sectionCode', e.target.value)} placeholder="INT2208-01" required className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /></label>
        <label className="text-sm font-medium text-slate-700">Số buổi / tuần<select value={form.meetingCount} onChange={(e) => { const count = Number(e.target.value); setField('meetingCount', count); if (count === 2) { setField('secondDayOfWeek', pairedDay[form.dayOfWeek] ?? 5); } else { // Về 1 buổi → xoá giá trị buổi 2 để không lưu dữ liệu rác.
 setField('secondDayOfWeek', null); setField('secondStartPeriod', null); setField('secondEndPeriod', null); } }} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value={1}>1 buổi</option><option value={2}>2 buổi</option></select></label>
        <label className="text-sm font-medium text-slate-700">Thứ<select value={form.dayOfWeek} onChange={(e) => { const day = Number(e.target.value); setField('dayOfWeek', day); if (form.meetingCount === 2) setField('secondDayOfWeek', pairedDay[day] ?? 5); }} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">{(form.meetingCount === 2 ? [2, 3, 4] : [2, 3, 4, 5, 6, 7]).map((day) => <option key={day} value={day}>{days[day]}</option>)}</select></label>
        <label className="text-sm font-medium text-slate-700">Tiết bắt đầu<input type="number" min="1" max="12" value={form.startPeriod} onChange={(e) => setField('startPeriod', Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /></label>
        <label className="text-sm font-medium text-slate-700">Tiết kết thúc<input type="number" min="1" max="12" value={form.endPeriod} onChange={(e) => setField('endPeriod', Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /></label>
        {form.meetingCount === 2 ?  <><label className="text-sm font-medium text-slate-700">Thứ buổi 2<select value={form.secondDayOfWeek ?? pairedDay[form.dayOfWeek] ?? 5} disabled className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm">{[2, 3, 4].map((day) => <option key={pairedDay[day]} value={pairedDay[day]}>{days[pairedDay[day] - 1]}</option>)}</select></label><label className="text-sm font-medium text-slate-700">Tiết bắt đầu buổi 2<input type="number" min="1" max="12" value={form.secondStartPeriod ?? 1} onChange={(e) => setField('secondStartPeriod', Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /></label><label className="text-sm font-medium text-slate-700">Tiết kết thúc buổi 2<input type="number" min="1" max="12" value={form.secondEndPeriod ?? 2} onChange={(e) => setField('secondEndPeriod', Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /></label></> : null}
        <label className="text-sm font-medium text-slate-700">Ngày bắt đầu<input type="date" value={form.startDate ?? ''} onChange={(e) => setField('startDate', e.target.value || null)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /><span className="mt-1 block text-[11px] text-slate-500">Lớp chỉ hiện trong lịch từ tuần có ngày này</span></label>
        <label className="text-sm font-medium text-slate-700">Ngày kết thúc<input type="date" value={form.endDate ?? ''} onChange={(e) => setField('endDate', e.target.value || null)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /><span className="mt-1 block text-[11px] text-slate-500">Để trống = lớp diễn ra cả học kỳ</span></label>
        <label className="text-sm font-medium text-slate-700">Phòng<input value={form.room ?? ''} onChange={(e) => setField('room', e.target.value || null)} placeholder="A101" className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /></label>
        <label className="text-sm font-medium text-slate-700">Giảng viên<input value={form.lecturer ?? ''} onChange={(e) => setField('lecturer', e.target.value || null)} placeholder="Nguyễn Văn A" className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /></label>
        <label className="text-sm font-medium text-slate-700">Sĩ số<input type="number" min="1" value={form.capacity ?? ''} onChange={(e) => setField('capacity', e.target.value ? Number(e.target.value) : null)} placeholder="40" className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /></label>
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-600"><input type="checkbox" checked={hasPractical} onChange={(e) => setHasPractical(e.target.checked)} /> Tạo lớp thực hành liên kết</label>
        {hasPractical ? (
          <>
            <label className="text-sm font-medium text-slate-700">
              Số buổi thực hành / tuần
              <select
                value={practicalMeetingCount}
                onChange={(e) => setPracticalMeetingCount(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value={1}>1 buổi</option>
                <option value={2}>2 buổi</option>
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Thứ thực hành
              <select
                value={practicalDay}
                onChange={(e) => setPracticalDay(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                {[2, 3, 4, 5, 6, 7].map((day) => <option key={day} value={day}>{days[day]}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Tiết bắt đầu thực hành
              <input type="number" min="1" max="12" value={practicalStart} onChange={(e) => setPracticalStart(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Tiết kết thúc thực hành
              <input type="number" min="1" max="12" value={practicalEnd} onChange={(e) => setPracticalEnd(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" />
            </label>
            {practicalMeetingCount === 2 ? (
              <>
                <label className="text-sm font-medium text-slate-700">
                  Thứ thực hành buổi 2
                  <select
                    value={practicalSecondDay}
                    onChange={(e) => setPracticalSecondDay(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    {[2, 3, 4, 5, 6, 7].map((day) => <option key={day} value={day}>{days[day]}</option>)}
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Tiết bắt đầu buổi 2
                  <input type="number" min="1" max="12" value={practicalSecondStart} onChange={(e) => setPracticalSecondStart(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Tiết kết thúc buổi 2
                  <input type="number" min="1" max="12" value={practicalSecondEnd} onChange={(e) => setPracticalSecondEnd(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" />
                </label>
              </>
            ) : null}
          </>
        ) : null}
        <div className="rounded-xl border border-slate-200 bg-white p-3 sm:col-span-2 lg:col-span-4">
          <p className="text-sm font-medium text-slate-700">Tuần nghỉ (không học)</p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Tuần được đánh số từ tuần đầu của học kỳ
            {semesterStart ? ` (bắt đầu ${semesterStart.slice(0, 10)})` : ''}
            {semesterEnd ? ` đến ${semesterEnd.slice(0, 10)} — ${weekOptions.length} tuần` : ' (học kỳ chưa có ngày kết thúc, mặc định 20 tuần)'}. Không chọn tuần nào nghĩa là học đều mọi tuần.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {weekOptions.map((week) => {
              const active = skippedWeeks.includes(week);
              return (
                <button
                  key={week}
                  type="button"
                  onClick={() =>
                    setSkippedWeeks((current) =>
                      active ? current.filter((item) => item !== week) : [...current, week].sort((a, b) => a - b),
                    )
                  }
                  className={`h-8 w-9 rounded-lg border text-xs font-medium transition ${
                    active
                      ? 'border-brand-500 bg-brand-500 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {week}
                </button>
              );
            })}
          </div>
        </div>        <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-600"><input type="checkbox" checked={form.isCancelled} onChange={(e) => setField('isCancelled', e.target.checked)} /> Tạm ngừng</label>
        <div className="flex items-end gap-2"><button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white">{editingId ? 'Lưu thay đổi' : 'Thêm lịch học'}</button>{editingId ? <button type="button" onClick={reset} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">Hủy</button> : null}</div>
      </form>
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center"><label className="text-sm font-medium text-slate-700">Lọc theo học kỳ</label><Combobox options={semesterOptions} value={semester} onChange={setSemester} placeholder="Chọn học kỳ" emptyLabel="— Tất cả học kỳ —" className="w-full sm:w-72" /></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b bg-white text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Học kỳ</th><th className="px-5 py-3">Môn / lớp</th><th className="px-5 py-3">Lịch học trong tuần</th><th className="px-5 py-3">Khoảng thời gian</th><th className="px-5 py-3">Phòng / GV</th><th className="px-5 py-3 text-right">Thao tác</th></tr></thead><tbody className="divide-y">{sections.map((item) => <tr key={item.id} className="hover:bg-slate-50"><td className="px-5 py-4">{item.semester}</td><td className="px-5 py-4"><p className="font-semibold">{item.subjectCode} - {item.subjectName}</p><p className="text-xs text-slate-500">{item.sectionCode} · {item.credits} tín chỉ · {item.classType === 'practical' ? 'Thực hành' : 'Lý thuyết'}</p></td><td className="px-5 py-4">{days[item.dayOfWeek]} · Tiết {item.startPeriod}-{item.endPeriod}{item.secondDayOfWeek ? <><br />{days[item.secondDayOfWeek]} · Tiết {item.secondStartPeriod}-{item.secondEndPeriod}</> : null}</td><td className="px-5 py-4">{item.startDate || 'Đầu kỳ'} → {item.endDate || 'Cuối kỳ'}{item.skippedWeeks?.length ? <><p className="text-xs text-amber-600">Nghỉ tuần: {item.skippedWeeks.join(', ')}</p></> : null}</td><td className="px-5 py-4">{item.room || 'Chưa xếp phòng'}<p className="text-xs text-slate-500">{item.lecturer || 'Chưa có giảng viên'}</p></td><td className="px-5 py-4 text-right"><button type="button" onClick={() => edit(item)} className="mr-3 text-brand-600">Sửa</button><button type="button" onClick={() => remove(item.id)} className="text-rose-600">Xóa</button></td></tr>)}</tbody></table>{!sections.length ? <p className="p-10 text-center text-sm text-slate-500">Chưa có lịch học cho học kỳ này.</p> : null}</div>
    </AdminListPage>
  );
}
