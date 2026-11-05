ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone varchar(30),
  ADD COLUMN IF NOT EXISTS student_code varchar(30);

CREATE UNIQUE INDEX IF NOT EXISTS users_student_code_unique
  ON users (student_code)
  WHERE student_code IS NOT NULL;
