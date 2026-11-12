-- 030_document_moderation.sql — quản trị tài liệu: ẩn, khóa, xóa.
--
-- * is_hidden: tài liệu bị ẩn khỏi sinh viên (không liệt kê, không xem/tải),
--   admin vẫn quản lý và có thể bỏ ẩn.
-- * is_locked: tài liệu bị khóa — sinh viên vẫn thấy nhưng không thể xem/tải
--   hoặc bình chọn (chỉ admin thao tác).
-- * Xóa: thực hiện bằng DELETE (xóa metadata + votes cascade, service xóa object
--   trên storage).

ALTER TABLE subject_documents
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;

-- Hỗ trợ lọc tài liệu hiển thị cho sinh viên.
CREATE INDEX IF NOT EXISTS idx_subject_documents_visibility
  ON subject_documents (subject_id, is_hidden, upvotes DESC, downvotes ASC, created_at DESC);

COMMENT ON COLUMN subject_documents.is_hidden IS 'Ẩn khỏi sinh viên (admin vẫn thấy).';
COMMENT ON COLUMN subject_documents.is_locked IS 'Khóa: không cho xem/tải/bình chọn.';