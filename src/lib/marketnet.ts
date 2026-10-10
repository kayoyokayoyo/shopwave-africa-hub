export const THEMES = [
  { id: "savane", name: "Savane", desc: "Chaleureux et arrondi", swatch: ["#FBF7F0", "#E8590C"] },
  { id: "minuit", name: "Minuit", desc: "Sombre et élégant", swatch: ["#1B1F2E", "#F59F00"] },
  { id: "boutique", name: "Boutique", desc: "Mode, serif raffiné", swatch: ["#F9F1F0", "#C2255C"] },
  { id: "marche", name: "Marché", desc: "Coloré et généreux", swatch: ["#F7F0D6", "#2F9E44"] },
  { id: "pur", name: "Pur", desc: "Minimal, angles nets", swatch: ["#FFFFFF", "#111111"] },
  { id: "oasis", name: "Oasis", desc: "Frais et lumineux", swatch: ["#EAF6F6", "#1971C2"] },
] as const;

export const SHOP_CATEGORIES = [
  "Mode & vêtements", "Beauté & cosmétiques", "Alimentation", "Électronique & téléphones",
  "Maison & décoration", "Restaurant & traiteur", "Artisanat", "Santé & pharmacie", "Services", "Autre",
];

export const PRESET_COLORS = ["#E8590C", "#C2255C", "#2F9E44", "#1971C2", "#F59F00", "#111111", "#7048E8", "#0CA678"];

export function formatPrice(n: number, currency: string) {
  if (currency === "MIXTE") return "Montant mixte";
  if (currency === "CDF") return `${Math.round(n).toLocaleString("fr-FR")} FC`;
  if (currency === "FCFA" || currency === "XOF" || currency === "XAF") return `${Math.round(n).toLocaleString("fr-FR")} FCFA`;
  if (currency === "EUR") return `${n.toLocaleString("fr-FR", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })} €`;
  if (currency === "USD") return `${n.toLocaleString("fr-FR", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })} $`;
  
  return `${n.toLocaleString("fr-FR", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })} ${currency}`;
}

export function slugify(s: string) {
  return s
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 42);
}

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,40}[a-z0-9]$/;
export const WHATSAPP_RE = /^\+[1-9][0-9]{7,14}$/;

export function mediaUrl(path?: string | null) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `/api/public/media/${path}`;
}

/** Pick readable foreground for a hex color */
export function contrastOn(hex: string) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 160 ? "#111111" : "#ffffff";
}

export function shopStyle(primary: string): React.CSSProperties {
  return { ["--shop-primary" as string]: primary, ["--shop-primary-foreground" as string]: contrastOn(primary) };
}

export type Variant = { name: string; options: string[] };
