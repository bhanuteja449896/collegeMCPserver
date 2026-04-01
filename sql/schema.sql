CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('ADMIN', 'FACULTY', 'STUDENT');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subject_type') THEN
    CREATE TYPE subject_type AS ENUM ('THEORY', 'LAB', 'ELECTIVE');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(60) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role user_role NOT NULL,
  session_token TEXT,
  session_expires_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  code VARCHAR(20) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS programs (
  id SERIAL PRIMARY KEY,
  department_id INT NOT NULL REFERENCES departments(id),
  name VARCHAR(120) NOT NULL,
  code VARCHAR(30) UNIQUE NOT NULL,
  duration_years INT NOT NULL
);

CREATE TABLE IF NOT EXISTS semesters (
  id SERIAL PRIMARY KEY,
  program_id INT NOT NULL REFERENCES programs(id),
  year_number INT NOT NULL,
  semester_number INT NOT NULL,
  sequence_number INT NOT NULL,
  name VARCHAR(20) NOT NULL,
  UNIQUE (program_id, sequence_number),
  UNIQUE (program_id, year_number, semester_number)
);

CREATE TABLE IF NOT EXISTS subjects (
  id SERIAL PRIMARY KEY,
  semester_id INT NOT NULL REFERENCES semesters(id),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(180) NOT NULL,
  credits INT NOT NULL,
  type subject_type NOT NULL
);

CREATE TABLE IF NOT EXISTS faculty (
  id SERIAL PRIMARY KEY,
  user_id INT UNIQUE NOT NULL REFERENCES users(id),
  department_id INT NOT NULL REFERENCES departments(id),
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) UNIQUE NOT NULL,
  phone VARCHAR(20),
  designation VARCHAR(60) NOT NULL
);

CREATE TABLE IF NOT EXISTS students (
  id SERIAL PRIMARY KEY,
  user_id INT UNIQUE NOT NULL REFERENCES users(id),
  program_id INT NOT NULL REFERENCES programs(id),
  roll_number VARCHAR(30) UNIQUE NOT NULL,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) UNIQUE NOT NULL,
  phone VARCHAR(20),
  admission_year INT NOT NULL,
  current_semester_id INT NOT NULL REFERENCES semesters(id)
);

CREATE TABLE IF NOT EXISTS classes (
  id SERIAL PRIMARY KEY,
  semester_id INT NOT NULL REFERENCES semesters(id),
  name VARCHAR(40) NOT NULL,
  class_teacher_id INT REFERENCES faculty(id),
  UNIQUE (semester_id, name)
);

CREATE TABLE IF NOT EXISTS class_students (
  id SERIAL PRIMARY KEY,
  class_id INT NOT NULL REFERENCES classes(id),
  student_id INT NOT NULL REFERENCES students(id),
  UNIQUE (class_id, student_id)
);

CREATE TABLE IF NOT EXISTS faculty_subject_assignments (
  id SERIAL PRIMARY KEY,
  faculty_id INT NOT NULL REFERENCES faculty(id),
  class_id INT NOT NULL REFERENCES classes(id),
  subject_id INT NOT NULL REFERENCES subjects(id),
  UNIQUE (faculty_id, class_id, subject_id)
);

CREATE TABLE IF NOT EXISTS assessments (
  id SERIAL PRIMARY KEY,
  subject_id INT NOT NULL REFERENCES subjects(id),
  name VARCHAR(60) NOT NULL,
  max_marks INT NOT NULL,
  weightage NUMERIC(5,2),
  UNIQUE (subject_id, name)
);

CREATE TABLE IF NOT EXISTS marks (
  id SERIAL PRIMARY KEY,
  assessment_id INT NOT NULL REFERENCES assessments(id),
  student_id INT NOT NULL REFERENCES students(id),
  marks_obtained NUMERIC(6,2) NOT NULL,
  UNIQUE (assessment_id, student_id)
);

CREATE TABLE IF NOT EXISTS days_of_week (
  id SERIAL PRIMARY KEY,
  name VARCHAR(20) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS periods (
  id SERIAL PRIMARY KEY,
  period_number INT UNIQUE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_break BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS class_timetable (
  id SERIAL PRIMARY KEY,
  class_id INT NOT NULL REFERENCES classes(id),
  day_id INT NOT NULL REFERENCES days_of_week(id),
  period_id INT NOT NULL REFERENCES periods(id),
  subject_id INT NOT NULL REFERENCES subjects(id),
  faculty_id INT NOT NULL REFERENCES faculty(id),
  UNIQUE (class_id, day_id, period_id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  action VARCHAR(120) NOT NULL,
  details JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_queries (
  id SERIAL PRIMARY KEY,
  admin_id INT NOT NULL REFERENCES users(id),
  query_text TEXT NOT NULL,
  executed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  success BOOLEAN NOT NULL,
  error_message TEXT
);

INSERT INTO days_of_week (name)
VALUES ('MONDAY'), ('TUESDAY'), ('WEDNESDAY'), ('THURSDAY'), ('FRIDAY'), ('SATURDAY')
ON CONFLICT (name) DO NOTHING;

INSERT INTO periods (period_number, start_time, end_time, is_break)
VALUES
  (1, '09:00', '10:00', FALSE),
  (2, '10:00', '11:00', FALSE),
  (3, '11:00', '12:00', FALSE),
  (4, '13:00', '14:00', FALSE),
  (5, '14:00', '15:00', FALSE),
  (6, '15:00', '16:00', FALSE)
ON CONFLICT (period_number) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_students_program ON students(program_id);
CREATE INDEX IF NOT EXISTS idx_class_students_class ON class_students(class_id);
CREATE INDEX IF NOT EXISTS idx_marks_student ON marks(student_id);
CREATE INDEX IF NOT EXISTS idx_timetable_lookup ON class_timetable(day_id, period_id, faculty_id);
