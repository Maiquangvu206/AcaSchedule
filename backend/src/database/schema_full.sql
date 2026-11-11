-- =====================================================================
-- AcaSchedule — FULL SCHEMA (migrations 001 -> 023 merged)
-- Nguon: backend/src/database/migrations/*.sql
-- Chay tren database PostgreSQL TRONG (Render/Neon/Supabase deu duoc).
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- >>>>>>>>>>>>>>>>>>>> 001_init.sql <<<<<<<<<<<<<<<<<<<<
-- 001_init.sql — core schema for AcaSchedule
-- Applied by backend/src/database/migrate.ts inside a transaction.

CREATE TABLE users (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email         varchar(255) NOT NULL UNIQUE,
    password_hash text NOT NULL,
    full_name     varchar(120) NOT NULL,
    role          varchar(20) NOT NULL DEFAULT 'student'
                  CHECK (role IN ('student', 'admin')),
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE grade_scales (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    min_score_10 numeric(4, 2) NOT NULL UNIQUE
                 CHECK (min_score_10 >= 0 AND min_score_10 <= 10),
    letter_grade varchar(2) NOT NULL,
    grade_4      numeric(3, 2) NOT NULL
                 CHECK (grade_4 >= 0 AND grade_4 <= 4),
    is_pass      boolean NOT NULL
);

CREATE TABLE subjects (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code            varchar(20) NOT NULL UNIQUE,
    name            varchar(255) NOT NULL,
    credits         smallint NOT NULL CHECK (credits > 0 AND credits <= 30),
    knowledge_block varchar(100) NOT NULL DEFAULT 'General',
    is_active       boolean NOT NULL DEFAULT true,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE student_enrollments (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id        uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    subject_id        uuid NOT NULL REFERENCES subjects (id) ON DELETE RESTRICT,
    semester          varchar(20) NOT NULL,
    process_score     numeric(4, 2) CHECK (process_score >= 0 AND process_score <= 10),
    final_score       numeric(4, 2) CHECK (final_score >= 0 AND final_score <= 10),
    letter_grade      varchar(2),
    grade_4           numeric(3, 2) CHECK (grade_4 >= 0 AND grade_4 <= 4),
    is_counted_in_cpa boolean NOT NULL DEFAULT true,
    attempt_no        smallint NOT NULL DEFAULT 1 CHECK (attempt_no >= 1),
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    UNIQUE (student_id, subject_id, attempt_no)
);

CREATE INDEX idx_enrollments_student_cpa
    ON student_enrollments (student_id, is_counted_in_cpa);
CREATE INDEX idx_enrollments_subject
    ON student_enrollments (subject_id);

CREATE TABLE subject_documents (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id  uuid NOT NULL REFERENCES subjects (id) ON DELETE CASCADE,
    uploader_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title       varchar(255) NOT NULL,
    object_key  text NOT NULL UNIQUE,
    mime_type   varchar(100) NOT NULL,
    size_bytes  bigint NOT NULL CHECK (size_bytes >= 0),
    upvotes     integer NOT NULL DEFAULT 0 CHECK (upvotes >= 0),
    downvotes   integer NOT NULL DEFAULT 0 CHECK (downvotes >= 0),
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_subject_rank
    ON subject_documents (subject_id, upvotes DESC, downvotes ASC, created_at DESC);

CREATE TABLE schedule_items (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    enrollment_id uuid REFERENCES student_enrollments (id) ON DELETE SET NULL,
    day_of_week   smallint NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    start_period  smallint NOT NULL CHECK (start_period BETWEEN 1 AND 16),
    end_period    smallint NOT NULL CHECK (end_period BETWEEN 1 AND 16),
    room          varchar(50),
    note          text,
    created_at    timestamptz NOT NULL DEFAULT now(),
    CHECK (end_period >= start_period)
);

CREATE INDEX idx_schedule_student_day
    ON schedule_items (student_id, day_of_week, start_period);

CREATE TABLE refresh_tokens (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash char(64) NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_refresh_tokens_active
    ON refresh_tokens (user_id, expires_at)
    WHERE revoked_at IS NULL;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_set_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER subjects_set_updated_at
    BEFORE UPDATE ON subjects
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER enrollments_set_updated_at
    BEFORE UPDATE ON student_enrollments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- >>>>>>>>>>>>>>>>>>>> 002_subject_weights.sql <<<<<<<<<<<<<<<<<<<<
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

-- >>>>>>>>>>>>>>>>>>>> 003_schedule.sql <<<<<<<<<<<<<<<<<<<<
-- 003_schedule.sql — course sections, period configuration and personal calendar fields

CREATE TABLE period_slots (
    period     smallint PRIMARY KEY CHECK (period BETWEEN 1 AND 16),
    start_time time NOT NULL,
    end_time   time NOT NULL,
    label      varchar(30) NOT NULL,
    CHECK (end_time > start_time)
);

INSERT INTO period_slots (period, start_time, end_time, label) VALUES
    (1,  '07:00', '07:50', 'Tiết 1'),
    (2,  '07:55', '08:45', 'Tiết 2'),
    (3,  '08:50', '09:40', 'Tiết 3'),
    (4,  '09:55', '10:45', 'Tiết 4'),
    (5,  '10:50', '11:40', 'Tiết 5'),
    (6,  '12:30', '13:20', 'Tiết 6'),
    (7,  '13:25', '14:15', 'Tiết 7'),
    (8,  '14:20', '15:10', 'Tiết 8'),
    (9,  '15:25', '16:15', 'Tiết 9'),
    (10, '16:20', '17:10', 'Tiết 10'),
    (11, '17:30', '18:20', 'Tiết 11'),
    (12, '18:25', '19:15', 'Tiết 12');

COMMENT ON TABLE period_slots IS 'Cấu hình tiết → giờ, dùng chung cho backend và UI';

CREATE TABLE course_sections (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id   uuid NOT NULL REFERENCES subjects (id) ON DELETE RESTRICT,
    semester     varchar(20) NOT NULL,
    section_code varchar(30) NOT NULL,
    day_of_week  smallint NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    start_period smallint NOT NULL CHECK (start_period BETWEEN 1 AND 16),
    end_period   smallint NOT NULL CHECK (end_period BETWEEN 1 AND 16),
    room         varchar(50),
    lecturer     varchar(120),
    capacity     smallint CHECK (capacity IS NULL OR capacity > 0),
    is_cancelled boolean NOT NULL DEFAULT false,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (semester, section_code),
    CHECK (end_period >= start_period)
);

CREATE INDEX idx_course_sections_semester
    ON course_sections (semester, is_cancelled, day_of_week, start_period);
CREATE INDEX idx_course_sections_subject
    ON course_sections (subject_id);

CREATE TRIGGER course_sections_set_updated_at
    BEFORE UPDATE ON course_sections
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE schedule_items
    ADD COLUMN title varchar(255) NOT NULL DEFAULT 'Lịch cá nhân',
    ADD COLUMN semester varchar(20),
    ADD COLUMN section_id uuid REFERENCES course_sections (id) ON DELETE SET NULL;

CREATE INDEX idx_schedule_items_semester
    ON schedule_items (student_id, semester, day_of_week);

-- >>>>>>>>>>>>>>>>>>>> 004_documents.sql <<<<<<<<<<<<<<<<<<<<
-- 004_documents.sql — per-user votes and upload metadata for the document hub

ALTER TABLE subject_documents
    ADD COLUMN original_name varchar(255),
    ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

CREATE TRIGGER subject_documents_set_updated_at
    BEFORE UPDATE ON subject_documents
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- One row per user/document. value = 1 (upvote) or -1 (downvote).
-- Counters on subject_documents are recalculated from this table inside the vote transaction.
CREATE TABLE document_votes (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id uuid NOT NULL REFERENCES subject_documents (id) ON DELETE CASCADE,
    user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    value       smallint NOT NULL CHECK (value IN (-1, 1)),
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (document_id, user_id)
);

CREATE TRIGGER document_votes_set_updated_at
    BEFORE UPDATE ON document_votes
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_document_votes_user
    ON document_votes (user_id, value);

COMMENT ON TABLE document_votes IS '1 user 1 vote per document; counters are derived from this table';

-- >>>>>>>>>>>>>>>>>>>> 005_tuition_fees.sql <<<<<<<<<<<<<<<<<<<<
-- 005_tuition_fees.sql — học phí theo từng học kỳ (được admin setup)

CREATE TABLE tuition_fees (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    semester     varchar(20) NOT NULL UNIQUE,
    fee_per_credit integer NOT NULL DEFAULT 1500000 CHECK (fee_per_credit >= 0),
    currency     varchar(10) NOT NULL DEFAULT 'VND',
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER tuition_fees_set_updated_at
    BEFORE UPDATE ON tuition_fees
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE tuition_fees IS 'Học phí theo từng học kỳ, do admin setup';

-- >>>>>>>>>>>>>>>>>>>> 006_audit_logs.sql <<<<<<<<<<<<<<<<<<<<
CREATE TABLE audit_logs (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid REFERENCES users (id) ON DELETE SET NULL,
    action      varchar(100) NOT NULL,
    method      varchar(10),
    path        varchar(255),
    status_code smallint,
    ip_address  varchar(64),
    user_agent  varchar(512),
    metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX idx_audit_logs_user_created ON audit_logs (user_id, created_at DESC);

-- >>>>>>>>>>>>>>>>>>>> 007_admin_management.sql <<<<<<<<<<<<<<<<<<<<
CREATE TABLE IF NOT EXISTS majors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(30) NOT NULL UNIQUE,
  name varchar(255) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS curriculum_subjects (
  major_id uuid NOT NULL REFERENCES majors(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  is_required boolean NOT NULL DEFAULT true,
  semester_no smallint CHECK (semester_no BETWEEN 1 AND 20),
  PRIMARY KEY (major_id, subject_id)
);

CREATE TABLE IF NOT EXISTS user_majors (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  major_id uuid NOT NULL REFERENCES majors(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, major_id)
);

CREATE TABLE IF NOT EXISTS tuition_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semester varchar(20) NOT NULL UNIQUE,
  fee_per_credit integer NOT NULL DEFAULT 1500000 CHECK (fee_per_credit >= 0),
  currency varchar(10) NOT NULL DEFAULT 'VND',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE tuition_fees IS 'Học phí theo từng học kỳ, do admin setup';

DROP TRIGGER IF EXISTS majors_set_updated_at ON majors;
CREATE TRIGGER majors_set_updated_at
BEFORE UPDATE ON majors
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS tuition_fees_set_updated_at ON tuition_fees;
CREATE TRIGGER tuition_fees_set_updated_at
BEFORE UPDATE ON tuition_fees
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- >>>>>>>>>>>>>>>>>>>> 008_section_meetings.sql <<<<<<<<<<<<<<<<<<<<
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

-- >>>>>>>>>>>>>>>>>>>> 009_linked_practical_sections.sql <<<<<<<<<<<<<<<<<<<<
ALTER TABLE course_sections
  ADD COLUMN IF NOT EXISTS meeting_count smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS linked_section_id uuid REFERENCES course_sections(id) ON DELETE SET NULL;

UPDATE course_sections
SET meeting_count = 2
WHERE class_type = 'lecture' AND second_day_of_week IS NOT NULL;

ALTER TABLE course_sections
  DROP CONSTRAINT IF EXISTS course_sections_meeting_count_check,
  ADD CONSTRAINT course_sections_meeting_count_check CHECK (meeting_count BETWEEN 1 AND 2);

-- >>>>>>>>>>>>>>>>>>>> 010_weekday_schedule_only.sql <<<<<<<<<<<<<<<<<<<<
ALTER TABLE course_sections
  DROP CONSTRAINT IF EXISTS course_sections_day_of_week_check,
  ADD CONSTRAINT course_sections_day_of_week_check
    CHECK (day_of_week BETWEEN 2 AND 7),
  DROP CONSTRAINT IF EXISTS course_sections_second_day_check,
  ADD CONSTRAINT course_sections_second_day_check
    CHECK (second_day_of_week IS NULL OR second_day_of_week BETWEEN 2 AND 7);

-- >>>>>>>>>>>>>>>>>>>> 011_tuition_by_major.sql <<<<<<<<<<<<<<<<<<<<
ALTER TABLE tuition_fees
  ADD COLUMN IF NOT EXISTS major_id uuid REFERENCES majors(id) ON DELETE CASCADE;

ALTER TABLE tuition_fees
  DROP CONSTRAINT IF EXISTS tuition_fees_semester_key;

CREATE UNIQUE INDEX IF NOT EXISTS tuition_fees_semester_major_key
  ON tuition_fees (semester, COALESCE(major_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- >>>>>>>>>>>>>>>>>>>> 012_departments.sql <<<<<<<<<<<<<<<<<<<<
CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(30) NOT NULL UNIQUE,
  name varchar(255) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE majors
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES departments(id) ON DELETE SET NULL;

DROP TRIGGER IF EXISTS departments_set_updated_at ON departments;
CREATE TRIGGER departments_set_updated_at
BEFORE UPDATE ON departments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- >>>>>>>>>>>>>>>>>>>> 013_user_profile_fields.sql <<<<<<<<<<<<<<<<<<<<
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone varchar(30),
  ADD COLUMN IF NOT EXISTS student_code varchar(30);

CREATE UNIQUE INDEX IF NOT EXISTS users_student_code_unique
  ON users (student_code)
  WHERE student_code IS NOT NULL;

-- >>>>>>>>>>>>>>>>>>>> 014_user_account_status.sql <<<<<<<<<<<<<<<<<<<<
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- >>>>>>>>>>>>>>>>>>>> 015_force_password_change.sql <<<<<<<<<<<<<<<<<<<<
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

-- >>>>>>>>>>>>>>>>>>>> 016_personal_schedule_sunday.sql <<<<<<<<<<<<<<<<<<<<
ALTER TABLE schedule_items
  DROP CONSTRAINT IF EXISTS schedule_items_day_of_week_check,
  ADD CONSTRAINT schedule_items_day_of_week_check CHECK (day_of_week BETWEEN 2 AND 8);

-- >>>>>>>>>>>>>>>>>>>> 017_personal_schedule_times.sql <<<<<<<<<<<<<<<<<<<<
ALTER TABLE schedule_items
  ADD COLUMN IF NOT EXISTS start_time time,
  ADD COLUMN IF NOT EXISTS end_time time;

UPDATE schedule_items
   SET start_time = COALESCE(start_time, make_time(7 + ((start_period - 1) * 55) / 60, ((start_period - 1) * 55) % 60, 0)),
       end_time = COALESCE(end_time, make_time(7 + ((end_period - 1) * 55 + 50) / 60, ((end_period - 1) * 55 + 50) % 60, 0))
 WHERE start_time IS NULL OR end_time IS NULL;

-- >>>>>>>>>>>>>>>>>>>> 018_personal_schedule_week.sql <<<<<<<<<<<<<<<<<<<<
ALTER TABLE schedule_items
  ADD COLUMN IF NOT EXISTS week_start date;

UPDATE schedule_items
   SET week_start = date_trunc('week', created_at)::date
 WHERE week_start IS NULL;

ALTER TABLE schedule_items
  ALTER COLUMN week_start SET NOT NULL;

-- >>>>>>>>>>>>>>>>>>>> 019_registration_configs.sql <<<<<<<<<<<<<<<<<<<<
-- 019_registration_configs.sql — per-semester registration open/close configuration

CREATE TABLE IF NOT EXISTS registration_configs (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    semester   varchar(20) NOT NULL UNIQUE,
    is_open    boolean NOT NULL DEFAULT true,
    opened_at  timestamptz,
    closed_at  timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_registration_configs_semester
    ON registration_configs (semester);

DROP TRIGGER IF EXISTS registration_configs_set_updated_at ON registration_configs;
CREATE TRIGGER registration_configs_set_updated_at
    BEFORE UPDATE ON registration_configs
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- >>>>>>>>>>>>>>>>>>>> 020_student_study_plan.sql <<<<<<<<<<<<<<<<<<<<
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

-- >>>>>>>>>>>>>>>>>>>> 021_subjects_managing_unit.sql <<<<<<<<<<<<<<<<<<<<
-- 021_subjects_managing_unit.sql — "Bộ môn quản lý" of each subject.
-- Mirrors the managing-unit column of the official training programme
-- (e.g. "Tin học và Kỹ thuật tính toán", "Toán học"). Admins configure it
-- per subject; it is displayed in the curriculum views and study plan.

ALTER TABLE subjects
    ADD COLUMN IF NOT EXISTS managing_unit varchar(100) NOT NULL DEFAULT '';

-- >>>>>>>>>>>>>>>>>>>> 022_semesters.sql <<<<<<<<<<<<<<<<<<<<
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

-- >>>>>>>>>>>>>>>>>>>> 023_curriculum_subject_weights.sql <<<<<<<<<<<<<<<<<<<<
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

-- >>>>>>>>>>>>>>>>>>>> 024_ai_admin.sql <<<<<<<<<<<<<<<<<<<<
-- 024_ai_admin.sql — admin-managed AI providers, API keys and usage tracking.
--
-- * ai_settings        : one row (id = 1) with the kill switch, provider order,
--                        model names and the default daily quota per student.
-- * ai_provider_keys    : Gemini / OpenRouter keys, AES-256-GCM encrypted by the
--                        backend (AI_KEYS_SECRET). Never stored in plain text.
-- * ai_usage_logs       : one row per AI request, used for per-user statistics
--                        and for enforcing the daily quota.
-- * users.ai_daily_limit: optional per-student override (NULL = use default).

CREATE TABLE IF NOT EXISTS ai_settings (
    id                   smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    is_enabled           boolean NOT NULL DEFAULT true,
    provider_order       varchar(64) NOT NULL DEFAULT 'gemini,openrouter',
    gemini_model         varchar(120) NOT NULL DEFAULT 'gemini-1.5-flash',
    openrouter_model     varchar(160) NOT NULL DEFAULT 'google/gemini-2.0-flash-001',
    daily_limit_per_user integer NOT NULL DEFAULT 0 CHECK (daily_limit_per_user >= 0),
    updated_at           timestamptz NOT NULL DEFAULT now()
);

INSERT INTO ai_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS ai_provider_keys (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider      varchar(32) NOT NULL CHECK (provider IN ('gemini', 'openrouter')),
    label         varchar(80) NOT NULL DEFAULT '',
    encrypted_key text NOT NULL,
    key_hint      varchar(16) NOT NULL DEFAULT '',
    is_active     boolean NOT NULL DEFAULT true,
    priority      integer NOT NULL DEFAULT 100,
    last_used_at  timestamptz,
    last_error    text,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_provider_keys_pool
    ON ai_provider_keys (provider, is_active, priority, created_at);

CREATE TABLE IF NOT EXISTS ai_usage_logs (
    id            bigserial PRIMARY KEY,
    user_id       uuid REFERENCES users (id) ON DELETE SET NULL,
    endpoint      varchar(64) NOT NULL,
    provider      varchar(32) NOT NULL DEFAULT 'fallback',
    used_fallback boolean NOT NULL DEFAULT false,
    latency_ms    integer NOT NULL DEFAULT 0,
    status_code   smallint,
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created
    ON ai_usage_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_created
    ON ai_usage_logs (user_id, created_at DESC);

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS ai_daily_limit integer;

ALTER TABLE users
    DROP CONSTRAINT IF EXISTS users_ai_daily_limit_check;
ALTER TABLE users
    ADD CONSTRAINT users_ai_daily_limit_check
    CHECK (ai_daily_limit IS NULL OR ai_daily_limit >= 0);

DROP TRIGGER IF EXISTS ai_settings_set_updated_at ON ai_settings;
CREATE TRIGGER ai_settings_set_updated_at
    BEFORE UPDATE ON ai_settings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS ai_provider_keys_set_updated_at ON ai_provider_keys;
CREATE TRIGGER ai_provider_keys_set_updated_at
    BEFORE UPDATE ON ai_provider_keys
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================================
-- Danh dau da chay migration de buoc migrate cua backend khong chay lai.
-- =====================================================================
CREATE TABLE IF NOT EXISTS schema_migrations (
  name text PRIMARY KEY,
  checksum text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO schema_migrations (name, checksum) VALUES ('001_init.sql', '2abfdaa5b8bc15a383283788dd62d40c82d0504abdb49720797f029f721d973b') ON CONFLICT (name) DO UPDATE SET checksum = EXCLUDED.checksum;
INSERT INTO schema_migrations (name, checksum) VALUES ('002_subject_weights.sql', '0d8d3c5335415f9bb59a6e39148154ec163356de018aa5d5079f5bc255e7fa62') ON CONFLICT (name) DO UPDATE SET checksum = EXCLUDED.checksum;
INSERT INTO schema_migrations (name, checksum) VALUES ('003_schedule.sql', 'cc3e172630dc8e6c08de4cc1cf9592f2bfedd8b9dd3546a8cb10d787aca92760') ON CONFLICT (name) DO UPDATE SET checksum = EXCLUDED.checksum;
INSERT INTO schema_migrations (name, checksum) VALUES ('004_documents.sql', '705379144c9946cc9c5e865e6a735df269a496d95be1d736e1276964ea252b7b') ON CONFLICT (name) DO UPDATE SET checksum = EXCLUDED.checksum;
INSERT INTO schema_migrations (name, checksum) VALUES ('005_tuition_fees.sql', '9f1cdf26b0db8031a24e5c45aeb59dd3ef8334ce6ec3b782bada38f404046632') ON CONFLICT (name) DO UPDATE SET checksum = EXCLUDED.checksum;
INSERT INTO schema_migrations (name, checksum) VALUES ('006_audit_logs.sql', 'dcf28e2443ed51d5c1acd9bd6b4889d2cc851430c3e76b30751f85d8557a50b6') ON CONFLICT (name) DO UPDATE SET checksum = EXCLUDED.checksum;
INSERT INTO schema_migrations (name, checksum) VALUES ('007_admin_management.sql', '642d093d4ac561fa8a9081a12341508d6ab0d1565645c2e45fe2b5350bb3ab3a') ON CONFLICT (name) DO UPDATE SET checksum = EXCLUDED.checksum;
INSERT INTO schema_migrations (name, checksum) VALUES ('008_section_meetings.sql', 'a3389667ef410e879752b308d721a7f67925f017a54823a97c6f351232777e1f') ON CONFLICT (name) DO UPDATE SET checksum = EXCLUDED.checksum;
INSERT INTO schema_migrations (name, checksum) VALUES ('009_linked_practical_sections.sql', '8ced71dc7be59fa59003a0024ccd93185bc93c14acdb4441a9d274089ea4bad7') ON CONFLICT (name) DO UPDATE SET checksum = EXCLUDED.checksum;
INSERT INTO schema_migrations (name, checksum) VALUES ('010_weekday_schedule_only.sql', '56b2ed184e5d929abbc738c47055b078d36410fd12a731cb93855d4bf8b77bbc') ON CONFLICT (name) DO UPDATE SET checksum = EXCLUDED.checksum;
INSERT INTO schema_migrations (name, checksum) VALUES ('011_tuition_by_major.sql', '4c0588bd52c78ca6d46a76cef6f782a3083d898187dcaf857e1e427bd98b4fd2') ON CONFLICT (name) DO UPDATE SET checksum = EXCLUDED.checksum;
INSERT INTO schema_migrations (name, checksum) VALUES ('012_departments.sql', '10a96825233b5e6291772c1df17e98955883c7e61f8f1857d0e8d816136aacba') ON CONFLICT (name) DO UPDATE SET checksum = EXCLUDED.checksum;
INSERT INTO schema_migrations (name, checksum) VALUES ('013_user_profile_fields.sql', 'ccb914fb93c9bc98c246085a87a92e9b0ac2f1a822d4ef5c49234e58c298936e') ON CONFLICT (name) DO UPDATE SET checksum = EXCLUDED.checksum;
INSERT INTO schema_migrations (name, checksum) VALUES ('014_user_account_status.sql', '92f5fdb48d996d70cd77cbca9a58c12ef01d259d801541b170f9b74d1e4bd4a4') ON CONFLICT (name) DO UPDATE SET checksum = EXCLUDED.checksum;
INSERT INTO schema_migrations (name, checksum) VALUES ('015_force_password_change.sql', '163f71bb1e1756e18b10ae730fa16ace934855382a5a4618f14ffd9afe3abe3d') ON CONFLICT (name) DO UPDATE SET checksum = EXCLUDED.checksum;
INSERT INTO schema_migrations (name, checksum) VALUES ('016_personal_schedule_sunday.sql', 'a2b9de48c2ddaff8256a2971f601785ef94b6aa121acb8e0cdf75ca180d9a22b') ON CONFLICT (name) DO UPDATE SET checksum = EXCLUDED.checksum;
INSERT INTO schema_migrations (name, checksum) VALUES ('017_personal_schedule_times.sql', '310aefaa0d211297808216033ba4326f3de79c9eb39adfb04ded5b0c6ac78185') ON CONFLICT (name) DO UPDATE SET checksum = EXCLUDED.checksum;
INSERT INTO schema_migrations (name, checksum) VALUES ('018_personal_schedule_week.sql', 'f3020a53ab0ad262cf511a2623146ca46225d3c29bba1c8590ade09ed9c50ed2') ON CONFLICT (name) DO UPDATE SET checksum = EXCLUDED.checksum;
INSERT INTO schema_migrations (name, checksum) VALUES ('019_registration_configs.sql', '17c82ef5591dc7f9651732466fcae5872b9d7c6c6a232579049d82afdef0f538') ON CONFLICT (name) DO UPDATE SET checksum = EXCLUDED.checksum;
INSERT INTO schema_migrations (name, checksum) VALUES ('020_student_study_plan.sql', 'e22a3d19611cb3ee1f95b425d9dba516ad502fc2ac33f3f966f7c081fced0436') ON CONFLICT (name) DO UPDATE SET checksum = EXCLUDED.checksum;
INSERT INTO schema_migrations (name, checksum) VALUES ('021_subjects_managing_unit.sql', 'bd0dc62f8cb01e776fbe02e748760b232c5f1fab33e3919e02103d356f0ab79c') ON CONFLICT (name) DO UPDATE SET checksum = EXCLUDED.checksum;
INSERT INTO schema_migrations (name, checksum) VALUES ('022_semesters.sql', '5b83c7345fe6980391720d522da54bc8cac63f5ff4102b027af1dd2532bb282e') ON CONFLICT (name) DO UPDATE SET checksum = EXCLUDED.checksum;
INSERT INTO schema_migrations (name, checksum) VALUES ('023_curriculum_subject_weights.sql', 'db9b03d81d6cfac47c5b4a947b7404d9cdff5725563b1c13c1aca8eb95ccc505') ON CONFLICT (name) DO UPDATE SET checksum = EXCLUDED.checksum;
INSERT INTO schema_migrations (name, checksum) VALUES ('024_ai_admin.sql', 'f46396c36853c88344492ce0300e1a90d1477d3d90f42833c89895a18b58b5b9') ON CONFLICT (name) DO UPDATE SET checksum = EXCLUDED.checksum;
