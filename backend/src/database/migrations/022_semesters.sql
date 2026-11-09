-- 022_semesters.sql — central semester catalogue.
-- Admins configure semesters here once; every other screen
-- (schedule, tuition, enrollments, registration) reads from this table
-- through the shared combo box so codes stay consistent.

CREATE TABLE IF NOT EXISTS semesters (
    code       varchar(30) PRIMARY KEY,
    name       varchar(100) NOT NULL DEFAULT '',
    start_date date,
    end_date   date,
    is_active  boolean NOT NULL DEFAULT true,
    sort_no    int NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_semesters_sort
    ON semesters (sort_no, code);

-- Backfill from every place semesters already exist so no history is lost.
INSERT INTO semesters (code, name, sort_no)
SELECT DISTINCT semester, '', 0 FROM student_enrollments WHERE semester IS NOT NULL AND semester <> ''
ON CONFLICT (code) DO NOTHING;

INSERT INTO semesters (code, name, sort_no)
SELECT DISTINCT semester, '', 0 FROM course_sections WHERE semester IS NOT NULL AND semester <> ''
ON CONFLICT (code) DO NOTHING;

INSERT INTO semesters (code, name, sort_no)
SELECT DISTINCT semester, '', 0 FROM tuition_fees WHERE semester IS NOT NULL AND semester <> ''
ON CONFLICT (code) DO NOTHING;

INSERT INTO semesters (code, name, sort_no)
SELECT DISTINCT semester, '', 0 FROM registration_configs WHERE semester IS NOT NULL AND semester <> ''
ON CONFLICT (code) DO NOTHING;

DROP TRIGGER IF EXISTS semesters_set_updated_at ON semesters;
CREATE TRIGGER semesters_set_updated_at
    BEFORE UPDATE ON semesters
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
