import type { Tables } from "@/integrations/supabase/types";

export type Promotion = Tables<"promotions">;
export type PromotionProduct = Tables<"promotion_products">;
export type PromoTemplate = "fullscreen" | "split" | "badge" | "minimal" | "countdown";
export type DiscountType = "percent" | "amount";

export const PROMO_TEMPLATES: { id: PromoTemplate; name: string; desc: string }[] = [
  { id: "fullscreen", name: "Plein écran", desc: "Grande photo, texte par-dessus" },
  { id: "split", name: "Texte + image", desc: "Texte à gauche, image à droite" },
  { id: "badge", name: "Badge réduction", desc: "Gros badge « -25 % »" },
  { id: "minimal", name: "Minimal", desc: "Texte seul, image facultative" },
  { id: "countdown", name: "Compte à rebours", desc: "Temps restant avant la fin" },
];

export const PROMO_STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Brouillon", cls: "bg-muted text-muted-foreground" },
  published: { label: "Publiée", cls: "bg-primary/15 text-primary" },
  paused: { label: "En pause", cls: "bg-secondary text-secondary-foreground" },
};

export function applyDiscount(price: number, type: string | null | undefined, value: number | null | undefined) {
  if (!type || !value) return price;
  if (type === "percent") return Math.max(0, Math.round(price * (100 - value)) / 100);
  return Math.max(0, price - value);
}

export function discountLabel(type: string | null | undefined, value: number | null | undefined, currency?: string) {
  if (!type || !value) return null;
  if (type === "percent") return `-${Number(value)} %`;
  return `-${Number(value)}${currency === "CDF" ? " FC" : currency === "EUR" ? " €" : " $"}`;
}

/** Live state of a promotion for the merchant list. */
export function promoLiveState(p: Pick<Promotion, "status" | "starts_at" | "ends_at">, now = Date.now()) {
  if (p.status !== "published") return p.status;
  if (p.ends_at && new Date(p.ends_at).getTime() <= now) return "ended";
  if (p.starts_at && new Date(p.starts_at).getTime() > now) return "scheduled";
  return "active";
}

export function formatDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : null;
}
