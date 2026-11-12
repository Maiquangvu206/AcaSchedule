import { pool } from '../../database/pool';

/** Mức độ hiển thị của thông báo. */
export type NotificationLevel = 'info' | 'success' | 'warning' | 'error';

export const NOTIFICATION_LEVELS: NotificationLevel[] = ['info', 'success', 'warning', 'error'];

export interface SystemNotification {
  id: string;
  title: string;
  message: string;
  level: NotificationLevel;
  isActive: boolean;
  /** ISO string; null = không hết hạn. */
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Bản đầy đủ cho trang quản trị (có thêm email người tạo). */
export interface AdminNotification extends SystemNotification {
  /** Email người tạo (admin) — null nếu tài khoản đã bị xoá. */
  createdByEmail: string | null;
}

interface NotificationRow {
  id: string;
  title: string;
  message: string;
  level: NotificationLevel;
  is_active: boolean;
  expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
  created_by_email: string | null;
}

const SELECT = `
  SELECT n.id, n.title, n.message, n.level, n.is_active, n.expires_at,
         n.created_at, n.updated_at, u.email AS created_by_email
    FROM system_notifications n
    LEFT JOIN users u ON u.id = n.created_by
`;

function toNotification(row: NotificationRow): SystemNotification {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    level: row.level,
    isActive: row.is_active,
    expiresAt: row.expires_at ? row.expires_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function toAdminNotification(row: NotificationRow): AdminNotification {
  return { ...toNotification(row), createdByEmail: row.created_by_email };
}

/**
 * Thông báo đang hiện với người dùng.
 *
 * Chỉ trả về thông báo còn bật và chưa quá hạn; admin ẩn (is_active = false)
 * hoặc quá ngày hết hạn thì thông báo biến mất khỏi giao diện.
 */
export async function listVisibleNotifications(): Promise<SystemNotification[]> {
  const result = await pool.query<NotificationRow>(
    `${SELECT}
      WHERE n.is_active = true
        AND (n.expires_at IS NULL OR n.expires_at > now())
      ORDER BY n.created_at DESC`,
  );
  return result.rows.map(toNotification);
}

/** Toàn bộ thông báo (kể cả đã ẩn / quá hạn) — dành cho trang quản trị. */
export async function listAllNotifications(): Promise<AdminNotification[]> {
  const result = await pool.query<NotificationRow>(
    `${SELECT}
      ORDER BY n.created_at DESC`,
  );
  return result.rows.map(toAdminNotification);
}

export interface NotificationInput {
  title: string;
  message: string;
  level: NotificationLevel;
  isActive: boolean;
  expiresAt: Date | null;
}

export async function createNotification(
  input: NotificationInput,
  createdBy: string | null,
): Promise<AdminNotification> {
  const result = await pool.query<NotificationRow>(
    `WITH inserted AS (
       INSERT INTO system_notifications
         (title, message, level, is_active, expires_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, title, message, level, is_active, expires_at,
                 created_at, updated_at, created_by
     )
     SELECT i.id, i.title, i.message, i.level, i.is_active, i.expires_at,
            i.created_at, i.updated_at, u.email AS created_by_email
       FROM inserted i
       LEFT JOIN users u ON u.id = i.created_by`,
    [input.title, input.message, input.level, input.isActive, input.expiresAt, createdBy],
  );
  return toAdminNotification(result.rows[0]);
}

export async function updateNotification(
  id: string,
  input: Partial<NotificationInput>,
): Promise<AdminNotification | null> {
  // `expires_at` có thể được đặt lại thành NULL nên cần cờ riêng biết
  // "không đổi" với "xoá hạn dùng".
  const hasExpiresAt = input.expiresAt !== undefined;
  const result = await pool.query<NotificationRow>(
    `WITH updated AS (
       UPDATE system_notifications
          SET title       = COALESCE($2, title),
              message     = COALESCE($3, message),
              level       = COALESCE($4, level),
              is_active   = COALESCE($5, is_active),
              expires_at  = CASE WHEN $6 THEN $7 ELSE expires_at END,
              updated_at  = now()
        WHERE id = $1
        RETURNING id, title, message, level, is_active, expires_at,
                  created_at, updated_at, created_by
     )
     SELECT up.id, up.title, up.message, up.level, up.is_active, up.expires_at,
            up.created_at, up.updated_at, u.email AS created_by_email
       FROM updated up
       LEFT JOIN users u ON u.id = up.created_by`,
    [
      id,
      input.title ?? null,
      input.message ?? null,
      input.level ?? null,
      input.isActive ?? null,
      hasExpiresAt,
      input.expiresAt ?? null,
    ],
  );
  return result.rows[0] ? toAdminNotification(result.rows[0]) : null;
}

export async function deleteNotification(id: string): Promise<boolean> {
  const result = await pool.query(`DELETE FROM system_notifications WHERE id = $1`, [id]);
  return (result.rowCount ?? 0) > 0;
}
