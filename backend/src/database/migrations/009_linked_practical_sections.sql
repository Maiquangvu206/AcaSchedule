ALTER TABLE course_sections
  ADD COLUMN IF NOT EXISTS meeting_count smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS linked_section_id uuid REFERENCES course_sections(id) ON DELETE SET NULL;

UPDATE course_sections
SET meeting_count = 2
WHERE class_type = 'lecture' AND second_day_of_week IS NOT NULL;

ALTER TABLE course_sections
  DROP CONSTRAINT IF EXISTS course_sections_meeting_count_check,
  ADD CONSTRAINT course_sections_meeting_count_check CHECK (meeting_count BETWEEN 1 AND 2);
