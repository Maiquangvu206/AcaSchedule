ALTER TABLE course_sections
  DROP CONSTRAINT IF EXISTS course_sections_day_of_week_check,
  ADD CONSTRAINT course_sections_day_of_week_check
    CHECK (day_of_week BETWEEN 2 AND 7),
  DROP CONSTRAINT IF EXISTS course_sections_second_day_check,
  ADD CONSTRAINT course_sections_second_day_check
    CHECK (second_day_of_week IS NULL OR second_day_of_week BETWEEN 2 AND 7);
