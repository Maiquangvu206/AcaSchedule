import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  assignCurriculumSubject, createAdminDepartment, createAdminMajor, fetchAdminDepartments, fetchAdminMajors, fetchCurriculumSubjects, updateAdminMajor, updateAdminSubject,
  type AdminDepartment, type AdminMajor, type CurriculumSubject,
} from '../lib/api';
import { AdminListPage } from './AdminUsers';

export function AdminMajorsPage() {
  const { token } = useAuth();
  const [departments, setDepartments] = useState<AdminDepartment[]>([]);
  const [majors, setMajors] = useState<AdminMajor[]>([]);
  const [departmentId, setDepartmentId] = useState('');
  const [departmentCode, setDepartmentCode] = useState('');
  const [departmentName, setDepartmentName] = useState('');
  const [majorCode, setMajorCode] = useState('');
  const [majorName, setMajorName] = useState('');
  const [minimumCreditsDraft, setMinimumCreditsDraft] = useState<Record<string, string>>({});
  const [savingMajorId, setSavingMajorId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [curriculumByMajor, setCurriculumByMajor] = useState<Map<string, CurriculumSubject[]>>(new Map());
  const [draftBySubject, setDraftBySubject] = useState<Record<string, string>>({});
  const [weightDraft, setWeightDraft] = useState<Record<string, { process: string; final: string }>>({});
  const [calculateDraft, setCalculateDraft] = useState<Record<string, boolean>>({});
  const [savingSubjectId, setSavingSubjectId] = useState<string | null>(null);

  const load = () => {
    if (!token) return;
    Promise.all([fetchAdminDepartments(token), fetchAdminMajors(token)])
      .then(([departmentItems, majorItems]) => {
        setDepartments(departmentItems);
        setMajors(majorItems);
        if (!departmentId && departmentItems[0]) setDepartmentId(departmentItems[0].id);
        return majorItems;
      })
      .then((majorItems) => {
        if (!majorItems?.length) return;
        Promise.all(majorItems.map((major) => fetchCurriculumSubjects(token, major.id).catch(() => [])))
          .then((lists) => {
            setCurriculumByMajor(new Map(majorItems.map((major, index) => [major.id, lists[index] ?? []])));
          })
          .catch(() => undefined);
      })
      .catch(() => setError('Không tải được dữ liệu khoa/ngành.'));
  };

  useEffect(load, [token]);

  const addDepartment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || !departmentCode.trim() || !departmentName.trim()) return;
    try {
      const department = await createAdminDepartment(token, { code: departmentCode.trim(), name: departmentName.trim() });
      setDepartments((items) => [...items, department]);
      setDepartmentId(department.id);
      setDepartmentCode('');
      setDepartmentName('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể tạo khoa.');
    }
  };

  const addMajor = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || !departmentId || !majorCode.trim() || !majorName.trim()) return;
    try {
      const major = await createAdminMajor(token, { code: majorCode.trim(), name: majorName.trim(), departmentId });
      setMajors((items) => [...items.filter((item) => item.id !== major.id), major]);
      setMajorCode('');
      setMajorName('');
      setDepartments((items) => items.map((item) => item.id === departmentId ? { ...item, majorCount: item.majorCount + 1 } : item));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể tạo ngành.');
    }
  };

  const attachMajor = async (major: AdminMajor, nextDepartmentId: string) => {
    if (!token || !nextDepartmentId) return;
    try {
      await updateAdminMajor(token, major.id, { departmentId: nextDepartmentId });
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể cập nhật khoa cho ngành.');
    }
  };

  /** Lưu số tín chỉ tối thiểu của ngành (để trống = dùng tổng chương trình). */
  const saveMinimumCredits = async (major: AdminMajor) => {
    if (!token) return;
    const raw = (minimumCreditsDraft[major.id] ?? '').trim();
    if (raw !== '' && (!Number.isFinite(Number(raw)) || Number(raw) < 0)) {
      setError('Số tín chỉ tối thiểu phải là số không âm (để trống = dùng tổng chương trình).');
      return;
    }
    const value = raw === '' ? null : Math.trunc(Number(raw));
    setSavingMajorId(major.id);
    setError(null);
    try {
      const saved = await updateAdminMajor(token, major.id, { minimumCredits: value });
      setMajors((items) => items.map((item) => (item.id === major.id ? { ...item, ...saved } : item)));
      setMinimumCreditsDraft((prev) => ({ ...prev, [major.id]: value === null ? '' : String(value) }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể lưu số tín chỉ tối thiểu.');
    } finally {
      setSavingMajorId(null);
    }
  };

  const saveManagingUnit = async (major: AdminMajor, subject: CurriculumSubject) => {
    if (!token) return;
    const nextManagingUnit = (draftBySubject[subject.id] ?? subject.managingUnit ?? '').trim();
    const weight = weightDraft[subject.id];
    // PG numeric columns can arrive as strings; normalise before sending.
    const processWeight = weight ? Number(weight.process) : Number(subject.processWeight);
    const finalWeight = weight ? Number(weight.final) : Number(subject.finalWeight);
    const calculateGrade = calculateDraft[subject.id] ?? subject.calculateGrade;
    if (Math.abs(processWeight + finalWeight - 1) > 0.001) {
      setError('Tỉ lệ Process + Final phải bằng 1 (ví dụ 0.4 và 0.6).');
      return;
    }
    setSavingSubjectId(subject.id);
    setError(null);
    try {
      await updateAdminSubject(token, subject.id, {
        code: subject.code,
        name: subject.name,
        credits: subject.credits,
        knowledgeBlock: subject.knowledgeBlock,
        managingUnit: nextManagingUnit,
      });
      await assignCurriculumSubject(token, major.id, {
        subjectId: subject.id,
        isRequired: subject.isRequired,
        semesterNo: subject.semesterNo,
        calculateGrade,
        processWeight,
        finalWeight,
      });
      setCurriculumByMajor((prev) => {
        const nextMap = new Map(prev);
        for (const [majorId, list] of nextMap) {
          nextMap.set(majorId, list.map((item) => (item.id === subject.id ? { ...item, managingUnit: nextManagingUnit, processWeight, finalWeight, calculateGrade } : item)));
        }
        return nextMap;
      });
      setCalculateDraft((prev) => ({ ...prev, [subject.id]: calculateGrade }));
      setDraftBySubject((prev) => ({ ...prev, [subject.id]: nextManagingUnit }));
      setWeightDraft((prev) => ({ ...prev, [subject.id]: { process: String(processWeight), final: String(finalWeight) } }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể lưu bộ môn quản lý.');
    } finally {
      setSavingSubjectId(null);
    }
  };

  return (
    <AdminListPage title="Ngành & khoa" description="Tạo khoa, tạo ngành và sắp xếp ngành thuộc khoa. Việc gán sinh viên thực hiện tại trang Sinh viên.">
      {error ? <p role="alert" className="m-5 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
      <div className="grid gap-5 border-b border-slate-100 bg-slate-50/70 p-5 lg:grid-cols-2">
        <form onSubmit={addDepartment} className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">Tạo khoa</h2>
          <p className="mt-1 text-xs text-slate-500">Nhập thông tin khoa.</p>
          <div className="mt-3 grid gap-2"><input value={departmentCode} onChange={(e) => setDepartmentCode(e.target.value.toUpperCase())} placeholder="Mã khoa" required className="rounded-lg border border-slate-200 px-3 py-2 text-sm" /><input value={departmentName} onChange={(e) => setDepartmentName(e.target.value)} placeholder="Tên khoa" required className="rounded-lg border border-slate-200 px-3 py-2 text-sm" /></div>
          <button className="mt-3 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white">Thêm khoa</button>
        </form>
        <form onSubmit={addMajor} className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">Tạo ngành thuộc khoa</h2>
          <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} required className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="">Chọn khoa</option>{departments.map((item) => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}</select>
          <div className="mt-2 grid gap-2 sm:grid-cols-2"><input value={majorCode} onChange={(e) => setMajorCode(e.target.value.toUpperCase())} placeholder="Mã ngành" required className="rounded-lg border border-slate-200 px-3 py-2 text-sm" /><input value={majorName} onChange={(e) => setMajorName(e.target.value)} placeholder="Tên ngành" required className="rounded-lg border border-slate-200 px-3 py-2 text-sm" /></div>
          <button disabled={!departments.length} className="mt-3 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Thêm ngành</button>
        </form>
      </div>
      <div className="p-5">
        <h2 className="font-semibold text-slate-900">Cơ cấu khoa và ngành</h2>
        <p className="mt-1 text-xs text-slate-500">
          Không phải ngành nào cũng bắt học hết mọi môn trong chương trình, nên mỗi ngành có
          thể đặt số tín chỉ tối thiểu riêng. Tiến độ trên trang Tổng quan so sánh số tín
          chỉ đã đạt (chỉ tính môn tính điểm) với mốc này — vượt mốc vẫn được.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {departments.map((department) => (
            <section key={department.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between"><div><p className="font-semibold text-slate-900">{department.code}</p><p className="text-sm text-slate-600">{department.name}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">{department.majorCount} ngành</span></div>
              <div className="mt-3 space-y-2">{majors.filter((major) => major.departmentId === department.id).map((major) => (
                <div key={major.id} className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-sm font-medium text-slate-800">{major.code} - {major.name}</p>
                  <p className="text-xs text-slate-500">{major.subjectCount} môn trong chương trình</p>
                  <div className="mt-2 flex items-center gap-2">
                    <label className="text-xs text-slate-600" htmlFor={`min-credits-${major.id}`}>
                      Tín chỉ tối thiểu
                    </label>
                    <input
                      id={`min-credits-${major.id}`}
                      type="number"
                      min="0"
                      value={minimumCreditsDraft[major.id] ?? (major.minimumCredits === null ? '' : String(major.minimumCredits))}
                      onChange={(event) => setMinimumCreditsDraft((prev) => ({ ...prev, [major.id]: event.target.value }))}
                      placeholder={String(major.programCredits)}
                      className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm"
                    />
                    <span className="text-[11px] text-slate-500">
                      {major.programCredits} TC trong chương trình
                    </span>
                    <button
                      type="button"
                      onClick={() => void saveMinimumCredits(major)}
                      disabled={savingMajorId === major.id}
                      className="ml-auto rounded-lg bg-brand-500 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {savingMajorId === major.id ? 'Đang lưu…' : 'Lưu'}
                    </button>
                  </div>
                </div>
              ))}{!majors.some((major) => major.departmentId === department.id) ? <p className="text-sm text-slate-400">Chưa có ngành.</p> : null}</div>
            </section>
          ))}
        </div>
        {majors.some((major) => !major.departmentId) ? <section className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4"><h3 className="font-semibold text-amber-900">Ngành chưa gán khoa</h3><div className="mt-3 space-y-2">{majors.filter((major) => !major.departmentId).map((major) => <div key={major.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white px-3 py-2"><span className="text-sm font-medium text-slate-800">{major.code} - {major.name}</span><div className="flex items-center gap-2"><label className="text-xs text-slate-600">Tín chỉ tối thiểu</label><input type="number" min="0" value={minimumCreditsDraft[major.id] ?? (major.minimumCredits === null ? '' : String(major.minimumCredits))} onChange={(event) => setMinimumCreditsDraft((prev) => ({ ...prev, [major.id]: event.target.value }))} placeholder={String(major.programCredits)} className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm" /><button type="button" onClick={() => void saveMinimumCredits(major)} disabled={savingMajorId === major.id} className="rounded-lg bg-brand-500 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50">{savingMajorId === major.id ? 'Đang lưu…' : 'Lưu'}</button><select defaultValue="" onChange={(event) => attachMajor(major, event.target.value)} className="rounded-lg border border-slate-200 px-3 py-1 text-sm"><option value="">Chọn khoa để gán</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.code} - {department.name}</option>)}</select></div></div>)}</div></section> : null}
        {!departments.length ? <p className="mt-4 text-sm text-slate-500">Chưa có khoa nào. Hãy tạo khoa trước.</p> : null}
      </div>
      <div className="border-t border-slate-100 p-5">
        <h2 className="font-semibold text-slate-900">Bộ môn quản lý theo ngành</h2>
        <p className="mt-1 text-xs text-slate-500">
          Thiết lập bộ môn phụ trách từng môn học trong chương trình đào tạo.
          Nội dung này hiển thị trên trang Chương trình đào tạo và Lộ trình học của sinh viên.
        </p>
        <div className="mt-4 space-y-4">
          {majors.map((major) => {
            const subjects = curriculumByMajor.get(major.id) ?? [];
            return (
              <section key={major.id} className="overflow-x-auto rounded-xl border border-slate-200">
                <header className="border-b bg-slate-50/70 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">{major.code} - {major.name}</p>
                  <p className="text-xs text-slate-500">{subjects.length} môn trong chương trình</p>
                </header>
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b bg-white text-xs uppercase text-slate-500">
                    <tr><th className="px-4 py-2">Mã môn</th><th className="px-4 py-2">Tên môn</th><th className="px-4 py-2">Học kỳ</th><th className="px-4 py-2">Bộ môn quản lý</th><th className="px-4 py-2">Tính điểm</th><th className="px-4 py-2">Tỉ lệ Process</th><th className="px-4 py-2">Tỉ lệ Final</th><th className="px-4 py-2 text-right">Thao tác</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {subjects.map((subject) => (
                      <tr key={subject.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2 font-semibold">{subject.code}</td>
                        <td className="px-4 py-2">{subject.name}</td>
                        <td className="px-4 py-2 text-slate-600">{subject.semesterNo ? `Học kỳ ${subject.semesterNo}` : 'Chưa xếp kỳ'}</td>
                        <td className="px-4 py-2">
                          <input
                            value={draftBySubject[subject.id] ?? subject.managingUnit ?? ''}
                            onChange={(event) => setDraftBySubject((prev) => ({ ...prev, [subject.id]: event.target.value }))}
                            placeholder="Tên bộ môn"
                            className="w-full min-w-[180px] rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <label className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={calculateDraft[subject.id] ?? subject.calculateGrade}
                              onChange={(event) => setCalculateDraft((prev) => ({ ...prev, [subject.id]: event.target.checked }))}
                              className="h-4 w-4 rounded border-slate-300"
                            />
                            <span className={(calculateDraft[subject.id] ?? subject.calculateGrade) ? 'text-slate-600' : 'text-rose-600'}>
                              {(calculateDraft[subject.id] ?? subject.calculateGrade) ? 'Tính điểm' : 'Chỉ học phí'}
                            </span>
                          </label>
                        </td>
                        <td className="px-4 py-2">
                          <input
                            value={weightDraft[subject.id]?.process ?? String(subject.processWeight)}
                            onChange={(event) => setWeightDraft((prev) => ({
                              ...prev,
                              [subject.id]: {
                                process: event.target.value,
                                final: prev[subject.id]?.final ?? String(subject.finalWeight),
                              },
                            }))}
                            type="number"
                            min="0"
                            max="1"
                            step="0.05"
                            className="w-full min-w-[90px] rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            value={weightDraft[subject.id]?.final ?? String(subject.finalWeight)}
                            onChange={(event) => setWeightDraft((prev) => ({
                              ...prev,
                              [subject.id]: {
                                process: prev[subject.id]?.process ?? String(subject.processWeight),
                                final: event.target.value,
                              },
                            }))}
                            type="number"
                            min="0"
                            max="1"
                            step="0.05"
                            className="w-full min-w-[90px] rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => void saveManagingUnit(major, subject)}
                            disabled={savingSubjectId === subject.id}
                            className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            {savingSubjectId === subject.id ? 'Đang lưu…' : 'Lưu'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!subjects.length ? <p className="px-4 py-6 text-center text-sm text-slate-500">Ngành này chưa có môn trong chương trình. Hãy gán môn ở tab Môn học.</p> : null}
              </section>
            );
          })}
          {!majors.length ? <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">Chưa có ngành nào.</p> : null}
        </div>
      </div>
    </AdminListPage>
  );
}
