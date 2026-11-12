import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { fetchNotifications, type NotificationLevel, type SystemNotification } from '../lib/api';

/**
 * Lớp thông báo hệ thống cho người dùng.
 *
 * - Lấy thông báo **một lần cho mỗi phiên đăng nhập** (theo token), rồi giữ
 *   nguyên trong suốt phiên: đổi trang / chuyển tab không hiện lại.
 * - Thông báo hiện **một cái một**: đóng cái hiện tại thì cái kế tiếp hiện tiếp.
 * - Nút **X** (hoặc phím Esc) để thoát thông báo; đăng nhập lại (hoặc refresh
 *   trang) thì hiện lại từ đầu.
 */

interface LevelStyle {
  badge: string;
  accent: string;
  icon: string;
}

const LEVEL_STYLES: Record<NotificationLevel, LevelStyle> = {
  info: {
    badge: 'bg-brand-500/10 text-brand-700',
    accent: 'text-brand-600',
    icon: 'ℹ',
  },
  success: {
    badge: 'bg-emerald-500/10 text-emerald-700',
    accent: 'text-emerald-600',
    icon: '✓',
  },
  warning: {
    badge: 'bg-amber-500/15 text-amber-800',
    accent: 'text-amber-600',
    icon: '!',
  },
  error: {
    badge: 'bg-rose-500/10 text-rose-700',
    accent: 'text-rose-600',
    icon: '×',
  },
};

export function NotificationLayer() {
  const { token } = useAuth();
  const [items, setItems] = useState<SystemNotification[]>([]);

  // Chỉ lấy thông báo một lần cho mỗi phiên đăng nhập (khi token đổi);
  // đổi trang / chuyển tab không lấy lại nên lớp thông báo không hiện lại.
  useEffect(() => {
    if (!token) {
      setItems([]);
      return;
    }
    // Đánh dấu "đã hiện trong phiên này" theo token: tải lại trang hoặc mở
    // tab mới trong cùng phiên cũng không hiện lại; đăng nhập lại (token
    // mới) thì thông báo hiện một lần nữa.
    const SEEN_KEY = 'acaschedule.notifications.seen';
    let seen: string | null = null;
    try {
      seen = window.sessionStorage.getItem(SEEN_KEY);
    } catch {
      seen = null;
    }
    if (seen === token) return;

    let cancelled = false;
    fetchNotifications(token)
      .then((list) => {
        if (cancelled) return;
        setItems(list);
        try {
          window.sessionStorage.setItem(SEEN_KEY, token);
        } catch {
          // Không lưu được thì thông báo sẽ hiện lại ở lần truy cập sau — chấp nhận được.
        }
      })
      .catch(() => {
        // Lỗi mạng không được chặn người dùng dùng hệ thống.
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const dismiss = useCallback(() => {
    setItems((current) => current.slice(1));
  }, []);

  const current = items[0];
  if (!current) return null;

  const style = LEVEL_STYLES[current.level] ?? LEVEL_STYLES.info;
  const remaining = items.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-[2px] sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="notification-layer-title"
      onClick={dismiss}
      onKeyDown={(event) => {
        if (event.key === 'Escape') dismiss();
      }}
    >
      <div
        className="my-auto w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-slate-100 p-4 sm:p-5">
          <span
            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base font-bold ${style.badge}`}
            aria-hidden="true"
          >
            {style.icon}
          </span>

          <div className="min-w-0 flex-1">
            <h2 id="notification-layer-title" className="text-base font-semibold text-slate-900">
              {current.title}
            </h2>
            {remaining > 1 ? (
              <p className="mt-0.5 text-xs text-slate-500">
                Thông báo {1} / {remaining}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={dismiss}
            aria-label="Đóng thông báo"
            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-4 text-sm leading-6 text-slate-700 sm:p-5">
          <p className="whitespace-pre-wrap break-words">{current.message}</p>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 sm:px-5">
          <p className={`text-xs ${style.accent}`}>
            {remaining > 1 ? `Còn ${remaining - 1} thông báo` : 'Thông báo từ hệ thống'}
          </p>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600"
          >
            Đã hiểu
          </button>
        </div>
      </div>
    </div>
  );
}
