import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const { pool } = await import("../db.js");
  const relativeSqlPath = process.argv[2];
  if (!relativeSqlPath) {
    throw new Error("Provide SQL file path. Example: node src/scripts/run-sql.js sql/schema.sql");
  }

  const absolutePath = path.resolve(__dirname, "../../", relativeSqlPath);
  const sql = fs.readFileSync(absolutePath, "utf8");
  await pool.query(sql);
  await pool.end();
  console.log(`Executed SQL: ${relativeSqlPath}`);
}

main().catch(async (err) => {
  const { pool } = await import("../db.js");
  console.error(err.message);
  try {
    await pool.end();
  } catch {
    // ignore
  }
  process.exit(1);
});
