import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const { Pool } = pg;

function parseBoolean(value, defaultValue) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }
  return String(value).toLowerCase() === "true";
}

function buildConnectionString() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT || "5432";
  const database = process.env.DB_NAME || "postgres";
  const user = process.env.DB_USER || "postgres";
  const password = process.env.DB_PASSWORD || "";

  if (!host) {
    throw new Error("DATABASE_URL or DB_HOST must be set");
  }

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

const shouldUseSsl = parseBoolean(process.env.DB_SSL, true);
const rejectUnauthorized = parseBoolean(process.env.DB_SSL_REJECT_UNAUTHORIZED, false);

export const pool = new Pool({
  connectionString: buildConnectionString(),
  ssl: shouldUseSsl ? { rejectUnauthorized } : false
});

export async function query(text, params = []) {
  return pool.query(text, params);
}
