import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Combobox } from '../components/Combobox';
import {
  fetchAdminDocuments,
  fetchAdminSubjects,
  type AdminSubject,
  type DocumentItem,
} from '../lib/api';
import { AdminListPage } from './AdminUsers';

export function AdminDocumentsPage() {
  const { token } = useAuth();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [subjects, setSubjects] = useState<AdminSubject[]>([]);
  const [search, setSearch] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [sort, setSort] = useState<'rank' | 'newest'>('newest');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Danh sách môn để lọc (dùng chung endpoint quản trị).
  useEffect(() => {
    if (!token) return;
    fetchAdminSubjects(token).then(setSubjects).catch(() => setSubjects([]));
  }, [token]);

  // Gõ xong 300ms mới gọi API để không dội request mỗi ký tự.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      fetchAdminDocuments(token, {
        q: search.trim() || undefined,
        subjectId: subjectId || undefined,
        sort,
      })
        .then((items) => {
          if (!cancelled) setDocuments(items);
        })
        .catch(() => {
          if (!cancelled) setError('Không tải được danh sách tài liệu.');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, search ? 300 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [token, search, subjectId, sort]);

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

  return (
    <AdminListPage
      title="Quản lý tài liệu"
      description="Theo dõi thống kê và quản lý tài liệu cộng đồng."
    >
      <div className="flex flex-wrap items-end gap-3 border-b border-slate-100 bg-slate-50/70 p-5">
        <label className="text-sm font-medium text-slate-700">
          Tìm kiếm
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tên tài liệu, tên người đăng, môn học…"
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm sm:w-72"
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Môn học
          <Combobox
            options={subjectOptions}
            value={subjectId}
            onChange={setSubjectId}
            placeholder="Tất cả môn học"
            emptyLabel="— Tất cả môn học —"
            className="mt-1 w-full sm:w-64"
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Sắp xếp
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as 'rank' | 'newest')}
            className="mt-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="newest">Mới nhất</option>
            <option value="rank">Điểm đánh giá</option>
          </select>
        </label>
        <p className="pb-2 text-xs text-slate-500">
          {loading ? 'Đang tải…' : `${documents.length} tài liệu`}
        </p>
        {search || subjectId ? (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setSubjectId('');
            }}
            className="mb-0.5 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:bg-white"
          >
            Xoá lọc
          </button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="m-5 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b bg-gray-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Tài liệu</th>
              <th className="px-4 py-3">Môn học</th>
              <th className="px-4 py-3">Điểm đánh giá</th>
              <th className="px-4 py-3">Người tải</th>
              <th className="px-4 py-3">Ngày đăng</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {documents.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{item.title}</p>
                  {item.originalName ? (
                    <p className="text-xs text-slate-500">{item.originalName}</p>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <p className="text-slate-700">{item.subjectCode}</p>
                  <p className="text-xs text-slate-500">{item.subjectName}</p>
                </td>
                <td className="px-4 py-3">{item.score}</td>
                <td className="px-4 py-3">{item.uploaderName}</td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {new Date(item.createdAt).toLocaleDateString('vi-VN')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!documents.length && !loading ? (
          <p className="p-8 text-center text-sm text-slate-500">
            {search || subjectId
              ? 'Không có tài liệu nào khớp bộ lọc.'
              : 'Chưa có tài liệu.'}
          </p>
        ) : null}
      </div>
    </AdminListPage>
  );
}
