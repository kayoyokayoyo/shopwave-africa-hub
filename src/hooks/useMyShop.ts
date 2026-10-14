import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Shop = Tables<"shops">;
export type Product = Tables<"products">;
export type Category = Tables<"product_categories">;
export type Order = Tables<"orders">;

export function useMyShop() {
  return useQuery({
    queryKey: ["myShop"],
    staleTime: 0,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data, error } = await supabase.from("shops").select("*").eq("owner_id", u.user.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useShopProducts(shopId?: string) {
  return useQuery({
    queryKey: ["products", shopId],
    enabled: !!shopId,
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").eq("shop_id", shopId!).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useShopCategories(shopId?: string) {
  return useQuery({
    queryKey: ["categories", shopId],
    enabled: !!shopId,
    queryFn: async () => {
      const { data, error } = await supabase.from("product_categories").select("*").eq("shop_id", shopId!).order("position");
      if (error) throw error;
      return data;
    },
  });
}

export function useShopPromotions(shopId?: string) {
  return useQuery({
    queryKey: ["shop-promotions-active", shopId],
    enabled: !!shopId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("promotions")
        .select(`
          id, title, description, badge_label, image_url, template, discount_type, discount_value, button_label, starts_at, ends_at, position,
          promotion_products!promotion_products_promotion_id_fkey (product_id)
        `)
        .eq("shop_id", shopId!)
        .eq("status", "published")
        .eq("is_hidden", false)
        .order("position", { ascending: true });
      if (error) throw error;

      const nowMs = Date.now();
      const valid = (data ?? []).filter((p) => {
        if (p.ends_at && new Date(p.ends_at).getTime() <= nowMs) return false;
        if (p.starts_at && new Date(p.starts_at).getTime() > nowMs) return false;
        return true;
      });

      return valid.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        badge_label: (p as any).badge_label,
        image_url: p.image_url,
        template: p.template,
        discount_type: p.discount_type,
        discount_value: p.discount_value,
        button_label: p.button_label,
        ends_at: p.ends_at,
        product_ids: (p.promotion_products ?? []).map((pp: any) => pp.product_id),
      }));
    },
  });
}

