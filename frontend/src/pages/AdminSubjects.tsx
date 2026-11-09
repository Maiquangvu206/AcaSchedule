import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  assignCurriculumSubject, createAdminSubject, fetchAdminMajors, fetchAdminSubjects,
  fetchCurriculumSubjects, removeCurriculumSubject, type AdminMajor, type AdminSubject, type CurriculumSubject,
  updateAdminSubject,
} from '../lib/api';
import { AdminListPage } from './AdminUsers';

export function AdminSubjectsPage() {
  const { token } = useAuth();
  const [majors, setMajors] = useState<AdminMajor[]>([]);
  const [subjects, setSubjects] = useState<AdminSubject[]>([]);
  const [assigned, setAssigned] = useState<CurriculumSubject[]>([]);
  const [selectedMajor, setSelectedMajor] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [semesterNo, setSemesterNo] = useState('');
  const [isRequired, setIsRequired] = useState(true);
  const [subjectCode, setSubjectCode] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [subjectCredits, setSubjectCredits] = useState('');
  const [knowledgeBlock, setKnowledgeBlock] = useState('');
  const [managingUnit, setManagingUnit] = useState('');
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetchAdminSubjects(token).then(setSubjects).catch(() => setError('Không tải được danh sách môn học.'));
    fetchAdminMajors(token).then((items) => {
      setMajors(items);
      if (items[0]) setSelectedMajor(items[0].id);
    }).catch(() => setError('Không tải được danh sách ngành.'));
  }, [token]);

  useEffect(() => {
    if (token && selectedMajor) fetchCurriculumSubjects(token, selectedMajor).then(setAssigned)
      .catch(() => setError('Không tải được chương trình đào tạo.'));
  }, [token, selectedMajor]);

  const assignSubject = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || !selectedMajor || !subjectId) return;
    try {
      await assignCurriculumSubject(token, selectedMajor, { subjectId, isRequired, semesterNo: semesterNo ? Number(semesterNo) : null });
      setAssigned(await fetchCurriculumSubjects(token, selectedMajor));
      setSubjectId('');
      setSemesterNo('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể gán môn vào chương trình.');
    }
  };

  const saveSubject = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || !subjectCode.trim() || !subjectName.trim() || !subjectCredits) return;
    try {
      const input = { code: subjectCode.trim(), name: subjectName.trim(), credits: Number(subjectCredits), knowledgeBlock: knowledgeBlock.trim() || 'Chung', managingUnit: managingUnit.trim() };
      const subject = editingSubjectId ? await updateAdminSubject(token, editingSubjectId, input) : await createAdminSubject(token, input);
      setSubjects((items) => editingSubjectId ? items.map((item) => item.id === subject.id ? subject : item) : [...items, subject].sort((a, b) => a.code.localeCompare(b.code)));
      setSubjectCode('');
      setSubjectName('');
      setSubjectCredits('');
      setKnowledgeBlock('');
      setManagingUnit('');
      setEditingSubjectId(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể lưu môn học.');
    }
  };

  const removeSubject = async (id: string) => {
    if (!token || !selectedMajor) return;
    await removeCurriculumSubject(token, selectedMajor, id);
    setAssigned(await fetchCurriculumSubjects(token, selectedMajor));
  };

  return (
    <AdminListPage title="Chương trình đào tạo" description="Cấu hình các môn học theo từng ngành. Quản lý ngành và phân sinh viên được thực hiện ở tab Ngành & khoa.">
      {error ? <p role="alert" className="m-5 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
      <form onSubmit={saveSubject} className="border-b border-slate-100 bg-slate-50/70 p-5">
        <h2 className="font-semibold text-slate-900">{editingSubjectId ? 'Chỉnh sửa môn học' : 'Cấu hình môn học'}</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-[0.8fr_1.5fr_0.5fr_1fr_1.2fr_auto] md:items-end">
          <label className="text-sm font-medium text-slate-700">Mã môn<input value={subjectCode} onChange={(e) => setSubjectCode(e.target.value.toUpperCase())} placeholder="INT2208" required className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
          <label className="text-sm font-medium text-slate-700">Tên môn<input value={subjectName} onChange={(e) => setSubjectName(e.target.value)} placeholder="Tên môn học" required className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
          <label className="text-sm font-medium text-slate-700">Tín chỉ<input type="number" value={subjectCredits} onChange={(e) => setSubjectCredits(e.target.value)} min="1" max="30" required className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
          <label className="text-sm font-medium text-slate-700">Khối kiến thức<input value={knowledgeBlock} onChange={(e) => setKnowledgeBlock(e.target.value)} placeholder="Cơ sở ngành" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
          <label className="text-sm font-medium text-slate-700">Bộ môn quản lý<input value={managingUnit} onChange={(e) => setManagingUnit(e.target.value)} placeholder="Tin học và Kỹ thuật tính toán" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
          <button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white">{editingSubjectId ? 'Lưu thay đổi' : 'Thêm môn'}</button>
        </div>
      </form>
      <div className="border-b border-slate-100 px-5 py-4">
        <label className="text-sm font-medium text-slate-700">Chương trình của ngành</label>
        <select value={selectedMajor} onChange={(e) => setSelectedMajor(e.target.value)} className="ml-3 rounded-lg border border-slate-200 px-3 py-2 text-sm">{majors.map((major) => <option key={major.id} value={major.id}>{major.code} - {major.name} ({major.subjectCount} môn)</option>)}</select>
      </div>
      <form onSubmit={assignSubject} className="grid gap-3 border-b border-slate-100 bg-slate-50/70 p-5 md:grid-cols-[1.5fr_0.7fr_0.8fr_auto] md:items-end">
        <label className="text-sm font-medium text-slate-700">Môn học<select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} required className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="">Chọn môn học</option>{subjects.map((item) => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}</select></label>
        <label className="text-sm font-medium text-slate-700">Học kỳ<input type="number" min="1" max="20" value={semesterNo} onChange={(e) => setSemesterNo(e.target.value)} placeholder="1" className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /></label>
        <label className="flex items-center gap-2 pb-2 text-sm text-slate-600"><input type="checkbox" checked={isRequired} onChange={(e) => setIsRequired(e.target.checked)} /> Bắt buộc</label>
        <button disabled={!selectedMajor} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Lưu cấu hình</button>
      </form>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b bg-white text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Mã môn</th><th className="px-5 py-3">Tên môn</th><th className="px-5 py-3">Tín chỉ</th><th className="px-5 py-3">Học kỳ</th><th className="px-5 py-3">Loại môn</th><th className="px-5 py-3">Bộ môn quản lý</th><th className="px-5 py-3 text-right">Thao tác</th></tr></thead><tbody className="divide-y">{assigned.map((item) => <tr key={item.id} className="hover:bg-slate-50"><td className="px-5 py-4 font-semibold">{item.code}</td><td className="px-5 py-4">{item.name}</td><td className="px-5 py-4">{item.credits}</td><td className="px-5 py-4">{item.semesterNo ? `Học kỳ ${item.semesterNo}` : 'Chưa xếp kỳ'}</td><td className="px-5 py-4">{item.isRequired ? 'Bắt buộc' : 'Tự chọn'}</td><td className="px-5 py-4 text-slate-600">{item.managingUnit || '—'}</td><td className="px-5 py-4 text-right"><button type="button" onClick={() => { setEditingSubjectId(item.id); setSubjectCode(item.code); setSubjectName(item.name); setSubjectCredits(String(item.credits)); setKnowledgeBlock(item.knowledgeBlock); setManagingUnit(item.managingUnit); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="mr-3 text-brand-600">Sửa môn</button><button type="button" onClick={() => removeSubject(item.id)} className="text-rose-600">Bỏ môn</button></td></tr>)}</tbody></table>{!assigned.length ? <p className="p-10 text-center text-sm text-slate-500">Chưa có môn trong chương trình này.</p> : null}</div>
    </AdminListPage>
  );
}
