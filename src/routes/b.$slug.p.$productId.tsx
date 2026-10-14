import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Minus, Plus, ShoppingBag, Package } from "lucide-react";
import { toast } from "sonner";
import { publicShopQuery } from "@/lib/storefront.query";
import { useCart } from "@/components/store/cart";

import { Button } from "@/components/ui/button";
import { absoluteMediaUrl, formatPrice, mediaUrl, type Variant } from "@/lib/marketnet";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/b/$slug/p/$productId")({
  loader: async ({ context, params }) => {
    const d = await context.queryClient.ensureQueryData(publicShopQuery(params.slug));
    const product = d.products.find((p) => p.id === params.productId);
    if (!product) throw notFound();
    return { product, shop: d.shop, origin: d.origin };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Produit introuvable" }, { name: "robots", content: "noindex" }] };
    const { product, shop, origin } = loaderData;
    const title = `${product.name} — ${formatPrice(Number(product.price), product.currency)} | ${shop.name}`;
    const desc = product.description?.slice(0, 160) || `Commandez ${product.name} chez ${shop.name} sur WhatsApp.`;
    const productUrl = `${origin}/b/${shop.slug}/p/${product.id}`;
    // Image principale du produit comme couverture de partage
    const ogImage = absoluteMediaUrl(product.images[0], origin);
    const meta = [
      { title },
      { name: "description", content: desc },
      { property: "og:site_name", content: "MarketNet" },
      { property: "og:title", content: title },
      { property: "og:description", content: desc },
      { property: "og:type", content: "product" },
      { property: "og:url", content: productUrl },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: desc },
    ];
    if (ogImage) {
      meta.push(
        { property: "og:image", content: ogImage },
        { property: "og:image:alt", content: product.name },
        { name: "twitter:image", content: ogImage },
      );
    }
    return { meta };
  },
  notFoundComponent: () => <p className="py-20 text-center">Produit introuvable.</p>,
  component: ProductPage,
});

function ProductPage() {
  const { slug, productId } = Route.useParams();
  const { data } = useSuspenseQuery(publicShopQuery(slug));
  const product = data.products.find((p) => p.id === productId)!;
  const variants = (product.variants as Variant[]) ?? [];
  const [idx, setIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [choice, setChoice] = useState<Record<string, string>>({});
  const { add, setOpen } = useCart();
  const out = product.status === "out_of_stock";
  const imgs = product.images.length ? product.images : [];

  const isDiscounted = (product as any).discounted_price != null && (product as any).discounted_price < Number(product.price);
  const effectivePrice = isDiscounted ? (product as any).discounted_price : Number(product.price);

  function addToCart() {
    const missing = variants.find((v) => !choice[v.name]);
    if (missing) return toast.error(`Choisissez : ${missing.name}`);
    add({
      productId: product.id,
      name: product.name,
      price: effectivePrice,
      currency: product.currency,
      image: product.images[0],
      variant: variants.map((v) => `${v.name}: ${choice[v.name]}`).join(", ") || undefined,
      promo_id: (product as any).promo_id,
      original_price: Number(product.price),
    }, qty);
    toast.success("Ajouté au panier", { action: { label: "Voir", onClick: () => setOpen(true) } });
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pt-4">
      <Link to="/b/$slug" params={{ slug }} className="inline-flex h-10 items-center gap-1 text-sm text-shop-muted"><ArrowLeft className="h-4 w-4" />Retour</Link>
      <div className="mt-2 grid gap-6 md:grid-cols-2">
        <div>
          <div className="aspect-square overflow-hidden rounded-shop bg-shop-card relative">
            {imgs[idx] ? <img src={mediaUrl(imgs[idx])!} alt={product.name} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center"><Package className="h-16 w-16 opacity-30 text-shop-muted" /></div>}
            {(product as any).discount_badge && (
              <span className="absolute left-3 top-3 rounded-full bg-red-600 px-3 py-1 text-xs font-black text-white shadow-md">
                {(product as any).discount_badge}
              </span>
            )}
          </div>
          {imgs.length > 1 && (
            <div className="mt-2 flex gap-2 overflow-x-auto">
              {imgs.map((im, i) => <button key={im} onClick={() => setIdx(i)} className={cn("h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2", i === idx ? "border-shop" : "border-transparent")}><img src={mediaUrl(im)!} alt="" loading="lazy" className="h-full w-full object-cover" /></button>)}
            </div>
          )}
        </div>
        <div>
          <h1 className="font-shop-heading text-2xl font-extrabold sm:text-3xl">{product.name}</h1>
          <div className="mt-2 flex items-baseline gap-3">
            {isDiscounted && (
              <span className="text-lg text-shop-muted line-through">
                {formatPrice(Number(product.price), product.currency)}
              </span>
            )}
            <span className={cn("text-2xl font-bold text-shop", isDiscounted && "text-red-600 dark:text-red-400 font-black")}>
              {formatPrice(effectivePrice, product.currency)}
            </span>
            {(product as any).promo_ends_at && (
              <span className="text-xs text-shop-muted">
                Offre jusqu'au {new Date((product as any).promo_ends_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
              </span>
            )}
          </div>
          {out && <p className="mt-2 inline-block rounded-full bg-shop-fg/10 px-3 py-1 text-sm font-semibold">Rupture de stock</p>}
          {product.description && <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-shop-muted">{product.description}</p>}
          {variants.map((v) => (
            <div key={v.name} className="mt-5">
              <p className="text-sm font-semibold">{v.name}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {v.options.map((o) => <button key={o} onClick={() => setChoice((c) => ({ ...c, [v.name]: o }))} className={cn("h-10 min-w-12 rounded-shop border px-3 text-sm font-medium", choice[v.name] === o ? "border-shop bg-shop text-shop-foreground" : "border-current/20")}>{o}</button>)}
              </div>
            </div>
          ))}
          {!out && (
            <div className="mt-6 flex gap-3">
              <div className="flex items-center rounded-shop border border-current/20">
                <button className="grid h-12 w-12 place-items-center" aria-label="Moins" onClick={() => setQty((q) => Math.max(1, q - 1))}><Minus className="h-4 w-4" /></button>
                <span className="w-8 text-center font-semibold">{qty}</span>
                <button className="grid h-12 w-12 place-items-center" aria-label="Plus" onClick={() => setQty((q) => Math.min(99, q + 1))}><Plus className="h-4 w-4" /></button>
              </div>
              <Button variant="shop" size="lg" className="h-12 flex-1" onClick={addToCart}><ShoppingBag />Ajouter au panier</Button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
