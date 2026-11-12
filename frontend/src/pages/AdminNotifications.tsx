import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  createAdminNotification,
  deleteAdminNotification,
  fetchAdminNotifications,
  updateAdminNotification,
  type AdminNotification,
  type NotificationLevel,
} from '../lib/api';
import { AdminListPage } from './AdminUsers';

/**
 * Trang quản trị thông báo hệ thống.
 *
 * Admin soạn thông báo cho toàn bộ sinh viên. Thông báo đang bật sẽ hiện trong
 * lớp thông báo mỗi lần sinh viên vào trang; admin có thể ẩn hoặc xoá bất kỳ lúc nào.
 */

const LEVELS: { value: NotificationLevel; label: string; badge: string }[] = [
  { value: 'info', label: 'Thông tin', badge: 'bg-brand-500/10 text-brand-700' },
  { value: 'success', label: 'Thành công', badge: 'bg-emerald-500/10 text-emerald-700' },
  { value: 'warning', label: 'Cảnh báo', badge: 'bg-amber-500/15 text-amber-800' },
  { value: 'error', label: 'Lỗi', badge: 'bg-rose-500/10 text-rose-700' },
];

interface Draft {
  title: string;
  message: string;
  level: NotificationLevel;
  isActive: boolean;
  /** yyyy-mm-dd từ input date; rỗng = không hết hạn. */
  expiresAt: string;
}

const emptyDraft: Draft = {
  title: '',
  message: '',
  level: 'info',
  isActive: true,
  expiresAt: '',
};

function toIso(value: string): string | null {
  if (!value) return null;
  const parsed = new Date(`${value}T23:59:59`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function toDateInput(value: string | null): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${parsed.getFullYear()}-${month}-${day}`;
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function levelMeta(level: NotificationLevel) {
  return LEVELS.find((item) => item.value === level) ?? LEVELS[0];
}

function isExpired(item: AdminNotification): boolean {
  return Boolean(item.expiresAt && new Date(item.expiresAt).getTime() <= Date.now());
}

export function AdminNotificationsPage() {
  const { token } = useAuth();
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!token) return;
    try {
      setItems(await fetchAdminNotifications(token));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không tải được thông báo.');
    }
  };

  useEffect(() => {
    void load();
  }, [token]);

  const reset = () => {
    setDraft(emptyDraft);
    setEditingId(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return;
    setBusy(true);
    try {
      const payload = {
        title: draft.title.trim(),
        message: draft.message.trim(),
        level: draft.level,
        isActive: draft.isActive,
        expiresAt: toIso(draft.expiresAt),
      };
      const saved = editingId
        ? await updateAdminNotification(token, editingId, payload)
        : await createAdminNotification(token, payload);
      setItems((current) =>
        editingId
          ? current.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...current],
      );
      setMessage(editingId ? 'Đã cập nhật thông báo.' : 'Đã gửi thông báo tới sinh viên.');
      setError(null);
      reset();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không lưu được thông báo.');
      setMessage(null);
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (item: AdminNotification) => {
    if (!token) return;
    try {
      const saved = await updateAdminNotification(token, item.id, { isActive: !item.isActive });
      setItems((current) => current.map((row) => (row.id === saved.id ? saved : row)));
      setMessage(saved.isActive ? 'Thông báo đã hiện lại với sinh viên.' : 'Đã ẩn thông báo.');
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không cập nhật được thông báo.');
    }
  };

  const remove = async (item: AdminNotification) => {
    if (!token) return;
    if (!window.confirm(`Xoá thông báo "${item.title}"?`)) return;
    try {
      await deleteAdminNotification(token, item.id);
      setItems((current) => current.filter((row) => row.id !== item.id));
      setMessage('Đã xoá thông báo.');
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không xoá được thông báo.');
    }
  };

  return (
    <AdminListPage
      title="Thông báo hệ thống"
      description="Gửi thông báo tới toàn bộ sinh viên. Thông báo đang bật sẽ hiện trong lớp thông báo mỗi lần sinh viên đăng nhập (đóng bằng nút X), không hiện lại khi chuyển trang."
    >
      {error ? (
        <p role="alert" className="m-5 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="m-5 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p>
      ) : null}

      <form
        onSubmit={submit}
        className="grid gap-3 border-b border-slate-100 bg-slate-50/70 p-5 sm:grid-cols-2"
      >
        <label className="text-sm font-medium text-slate-700">
          Tiêu đề
          <input
            value={draft.title}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            maxLength={200}
            required
            placeholder="Ví dụ: Nghỉ lễ kỷ niệm 100 năm trường"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>

        <label className="text-sm font-medium text-slate-700">
          Mức độ
          <select
            value={draft.level}
            onChange={(event) =>
              setDraft({ ...draft, level: event.target.value as NotificationLevel })
            }
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
          >
            {LEVELS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium text-slate-700 sm:col-span-2">
          Nội dung
          <textarea
            value={draft.message}
            onChange={(event) => setDraft({ ...draft, message: event.target.value })}
            maxLength={5000}
            rows={4}
            required
            placeholder="Nội dung thông báo sẽ hiển thị cho sinh viên."
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>

        <label className="text-sm font-medium text-slate-700">
          Ngày hết hạn (tuỳ chọn)
          <input
            type="date"
            value={draft.expiresAt}
            onChange={(event) => setDraft({ ...draft, expiresAt: event.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>

        <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={draft.isActive}
            onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })}
          />
          Hiện ngay với sinh viên
        </label>

        <div className="flex items-center gap-2 sm:col-span-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
          >
            {editingId ? 'Lưu thay đổi' : 'Gửi thông báo'}
          </button>
          {editingId ? (
            <button
              type="button"
              onClick={reset}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
            >
              Huỷ
            </button>
          ) : null}
        </div>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b text-xs uppercase text-slate-500">
            <tr>
              <th className="px-5 py-3">Tiêu đề</th>
              <th className="px-5 py-3">Mức độ</th>
              <th className="px-5 py-3">Trạng thái</th>
              <th className="px-5 py-3">Hết hạn</th>
              <th className="px-5 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-slate-500">
                  Chưa có thông báo nào.
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const meta = levelMeta(item.level);
                const expired = isExpired(item);
                const visible = item.isActive && !expired;
                return (
                  <tr key={item.id}>
                    <td className="max-w-xs px-5 py-3">
                      <p className="font-semibold text-slate-900">{item.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{item.message}</p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        Tạo lúc {formatDate(item.createdAt)}
                      </p>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${meta.badge}`}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {visible ? (
                        <span className="text-emerald-700">Đang hiện</span>
                      ) : expired ? (
                        <span className="text-slate-500">Đã quá hạn</span>
                      ) : (
                        <span className="text-slate-500">Đã ẩn</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {item.expiresAt ? formatDate(item.expiresAt) : 'Không hết hạn'}
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(item.id);
                          setDraft({
                            title: item.title,
                            message: item.message,
                            level: item.level,
                            isActive: item.isActive,
                            expiresAt: toDateInput(item.expiresAt),
                          });
                          setError(null);
                          setMessage(null);
                        }}
                        className="mr-3 text-brand-600"
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        onClick={() => void toggleActive(item)}
                        className="mr-3 text-slate-600"
                      >
                        {item.isActive ? 'Ẩn' : 'Hiện'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void remove(item)}
                        className="text-rose-600"
                      >
                        Xoá
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </AdminListPage>
  );
}
