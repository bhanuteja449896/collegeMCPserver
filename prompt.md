Hi claude I need your help in developing a Mcp server for my final year project It is an emergencey and we need to built this in a very perfectly. 

i will give deep context about that 

what my project is 

i'm building a mcp project for my college management 
this project mainly depends on role based access
so it contains a 3 roles 
1. admin (hod, principal , other seniors)
2. faculty ( staff , teachers , class teachers , co teachers etc)
3. student (students)

now explain each and every role 

1. admin 

admin is the main candidate in this 
he can view all the faculty data , students data , whole department data, classes , subjects, marks , time table of each class 
he can fetch the data and do whatever analytics he needs like avg of class in semester

2. staff 

so staff is the second layer role 
they don't have access to the admin's table 
they can view the students data and can do analytics  and can see the time table 
which teacher is free now and which teacher is present in which class everything related to the time table 

3. student

so coming to the student . it is the last layer 
student has access to his own data , and time table of the classroom . and he can do analytics with his data 



now this is a mcp server and we need authentication 

how the authentication works
so in users table we store all the data about users but we differentitate them with the roles we given to them 

users , password, sessiontoken

so how it works 
we should build a tool that mainly manages the sessiontoken which is mainly for authentication

so user sends the credentials in the chat so the tool analyzes the credentials and searches them in the users table 

and it returns the sessiontoken in return . so the application must send it in the every tool call from next 

what session token contains 
it contains the username when decrypts 

so whenever a tool sent in the call , it must decrypts and gets the username and find the user in user table and must evaluate the sessiontoken if it is the same 
if it is differnt invalid login again 

if it same then continue the response of the funtion .

now coming to the tools for each role 

1. admin

get student detials ,
get faculty details ,
get department details,
get student marks,
get time table of the class,
get time table of the teacher,
find who is free today in the timetable in which periods,
design a new time table with current faculty(this must be the ai user prompt taken and ai creates the time table and if admin accepts it inserts the new time table),
mget marks of the department wise like stuff create multiple tools like these because there are mulitple parameter that admin needed,
query executor of admin (if no tool available),
teache modification to the class


2. teacher
get student details, 
get department details,
get student marks,
get student marks parameters like stuff tools,
query executor but limited to the teacher
class average ,
class details etc
faculty time table,
class time table


3. student

get marks of the student(his own marks)
get time table of the class
get faculty details(faculty who teaches the class)
get class analytics 
get department analytics 




database design 

## 1. Core user & role tables

**users**

- `id` (PK, int, auto)
- `username` (varchar, unique)
- `password_hash` (varchar)
- `role` (enum: 'ADMIN','FACULTY','STUDENT')
- `session_token` (text, nullable)
- `session_expires_at` (timestamp, nullable)
- `created_at` (timestamp)
- `updated_at` (timestamp)

***

## 2. Academic structure

**departments**

- `id` (PK)
- `name` (varchar)
- `code` (varchar, unique)

**programs** (e.g., B.Tech CSE, B.Tech ECE)

- `id` (PK)
- `department_id` (FK → departments.id)
- `name` (varchar)
- `code` (varchar, unique)
- `duration_years` (int)

**semesters**

- `id` (PK)
- `program_id` (FK → programs.id)
- `year_number` (int)  -- 1..4
- `semester_number` (int)  -- 1 or 2
- `name` (varchar)  -- e.g. "1-1", "1-2"

**subjects**

- `id` (PK)
- `semester_id` (FK → semesters.id)
- `code` (varchar, unique)
- `name` (varchar)
- `credits` (int)
- `type` (enum: 'THEORY','LAB','ELECTIVE')

***

## 3. People: students & faculty

**faculty**

- `id` (PK)
- `user_id` (FK → users.id, unique)
- `department_id` (FK → departments.id)
- `name` (varchar)
- `email` (varchar, unique)
- `phone` (varchar, nullable)
- `designation` (varchar)  -- Prof, HOD, etc.

**students**

- `id` (PK)
- `user_id` (FK → users.id, unique)
- `program_id` (FK → programs.id)
- `roll_number` (varchar, unique)
- `name` (varchar)
- `email` (varchar, unique)
- `phone` (varchar, nullable)
- `admission_year` (int)
- `current_semester_id` (FK → semesters.id)

**classes** (section-level)

- `id` (PK)
- `semester_id` (FK → semesters.id)
- `name` (varchar)  -- e.g., "CSE-2A"
- `class_teacher_id` (FK → faculty.id, nullable)

**class_students** (which student in which class)

- `id` (PK)
- `class_id` (FK → classes.id)
- `student_id` (FK → students.id)
- Unique (class_id, student_id)

**faculty_subject_assignments**

- `id` (PK)
- `faculty_id` (FK → faculty.id)
- `class_id` (FK → classes.id)
- `subject_id` (FK → subjects.id)
- Unique (faculty_id, class_id, subject_id)

***

## 4. Marks and analytics

**assessments** (to support multiple types)

- `id` (PK)
- `subject_id` (FK → subjects.id)
- `name` (varchar)  -- "Mid-1", "End-Sem", "Assignment-1"
- `max_marks` (int)
- `weightage` (numeric, nullable)  -- for analytics

**marks**

- `id` (PK)
- `assessment_id` (FK → assessments.id)
- `student_id` (FK → students.id)
- `marks_obtained` (numeric)
- Unique (assessment_id, student_id)

This lets admin/faculty query department-wise, class-wise, subject-wise averages, etc. [studocu](https://www.studocu.com/in/document/kiet-group-of-institutions/database-management-system/pbl-report-college-management-system-database-design-implementation/148716047)

***

## 5. Timetable model (9–4, 6 periods, 1 hr break)

Assume:

- College hours: 9:00 – 16:00.
- 6 teaching periods per day.
- 1 hour break (e.g., 12–1) which we can represent but does not need entries in timetable rows.

First define reference tables:

**days_of_week**

- `id` (PK)
- `name` (varchar)  -- 'MONDAY'...'SATURDAY'

**periods**

- `id` (PK)  -- 1..6
- `period_number` (int, unique)
- `start_time` (time)  -- e.g., 09:00, 10:00...
- `end_time` (time)    -- e.g., 09:50, 10:50...
- `is_break` (boolean)  -- false for 6 teaching periods

Then actual timetable:

**class_timetable**

- `id` (PK)
- `class_id` (FK → classes.id)
- `day_id` (FK → days_of_week.id)
- `period_id` (FK → periods.id)
- `subject_id` (FK → subjects.id)
- `faculty_id` (FK → faculty.id)
- Unique (class_id, day_id, period_id)

This is enough to answer:

- Class timetable for a given class.
- Faculty timetable (query by faculty_id).
- “Who is free this period?”  
  → Find all `faculty` not in any `class_timetable` row for that `day_id` + `period_id`. [dev](https://dev.to/pocharis/relational-database-design-to-store-university-timetables-and-record-of-students-attendance-3jg4)

If you want to explicitly store lunch:

**breaks** (optional)

- `id` (PK)
- `start_time` (time)  -- e.g., 12:00
- `end_time` (time)    -- e.g., 13:00
- `description` (varchar)  -- "Lunch Break"

But you can also just document that e.g. periods are (9–10, 10–11, 11–12, 13–14, 14–15, 15–16) so 12–13 is implicitly the break.

***

## 6. Admin / logging helpers (optional but useful)

**audit_logs**

- `id` (PK)
- `user_id` (FK → users.id)
- `action` (varchar)  -- e.g., 'LOGIN', 'CREATE_TIMETABLE', 'UPDATE_MARKS'
- `details` (jsonb or text)
- `created_at` (timestamp)

**admin_queries** (for “query executor” tool)

- `id` (PK)
- `admin_id` (FK → users.id where role='ADMIN')
- `query_text` (text)
- `executed_at` (timestamp)
- `success` (boolean)
- `error_message` (text, nullable)




final and most important thing ***

It should not have separate server for all these 

this mcp server should work only with tools not with any other outer api's and any other server to manage via api's

I will give the sql string to connect to the database 



