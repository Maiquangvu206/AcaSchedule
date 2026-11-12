import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Combobox } from '../components/Combobox';
import {
  deleteAdminDocument,
  fetchAdminDocuments,
  fetchAdminSubjects,
  updateAdminDocument,
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
  const [notice, setNotice] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

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
          if (!cancelled) {
            setDocuments(items);
            setError(null);
          }
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
  }, [token, search, subjectId, sort, version]);

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

  const runAction = async (id: string, action: () => Promise<void>, success: string) => {
    if (!token) return;
    setActingId(id);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(success);
      setVersion((v) => v + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Thao tác thất bại.');
    } finally {
      setActingId(null);
    }
  };

  const toggleHidden = (item: DocumentItem) =>
    runAction(
      item.id,
      () => updateAdminDocument(token!, item.id, { isHidden: !item.isHidden }).then(() => undefined),
      item.isHidden ? 'Đã hiện lại tài liệu.' : 'Đã ẩn tài liệu khỏi sinh viên.',
    );

  const toggleLocked = (item: DocumentItem) =>
    runAction(
      item.id,
      () => updateAdminDocument(token!, item.id, { isLocked: !item.isLocked }).then(() => undefined),
      item.isLocked ? 'Đã mở khóa tài liệu.' : 'Đã khóa tài liệu (sinh viên không thể xem/tải/bình chọn).',
    );

  const remove = (item: DocumentItem) => {
    if (!token) return;
    if (!window.confirm(`Xóa hẳn tài liệu "${item.title}"? Hành động này không thể hoàn tác.`)) return;
    void runAction(
      item.id,
      () => deleteAdminDocument(token, item.id),
      'Đã xóa tài liệu.',
    );
  };

  return (
    <AdminListPage
      title="Quản lý tài liệu"
      description="Theo dõi, ẩn/khóa hoặc xóa tài liệu cộng đồng (sinh viên chỉ thấy tài liệu đang hiển thị và chưa bị khóa khi xem/tải)."
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
      {notice ? (
        <p className="m-5 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="border-b bg-gray-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Tài liệu</th>
              <th className="px-4 py-3">Môn học</th>
              <th className="px-4 py-3">Điểm</th>
              <th className="px-4 py-3">Người tải</th>
              <th className="px-4 py-3">Ngày đăng</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {documents.map((item) => {
              const busy = actingId === item.id;
              return (
                <tr key={item.id} className={`hover:bg-slate-50 ${item.isHidden ? 'bg-slate-50/70 text-slate-500' : ''}`}>
                  <td className="px-4 py-3">
                    <p className={`font-medium ${item.isHidden ? 'text-slate-600' : 'text-slate-900'}`}>{item.title}</p>
                    {item.originalName ? (
                      <p className="text-xs text-slate-500">{item.originalName}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-slate-700">{item.subjectCode}</p>
                    <p className="text-xs text-slate-500">{item.subjectName}</p>
                  </td>
                  <td className="px-4 py-3">{item.score.toFixed(2)}</td>
                  <td className="px-4 py-3">{item.uploaderName}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {new Date(item.createdAt).toLocaleDateString('vi-VN')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {item.isHidden ? (
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700">Đã ẩn</span>
                      ) : (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Hiển thị</span>
                      )}
                      {item.isLocked ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Đã khóa</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void toggleHidden(item)}
                        className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        {item.isHidden ? 'Hiện' : 'Ẩn'}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void toggleLocked(item)}
                        className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                      >
                        {item.isLocked ? 'Mở khóa' : 'Khóa'}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => remove(item)}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                      >
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
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
