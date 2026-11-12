import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Thông báo hệ thống — quy tắc hiển thị.
 *
 * Sinh viên chỉ thấy thông báo còn bật và chưa quá hạn; admin ẩn thì thông báo
 * biến mất khỏi giao diện nhưng vẫn còn trong danh sách quản trị.
 */

const state = {
  notifications: [] as {
    id: string;
    title: string;
    message: string;
    level: string;
    is_active: boolean;
    expires_at: Date | null;
    created_at: Date;
    updated_at: Date;
    created_by_email: string | null;
  }[],
};

let statements: string[] = [];
let idCounter = 0;

const pool = {
  query: vi.fn(async (sql: string, params: unknown[] = []) => {
    const s = sql.replace(/\s+/g, ' ').trim();
    statements.push(s);

    const visible = state.notifications.filter(
      (n) => n.is_active && (!n.expires_at || n.expires_at.getTime() > Date.now()),
    );

    if (s.includes('FROM system_notifications n') && s.includes('n.is_active = true')) {
      return { rows: visible };
    }
    if (s.includes('FROM system_notifications n')) {
      return { rows: state.notifications };
    }
    if (s.includes('INSERT INTO system_notifications')) {
      const row = {
        id: `notif-${++idCounter}`,
        title: String(params[0]),
        message: String(params[1]),
        level: String(params[2]),
        is_active: Boolean(params[3]),
        expires_at: (params[4] as Date | null) ?? null,
        created_at: new Date(),
        updated_at: new Date(),
        created_by_email: 'admin@acaschedule.local',
      };
      state.notifications.push(row);
      return { rows: [row] };
    }
    if (s.includes('UPDATE system_notifications')) {
      const row = state.notifications.find((n) => n.id === params[0]);
      if (row) {
        if (params[1] !== null) row.title = String(params[1]);
        if (params[2] !== null) row.message = String(params[2]);
        if (params[3] !== null) row.level = String(params[3]);
        if (params[4] !== null) row.is_active = Boolean(params[4]);
        if (params[5] === true) row.expires_at = (params[6] as Date | null) ?? null;
        row.updated_at = new Date();
      }
      return { rows: row ? [row] : [] };
    }
    if (s.startsWith('DELETE FROM system_notifications')) {
      const index = state.notifications.findIndex((n) => n.id === params[0]);
      if (index >= 0) {
        state.notifications.splice(index, 1);
        return { rowCount: 1 };
      }
      return { rowCount: 0 };
    }
    return { rows: [] };
  }),
};

vi.mock('../src/database/pool', () => ({ pool }));

const { createNotification, deleteNotification, listAllNotifications, listVisibleNotifications, updateNotification } =
  await import('../src/modules/notifications/notifications.repository');

const HOUR = 60 * 60 * 1000;

beforeEach(() => {
  statements = [];
  idCounter = 0;
  pool.query.mockClear();
  state.notifications.length = 0;
});

describe('thông báo hệ thống', () => {
  it('sinh viên không thấy thông báo đã bị admin ẩn', async () => {
    const created = await createNotification(
      { title: 'A', message: 'B', level: 'info', isActive: true, expiresAt: null },
      'admin-1',
    );
    expect((await listVisibleNotifications()).map((n) => n.id)).toEqual([created.id]);

    await updateNotification(created.id, { isActive: false });

    expect(await listVisibleNotifications()).toEqual([]);
    // Danh sách quản trị vẫn thấy để admin bật lại được.
    expect((await listAllNotifications()).map((n) => n.id)).toEqual([created.id]);
  });

  it('thông báo quá hạn không hiện nhưng vẫn còn trong danh sách quản trị', async () => {
    const created = await createNotification(
      {
        title: 'A',
        message: 'B',
        level: 'info',
        isActive: true,
        expiresAt: new Date(Date.now() - HOUR),
      },
      'admin-1',
    );

    expect(await listVisibleNotifications()).toEqual([]);
    expect((await listAllNotifications()).map((n) => n.id)).toEqual([created.id]);
  });

  it('bỏ hạn dùng thì thông báo hiện lại', async () => {
    const created = await createNotification(
      {
        title: 'A',
        message: 'B',
        level: 'info',
        isActive: true,
        expiresAt: new Date(Date.now() - HOUR),
      },
      'admin-1',
    );
    expect(await listVisibleNotifications()).toEqual([]);

    const updated = await updateNotification(created.id, { expiresAt: null });

    expect(updated?.expiresAt).toBeNull();
    expect((await listVisibleNotifications()).map((n) => n.id)).toEqual([created.id]);
  });

  it('không đổi hạn dùng thì giữ nguyên hạn dùng cũ', async () => {
    const expires = new Date(Date.now() + HOUR);
    const created = await createNotification(
      { title: 'A', message: 'B', level: 'info', isActive: true, expiresAt: expires },
      'admin-1',
    );

    // Không truyền `expiresAt` → không được đụng vào giá trị đã lưu.
    const updated = await updateNotification(created.id, { title: 'C' });

    expect(updated?.expiresAt).toBe(expires.toISOString());
    expect(updated?.title).toBe('C');
  });

  it('danh sách cho người dùng không lộ email người tạo', async () => {
    await createNotification(
      { title: 'A', message: 'B', level: 'info', isActive: true, expiresAt: null },
      'admin-1',
    );

    const [visible] = await listVisibleNotifications();
    expect(visible).not.toHaveProperty('createdByEmail');

    const [adminView] = await listAllNotifications();
    expect(adminView.createdByEmail).toBe('admin@acaschedule.local');
  });

  it('xoá thông báo không tồn tại trả về false', async () => {
    expect(await deleteNotification('khong-ton-tai')).toBe(false);
  });
});
