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
