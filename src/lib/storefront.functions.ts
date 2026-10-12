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
    const [{ data: products }, { data: categories }, { data: promos }] = await Promise.all([
      sb.from("products").select("id,name,description,price,currency,images,status,featured,variants,category_id,created_at").eq("shop_id", shop.id).order("featured", { ascending: false }).order("created_at", { ascending: false }),
      sb.from("product_categories").select("id,name,position").eq("shop_id", shop.id).order("position"),
      sb.from("promotions").select(`
        id, title, description, badge_label, image_url, template, discount_type, discount_value, button_label, starts_at, ends_at, position,
        promotion_products (product_id, position, discount_type, discount_value)
      `).eq("shop_id", shop.id).eq("status", "published").eq("is_hidden", false).order("position"),
    ]);

    // Format public promos filtering by validity dates
    const nowMs = Date.now();
    const validPromos = (promos ?? []).filter((p) => {
      if (p.ends_at && new Date(p.ends_at).getTime() <= nowMs) return false;
      if (p.starts_at && new Date(p.starts_at).getTime() > nowMs) return false;
      return true;
    });

    const publicPromos = validPromos.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      badge_label: p.badge_label,
      image_url: p.image_url,
      template: p.template,
      discount_type: p.discount_type,
      discount_value: p.discount_value,
      button_label: p.button_label,
      ends_at: p.ends_at,
      product_ids: (p.promotion_products ?? []).sort((a, b) => a.position - b.position).map((pp) => pp.product_id),
      products: (p.promotion_products ?? []).sort((a, b) => a.position - b.position),
    }));

    // Attach active discounts to each product (handling multiple promotions: best discount wins)
    const productsWithPromos = (products ?? []).map((prod) => {
      let bestDiscountedPrice = Number(prod.price);
      let bestDiscountBadge: string | null = null;
      let activePromoId: string | null = null;
      let promoEndDate: string | null = null;

      for (const p of validPromos) {
        const link = (p.promotion_products ?? []).find((pp) => pp.product_id === prod.id);
        if (link || (p.promotion_products ?? []).length === 0) {
          const discType = link?.discount_type || p.discount_type;
          const discVal = link?.discount_value != null ? link.discount_value : p.discount_value;
          if (discType && discVal) {
            let discPrice = Number(prod.price);
            if (discType === "percent") {
              discPrice = Math.max(0, Math.round(discPrice * (100 - Number(discVal))) / 100);
            } else if (discType === "amount") {
              discPrice = Math.max(0, discPrice - Number(discVal));
            }

            if (discPrice < bestDiscountedPrice) {
              bestDiscountedPrice = discPrice;
              bestDiscountBadge = discType === "percent" ? `-${Number(discVal)}%` : `-${Number(discVal)} ${prod.currency}`;
              activePromoId = p.id;
              promoEndDate = p.ends_at;
            }
          }
        }
      }

      return {
        ...prod,
        original_price: Number(prod.price),
        discounted_price: bestDiscountedPrice < Number(prod.price) ? bestDiscountedPrice : null,
        discount_badge: bestDiscountBadge,
        promo_id: activePromoId,
        promo_ends_at: promoEndDate,
      };
    });

    let origin = "";
    try { origin = new URL(getRequest().url).origin; } catch { /* noop */ }
    return { shop, products: productsWithPromos, categories: categories ?? [], promos: publicPromos, origin };
  });

export const recordShopVisit = createServerFn({ method: "POST" })
  .validator((d) => z.object({
    slug: z.string().min(1).max(60),
    src: z.string().nullable().optional(),
    productId: z.string().uuid().nullable().optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const admin = (await import("@/integrations/supabase/client.server")).supabaseAdmin;
    
    // 1. Incrémenter la vue générale de la boutique
    try {
      await admin.rpc("increment_shop_view", { _slug: data.slug });
    } catch (err) {
      console.error("Erreur increment_shop_view:", err);
    }

    // 2. Si la visite vient de facebook (?src=facebook), enregistrer le clic
    if (data.src === "facebook") {
      try {
        await admin.rpc("record_facebook_visit", {
          _shop_slug: data.slug,
          _product_id: data.productId ?? undefined,
        });
      } catch (err) {
        console.error("Erreur record_facebook_visit:", err);
      }
    }

    return { ok: true };
  });
