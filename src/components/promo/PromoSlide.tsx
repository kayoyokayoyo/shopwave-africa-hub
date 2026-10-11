import { useEffect, useState } from "react";
import { Clock, Package, Sparkles, Flame, ArrowRight, ShieldCheck, Zap } from "lucide-react";
import { mediaUrl } from "@/lib/marketnet";
import { discountLabel, type PromoTemplate } from "@/lib/promotions";
import { cn } from "@/lib/utils";

export type SlidePromo = {
  title: string;
  description: string | null;
  image_url: string | null;
  template: string;
  discount_type: string | null;
  discount_value: number | null;
  button_label: string;
  badge_label?: string | null;
  ends_at: string | null;
};

/** One promotion rendered with the shop theme tokens (bg-shop, text-shop-fg, rounded-shop, font-shop-heading). */
export function PromoSlide({ promo, currency, onCta, className }: { promo: SlidePromo; currency: string; onCta?: () => void; className?: string }) {
  const t = promo.template as PromoTemplate;
  const img = mediaUrl(promo.image_url);
  const disc = discountLabel(promo.discount_type, promo.discount_value, currency);

  const cta = (
    <button
      type="button"
      onClick={onCta}
      className="inline-flex h-9 sm:h-10 min-w-[40px] items-center justify-center gap-1.5 rounded-shop bg-shop px-4 sm:px-5 text-xs sm:text-sm font-extrabold text-shop-foreground shadow-sm transition-all duration-200 hover:opacity-95 hover:shadow-md active:scale-98 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <span>{promo.button_label}</span>
      <ArrowRight className="h-3.5 w-3.5 opacity-80" />
    </button>
  );

  const base = cn(
    "relative h-[190px] sm:h-[225px] md:h-[260px] w-full overflow-hidden rounded-shop transition-all duration-300 shadow-sm select-none",
    className
  );

  // 1. HERO IMMERSIF (Plein écran avec verre dépoli et vignette cinéma)
  if (t === "fullscreen") {
    return (
      <div className={cn(base, "group cursor-pointer")}>
        {img ? (
          <img
            src={img}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-shop via-shop/75 to-shop/40" />
        )}
        {/* Double dégradé pour lisibilité parfaite */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-black/20" />

        {/* Cartouche flottant en verre dépoli */}
        <div className="absolute left-2.5 bottom-2.5 right-14 sm:right-auto sm:left-4 sm:bottom-3.5 sm:max-w-md rounded-xl sm:rounded-2xl bg-shop-card/90 p-3 sm:p-4 text-shop-fg shadow-xl backdrop-blur-xl border border-white/25 transition-all duration-300 group-hover:translate-y-[-2px]">
          <div className="flex items-center gap-1.5 mb-1.5">
            {disc ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-shop px-2.5 py-0.5 text-[11px] font-black text-shop-foreground shadow-xs tracking-wider uppercase">
                <Sparkles className="h-2.5 w-2.5" />
                {disc}
              </span>
            ) : promo.badge_label ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-shop px-2.5 py-0.5 text-[11px] font-black text-shop-foreground shadow-xs tracking-wider uppercase">
                <Sparkles className="h-2.5 w-2.5" />
                {promo.badge_label}
              </span>
            ) : null}
            {promo.ends_at && (
              <span className="text-[10px] sm:text-xs text-shop-fg/75 font-semibold flex items-center gap-1 bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded-lg">
                <Clock className="h-3 w-3 opacity-70" />
                <span>Jusqu'au {new Date(promo.ends_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
              </span>
            )}
          </div>
          <div className="space-y-0.5">
            <h2 className="font-shop-heading text-sm sm:text-lg font-black leading-tight line-clamp-1 sm:line-clamp-2 text-shop-fg tracking-tight">
              {promo.title}
            </h2>
            {promo.description && (
              <p className="line-clamp-1 text-xs leading-normal opacity-85 text-shop-fg font-medium">
                {promo.description}
              </p>
            )}
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            {cta}
          </div>
        </div>
      </div>
    );
  }

  // 2. DUO SHOWCASE (Split asymétrique avec cadre produit stylisé)
  if (t === "split") {
    return (
      <div className={cn(base, "group cursor-pointer grid grid-cols-[1.15fr_0.85fr] sm:grid-cols-[1.2fr_0.8fr] bg-gradient-to-br from-shop-card via-shop-card/95 to-muted/20 text-shop-fg border border-current/10 shadow-sm")}>
        <div className="flex flex-col justify-center p-3.5 sm:p-5 relative z-10 min-w-0">
          <div className="flex items-center gap-1.5 mb-1.5">
            {disc && (
              <span className="w-fit rounded-full bg-shop px-2.5 py-0.5 text-[11px] font-black text-shop-foreground shadow-xs tracking-wide">
                {disc}
              </span>
            )}
            {(promo.badge_label || !disc) && (
              <span className="text-[10px] uppercase font-bold tracking-wider text-shop-fg/60 hidden sm:inline-block">
                {promo.badge_label || "Sélection vedette"}
              </span>
            )}
          </div>
          <div className="space-y-0.5">
            <h2 className="font-shop-heading text-sm sm:text-xl font-black leading-tight line-clamp-2 text-shop-fg tracking-tight">
              {promo.title}
            </h2>
            {promo.description && (
              <p className="hidden sm:line-clamp-2 text-xs leading-relaxed opacity-85 text-shop-fg font-medium">
                {promo.description}
              </p>
            )}
          </div>
          <div className="mt-2.5 sm:mt-3 flex items-center gap-2">{cta}</div>
        </div>

        <div className="relative h-full overflow-hidden bg-muted/30 p-2 sm:p-3 flex items-center justify-center">
          <div className="relative h-full w-full overflow-hidden rounded-xl shadow-md border border-black/5 dark:border-white/10">
            {img ? (
              <img
                src={img}
                alt=""
                className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-108"
              />
            ) : (
              <div className="grid h-full place-items-center bg-shop/10">
                <Package className="h-8 w-8 sm:h-12 sm:w-12 text-shop/60" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent pointer-events-none" />
          </div>
        </div>
      </div>
    );
  }

  // 3. FLASH IMPACT (Badge promotionnel en relief avec dégradé vibrant)
  if (t === "badge") {
    return (
      <div className={cn(base, "group cursor-pointer bg-gradient-to-r from-shop via-shop/95 to-shop/85 text-shop-foreground relative overflow-hidden shadow-inner")}>
        {/* Cercles d'ambiance lumineuse */}
        <div className="absolute -top-12 -left-12 h-36 w-36 rounded-full bg-white/15 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 right-1/4 h-36 w-36 rounded-full bg-black/20 blur-2xl pointer-events-none" />

        {img && (
          <img
            src={img}
            alt=""
            className="absolute inset-y-0 right-0 h-full w-3/5 sm:w-1/2 object-cover opacity-85 transition-transform duration-700 ease-out group-hover:scale-105"
            style={{ maskImage: "linear-gradient(to right, transparent 0%, black 35%)" }}
          />
        )}
        <div className="relative z-10 flex h-full flex-col justify-center gap-2 p-3.5 sm:p-5 max-w-[82%] sm:max-w-[62%]">
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 min-w-10 sm:h-12 sm:min-w-12 px-2 place-items-center rounded-xl bg-shop-card text-center font-shop-heading text-xs sm:text-sm font-black text-shop shadow-xl ring-2 ring-white/30 border border-white/20">
              {disc ?? "OFFRE"}
            </span>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider font-extrabold opacity-95 flex items-center gap-1">
                <Zap className="h-3 w-3" /> {promo.badge_label || "Flash Réduction"}
              </span>
              {promo.ends_at && (
                <span className="text-[9px] sm:text-[10px] opacity-80 flex items-center gap-1 font-semibold">
                  <Clock className="h-2.5 w-2.5" /> Fin {new Date(promo.ends_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                </span>
              )}
            </div>
          </div>
          <div className="space-y-0.5">
            <h2 className="font-shop-heading text-sm sm:text-xl font-black leading-tight line-clamp-2 tracking-tight">
              {promo.title}
            </h2>
            {promo.description && (
              <p className="line-clamp-1 text-xs leading-normal opacity-85 text-shop-foreground/90 font-medium">
                {promo.description}
              </p>
            )}
          </div>
          <div className="pt-0.5">
            <button
              type="button"
              onClick={onCta}
              className="inline-flex h-8 sm:h-9 items-center justify-center gap-1.5 rounded-shop bg-shop-card px-3.5 sm:px-5 text-xs font-bold text-shop shadow-md hover:shadow-xl hover:scale-102 active:scale-98 transition-all duration-200"
            >
              <span>{promo.button_label}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. CHRONO URGENCE (Vente flash avec compteur temps dynamique)
  if (t === "countdown") {
    return (
      <div className={cn(base, "group cursor-pointer bg-gradient-to-br from-shop-card via-shop-card/95 to-black/5 dark:to-white/5 text-shop-fg border border-current/15 relative overflow-hidden")}>
        {img && (
          <img
            src={img}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-15 filter blur-xs transition-transform duration-700 ease-out group-hover:scale-105"
          />
        )}
        <div className="absolute inset-0 bg-radial from-transparent via-transparent to-black/15 pointer-events-none" />

        <div className="relative z-10 flex h-full flex-col items-center justify-center gap-1.5 sm:gap-2 p-3 sm:p-5 text-center max-w-xl mx-auto">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 border border-red-500/30 px-2.5 py-0.5 text-[10px] sm:text-[11px] font-black text-red-600 dark:text-red-400 uppercase tracking-wider animate-pulse">
              <Flame className="h-3 w-3" /> {promo.badge_label || "Vente flash"}
            </span>
            {disc && (
              <span className="rounded-full bg-shop px-2.5 py-0.5 text-[11px] font-black text-shop-foreground shadow-xs">
                {disc}
              </span>
            )}
          </div>

          <div className="space-y-0.5">
            <h2 className="font-shop-heading text-sm sm:text-lg font-black leading-tight line-clamp-1 sm:line-clamp-2 text-shop-fg tracking-tight">
              {promo.title}
            </h2>
            {promo.description && (
              <p className="hidden sm:line-clamp-1 text-xs leading-relaxed opacity-85 text-shop-fg font-medium">
                {promo.description}
              </p>
            )}
          </div>

          <div className="py-0.5">
            <Countdown end={promo.ends_at} />
          </div>

          <div>{cta}</div>
        </div>
      </div>
    );
  }

  // 5. STUDIO ÉLÉGANCE (Minimaliste chic avec typographie éditoriale)
  return (
    <div className={cn(base, "group cursor-pointer flex items-center justify-between gap-3 sm:gap-6 border border-current/10 bg-gradient-to-r from-shop-card via-shop-card/90 to-shop-card/60 backdrop-blur-md p-3.5 sm:p-5 shadow-sm")}>
      <div className="min-w-0 flex-1 space-y-1 sm:space-y-1.5">
        <div className="flex items-center gap-2">
          {disc && (
            <span className="font-shop-heading text-xl sm:text-3xl font-black text-shop tracking-tight">
              {disc}
            </span>
          )}
          <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/80 px-2 py-0.5 rounded-md bg-muted/60">
            {promo.badge_label || "Édition spéciale"}
          </span>
        </div>

        <div className="space-y-0.5">
          <h2 className="font-shop-heading text-sm sm:text-lg font-black leading-tight line-clamp-2 text-shop-fg tracking-tight">
            {promo.title}
          </h2>
          {promo.description && (
            <p className="hidden sm:line-clamp-2 text-xs leading-relaxed opacity-85 text-shop-fg font-medium">
              {promo.description}
            </p>
          )}
        </div>
        <div className="pt-1">{cta}</div>
      </div>

      {img && (
        <div className="h-24 w-24 sm:h-30 sm:w-30 md:h-36 md:w-36 shrink-0 overflow-hidden rounded-2xl shadow-lg border border-black/5 dark:border-white/15 relative group">
          <img
            src={img}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-108"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
        </div>
      )}
    </div>
  );
}

function Countdown({ end }: { end: string | null }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  if (!end) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-lg bg-black/5 dark:bg-white/5 px-3 py-1 text-xs font-semibold opacity-80">
        <Clock className="h-3.5 w-3.5" />
        <span>Offre à durée limitée</span>
      </div>
    );
  }

  const ms = Math.max(0, new Date(end).getTime() - (now ?? Date.now()));
  const parts = [
    Math.floor(ms / 86400000),
    Math.floor(ms / 3600000) % 24,
    Math.floor(ms / 60000) % 60,
    Math.floor(ms / 1000) % 60,
  ];
  const labels = ["j", "h", "min", "s"];

  return (
    <div className="flex gap-1.5 sm:gap-2 items-center" aria-label="Temps restant" suppressHydrationWarning>
      {parts.map((v, i) => (
        <div
          key={i}
          className="min-w-[42px] sm:min-w-[48px] rounded-xl bg-shop/95 px-1.5 py-1 text-shop-foreground text-center shadow-sm border border-white/20"
        >
          <p className="font-shop-heading text-sm sm:text-base font-black tabular-nums tracking-tight" suppressHydrationWarning>
            {now == null ? "--" : String(v).padStart(2, "0")}
          </p>
          <p className="text-[9px] font-bold uppercase tracking-wider opacity-85">{labels[i]}</p>
        </div>
      ))}
    </div>
  );
}
