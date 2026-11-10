-- 023_curriculum_subject_weights.sql — per-major grading configuration.
-- Admins can decide whether a subject counts toward the CPA and which
-- process/final weights apply to that subject inside a specific major.

ALTER TABLE curriculum_subjects
    ADD COLUMN IF NOT EXISTS calculate_grade boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS process_weight numeric(3,2) NOT NULL DEFAULT 0.40,
    ADD COLUMN IF NOT EXISTS final_weight numeric(3,2) NOT NULL DEFAULT 0.60;

-- Keep the weights valid for existing rows.
ALTER TABLE curriculum_subjects
    DROP CONSTRAINT IF EXISTS curriculum_subjects_weights_sum_check;
ALTER TABLE curriculum_subjects
    ADD CONSTRAINT curriculum_subjects_weights_sum_check
    CHECK (process_weight >= 0 AND process_weight <= 1
       AND final_weight >= 0 AND final_weight <= 1
       AND abs(process_weight + final_weight - 1) < 0.001);
