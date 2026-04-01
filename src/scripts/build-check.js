import { execFileSync } from "child_process";

const files = [
  "src/server.js",
  "src/auth.js",
  "src/db.js",
  "src/scripts/run-sql.js",
  "src/scripts/test-supabase-client.js"
];

for (const file of files) {
  execFileSync(process.execPath, ["--check", file], { stdio: "inherit" });
}

console.log("Build check passed.");
