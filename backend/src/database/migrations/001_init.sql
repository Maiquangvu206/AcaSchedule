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
