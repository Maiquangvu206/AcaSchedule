-- 028_system_notifications.sql — thông báo hệ thống do admin gửi cho sinh viên.
--
-- Mỗi lần sinh viên vào trang, hệ thống hiện một lớp thông báo (layer) chứa
-- nội dung mà admin đã gửi. Lớp thông báo có nút X để đóng.
--
-- Admin quản lý vòng đời thông báo: bấm "Ẩn" để ngừng hiển thị, hoặc đặt
-- ngày hết hạn để thông báo tự ẩn khi quá hạn.

CREATE TABLE IF NOT EXISTS system_notifications (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title       text NOT NULL,
    message     text NOT NULL,
    -- Mức độ hiển thị: info | success | warning | error
    level       text NOT NULL DEFAULT 'info',
    -- Admin tắt bằng tay => is_active = false (thông báo ẩn khỏi giao diện).
    is_active   boolean NOT NULL DEFAULT true,
    -- Ngày hết hạn (tuỳ chọn): quá thời điểm này thông báo tự ẩn.
    expires_at  timestamptz,
    created_by  uuid REFERENCES users (id) ON DELETE SET NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE system_notifications IS
  'Thông báo hệ thống do admin gửi cho toàn bộ sinh viên.';
COMMENT ON COLUMN system_notifications.level IS
  'Mức độ hiển thị: info | success | warning | error.';
COMMENT ON COLUMN system_notifications.is_active IS
  'false = admin đã ẩn, thông báo không còn hiện cho sinh viên.';
COMMENT ON COLUMN system_notifications.expires_at IS
  'Ngày hết hạn (null = không hết hạn).';

ALTER TABLE system_notifications
    DROP CONSTRAINT IF EXISTS system_notifications_level_check;
ALTER TABLE system_notifications
    ADD CONSTRAINT system_notifications_level_check
    CHECK (level IN ('info', 'success', 'warning', 'error'));

ALTER TABLE system_notifications
    DROP CONSTRAINT IF EXISTS system_notifications_title_check;
ALTER TABLE system_notifications
    ADD CONSTRAINT system_notifications_title_check
    CHECK (length(btrim(title)) > 0);

ALTER TABLE system_notifications
    DROP CONSTRAINT IF EXISTS system_notifications_message_check;
ALTER TABLE system_notifications
    ADD CONSTRAINT system_notifications_message_check
    CHECK (length(btrim(message)) > 0);

CREATE INDEX IF NOT EXISTS system_notifications_active_idx
    ON system_notifications (is_active, created_at DESC);
