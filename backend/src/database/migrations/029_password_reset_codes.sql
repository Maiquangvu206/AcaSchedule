-- 029_password_reset_codes.sql — luồng "quên mật khẩu" bằng mã xác nhận.
--
-- Trước đây: yêu cầu quên mật khẩu đổi mật khẩu NGAY LẬP TỨC rồi gửi mật khẩu
-- tạm qua email → ai đó biết email của bạn có thể kích hoạt đặt lại mật khẩu
-- dù không có quyền truy cập hộp thư (mật khẩu mới nằm trong email nhưng tài
-- khoản đã bị đổi mật khẩu).
--
-- Giờ: yêu cầu quên mật khẩu chỉ sinh một MÃ XÁC NHẬN 6 số gửi qua email;
-- người dùng phải nhập mã này (cùng mật khẩu mới) trên trang Quên mật khẩu
-- thì mật khẩu mới thực sự được đổi. Ai không có hộp thư không làm được gì.
--
-- An toàn:
--   - Mã lưu dạng HASH (sha256) — lộ DB không lộ được mã.
--   - Mã hết hạn sau 15 phút, chỉ dùng được 1 lần.
--   - Nhập sai tối đa 5 lần thì mã bị thu hồi, phải xin mã mới.

CREATE TABLE IF NOT EXISTS password_reset_codes (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    -- SHA-256 của mã 6 số — KHÔNG lưu mã gốc.
    code_hash  text NOT NULL,
    -- Hết hạn 15 phút sau khi tạo.
    expires_at timestamptz NOT NULL,
    -- Số lần nhập sai; >= 5 thì mã coi như thu hồi.
    attempts   int NOT NULL DEFAULT 0,
    -- Đánh dấu mã đã dùng để đổi mật khẩu thành công.
    used_at    timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE password_reset_codes IS
  'Mã xác nhận 6 số cho luồng quên mật khẩu (hết hạn 15 phút, dùng 1 lần).';
COMMENT ON COLUMN password_reset_codes.code_hash IS
  'SHA-256 của mã 6 số — không lưu mã gốc.';
COMMENT ON COLUMN password_reset_codes.attempts IS
  'Số lần nhập sai mã; đạt ngưỡng 5 thì mã bị thu hồi.';
COMMENT ON COLUMN password_reset_codes.used_at IS
  'Thời điểm mã được dùng thành công (null = chưa dùng).';

CREATE INDEX IF NOT EXISTS idx_password_reset_codes_user
    ON password_reset_codes (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_password_reset_codes_expiry
    ON password_reset_codes (expires_at);
