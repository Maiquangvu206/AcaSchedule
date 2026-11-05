ALTER TABLE tuition_fees
  ADD COLUMN IF NOT EXISTS major_id uuid REFERENCES majors(id) ON DELETE CASCADE;

ALTER TABLE tuition_fees
  DROP CONSTRAINT IF EXISTS tuition_fees_semester_key;

CREATE UNIQUE INDEX IF NOT EXISTS tuition_fees_semester_major_key
  ON tuition_fees (semester, COALESCE(major_id, '00000000-0000-0000-0000-000000000000'::uuid));
