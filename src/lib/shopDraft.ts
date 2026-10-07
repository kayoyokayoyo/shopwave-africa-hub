import type { Shop } from "@/hooks/useMyShop";
import { emptyDraft, type ShopDraft } from "@/components/dashboard/ShopFields";
import { SLUG_RE, WHATSAPP_RE } from "@/lib/marketnet";

export function draftFromShop(s: Shop): ShopDraft {
  const d = { ...emptyDraft };
  (Object.keys(d) as (keyof ShopDraft)[]).forEach((k) => {
    const v = s[k as keyof Shop];
    (d as Record<string, unknown>)[k] = v ?? (k === "logo_url" || k === "banner_url" ? null : "");
  });
  return d;
}

export function validateDraft(d: ShopDraft): string | null {
  if (d.name.trim().length < 2) return "Le nom de la boutique est trop court";
  if (!SLUG_RE.test(d.slug)) return "Lien invalide : 3 à 42 caractères, lettres minuscules, chiffres et tirets";
  if (!WHATSAPP_RE.test(d.whatsapp)) return "Numéro WhatsApp invalide (ex. +243812345678)";
  for (const k of ["facebook", "instagram", "tiktok"] as const) {
    if (d[k] && !/^https?:\/\//.test(d[k])) return `Le lien ${k} doit commencer par https://`;
  }
  return null;
}

export function draftToRow(d: ShopDraft) {
  const nul = (s: string) => (s.trim() ? s.trim() : null);
  return {
    name: d.name.trim(), slug: d.slug, description: nul(d.description), category: nul(d.category),
    logo_url: d.logo_url, banner_url: d.banner_url, city: nul(d.city), address: nul(d.address),
    whatsapp: d.whatsapp, hours: nul(d.hours), facebook: nul(d.facebook), instagram: nul(d.instagram),
    tiktok: nul(d.tiktok), theme: d.theme, primary_color: d.primary_color, currency: d.currency,
  };
}

export function friendlyDbError(msg: string) {
  if (msg.includes("shops_slug_key")) return "Ce lien est déjà pris, choisissez-en un autre";
  if (msg.includes("shops_owner_id_key")) return "Vous avez déjà une boutique";
  return msg;
}
