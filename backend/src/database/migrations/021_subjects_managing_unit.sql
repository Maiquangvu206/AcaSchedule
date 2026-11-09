-- 021_subjects_managing_unit.sql — "Bộ môn quản lý" of each subject.
-- Mirrors the managing-unit column of the official training programme
-- (e.g. "Tin học và Kỹ thuật tính toán", "Toán học"). Admins configure it
-- per subject; it is displayed in the curriculum views and study plan.

ALTER TABLE subjects
    ADD COLUMN IF NOT EXISTS managing_unit varchar(100) NOT NULL DEFAULT '';
