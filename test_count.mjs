import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { count: c1 } = await supabase.from("meta_connections").select("*", { count: "exact", head: true });
  const { count: c2 } = await supabase.from("shops").select("*", { count: "exact", head: true }).not("facebook", "is", null);
  console.log("meta_connections count:", c1);
  console.log("shops with facebook count:", c2);
}
run();
