# College MCP Server

Role-based MCP server for college management with a single MCP process (stdio transport), no separate REST/API server.

## Implemented

- MCP tools server with authentication + session token validation
- Role-based access for `ADMIN`, `FACULTY`, `STUDENT`
- Postgres schema for users, academics, timetable, marks, logs
- Seed data generator for realistic testing

## Tech Stack

- Node.js (ESM)
- `@modelcontextprotocol/sdk`
- PostgreSQL (`pg`)
- `@supabase/supabase-js`
- Prisma (optional ORM)
- Password hashing and auth checks with `bcryptjs`

## Database Connection

Use `.env` (copy from `.env.example`).

Recommended `.env` for MCP runtime + migrations:

```env
NEXT_PUBLIC_SUPABASE_URL=https://thexcigsybreknewmfxi.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your_publishable_key
DATABASE_URL=postgresql://postgres.thexcigsybreknewmfxi:YOUR_PASSWORD@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.thexcigsybreknewmfxi:YOUR_PASSWORD@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=false
SESSION_SECRET=replace-with-a-long-random-secret
SESSION_EXPIRY_HOURS=24
```

Notes:

- Password contains `@`, so in URL it is encoded as `%40`.
- `DATABASE_URL` is used by MCP runtime.
- `DIRECT_URL` is used automatically by migration/seed script.
- This pooled + direct setup avoids common IPv6/DNS issues from `db.<project-ref>.supabase.co`.
- This server runs only as MCP over stdio. No external HTTP service is created.

## Project Structure

- `src/server.js` - main MCP tools server
- `src/auth.js` - token generation/validation + login flow
- `src/db.js` - Postgres pool setup
- `src/scripts/run-sql.js` - SQL runner utility
- `sql/schema.sql` - complete schema
- `sql/seed.sql` - fake data for testing

## Setup

```bash
npm install
```

Create `.env` from `.env.example`, then run:

```bash
npm run db:migrate
npm run db:seed
npm run supabase:test
```

Start MCP server:

```bash
npm start
```

## Seed Data Coverage

Seed script inserts:

- 2 departments (`CSE`, `ECE`)
- 2 classes in each department (`4A`, `4B`) => 4 final-sem classes
- 20 students per class => 80 students total
- Semesters in strict sequence 1..8 (`1-1` to `4-2`)
- 5 theory subjects + 2 labs per semester
- Faculty records and subject assignments
- Class timetables for Monday-Friday, 6 periods/day
- Assessments and marks for final-semester subjects

Default login passwords in seed data:

- Admin users (`admin_hod`, `admin_principal`) -> `Admin@123`
- Faculty users (`fac_cse_01`, etc.) -> `Faculty@123`
- Student users (`std_cse_4a_01`, etc.) -> `Student@123`

## MCP Tools

### Authentication

- `auth_login`

### Admin

- `admin_get_all_departments`
- `admin_get_all_faculty`
- `admin_get_all_students`
- `admin_get_department_marks_analytics`
- `admin_get_student_marks`
- `admin_get_class_timetable`
- `admin_get_faculty_timetable`
- `admin_get_free_faculty`
- `admin_design_new_timetable`
- `admin_apply_timetable`
- `admin_assign_class_teacher`
- `admin_query_executor` (read-only)

### Faculty

- `faculty_get_assigned_subjects`
- `faculty_get_department_details`
- `faculty_get_class_students`
- `faculty_get_student_progress`
- `faculty_get_class_average`
- `faculty_get_my_timetable`
- `faculty_get_class_timetable`
- `faculty_query_executor` (read-only with `{{faculty_id}}` placeholder)

### Student

- `student_get_my_marks`
- `student_get_my_timetable`
- `student_get_my_faculty`
- `student_get_my_average_marks`
- `student_get_weak_subjects`
- `student_get_class_analytics`
- `student_get_department_analytics`

## Auth Behavior

- Every tool except `auth_login` requires `sessionToken`.
- If token is missing/invalid/expired, response returns login error (`Login again`).

## Build And Verify

```bash
npm run build
npm run db:migrate
npm run db:seed
npm run supabase:test
```

## Add To Claude MCP Settings (Windows)

Claude Desktop config path:

- `%APPDATA%\\Claude\\claude_desktop_config.json`

Use this JSON snippet under `mcpServers`:

```json
{
	"mcpServers": {
		"college-mcp-server": {
			"command": "node",
			"args": [
				"C:/Users/bhanu/Desktop/collegeMCPserver/src/server.js"
			],
			"env": {
				"NEXT_PUBLIC_SUPABASE_URL": "https://thexcigsybreknewmfxi.supabase.co",
				"NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY": "sb_publishable_lG2yMBbjvR7geotXccZh2w_EEesSRQ1",
				"DATABASE_URL": "postgresql://postgres.thexcigsybreknewmfxi:Teja%40449896@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true",
				"DIRECT_URL": "postgresql://postgres.thexcigsybreknewmfxi:Teja%40449896@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres",
				"DB_SSL": "true",
				"DB_SSL_REJECT_UNAUTHORIZED": "false",
				"SESSION_SECRET": "college-mcp-local-secret-2026",
				"SESSION_EXPIRY_HOURS": "24"
			}
		}
	}
}
```

Then restart Claude Desktop.

## Optional ORM

- Prisma schema is in `prisma/schema.prisma`
- Generate Prisma client:

```bash
npm run prisma:generate
```

## SSL Certificate Errors

If you face SSL certificate issues in another environment, keep:

- `DB_SSL=true`
- `DB_SSL_REJECT_UNAUTHORIZED=false`

This project already supports both flags in `src/db.js`.