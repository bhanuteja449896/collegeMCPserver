TRUNCATE TABLE
  admin_queries,
  audit_logs,
  class_timetable,
  marks,
  assessments,
  faculty_subject_assignments,
  class_students,
  classes,
  students,
  faculty,
  subjects,
  semesters,
  programs,
  departments,
  users
RESTART IDENTITY CASCADE;

INSERT INTO departments (name, code)
VALUES
  ('Computer Science and Engineering', 'CSE'),
  ('Electronics and Communication Engineering', 'ECE');

INSERT INTO programs (department_id, name, code, duration_years)
SELECT id, 'B.Tech ' || code, code || '-BT', 4
FROM departments;

INSERT INTO semesters (program_id, year_number, semester_number, sequence_number, name)
SELECT
  p.id,
  ((seq_no + 1) / 2),
  CASE WHEN seq_no % 2 = 1 THEN 1 ELSE 2 END,
  seq_no,
  ((seq_no + 1) / 2)::text || '-' || (CASE WHEN seq_no % 2 = 1 THEN 1 ELSE 2 END)::text
FROM programs p
CROSS JOIN generate_series(1, 8) AS seq_no;

DO $$
DECLARE
  sem_row RECORD;
  theory_idx INT;
  lab_idx INT;
BEGIN
  FOR sem_row IN
    SELECT s.id, s.sequence_number, p.code AS program_code
    FROM semesters s
    JOIN programs p ON p.id = s.program_id
  LOOP
    FOR theory_idx IN 1..5 LOOP
      INSERT INTO subjects (semester_id, code, name, credits, type)
      VALUES (
        sem_row.id,
        sem_row.program_code || '-S' || sem_row.sequence_number || '-TH' || theory_idx,
        sem_row.program_code || ' Semester ' || sem_row.sequence_number || ' Theory ' || theory_idx,
        3,
        'THEORY'
      );
    END LOOP;

    FOR lab_idx IN 1..2 LOOP
      INSERT INTO subjects (semester_id, code, name, credits, type)
      VALUES (
        sem_row.id,
        sem_row.program_code || '-S' || sem_row.sequence_number || '-LB' || lab_idx,
        sem_row.program_code || ' Semester ' || sem_row.sequence_number || ' Lab ' || lab_idx,
        2,
        'LAB'
      );
    END LOOP;
  END LOOP;
END $$;

INSERT INTO users (username, password_hash, role)
VALUES
  ('admin_hod', crypt('Admin@123', gen_salt('bf')), 'ADMIN'),
  ('admin_principal', crypt('Admin@123', gen_salt('bf')), 'ADMIN');

DO $$
DECLARE
  dept_row RECORD;
  i INT;
  uname TEXT;
  new_user_id INT;
BEGIN
  FOR dept_row IN SELECT id, code FROM departments LOOP
    FOR i IN 1..8 LOOP
      uname := lower('fac_' || dept_row.code || '_' || lpad(i::text, 2, '0'));
      INSERT INTO users (username, password_hash, role)
      VALUES (uname, crypt('Faculty@123', gen_salt('bf')), 'FACULTY')
      RETURNING id INTO new_user_id;

      INSERT INTO faculty (user_id, department_id, name, email, phone, designation)
      VALUES (
        new_user_id,
        dept_row.id,
        upper(dept_row.code) || ' Faculty ' || i,
        uname || '@college.local',
        '900000' || lpad((dept_row.id * 100 + i)::text, 4, '0'),
        CASE WHEN i = 1 THEN 'HOD' ELSE 'Assistant Professor' END
      );
    END LOOP;
  END LOOP;
END $$;

INSERT INTO classes (semester_id, name)
SELECT s.id, d.code || '-4A'
FROM departments d
JOIN programs p ON p.department_id = d.id
JOIN semesters s ON s.program_id = p.id AND s.sequence_number = 8;

INSERT INTO classes (semester_id, name)
SELECT s.id, d.code || '-4B'
FROM departments d
JOIN programs p ON p.department_id = d.id
JOIN semesters s ON s.program_id = p.id AND s.sequence_number = 8;

WITH ranked_faculty AS (
  SELECT f.id, d.code, ROW_NUMBER() OVER (PARTITION BY d.code ORDER BY f.id) AS rn
  FROM faculty f
  JOIN departments d ON d.id = f.department_id
)
UPDATE classes c
SET class_teacher_id = rf.id
FROM ranked_faculty rf
WHERE split_part(c.name, '-', 1) = rf.code
  AND (
    (right(c.name, 1) = 'A' AND rf.rn = 1) OR
    (right(c.name, 1) = 'B' AND rf.rn = 2)
  );

DO $$
DECLARE
  c_row RECORD;
  i INT;
  uname TEXT;
  new_user_id INT;
  class_idx INT;
  program_id_for_class INT;
BEGIN
  FOR c_row IN
    SELECT c.id, c.name, c.semester_id, s.program_id
    FROM classes c
    JOIN semesters s ON s.id = c.semester_id
    ORDER BY c.id
  LOOP
    class_idx := c_row.id;
    program_id_for_class := c_row.program_id;

    FOR i IN 1..20 LOOP
      uname := lower('std_' || replace(c_row.name, '-', '_') || '_' || lpad(i::text, 2, '0'));
      INSERT INTO users (username, password_hash, role)
      VALUES (uname, crypt('Student@123', gen_salt('bf')), 'STUDENT')
      RETURNING id INTO new_user_id;

      INSERT INTO students (
        user_id,
        program_id,
        roll_number,
        name,
        email,
        phone,
        admission_year,
        current_semester_id
      )
      VALUES (
        new_user_id,
        program_id_for_class,
        upper(replace(c_row.name, '-', '')) || lpad(i::text, 3, '0'),
        initcap(replace(c_row.name, '-', ' ')) || ' Student ' || i,
        uname || '@college.local',
        '800000' || lpad((class_idx * 100 + i)::text, 4, '0'),
        EXTRACT(YEAR FROM NOW())::int - 4,
        c_row.semester_id
      );

      INSERT INTO class_students (class_id, student_id)
      VALUES (c_row.id, currval('students_id_seq'));
    END LOOP;
  END LOOP;
END $$;

WITH class_subjects AS (
  SELECT c.id AS class_id, s.id AS subject_id, split_part(c.name, '-', 1) AS dept_code,
         ROW_NUMBER() OVER (PARTITION BY c.id ORDER BY s.id) AS rn
  FROM classes c
  JOIN subjects s ON s.semester_id = c.semester_id
),
faculty_rank AS (
  SELECT f.id AS faculty_id, d.code AS dept_code,
         ROW_NUMBER() OVER (PARTITION BY d.code ORDER BY f.id) AS rn
  FROM faculty f
  JOIN departments d ON d.id = f.department_id
)
INSERT INTO faculty_subject_assignments (faculty_id, class_id, subject_id)
SELECT fr.faculty_id, cs.class_id, cs.subject_id
FROM class_subjects cs
JOIN faculty_rank fr
  ON fr.dept_code = cs.dept_code
 AND fr.rn = ((cs.rn - 1) % 6) + 1;

INSERT INTO assessments (subject_id, name, max_marks, weightage)
SELECT id, 'Mid-1', 30, 0.30 FROM subjects
UNION ALL
SELECT id, 'End-Sem', 70, 0.70 FROM subjects
UNION ALL
SELECT id, 'Assignment-1', 20, 0.10 FROM subjects;

WITH final_sem_assessments AS (
  SELECT a.id AS assessment_id, a.max_marks, s.id AS subject_id
  FROM assessments a
  JOIN subjects s ON s.id = a.subject_id
  JOIN semesters sem ON sem.id = s.semester_id
  WHERE sem.sequence_number = 8
),
class_subjects AS (
  SELECT c.id AS class_id, s.id AS subject_id
  FROM classes c
  JOIN subjects s ON s.semester_id = c.semester_id
),
enrolled_students AS (
  SELECT cs.class_id, cs.student_id
  FROM class_students cs
)
INSERT INTO marks (assessment_id, student_id, marks_obtained)
SELECT
  fsa.assessment_id,
  es.student_id,
  ROUND((fsa.max_marks * (0.55 + random() * 0.40))::numeric, 2)
FROM enrolled_students es
JOIN class_subjects cls ON cls.class_id = es.class_id
JOIN final_sem_assessments fsa ON fsa.subject_id = cls.subject_id;

WITH day_periods AS (
  SELECT d.id AS day_id, d.name AS day_name, p.id AS period_id, p.period_number,
         ROW_NUMBER() OVER (ORDER BY d.id, p.period_number) AS slot_index
  FROM days_of_week d
  CROSS JOIN periods p
  WHERE d.name IN ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY')
),
class_assignments AS (
  SELECT fsa.class_id, fsa.subject_id, fsa.faculty_id,
         ROW_NUMBER() OVER (PARTITION BY fsa.class_id ORDER BY fsa.subject_id) AS rn,
         COUNT(*) OVER (PARTITION BY fsa.class_id) AS total
  FROM faculty_subject_assignments fsa
),
class_slots AS (
  SELECT c.id AS class_id, dp.day_id, dp.period_id, dp.slot_index
  FROM classes c
  JOIN day_periods dp ON TRUE
),
assignment_pick AS (
  SELECT
    cs.class_id,
    cs.day_id,
    cs.period_id,
    ca.subject_id,
    ca.faculty_id
  FROM class_slots cs
  JOIN class_assignments ca
    ON ca.class_id = cs.class_id
   AND ca.rn = ((cs.slot_index - 1) % ca.total) + 1
)
INSERT INTO class_timetable (class_id, day_id, period_id, subject_id, faculty_id)
SELECT class_id, day_id, period_id, subject_id, faculty_id
FROM assignment_pick;
