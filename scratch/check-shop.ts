import { supabaseAdmin } from "../src/integrations/supabase/client.server";

async function main() {
  const shopId = "114a450c-554e-439b-a77b-0f2582300daf";
  const { data, error } = await supabaseAdmin
    .from("shops")
    .update({ plan_id: "pro" })
    .eq("id", shopId)
    .select();
  console.log("Update result data:", data);
  console.log("Update error:", error);
}

main().catch(console.error);
