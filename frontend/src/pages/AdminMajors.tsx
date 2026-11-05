import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  createAdminDepartment, createAdminMajor, fetchAdminDepartments, fetchAdminMajors, updateAdminMajor,
  type AdminDepartment, type AdminMajor,
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
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    if (!token) return;
    Promise.all([fetchAdminDepartments(token), fetchAdminMajors(token)])
      .then(([departmentItems, majorItems]) => {
        setDepartments(departmentItems);
        setMajors(majorItems);
        if (!departmentId && departmentItems[0]) setDepartmentId(departmentItems[0].id);
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
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {departments.map((department) => (
            <section key={department.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between"><div><p className="font-semibold text-slate-900">{department.code}</p><p className="text-sm text-slate-600">{department.name}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">{department.majorCount} ngành</span></div>
              <div className="mt-3 space-y-2">{majors.filter((major) => major.departmentId === department.id).map((major) => <div key={major.id} className="rounded-lg bg-slate-50 px-3 py-2"><p className="text-sm font-medium text-slate-800">{major.code} - {major.name}</p><p className="text-xs text-slate-500">{major.subjectCount} môn trong chương trình</p></div>)}{!majors.some((major) => major.departmentId === department.id) ? <p className="text-sm text-slate-400">Chưa có ngành.</p> : null}</div>
            </section>
          ))}
        </div>
        {majors.some((major) => !major.departmentId) ? <section className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4"><h3 className="font-semibold text-amber-900">Ngành chưa gán khoa</h3><div className="mt-3 space-y-2">{majors.filter((major) => !major.departmentId).map((major) => <div key={major.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white px-3 py-2"><span className="text-sm font-medium text-slate-800">{major.code} - {major.name}</span><select defaultValue="" onChange={(event) => attachMajor(major, event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="">Chọn khoa để gán</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.code} - {department.name}</option>)}</select></div>)}</div></section> : null}
        {!departments.length ? <p className="mt-4 text-sm text-slate-500">Chưa có khoa nào. Hãy tạo khoa trước.</p> : null}
      </div>
    </AdminListPage>
  );
}
