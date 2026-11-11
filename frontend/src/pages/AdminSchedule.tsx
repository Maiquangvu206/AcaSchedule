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
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return;
    try {
      const saved = editingId
        ? await updateAdminScheduleSection(token, editingId, form)
        : await createAdminScheduleSection(token, form);
      setSections((items) => editingId ? items.map((item) => item.id === saved.id ? saved : item) : [saved, ...items]);
      if (!editingId && hasPractical) {
        await createAdminScheduleSection(token, {
          ...form,
          classType: 'practical',
          meetingCount: 1,
          sectionCode: `${form.sectionCode}-TH`,
          dayOfWeek: practicalDay,
          startPeriod: practicalStart,
          endPeriod: practicalEnd,
          secondDayOfWeek: null,
          secondStartPeriod: null,
          secondEndPeriod: null,
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
      <form onSubmit={submit} className="grid gap-3 border-b border-slate-100 bg-slate-50/70 p-5 md:grid-cols-4">
        <label className="text-sm font-medium text-slate-700">Học kỳ<Combobox options={semesterOptions} value={form.semester} onChange={(value) => { setField('semester', value); setSemester(value); }} placeholder="Chọn học kỳ" emptyLabel="— Chọn học kỳ —" className="mt-1" /></label>
        <label className="text-sm font-medium text-slate-700">Môn học<Combobox options={subjectOptions} value={form.subjectId} onChange={(value) => setField('subjectId', value)} placeholder="Nhập mã hoặc tên môn…" emptyLabel="— Chọn môn học —" className="mt-1" /></label>
        <label className="text-sm font-medium text-slate-700">Mã lớp<input value={form.sectionCode} onChange={(e) => setField('sectionCode', e.target.value)} placeholder="INT2208-01" required className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /></label>
        <label className="text-sm font-medium text-slate-700">Số buổi / tuần<select value={form.meetingCount} onChange={(e) => { const count = Number(e.target.value); setField('meetingCount', count); if (count === 2) setField('secondDayOfWeek', pairedDay[form.dayOfWeek] ?? 5); }} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value={1}>1 buổi</option><option value={2}>2 buổi</option></select></label>
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
        {hasPractical ? <><label className="text-sm font-medium text-slate-700">Thứ thực hành<select value={practicalDay} onChange={(e) => setPracticalDay(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">{[2, 3, 4, 5, 6, 7].map((day) => <option key={day} value={day}>{days[day]}</option>)}</select></label><label className="text-sm font-medium text-slate-700">Tiết bắt đầu thực hành<input type="number" min="1" max="12" value={practicalStart} onChange={(e) => setPracticalStart(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /></label><label className="text-sm font-medium text-slate-700">Tiết kết thúc thực hành<input type="number" min="1" max="12" value={practicalEnd} onChange={(e) => setPracticalEnd(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /></label></> : null}
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-600"><input type="checkbox" checked={form.isCancelled} onChange={(e) => setField('isCancelled', e.target.checked)} /> Tạm ngừng</label>
        <div className="flex items-end gap-2"><button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white">{editingId ? 'Lưu thay đổi' : 'Thêm lịch học'}</button>{editingId ? <button type="button" onClick={reset} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">Hủy</button> : null}</div>
      </form>
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center"><label className="text-sm font-medium text-slate-700">Lọc theo học kỳ</label><Combobox options={semesterOptions} value={semester} onChange={setSemester} placeholder="Chọn học kỳ" emptyLabel="— Tất cả học kỳ —" className="w-72" /></div>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b bg-white text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Học kỳ</th><th className="px-5 py-3">Môn / lớp</th><th className="px-5 py-3">Lịch học trong tuần</th><th className="px-5 py-3">Khoảng thời gian</th><th className="px-5 py-3">Phòng / GV</th><th className="px-5 py-3 text-right">Thao tác</th></tr></thead><tbody className="divide-y">{sections.map((item) => <tr key={item.id} className="hover:bg-slate-50"><td className="px-5 py-4">{item.semester}</td><td className="px-5 py-4"><p className="font-semibold">{item.subjectCode} - {item.subjectName}</p><p className="text-xs text-slate-500">{item.sectionCode} · {item.credits} tín chỉ · {item.classType === 'practical' ? 'Thực hành' : 'Lý thuyết'}</p></td><td className="px-5 py-4">{days[item.dayOfWeek]} · Tiết {item.startPeriod}-{item.endPeriod}{item.secondDayOfWeek ? <><br />{days[item.secondDayOfWeek]} · Tiết {item.secondStartPeriod}-{item.secondEndPeriod}</> : null}</td><td className="px-5 py-4">{item.startDate || 'Đầu kỳ'} → {item.endDate || 'Cuối kỳ'}</td><td className="px-5 py-4">{item.room || 'Chưa xếp phòng'}<p className="text-xs text-slate-500">{item.lecturer || 'Chưa có giảng viên'}</p></td><td className="px-5 py-4 text-right"><button type="button" onClick={() => edit(item)} className="mr-3 text-brand-600">Sửa</button><button type="button" onClick={() => remove(item.id)} className="text-rose-600">Xóa</button></td></tr>)}</tbody></table>{!sections.length ? <p className="p-10 text-center text-sm text-slate-500">Chưa có lịch học cho học kỳ này.</p> : null}</div>
    </AdminListPage>
  );
}
