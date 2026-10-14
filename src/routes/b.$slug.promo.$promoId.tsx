import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { publicShopQuery } from "@/lib/storefront.query";
import { StoreHeader, ProductCard } from "@/components/store/StoreParts";
import { PromoSlide } from "@/components/promo/PromoSlide";
import { useCart } from "@/components/store/cart";
import { absoluteMediaUrl, formatPrice, mediaUrl, type Variant } from "@/lib/marketnet";
import { Button } from "@/components/ui/button";
import { trackPromo } from "@/components/promo/PromoBanner";

export const Route = createFileRoute("/b/$slug/promo/$promoId")({
  loader: async ({ context, params }) => {
    const d = await context.queryClient.ensureQueryData(publicShopQuery(params.slug));
    const promo = (d.promos ?? []).find((p: any) => p.id === params.promoId) ?? null;
    return { shop: d.shop, promo, origin: d.origin };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Promotion — MarketNet" }] };
    const { shop, promo, origin } = loaderData;

    const promoTitle = promo?.title
      ? `${promo.title} — ${shop.name}`
      : `Promotion exclusive chez ${shop.name}`;
    const promoDesc = promo?.description?.slice(0, 160)
      || `Offre spéciale disponible sur la boutique ${shop.name}. Commandez maintenant sur WhatsApp.`;

    // Priorité image : image de la promo > bannière boutique > logo boutique
    const coverPath = promo?.image_url || shop.banner_url || shop.logo_url;
    const ogImage = absoluteMediaUrl(coverPath, origin);
    const promoUrl = `${origin}/b/${shop.slug}/promo/${promo?.id ?? ""}`;

    const meta: Record<string, string>[] = [
      { title: promoTitle },
      { name: "description", content: promoDesc },
      { property: "og:site_name", content: "MarketNet" },
      { property: "og:title", content: promoTitle },
      { property: "og:description", content: promoDesc },
      { property: "og:type", content: "website" },
      { property: "og:url", content: promoUrl },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: promoTitle },
      { name: "twitter:description", content: promoDesc },
    ];

    if (ogImage) {
      meta.push(
        { property: "og:image", content: ogImage },
        { property: "og:image:alt", content: promoTitle },
        { name: "twitter:image", content: ogImage },
      );
    }

    return { meta };
  },
  component: DedicatedPromoPage,
});


function DedicatedPromoPage() {
  const { slug, promoId } = Route.useParams();
  const { data } = useSuspenseQuery(publicShopQuery(slug));
  const { shop, products, promos } = data;
  const { add } = useCart();

  // Find promo in public promos
  const promo = (promos ?? []).find((p: any) => p.id === promoId);

  // Track page view
  useState(() => {
    trackPromo(promoId, "view");
  });

  const nowMs = Date.now();
  const isEnded = promo?.ends_at ? new Date(promo.ends_at).getTime() <= nowMs : false;

  // Filter linked products
  const linkedProducts = useMemo(() => {
    if (!promo) return [];
    const pIds = new Set(promo.product_ids || []);
    return products.filter((p) => pIds.has(p.id));
  }, [promo, products]);

  if (!promo && !isEnded) {
    return (
      <div className="min-h-screen">
        <StoreHeader shop={shop} />
        <div className="mx-auto max-w-xl px-4 py-16 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <AlertCircle className="h-7 w-7" />
          </div>
          <h1 className="font-shop-heading text-2xl font-bold">Cette offre n'est plus disponible</h1>
          <p className="text-sm text-shop-muted">La promotion recherchée a été désactivée ou est expirée.</p>
          <Button asChild variant="shop" className="rounded-xl">
            <Link to="/b/$slug" params={{ slug }}>Voir toute la boutique</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <StoreHeader shop={shop} />

      <div className="mx-auto max-w-5xl px-4 py-4 space-y-6">
        {/* Navigation retour boutique */}
        <div>
          <Link
            to="/b/$slug"
            params={{ slug }}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-shop-muted hover:text-shop-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Voir toute la boutique
          </Link>
        </div>

        {/* Expired alert if applicable */}
        {isEnded && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-center space-y-2">
            <p className="font-bold text-amber-700 dark:text-amber-400">Cette offre est terminée</p>
            <p className="text-xs text-muted-foreground">
              Les prix normaux s'appliquent désormais à ces articles.
            </p>
            <Button asChild size="sm" variant="outline" className="rounded-xl mt-2">
              <Link to="/b/$slug" params={{ slug }}>Retour au catalogue complet</Link>
            </Button>
          </div>
        )}

        {/* Promo Hero visual (using exact shop theme tokens and PromoSlide design) */}
        {promo && (
          <div className="overflow-hidden rounded-3xl border border-current/10 shadow-lg">
            <PromoSlide
              promo={promo}
              currency={shop.currency}
              onCta={() => {
                document.getElementById("promo-products")?.scrollIntoView({ behavior: "smooth" });
              }}
            />
          </div>
        )}

        {/* Linked products grid */}
        <section id="promo-products" className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-shop-heading text-xl font-extrabold sm:text-2xl">
                Articles inclus dans l'offre ({linkedProducts.length})
              </h2>
              <p className="text-xs text-shop-muted mt-0.5">
                Sélection exclusive de cette promotion.
              </p>
            </div>
          </div>

          {linkedProducts.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-shop-muted">
              Aucun produit spécifique associé. Contactez la boutique pour profiter de cette offre.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 sm:gap-4">
              {linkedProducts.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  onAdd={
                    (p.variants as Variant[]).length
                      ? undefined
                      : () =>
                          add({
                            productId: p.id,
                            name: p.name,
                            price: p.discounted_price ?? Number(p.price),
                            original_price: Number(p.price),
                            promo_id: p.promo_id,
                            currency: p.currency,
                            image: p.images[0],
                          })
                  }
                  href={
                    <Link
                      to="/b/$slug/p/$productId"
                      params={{ slug, productId: p.id }}
                      className="absolute inset-0"
                      aria-label={p.name}
                    />
                  }
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
