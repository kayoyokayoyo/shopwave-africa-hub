import { useEffect, useState } from "react";
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
  ends_at: string | null;
};

/** One promotion rendered with the shop theme tokens only (bg-shop, shop-fg, rounded-shop, font-shop-heading). */
export function PromoSlide({ promo, currency, onCta, className }: { promo: SlidePromo; currency: string; onCta?: () => void; className?: string }) {
  const t = promo.template as PromoTemplate;
  const img = mediaUrl(promo.image_url);
  const disc = discountLabel(promo.discount_type, promo.discount_value, currency);
  const cta = (
    <button type="button" onClick={onCta} className="inline-flex h-11 min-w-[44px] items-center rounded-shop bg-shop px-5 text-sm font-bold text-shop-foreground shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
      {promo.button_label}
    </button>
  );
  const text = (onPanel: boolean) => (
    <>
      <h2 className={cn("font-shop-heading text-2xl font-extrabold leading-tight sm:text-3xl line-clamp-2", onPanel && "text-shop-fg")}>{promo.title}</h2>
      {promo.description && <p className="mt-1.5 line-clamp-2 text-sm opacity-85 sm:text-base">{promo.description}</p>}
    </>
  );
  const base = cn("relative h-60 w-full overflow-hidden sm:h-72", className);

  if (t === "fullscreen") {
    return (
      <div className={base}>
        {img && <img src={img} alt="" className="absolute inset-0 h-full w-full object-cover" />}
        <div className="absolute inset-x-3 bottom-3 rounded-shop bg-shop-card/92 p-4 text-shop-fg shadow-lg backdrop-blur sm:inset-x-auto sm:left-6 sm:max-w-md">
          {disc && <span className="mb-1 inline-block rounded-shop bg-shop px-2 py-0.5 text-xs font-extrabold text-shop-foreground">{disc}</span>}
          {text(true)}
          <div className="mt-3">{cta}</div>
        </div>
      </div>
    );
  }
  if (t === "split") {
    return (
      <div className={cn(base, "grid grid-cols-2 bg-shop-card text-shop-fg")}>
        <div className="flex flex-col justify-center p-4 sm:p-8">
          {disc && <span className="mb-2 w-fit rounded-shop bg-shop px-2 py-0.5 text-xs font-extrabold text-shop-foreground">{disc}</span>}
          {text(true)}
          <div className="mt-3">{cta}</div>
        </div>
        <div className="relative">{img && <img src={img} alt="" className="absolute inset-0 h-full w-full object-cover" />}</div>
      </div>
    );
  }
  if (t === "badge") {
    return (
      <div className={cn(base, "bg-shop text-shop-foreground")}>
        {img && <img src={img} alt="" className="absolute inset-y-0 right-0 h-full w-1/2 object-cover" style={{ maskImage: "linear-gradient(to right, transparent, black 40%)" }} />}
        <div className="relative flex h-full flex-col justify-center gap-2 p-5 sm:p-8 max-w-[65%]">
          <span className="grid h-24 w-24 place-items-center rounded-full bg-shop-card text-center font-shop-heading text-2xl font-black text-shop-fg shadow-lg sm:h-28 sm:w-28 sm:text-3xl">{disc ?? "Promo"}</span>
          {text(false)}
          <div><button type="button" onClick={onCta} className="inline-flex h-11 items-center rounded-shop bg-shop-card px-5 text-sm font-bold text-shop-fg shadow">{promo.button_label}</button></div>
        </div>
      </div>
    );
  }
  if (t === "countdown") {
    return (
      <div className={cn(base, "bg-shop-card text-shop-fg")}>
        {img && <img src={img} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />}
        <div className="relative flex h-full flex-col items-center justify-center gap-3 p-5 text-center">
          {disc && <span className="rounded-shop bg-shop px-2 py-0.5 text-xs font-extrabold text-shop-foreground">{disc}</span>}
          {text(true)}
          <Countdown end={promo.ends_at} />
          {cta}
        </div>
      </div>
    );
  }
  // minimal
  return (
    <div className={cn(base, "flex items-center gap-4 border-y border-current/10 bg-shop-bg p-5 text-shop-fg sm:p-8")}>
      <div className="min-w-0 flex-1">
        {disc && <p className="font-shop-heading text-4xl font-black text-shop">{disc}</p>}
        {text(true)}
        <div className="mt-3">{cta}</div>
      </div>
      {img && <img src={img} alt="" className="h-28 w-28 shrink-0 rounded-shop object-cover sm:h-40 sm:w-40" />}
    </div>
  );
}

function Countdown({ end }: { end: string | null }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);
  if (!end) return <p className="text-sm opacity-75">Offre limitée</p>;
  const ms = Math.max(0, new Date(end).getTime() - (now ?? Date.now()));
  const parts = [Math.floor(ms / 86400000), Math.floor(ms / 3600000) % 24, Math.floor(ms / 60000) % 60, Math.floor(ms / 1000) % 60];
  const labels = ["j", "h", "min", "s"];
  return (
    <div className="flex gap-2" aria-label="Temps restant" suppressHydrationWarning>
      {parts.map((v, i) => (
        <div key={i} className="min-w-[52px] rounded-shop bg-shop px-2 py-1.5 text-shop-foreground">
          <p className="font-shop-heading text-xl font-black tabular-nums" suppressHydrationWarning>{now == null ? "--" : String(v).padStart(2, "0")}</p>
          <p className="text-[10px] font-semibold uppercase">{labels[i]}</p>
        </div>
      ))}
    </div>
  );
}
