-- 025_major_minimum_credits.sql — số tín chỉ tối thiểu mỗi ngành yêu cầu.
--
-- Không phải ngành nào cũng bắt sinh viên học hết mọi môn trong chương trình
-- đào tạo, nên mỗi ngành có một mốc tối thiểu do admin setup. Tiến độ trên
-- trang Tổng quan so sánh số tín chỉ đã đạt (chỉ tính môn tính điểm) với mốc
-- này — vượt mốc vẫn được.

ALTER TABLE majors
    ADD COLUMN IF NOT EXISTS minimum_credits integer;

COMMENT ON COLUMN majors.minimum_credits IS
  'Số tín chỉ tối thiểu sinh viên phải đạt để tốt nghiệp ngành này (NULL = dùng tổng tín chỉ chương trình)';

-- Giá trị mặc định: tổng tín chỉ của các môn trong chương trình đào tạo.
UPDATE majors m
   SET minimum_credits = sub.total
  FROM (
    SELECT cs.major_id, sum(s.credits)::int AS total
      FROM curriculum_subjects cs
      JOIN subjects s ON s.id = cs.subject_id
     WHERE cs.calculate_grade
     GROUP BY cs.major_id
  ) sub
 WHERE m.minimum_credits IS NULL
   AND m.id = sub.major_id;

ALTER TABLE majors
    DROP CONSTRAINT IF EXISTS majors_minimum_credits_check;
ALTER TABLE majors
    ADD CONSTRAINT majors_minimum_credits_check
    CHECK (minimum_credits IS NULL OR minimum_credits >= 0);
