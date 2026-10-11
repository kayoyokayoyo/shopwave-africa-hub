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
  const [ref, api] = useEmblaCarousel({
    loop: promos.length > 1,
    duration: 30,
    skipSnaps: false,
  });
  const [idx, setIdx] = useState(0);
  const userInteracted = useRef(false);
  const resumeTimer = useRef<NodeJS.Timeout | null>(null);
  const navigate = useNavigate();

  // Handle slide selection
  useEffect(() => {
    if (!api) return;
    const onSelect = () => setIdx(api.selectedScrollSnap());
    api.on("select", onSelect);

    const onPointerDown = () => {
      userInteracted.current = true;
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    };

    const onPointerUp = () => {
      // Reprendre automatiquement le défilement 3.5s après l'interaction
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
      resumeTimer.current = setTimeout(() => {
        userInteracted.current = false;
      }, 3500);
    };

    api.on("pointerDown", onPointerDown);
    api.on("pointerUp", onPointerUp);

    return () => {
      api.off("select", onSelect);
      api.off("pointerDown", onPointerDown);
      api.off("pointerUp", onPointerUp);
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    };
  }, [api]);

  // Défilement automatique fluide et constant
  useEffect(() => {
    if (!api || promos.length < 2) return;
    const interval = setInterval(() => {
      if (!userInteracted.current && !document.hidden) {
        api.scrollNext();
      }
    }, 4500);

    return () => clearInterval(interval);
  }, [api, promos.length]);

  // Track unique view per session
  useEffect(() => {
    const p = promos[idx];
    if (!p) return;
    const k = `mn-pv-${p.id}`;
    if (!sessionStorage.getItem(k)) {
      sessionStorage.setItem(k, "1");
      trackPromo(p.id, "view");
    }
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
      navigate({ to: "/b/$slug/promo/$promoId", params: { slug, promoId: p.id } });
    }
  }, [navigate, slug, whatsapp]);

  const handleManualAction = (action: () => void) => {
    userInteracted.current = true;
    action();
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => {
      userInteracted.current = false;
    }, 3500);
  };

  return (
    <section
      aria-roledescription="carrousel"
      aria-label="Offres promotionnelles"
      className="group relative w-full overflow-hidden rounded-shop shadow-sm"
      onMouseEnter={() => { userInteracted.current = true; }}
      onMouseLeave={() => { userInteracted.current = false; }}
    >
      {/* Conteneur Embla à hauteur unifiée compacte : 190px mobile / 225px tablette / 260px bureau */}
      <div ref={ref} className="h-[190px] sm:h-[225px] md:h-[260px] w-full overflow-hidden">
        <div className="flex h-full">
          {promos.map((p, i) => (
            <div
              key={p.id}
              className="h-full min-w-0 shrink-0 grow-0 basis-full"
              aria-roledescription="diapositive"
              aria-label={`${i + 1} sur ${promos.length}`}
            >
              <PromoSlide promo={p} currency={currency} onCta={() => open(p)} className="h-full" />
            </div>
          ))}
        </div>
      </div>

      {promos.length > 1 && (
        <>
          {/* Flèches de navigation (sur tablette/bureau) */}
          <button
            type="button"
            aria-label="Offre précédente"
            onClick={() => handleManualAction(() => api?.scrollPrev())}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-20 hidden sm:grid h-9 w-9 place-items-center rounded-full bg-shop-card/90 text-shop-fg shadow-lg border border-white/20 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-105 active:scale-95"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Offre suivante"
            onClick={() => handleManualAction(() => api?.scrollNext())}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-20 hidden sm:grid h-9 w-9 place-items-center rounded-full bg-shop-card/90 text-shop-fg shadow-lg border border-white/20 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-105 active:scale-95"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          {/* Indicateur de pagination fluide (points modernes discrets) */}
          <div className="absolute bottom-2.5 right-2.5 sm:bottom-3 sm:right-3.5 z-20 flex items-center gap-1.5 rounded-full bg-black/50 backdrop-blur-md px-2 py-1 border border-white/10 shadow-md">
            {promos.map((p, i) => (
              <button
                key={p.id}
                type="button"
                aria-label={`Aller à l'offre ${i + 1}`}
                aria-current={i === idx}
                onClick={() => handleManualAction(() => api?.scrollTo(i))}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === idx ? "w-4 bg-white shadow-xs" : "w-1.5 bg-white/40 hover:bg-white/70"
                )}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
