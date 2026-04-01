import { createSupabaseClient } from "../supabase-client.js";

async function main() {
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from("departments")
    .select("id,name,code")
    .limit(1);

  if (error) {
    throw new Error(`Supabase JS check failed: ${error.message}`);
  }

  console.log("Supabase JS client works. Sample row count:", data.length);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
