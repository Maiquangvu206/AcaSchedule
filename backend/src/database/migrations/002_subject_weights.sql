-- 002_subject_weights.sql — grade composition weights per subject

ALTER TABLE subjects
    ADD COLUMN process_weight numeric(3, 2) NOT NULL DEFAULT 0.40
        CHECK (process_weight >= 0 AND process_weight <= 1),
    ADD COLUMN final_weight numeric(3, 2) NOT NULL DEFAULT 0.60
        CHECK (final_weight >= 0 AND final_weight <= 1);

ALTER TABLE subjects
    ADD CONSTRAINT subjects_weights_sum_check
    CHECK (process_weight + final_weight = 1);

COMMENT ON COLUMN subjects.process_weight IS 'Weight of process_score in the final 10-point score';
COMMENT ON COLUMN subjects.final_weight IS 'Weight of final_score in the final 10-point score';
