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
