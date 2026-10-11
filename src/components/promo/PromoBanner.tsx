import { useCallback, useEffect, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { PromoSlide, type SlidePromo } from "./PromoSlide";
import { cn } from "@/lib/utils";

export type PublicPromo = SlidePromo & { id: string; product_ids: string[] };

export function trackPromo(promotionId: string, kind: "view" | "click" | "share" | "whatsapp" | "order") {
  supabase.from("promotion_events").insert({ promotion_id: promotionId, kind }).then(() => {});
}

export function PromoBanner({ promos, slug, currency, whatsapp }: { promos: PublicPromo[]; slug: string; currency: string; whatsapp: string }) {
  const [ref, api] = useEmblaCarousel({ loop: promos.length > 1 });
  const [idx, setIdx] = useState(0);
  const paused = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!api) return;
    const on = () => setIdx(api.selectedScrollSnap());
    api.on("select", on);
    const stop = () => { paused.current = true; };
    api.on("pointerDown", stop);
    return () => { api.off("select", on); api.off("pointerDown", stop); };
  }, [api]);

  useEffect(() => {
    if (!api || promos.length < 2) return;
    const i = setInterval(() => { if (!paused.current && !document.hidden) api.scrollNext(); }, 5000);
    return () => clearInterval(i);
  }, [api, promos.length]);

  // one view per promo per session
  useEffect(() => {
    const p = promos[idx];
    if (!p) return;
    const k = `mn-pv-${p.id}`;
    if (!sessionStorage.getItem(k)) { sessionStorage.setItem(k, "1"); trackPromo(p.id, "view"); }
  }, [idx, promos]);

  const open = useCallback((p: PublicPromo) => {
    trackPromo(p.id, "click");
    if (p.product_ids.length === 1) {
      navigate({ to: "/b/$slug/p/$productId", params: { slug, productId: p.product_ids[0]! } });
    } else if (p.product_ids.length === 0) {
      trackPromo(p.id, "whatsapp");
      const num = whatsapp.replace(/\D/g, "");
      window.open(`https://wa.me/${num}?text=${encodeURIComponent(`Bonjour, je suis intéressé(e) par votre offre « ${p.title} ».`)}`, "_blank", "noopener");
    } else {
      document.getElementById("produits")?.scrollIntoView({ behavior: "smooth" });
    }
  }, [navigate, slug, whatsapp]);

  return (
    <section aria-roledescription="carrousel" aria-label="Promotions" className="relative"
      onMouseEnter={() => { paused.current = true; }} onMouseLeave={() => { paused.current = false; }}>
      <div ref={ref} className="overflow-hidden">
        <div className="flex">
          {promos.map((p, i) => (
            <div key={p.id} className="min-w-0 shrink-0 grow-0 basis-full" aria-roledescription="diapositive" aria-label={`${i + 1} sur ${promos.length}`}>
              <PromoSlide promo={p} currency={currency} onCta={() => open(p)} />
            </div>
          ))}
        </div>
      </div>
      {promos.length > 1 && <>
        <button type="button" aria-label="Promotion précédente" onClick={() => { paused.current = true; api?.scrollPrev(); }}
          className="absolute left-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-shop-card/90 text-shop-fg shadow sm:grid"><ChevronLeft className="h-5 w-5" /></button>
        <button type="button" aria-label="Promotion suivante" onClick={() => { paused.current = true; api?.scrollNext(); }}
          className="absolute right-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-shop-card/90 text-shop-fg shadow sm:grid"><ChevronRight className="h-5 w-5" /></button>
        <div className="absolute right-3 top-3 flex gap-1.5 rounded-full bg-shop-card/85 px-2 py-1.5">
          {promos.map((p, i) => (
            <button key={p.id} type="button" aria-label={`Aller à la promotion ${i + 1}`} aria-current={i === idx}
              onClick={() => { paused.current = true; api?.scrollTo(i); }}
              className={cn("h-2 rounded-full transition-all", i === idx ? "w-5 bg-shop" : "w-2 bg-shop-fg/30")} />
          ))}
        </div>
      </>}
    </section>
  );
}
