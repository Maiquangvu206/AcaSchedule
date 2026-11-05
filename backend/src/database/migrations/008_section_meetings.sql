ALTER TABLE course_sections
  ADD COLUMN IF NOT EXISTS class_type varchar(20) NOT NULL DEFAULT 'lecture',
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS second_day_of_week smallint,
  ADD COLUMN IF NOT EXISTS second_start_period smallint,
  ADD COLUMN IF NOT EXISTS second_end_period smallint;

ALTER TABLE course_sections
  DROP CONSTRAINT IF EXISTS course_sections_class_type_check,
  ADD CONSTRAINT course_sections_class_type_check
    CHECK (class_type IN ('lecture', 'practical')),
  DROP CONSTRAINT IF EXISTS course_sections_second_day_check,
  ADD CONSTRAINT course_sections_second_day_check
    CHECK (second_day_of_week IS NULL OR second_day_of_week BETWEEN 1 AND 7),
  DROP CONSTRAINT IF EXISTS course_sections_second_periods_check,
  ADD CONSTRAINT course_sections_second_periods_check
    CHECK (
      (second_start_period IS NULL AND second_end_period IS NULL)
      OR (
        second_start_period BETWEEN 1 AND 12
        AND second_end_period BETWEEN second_start_period AND 12
      )
    ),
  DROP CONSTRAINT IF EXISTS course_sections_dates_check,
  ADD CONSTRAINT course_sections_dates_check
    CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date),
  DROP CONSTRAINT IF EXISTS course_sections_meeting_pattern_check;
