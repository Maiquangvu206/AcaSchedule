-- 027_section_skipped_weeks.sql — cho phép lớp học phần nghỉ ở những tuần cụ thể.
--
-- Không phải lớp nào cũng học đủ mọi tuần: thực hành có thể chỉ học 1 hoặc
-- 2 buổi, và cả lý thuyết lẫn thực hành đều có thể nghỉ ở một vài tuần.
--
-- `skipped_weeks` lưu danh sách số tuần (1-based, tính từ tuần đầu của học kỳ)
-- mà lớp KHÔNG học. Giá trị rỗng = học đều mọi tuần (hành vi cũ).

ALTER TABLE course_sections
    ADD COLUMN IF NOT EXISTS skipped_weeks jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN course_sections.skipped_weeks IS
  'Danh sách số tuần (1-based từ tuần đầu học kỳ) mà lớp không học. Mảng rỗng = học đều.';

ALTER TABLE course_sections
    DROP CONSTRAINT IF EXISTS course_sections_skipped_weeks_check;
ALTER TABLE course_sections
    ADD CONSTRAINT course_sections_skipped_weeks_check
    CHECK (jsonb_typeof(skipped_weeks) = 'array');
