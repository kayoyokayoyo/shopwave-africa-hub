import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { notFound } from "@tanstack/react-router";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

export const getPublicShop = createServerFn({ method: "GET" })
  .validator((d) => z.object({ slug: z.string().min(1).max(60) }).parse(d))
  .handler(async ({ data }) => {
    const sb = createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    const { data: shop } = await sb
      .from("shops")
      .select("id,name,slug,description,category,logo_url,banner_url,city,address,whatsapp,hours,facebook,instagram,tiktok,theme,primary_color,currency")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!shop) throw notFound();
    const [{ data: products }, { data: categories }] = await Promise.all([
      sb.from("products").select("id,name,description,price,currency,images,status,featured,variants,category_id,created_at").eq("shop_id", shop.id).order("featured", { ascending: false }).order("created_at", { ascending: false }),
      sb.from("product_categories").select("id,name,position").eq("shop_id", shop.id).order("position"),
    ]);
    let origin = "";
    try { origin = new URL(getRequest().url).origin; } catch { /* noop */ }
    return { shop, products: products ?? [], categories: categories ?? [], origin };
  });
