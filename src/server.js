import dotenv from "dotenv";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { pool, query } from "./db.js";
import { login, requireSession } from "./auth.js";

dotenv.config();

const SESSION_SECRET = process.env.SESSION_SECRET || "replace-this-secret";
const SESSION_EXPIRY_HOURS = Number(process.env.SESSION_EXPIRY_HOURS || "24");

const tools = [
  {
    name: "auth_login",
    description: "Authenticate username/password and return session token.",
    inputSchema: {
      type: "object",
      properties: {
        username: { type: "string" },
        password: { type: "string" }
      },
      required: ["username", "password"]
    }
  },
  {
    name: "admin_get_all_departments",
    description: "Admin: fetch all departments and summary counts.",
    inputSchema: {
      type: "object",
      properties: { sessionToken: { type: "string" } },
      required: ["sessionToken"]
    }
  },
  {
    name: "admin_get_all_faculty",
    description: "Admin: fetch all faculty with department info.",
    inputSchema: {
      type: "object",
      properties: {
        sessionToken: { type: "string" },
        department: { type: "string" }
      },
      required: ["sessionToken"]
    }
  },
  {
    name: "admin_get_all_students",
    description: "Admin: fetch all students with class and program info.",
    inputSchema: {
      type: "object",
      properties: {
        sessionToken: { type: "string" },
        department: { type: "string" },
        className: { type: "string" }
      },
      required: ["sessionToken"]
    }
  },
  {
    name: "admin_get_department_marks_analytics",
    description: "Admin: department-wise marks analytics.",
    inputSchema: {
      type: "object",
      properties: {
        sessionToken: { type: "string" },
        departmentCode: { type: "string" },
        semester: { type: "number" }
      },
      required: ["sessionToken", "departmentCode"]
    }
  },
  {
    name: "admin_get_student_marks",
    description: "Admin: fetch detailed marks for a specific student.",
    inputSchema: {
      type: "object",
      properties: {
        sessionToken: { type: "string" },
        studentId: { type: "number" },
        semester: { type: "number" }
      },
      required: ["sessionToken", "studentId"]
    }
  },
  {
    name: "admin_get_class_timetable",
    description: "Admin: get timetable for a class.",
    inputSchema: {
      type: "object",
      properties: {
        sessionToken: { type: "string" },
        classId: { type: "number" },
        className: { type: "string" }
      },
      required: ["sessionToken"]
    }
  },
  {
    name: "admin_get_faculty_timetable",
    description: "Admin: get timetable of a faculty member.",
    inputSchema: {
      type: "object",
      properties: {
        sessionToken: { type: "string" },
        facultyId: { type: "number" }
      },
      required: ["sessionToken", "facultyId"]
    }
  },
  {
    name: "admin_get_free_faculty",
    description: "Admin: who is free at day+period.",
    inputSchema: {
      type: "object",
      properties: {
        sessionToken: { type: "string" },
        dayName: { type: "string" },
        periodNumber: { type: "number" }
      },
      required: ["sessionToken", "dayName", "periodNumber"]
    }
  },
  {
    name: "admin_design_new_timetable",
    description: "Admin: generate timetable proposal from class assignments and prompt.",
    inputSchema: {
      type: "object",
      properties: {
        sessionToken: { type: "string" },
        classId: { type: "number" },
        prompt: { type: "string" }
      },
      required: ["sessionToken", "classId", "prompt"]
    }
  },
  {
    name: "admin_apply_timetable",
    description: "Admin: apply accepted timetable proposal.",
    inputSchema: {
      type: "object",
      properties: {
        sessionToken: { type: "string" },
        classId: { type: "number" },
        entries: {
          type: "array",
          items: {
            type: "object",
            properties: {
              dayName: { type: "string" },
              periodNumber: { type: "number" },
              subjectId: { type: "number" },
              facultyId: { type: "number" }
            },
            required: ["dayName", "periodNumber", "subjectId", "facultyId"]
          }
        }
      },
      required: ["sessionToken", "classId", "entries"]
    }
  },
  {
    name: "admin_assign_class_teacher",
    description: "Admin: modify class teacher.",
    inputSchema: {
      type: "object",
      properties: {
        sessionToken: { type: "string" },
        classId: { type: "number" },
        facultyId: { type: "number" }
      },
      required: ["sessionToken", "classId", "facultyId"]
    }
  },
  {
    name: "admin_query_executor",
    description: "Admin: run read-only custom SQL query.",
    inputSchema: {
      type: "object",
      properties: {
        sessionToken: { type: "string" },
        sql: { type: "string" }
      },
      required: ["sessionToken", "sql"]
    }
  },
  {
    name: "faculty_get_assigned_subjects",
    description: "Faculty: list your assigned subjects/classes.",
    inputSchema: {
      type: "object",
      properties: { sessionToken: { type: "string" } },
      required: ["sessionToken"]
    }
  },
  {
    name: "faculty_get_department_details",
    description: "Faculty: get your own department details and aggregate counts.",
    inputSchema: {
      type: "object",
      properties: { sessionToken: { type: "string" } },
      required: ["sessionToken"]
    }
  },
  {
    name: "faculty_get_class_students",
    description: "Faculty: list students in a class you handle.",
    inputSchema: {
      type: "object",
      properties: {
        sessionToken: { type: "string" },
        classId: { type: "number" }
      },
      required: ["sessionToken", "classId"]
    }
  },
  {
    name: "faculty_get_student_progress",
    description: "Faculty: detailed progress for a student.",
    inputSchema: {
      type: "object",
      properties: {
        sessionToken: { type: "string" },
        studentId: { type: "number" },
        semester: { type: "number" }
      },
      required: ["sessionToken", "studentId"]
    }
  },
  {
    name: "faculty_get_class_average",
    description: "Faculty: class average by class and optional semester.",
    inputSchema: {
      type: "object",
      properties: {
        sessionToken: { type: "string" },
        classId: { type: "number" },
        semester: { type: "number" }
      },
      required: ["sessionToken", "classId"]
    }
  },
  {
    name: "faculty_get_my_timetable",
    description: "Faculty: your own timetable.",
    inputSchema: {
      type: "object",
      properties: { sessionToken: { type: "string" } },
      required: ["sessionToken"]
    }
  },
  {
    name: "faculty_get_class_timetable",
    description: "Faculty: timetable of class you teach.",
    inputSchema: {
      type: "object",
      properties: {
        sessionToken: { type: "string" },
        classId: { type: "number" }
      },
      required: ["sessionToken", "classId"]
    }
  },
  {
    name: "faculty_query_executor",
    description: "Faculty: run limited read-only SQL. Must use {{faculty_id}} placeholder.",
    inputSchema: {
      type: "object",
      properties: {
        sessionToken: { type: "string" },
        sql: { type: "string" }
      },
      required: ["sessionToken", "sql"]
    }
  },
  {
    name: "student_get_my_marks",
    description: "Student: your marks by semester.",
    inputSchema: {
      type: "object",
      properties: {
        sessionToken: { type: "string" },
        semester: { type: "number" }
      },
      required: ["sessionToken"]
    }
  },
  {
    name: "student_get_my_timetable",
    description: "Student: your class timetable.",
    inputSchema: {
      type: "object",
      properties: {
        sessionToken: { type: "string" },
        semester: { type: "number" }
      },
      required: ["sessionToken"]
    }
  },
  {
    name: "student_get_my_faculty",
    description: "Student: faculty teaching your class.",
    inputSchema: {
      type: "object",
      properties: { sessionToken: { type: "string" } },
      required: ["sessionToken"]
    }
  },
  {
    name: "student_get_my_average_marks",
    description: "Student: your average marks.",
    inputSchema: {
      type: "object",
      properties: {
        sessionToken: { type: "string" },
        semester: { type: "number" }
      },
      required: ["sessionToken"]
    }
  },
  {
    name: "student_get_weak_subjects",
    description: "Student: subjects below 60 percent.",
    inputSchema: {
      type: "object",
      properties: {
        sessionToken: { type: "string" },
        semester: { type: "number" }
      },
      required: ["sessionToken"]
    }
  },
  {
    name: "student_get_class_analytics",
    description: "Student: class analytics (average marks and topper score).",
    inputSchema: {
      type: "object",
      properties: {
        sessionToken: { type: "string" },
        semester: { type: "number" }
      },
      required: ["sessionToken"]
    }
  },
  {
    name: "student_get_department_analytics",
    description: "Student: department analytics for your semester.",
    inputSchema: {
      type: "object",
      properties: {
        sessionToken: { type: "string" },
        semester: { type: "number" }
      },
      required: ["sessionToken"]
    }
  }
];

function out(data) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2)
      }
    ]
  };
}

function validateReadOnlySql(sql) {
  const clean = sql.trim().toLowerCase();
  if (!clean.startsWith("select")) {
    throw new Error("Only SELECT queries are allowed.");
  }

  const blockedWords = ["insert", "update", "delete", "drop", "truncate", "alter", "create", "grant", "revoke"];
  if (blockedWords.some((w) => clean.includes(`${w} `))) {
    throw new Error("Unsafe SQL detected. Only read-only query is permitted.");
  }
}

async function getFacultyIdByUserId(userId) {
  const r = await query("SELECT id FROM faculty WHERE user_id = $1", [userId]);
  if (!r.rowCount) {
    throw new Error("Faculty profile not found.");
  }
  return r.rows[0].id;
}

async function getStudentIdByUserId(userId) {
  const r = await query("SELECT id FROM students WHERE user_id = $1", [userId]);
  if (!r.rowCount) {
    throw new Error("Student profile not found.");
  }
  return r.rows[0].id;
}

async function getClassTimetableRows(classId) {
  const tt = await query(
    `SELECT d.name AS day_name, p.period_number, p.start_time, p.end_time,
            s.id AS subject_id, s.code AS subject_code, s.name AS subject_name,
            f.id AS faculty_id, f.name AS faculty_name
     FROM class_timetable ct
     JOIN days_of_week d ON d.id = ct.day_id
     JOIN periods p ON p.id = ct.period_id
     JOIN subjects s ON s.id = ct.subject_id
     JOIN faculty f ON f.id = ct.faculty_id
     WHERE ct.class_id = $1
     ORDER BY d.id, p.period_number`,
    [classId]
  );
  return tt.rows;
}

const server = new Server(
  {
    name: "college-mcp-server",
    version: "1.0.0"
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    if (name === "auth_login") {
      const result = await login(pool, args.username, args.password, SESSION_SECRET, SESSION_EXPIRY_HOURS);
      return out(result);
    }

    if (!args.sessionToken || typeof args.sessionToken !== "string") {
      throw new Error("Missing session token. Login again.");
    }

    switch (name) {
      case "admin_get_all_departments": {
        await requireSession(pool, args.sessionToken, SESSION_SECRET, ["ADMIN"]);
        const result = await query(
          `SELECT d.id, d.name, d.code,
                  COUNT(DISTINCT f.id) AS faculty_count,
                  COUNT(DISTINCT s.id) AS student_count,
                  COUNT(DISTINCT c.id) AS class_count
           FROM departments d
           LEFT JOIN faculty f ON f.department_id = d.id
           LEFT JOIN programs p ON p.department_id = d.id
           LEFT JOIN students s ON s.program_id = p.id
           LEFT JOIN semesters sem ON sem.program_id = p.id
           LEFT JOIN classes c ON c.semester_id = sem.id
           GROUP BY d.id, d.name, d.code
           ORDER BY d.code`
        );
        return out(result.rows);
      }

      case "admin_get_all_faculty": {
        await requireSession(pool, args.sessionToken, SESSION_SECRET, ["ADMIN"]);
        const filter = [];
        const values = [];
        if (args.department) {
          values.push(args.department.toUpperCase());
          filter.push(`d.code = $${values.length}`);
        }
        const result = await query(
          `SELECT f.id, f.name, f.designation, f.email, f.phone, d.code AS department
           FROM faculty f
           JOIN departments d ON d.id = f.department_id
           ${filter.length ? `WHERE ${filter.join(" AND ")}` : ""}
           ORDER BY d.code, f.name`,
          values
        );
        return out(result.rows);
      }

      case "admin_get_all_students": {
        await requireSession(pool, args.sessionToken, SESSION_SECRET, ["ADMIN"]);
        const values = [];
        const where = [];
        if (args.department) {
          values.push(args.department.toUpperCase());
          where.push(`d.code = $${values.length}`);
        }
        if (args.className) {
          values.push(args.className.toUpperCase());
          where.push(`UPPER(c.name) = $${values.length}`);
        }

        const result = await query(
          `SELECT st.id, st.name, st.roll_number, st.email, p.code AS program,
                  d.code AS department, sem.name AS semester, c.name AS class_name
           FROM students st
           JOIN programs p ON p.id = st.program_id
           JOIN departments d ON d.id = p.department_id
           JOIN semesters sem ON sem.id = st.current_semester_id
           LEFT JOIN class_students cs ON cs.student_id = st.id
           LEFT JOIN classes c ON c.id = cs.class_id
           ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
           ORDER BY d.code, c.name, st.roll_number`,
          values
        );

        return out(result.rows);
      }

      case "admin_get_department_marks_analytics": {
        await requireSession(pool, args.sessionToken, SESSION_SECRET, ["ADMIN"]);
        const values = [args.departmentCode.toUpperCase()];
        let semesterClause = "";
        if (args.semester) {
          values.push(Number(args.semester));
          semesterClause = `AND sem.sequence_number = $${values.length}`;
        }

        const result = await query(
          `SELECT d.code AS department,
                  sem.sequence_number AS semester,
                  ROUND(AVG((m.marks_obtained / a.max_marks) * 100)::numeric, 2) AS avg_percentage,
                  COUNT(*) AS mark_entries
           FROM marks m
           JOIN assessments a ON a.id = m.assessment_id
           JOIN subjects sub ON sub.id = a.subject_id
           JOIN semesters sem ON sem.id = sub.semester_id
           JOIN programs p ON p.id = sem.program_id
           JOIN departments d ON d.id = p.department_id
           WHERE d.code = $1 ${semesterClause}
           GROUP BY d.code, sem.sequence_number
           ORDER BY sem.sequence_number`,
          values
        );

        return out(result.rows);
      }

      case "admin_get_student_marks": {
        await requireSession(pool, args.sessionToken, SESSION_SECRET, ["ADMIN"]);
        const values = [args.studentId];
        let semesterClause = "";
        if (args.semester) {
          values.push(Number(args.semester));
          semesterClause = `AND sem.sequence_number = $${values.length}`;
        }

        const result = await query(
          `SELECT st.id AS student_id, st.name AS student_name, st.roll_number,
                  sem.sequence_number AS semester, sub.code AS subject_code,
                  sub.name AS subject_name, a.name AS assessment_name,
                  a.max_marks, m.marks_obtained,
                  ROUND(((m.marks_obtained / a.max_marks) * 100)::numeric, 2) AS percentage
           FROM marks m
           JOIN assessments a ON a.id = m.assessment_id
           JOIN subjects sub ON sub.id = a.subject_id
           JOIN semesters sem ON sem.id = sub.semester_id
           JOIN students st ON st.id = m.student_id
           WHERE st.id = $1 ${semesterClause}
           ORDER BY sem.sequence_number, sub.code, a.name`,
          values
        );

        return out(result.rows);
      }

      case "admin_get_class_timetable": {
        await requireSession(pool, args.sessionToken, SESSION_SECRET, ["ADMIN"]);

        let classId = args.classId;
        if (!classId && args.className) {
          const c = await query("SELECT id FROM classes WHERE UPPER(name) = UPPER($1)", [args.className]);
          classId = c.rowCount ? c.rows[0].id : null;
        }
        if (!classId) {
          throw new Error("Provide classId or valid className.");
        }

        return out(await getClassTimetableRows(classId));
      }

      case "admin_get_faculty_timetable": {
        await requireSession(pool, args.sessionToken, SESSION_SECRET, ["ADMIN"]);
        const result = await query(
          `SELECT d.name AS day_name, p.period_number, c.name AS class_name,
                  s.code AS subject_code, s.name AS subject_name
           FROM class_timetable ct
           JOIN days_of_week d ON d.id = ct.day_id
           JOIN periods p ON p.id = ct.period_id
           JOIN classes c ON c.id = ct.class_id
           JOIN subjects s ON s.id = ct.subject_id
           WHERE ct.faculty_id = $1
           ORDER BY d.id, p.period_number`,
          [args.facultyId]
        );
        return out(result.rows);
      }

      case "admin_get_free_faculty": {
        await requireSession(pool, args.sessionToken, SESSION_SECRET, ["ADMIN"]);
        const result = await query(
          `SELECT f.id, f.name, dep.code AS department
           FROM faculty f
           JOIN departments dep ON dep.id = f.department_id
           WHERE NOT EXISTS (
             SELECT 1
             FROM class_timetable ct
             JOIN days_of_week d ON d.id = ct.day_id
             JOIN periods p ON p.id = ct.period_id
             WHERE ct.faculty_id = f.id
               AND UPPER(d.name) = UPPER($1)
               AND p.period_number = $2
           )
           ORDER BY dep.code, f.name`,
          [args.dayName, args.periodNumber]
        );
        return out(result.rows);
      }

      case "admin_design_new_timetable": {
        await requireSession(pool, args.sessionToken, SESSION_SECRET, ["ADMIN"]);

        const assignmentResult = await query(
          `SELECT fsa.subject_id, fsa.faculty_id, s.code AS subject_code, s.name AS subject_name, f.name AS faculty_name
           FROM faculty_subject_assignments fsa
           JOIN subjects s ON s.id = fsa.subject_id
           JOIN faculty f ON f.id = fsa.faculty_id
           WHERE fsa.class_id = $1
           ORDER BY s.id`,
          [args.classId]
        );

        if (!assignmentResult.rowCount) {
          throw new Error("No faculty-subject assignments found for class.");
        }

        const weekdays = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];
        const proposal = [];
        const assignments = assignmentResult.rows;
        let idx = 0;

        for (const dayName of weekdays) {
          for (let periodNumber = 1; periodNumber <= 6; periodNumber += 1) {
            const pick = assignments[idx % assignments.length];
            proposal.push({
              dayName,
              periodNumber,
              subjectId: pick.subject_id,
              subjectCode: pick.subject_code,
              subjectName: pick.subject_name,
              facultyId: pick.faculty_id,
              facultyName: pick.faculty_name
            });
            idx += 1;
          }
        }

        return out({
          note: "Generated from current faculty-subject assignments. Use admin_apply_timetable to save if accepted.",
          promptUsed: args.prompt,
          classId: args.classId,
          entries: proposal
        });
      }

      case "admin_apply_timetable": {
        const admin = await requireSession(pool, args.sessionToken, SESSION_SECRET, ["ADMIN"]);

        for (const entry of args.entries) {
          await query(
            `INSERT INTO class_timetable (class_id, day_id, period_id, subject_id, faculty_id)
             VALUES (
               $1,
               (SELECT id FROM days_of_week WHERE UPPER(name) = UPPER($2)),
               (SELECT id FROM periods WHERE period_number = $3),
               $4,
               $5
             )
             ON CONFLICT (class_id, day_id, period_id)
             DO UPDATE SET subject_id = EXCLUDED.subject_id, faculty_id = EXCLUDED.faculty_id`,
            [args.classId, entry.dayName, entry.periodNumber, entry.subjectId, entry.facultyId]
          );
        }

        await query(
          `INSERT INTO audit_logs (user_id, action, details)
           VALUES ($1, 'UPDATE_TIMETABLE', $2)`,
          [admin.id, JSON.stringify({ classId: args.classId, count: args.entries.length })]
        );

        return out({ success: true, updatedRows: args.entries.length });
      }

      case "admin_assign_class_teacher": {
        await requireSession(pool, args.sessionToken, SESSION_SECRET, ["ADMIN"]);

        await query(
          `UPDATE classes SET class_teacher_id = $1 WHERE id = $2`,
          [args.facultyId, args.classId]
        );
        return out({ success: true });
      }

      case "admin_query_executor": {
        const admin = await requireSession(pool, args.sessionToken, SESSION_SECRET, ["ADMIN"]);
        validateReadOnlySql(args.sql);
        try {
          const result = await query(args.sql);
          await query(
            `INSERT INTO admin_queries (admin_id, query_text, success)
             VALUES ($1, $2, TRUE)`,
            [admin.id, args.sql]
          );
          return out(result.rows);
        } catch (err) {
          await query(
            `INSERT INTO admin_queries (admin_id, query_text, success, error_message)
             VALUES ($1, $2, FALSE, $3)`,
            [admin.id, args.sql, err.message]
          );
          throw err;
        }
      }

      case "faculty_get_assigned_subjects": {
        const user = await requireSession(pool, args.sessionToken, SESSION_SECRET, ["FACULTY"]);
        const facultyId = await getFacultyIdByUserId(user.id);

        const result = await query(
          `SELECT fsa.class_id, c.name AS class_name, s.id AS subject_id, s.code AS subject_code, s.name AS subject_name
           FROM faculty_subject_assignments fsa
           JOIN classes c ON c.id = fsa.class_id
           JOIN subjects s ON s.id = fsa.subject_id
           WHERE fsa.faculty_id = $1
           ORDER BY c.name, s.code`,
          [facultyId]
        );

        return out(result.rows);
      }

      case "faculty_get_department_details": {
        const user = await requireSession(pool, args.sessionToken, SESSION_SECRET, ["FACULTY"]);
        const result = await query(
          `SELECT d.id, d.name, d.code,
                  COUNT(DISTINCT f.id) AS faculty_count,
                  COUNT(DISTINCT st.id) AS student_count,
                  COUNT(DISTINCT c.id) AS class_count
           FROM faculty fac
           JOIN departments d ON d.id = fac.department_id
           LEFT JOIN faculty f ON f.department_id = d.id
           LEFT JOIN programs p ON p.department_id = d.id
           LEFT JOIN students st ON st.program_id = p.id
           LEFT JOIN semesters sem ON sem.program_id = p.id
           LEFT JOIN classes c ON c.semester_id = sem.id
           WHERE fac.user_id = $1
           GROUP BY d.id, d.name, d.code`,
          [user.id]
        );
        return out(result.rows[0] || {});
      }

      case "faculty_get_class_students": {
        const user = await requireSession(pool, args.sessionToken, SESSION_SECRET, ["FACULTY"]);
        const facultyId = await getFacultyIdByUserId(user.id);
        const access = await query(
          `SELECT 1 FROM faculty_subject_assignments WHERE class_id = $1 AND faculty_id = $2 LIMIT 1`,
          [args.classId, facultyId]
        );
        if (!access.rowCount) {
          throw new Error("You are not assigned to this class.");
        }

        const result = await query(
          `SELECT st.id, st.roll_number, st.name, st.email
           FROM class_students cs
           JOIN students st ON st.id = cs.student_id
           WHERE cs.class_id = $1
           ORDER BY st.roll_number`,
          [args.classId]
        );
        return out(result.rows);
      }

      case "faculty_get_student_progress": {
        const user = await requireSession(pool, args.sessionToken, SESSION_SECRET, ["FACULTY"]);
        const facultyId = await getFacultyIdByUserId(user.id);

        const values = [args.studentId, facultyId];
        let semesterFilter = "";
        if (args.semester) {
          values.push(Number(args.semester));
          semesterFilter = `AND sem.sequence_number = $${values.length}`;
        }

        const result = await query(
          `SELECT sub.code AS subject_code, sub.name AS subject_name,
                  ROUND(AVG((m.marks_obtained / a.max_marks) * 100)::numeric, 2) AS average_percentage
           FROM marks m
           JOIN assessments a ON a.id = m.assessment_id
           JOIN subjects sub ON sub.id = a.subject_id
           JOIN semesters sem ON sem.id = sub.semester_id
           JOIN class_students cs ON cs.student_id = m.student_id
           JOIN faculty_subject_assignments fsa
             ON fsa.class_id = cs.class_id
            AND fsa.subject_id = sub.id
           WHERE m.student_id = $1
             AND fsa.faculty_id = $2
             ${semesterFilter}
           GROUP BY sub.code, sub.name
           ORDER BY sub.code`,
          values
        );

        return out(result.rows);
      }

      case "faculty_get_class_average": {
        const user = await requireSession(pool, args.sessionToken, SESSION_SECRET, ["FACULTY"]);
        const facultyId = await getFacultyIdByUserId(user.id);

        const check = await query(
          `SELECT 1 FROM faculty_subject_assignments WHERE class_id = $1 AND faculty_id = $2 LIMIT 1`,
          [args.classId, facultyId]
        );
        if (!check.rowCount) {
          throw new Error("You are not assigned to this class.");
        }

        const values = [args.classId];
        let semesterFilter = "";
        if (args.semester) {
          values.push(Number(args.semester));
          semesterFilter = `AND sem.sequence_number = $${values.length}`;
        }

        const result = await query(
          `SELECT ROUND(AVG((m.marks_obtained / a.max_marks) * 100)::numeric, 2) AS class_average_percentage
           FROM class_students cs
           JOIN marks m ON m.student_id = cs.student_id
           JOIN assessments a ON a.id = m.assessment_id
           JOIN subjects sub ON sub.id = a.subject_id
           JOIN semesters sem ON sem.id = sub.semester_id
           WHERE cs.class_id = $1 ${semesterFilter}`,
          values
        );

        return out(result.rows[0] || { class_average_percentage: null });
      }

      case "faculty_get_my_timetable": {
        const user = await requireSession(pool, args.sessionToken, SESSION_SECRET, ["FACULTY"]);
        const facultyId = await getFacultyIdByUserId(user.id);

        const result = await query(
          `SELECT d.name AS day_name, p.period_number, c.name AS class_name,
                  s.code AS subject_code, s.name AS subject_name
           FROM class_timetable ct
           JOIN days_of_week d ON d.id = ct.day_id
           JOIN periods p ON p.id = ct.period_id
           JOIN classes c ON c.id = ct.class_id
           JOIN subjects s ON s.id = ct.subject_id
           WHERE ct.faculty_id = $1
           ORDER BY d.id, p.period_number`,
          [facultyId]
        );

        return out(result.rows);
      }

      case "faculty_get_class_timetable": {
        const user = await requireSession(pool, args.sessionToken, SESSION_SECRET, ["FACULTY"]);
        const facultyId = await getFacultyIdByUserId(user.id);
        const access = await query(
          `SELECT 1 FROM faculty_subject_assignments WHERE class_id = $1 AND faculty_id = $2 LIMIT 1`,
          [args.classId, facultyId]
        );
        if (!access.rowCount) {
          throw new Error("You are not assigned to this class.");
        }
        return out(await getClassTimetableRows(args.classId));
      }

      case "faculty_query_executor": {
        const user = await requireSession(pool, args.sessionToken, SESSION_SECRET, ["FACULTY"]);
        const facultyId = await getFacultyIdByUserId(user.id);

        validateReadOnlySql(args.sql);
        if (!args.sql.includes("{{faculty_id}}")) {
          throw new Error("For safety, query must include {{faculty_id}} placeholder.");
        }
        const sql = args.sql.replaceAll("{{faculty_id}}", String(facultyId));
        const result = await query(sql);
        return out(result.rows);
      }

      case "student_get_my_marks": {
        const user = await requireSession(pool, args.sessionToken, SESSION_SECRET, ["STUDENT"]);
        const studentId = await getStudentIdByUserId(user.id);

        const values = [studentId];
        let semesterFilter = "";
        if (args.semester) {
          values.push(Number(args.semester));
          semesterFilter = `AND sem.sequence_number = $${values.length}`;
        }

        const result = await query(
          `SELECT sem.sequence_number AS semester, sub.code AS subject_code,
                  sub.name AS subject_name,
                  ROUND(AVG((m.marks_obtained / a.max_marks) * 100)::numeric, 2) AS average_percentage
           FROM marks m
           JOIN assessments a ON a.id = m.assessment_id
           JOIN subjects sub ON sub.id = a.subject_id
           JOIN semesters sem ON sem.id = sub.semester_id
           WHERE m.student_id = $1 ${semesterFilter}
           GROUP BY sem.sequence_number, sub.code, sub.name
           ORDER BY sem.sequence_number, sub.code`,
          values
        );

        return out(result.rows);
      }

      case "student_get_my_timetable": {
        const user = await requireSession(pool, args.sessionToken, SESSION_SECRET, ["STUDENT"]);

        const values = [user.id];
        let semesterFilter = "";
        if (args.semester) {
          values.push(Number(args.semester));
          semesterFilter = `AND sem.sequence_number = $${values.length}`;
        }

        const classResult = await query(
          `SELECT c.id
           FROM students st
           JOIN class_students cs ON cs.student_id = st.id
           JOIN classes c ON c.id = cs.class_id
           JOIN semesters sem ON sem.id = c.semester_id
           WHERE st.user_id = $1 ${semesterFilter}
           ORDER BY sem.sequence_number DESC
           LIMIT 1`,
          values
        );

        if (!classResult.rowCount) {
          return out([]);
        }

        return out(await getClassTimetableRows(classResult.rows[0].id));
      }

      case "student_get_my_faculty": {
        const user = await requireSession(pool, args.sessionToken, SESSION_SECRET, ["STUDENT"]);

        const result = await query(
          `SELECT DISTINCT f.id, f.name, f.designation, sub.code AS subject_code, sub.name AS subject_name
           FROM students st
           JOIN class_students cs ON cs.student_id = st.id
           JOIN faculty_subject_assignments fsa ON fsa.class_id = cs.class_id
           JOIN faculty f ON f.id = fsa.faculty_id
           JOIN subjects sub ON sub.id = fsa.subject_id
           WHERE st.user_id = $1
           ORDER BY f.name, sub.code`,
          [user.id]
        );

        return out(result.rows);
      }

      case "student_get_my_average_marks": {
        const user = await requireSession(pool, args.sessionToken, SESSION_SECRET, ["STUDENT"]);
        const studentId = await getStudentIdByUserId(user.id);

        const values = [studentId];
        let semesterFilter = "";
        if (args.semester) {
          values.push(Number(args.semester));
          semesterFilter = `AND sem.sequence_number = $${values.length}`;
        }

        const result = await query(
          `SELECT ROUND(AVG((m.marks_obtained / a.max_marks) * 100)::numeric, 2) AS average_percentage
           FROM marks m
           JOIN assessments a ON a.id = m.assessment_id
           JOIN subjects sub ON sub.id = a.subject_id
           JOIN semesters sem ON sem.id = sub.semester_id
           WHERE m.student_id = $1 ${semesterFilter}`,
          values
        );

        return out(result.rows[0] || { average_percentage: null });
      }

      case "student_get_weak_subjects": {
        const user = await requireSession(pool, args.sessionToken, SESSION_SECRET, ["STUDENT"]);
        const studentId = await getStudentIdByUserId(user.id);

        const values = [studentId];
        let semesterFilter = "";
        if (args.semester) {
          values.push(Number(args.semester));
          semesterFilter = `AND sem.sequence_number = $${values.length}`;
        }

        const result = await query(
          `SELECT sem.sequence_number AS semester, sub.code AS subject_code, sub.name AS subject_name,
                  ROUND(AVG((m.marks_obtained / a.max_marks) * 100)::numeric, 2) AS average_percentage
           FROM marks m
           JOIN assessments a ON a.id = m.assessment_id
           JOIN subjects sub ON sub.id = a.subject_id
           JOIN semesters sem ON sem.id = sub.semester_id
           WHERE m.student_id = $1 ${semesterFilter}
           GROUP BY sem.sequence_number, sub.code, sub.name
           HAVING AVG((m.marks_obtained / a.max_marks) * 100) < 60
           ORDER BY sem.sequence_number, sub.code`,
          values
        );

        return out(result.rows);
      }

      case "student_get_class_analytics": {
        const user = await requireSession(pool, args.sessionToken, SESSION_SECRET, ["STUDENT"]);
        const values = [user.id];
        let semesterClause = "";
        if (args.semester) {
          values.push(Number(args.semester));
          semesterClause = `AND sem.sequence_number = $${values.length}`;
        }

        const result = await query(
          `WITH my_class AS (
             SELECT cs.class_id
             FROM students st
             JOIN class_students cs ON cs.student_id = st.id
             WHERE st.user_id = $1
             LIMIT 1
           )
           SELECT c.id AS class_id, c.name AS class_name,
                  ROUND(AVG((m.marks_obtained / a.max_marks) * 100)::numeric, 2) AS class_average_percentage,
                  ROUND(MAX((m.marks_obtained / a.max_marks) * 100)::numeric, 2) AS top_percentage
           FROM my_class mc
           JOIN classes c ON c.id = mc.class_id
           JOIN class_students cs ON cs.class_id = c.id
           JOIN marks m ON m.student_id = cs.student_id
           JOIN assessments a ON a.id = m.assessment_id
           JOIN subjects sub ON sub.id = a.subject_id
           JOIN semesters sem ON sem.id = sub.semester_id
           WHERE 1 = 1 ${semesterClause}
           GROUP BY c.id, c.name`,
          values
        );

        return out(result.rows[0] || {});
      }

      case "student_get_department_analytics": {
        const user = await requireSession(pool, args.sessionToken, SESSION_SECRET, ["STUDENT"]);
        const values = [user.id];
        let semesterClause = "";
        if (args.semester) {
          values.push(Number(args.semester));
          semesterClause = `AND sem.sequence_number = $${values.length}`;
        }

        const result = await query(
          `SELECT d.code AS department,
                  ROUND(AVG((m.marks_obtained / a.max_marks) * 100)::numeric, 2) AS department_average_percentage,
                  COUNT(*) AS mark_entries
           FROM students me
           JOIN programs my_program ON my_program.id = me.program_id
           JOIN departments d ON d.id = my_program.department_id
           JOIN programs p ON p.department_id = d.id
           JOIN students st ON st.program_id = p.id
           JOIN marks m ON m.student_id = st.id
           JOIN assessments a ON a.id = m.assessment_id
           JOIN subjects sub ON sub.id = a.subject_id
           JOIN semesters sem ON sem.id = sub.semester_id
           WHERE me.user_id = $1 ${semesterClause}
           GROUP BY d.code`,
          values
        );

        return out(result.rows[0] || {});
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err) {
    return out({ error: err.message });
  }
});

async function start() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
