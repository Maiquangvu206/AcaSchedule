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