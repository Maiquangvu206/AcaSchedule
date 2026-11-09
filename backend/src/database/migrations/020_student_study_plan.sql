-- 020_student_study_plan.sql — per-student study-plan placements.
-- Lets a student reorder the subjects of their major's training programme
-- (drag & drop) without changing the admin-defined default plan.
-- When a row is absent, the subject falls back to curriculum_subjects.semester_no.

CREATE TABLE IF NOT EXISTS student_study_plan (
    student_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_id     uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    semester_no    smallint NOT NULL CHECK (semester_no >= 1 AND semester_no <= 20),
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (student_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_student_study_plan_student
    ON student_study_plan (student_id);

DROP TRIGGER IF EXISTS student_study_plan_set_updated_at ON student_study_plan;
CREATE TRIGGER student_study_plan_set_updated_at
    BEFORE UPDATE ON student_study_plan
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
