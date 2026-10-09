import { Clock, MapPin, Facebook, Instagram, MessageCircle, Plus, Star } from "lucide-react";
import type { Shop, Product } from "@/hooks/useMyShop";
import { formatPrice, mediaUrl } from "@/lib/marketnet";
import { cn } from "@/lib/utils";

type ShopLike = Pick<Shop, "name" | "description" | "logo_url" | "banner_url" | "category" | "city" | "hours" | "whatsapp" | "facebook" | "instagram">;

export function StoreHeader({ shop, compact }: { shop: ShopLike; compact?: boolean }) {
  const banner = mediaUrl(shop.banner_url);
  const logo = mediaUrl(shop.logo_url);
  return (
    <header className="pb-3 sm:pb-4">
      <div
        className={cn("relative isolate w-full overflow-hidden", compact ? "h-24" : "h-32 sm:h-48")}
        style={banner ? undefined : {
          backgroundImage: "radial-gradient(ellipse at 78% 12%, color-mix(in srgb, var(--shop-primary) 52%, transparent), transparent 48%), radial-gradient(ellipse at 8% 100%, color-mix(in srgb, var(--shop-primary) 24%, transparent), transparent 42%), linear-gradient(125deg, var(--shop-bg), color-mix(in srgb, var(--shop-bg) 78%, var(--shop-primary)))",
        }}
      >
        {banner && <>
          <img src={banner} alt={`Bannière de ${shop.name}`} className="absolute inset-0 h-full w-full object-cover" fetchPriority="high" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10" />
        </>}
        {!banner && <div aria-hidden="true" className="absolute -right-12 -top-24 h-64 w-64 rounded-full border border-shop/20 sm:h-80 sm:w-80" />}
      </div>
      <div className="mx-auto max-w-5xl px-4">
        <div className={cn("relative z-10 flex items-end justify-between", compact ? "-mt-8" : "-mt-10 sm:-mt-12")}>
          <div className={cn("grid shrink-0 place-items-center overflow-hidden rounded-shop border-4 border-shop-bg bg-shop-card font-shop-heading font-extrabold text-shop shadow-soft", compact ? "h-16 w-16 text-xl" : "h-20 w-20 text-2xl sm:h-24 sm:w-24 sm:text-3xl")}>
            {logo ? <img src={logo} alt={shop.name} className="h-full w-full object-cover" /> : shop.name.slice(0, 1)}
          </div>
          {!compact && shop.whatsapp.replace(/\D/g, "").length >= 8 && <a
            href={`https://wa.me/${shop.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(`Bonjour ${shop.name}, je vous contacte depuis votre boutique MarketNet.`)}`}
            target="_blank" rel="noreferrer"
            className="mb-1 inline-flex h-10 items-center gap-2 rounded-full bg-[#25D366] px-4 text-sm font-bold text-white shadow-soft transition hover:brightness-95 active:scale-[.98] sm:h-11 sm:px-5"
          ><MessageCircle className="h-4 w-4" />Contacter</a>}
        </div>
        <div className={cn("flex flex-wrap items-start justify-between gap-x-5 gap-y-2", compact ? "mt-2" : "mt-3")}>
          <div className="min-w-0 flex-1">
            {shop.category && !compact && <span className="mb-1.5 inline-flex rounded-full bg-shop/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-shop">{shop.category}</span>}
            <h1 className={cn("font-shop-heading font-extrabold tracking-tight", compact ? "text-lg" : "text-2xl sm:text-3xl")}>{shop.name}</h1>
            {shop.description && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-shop-muted">{shop.description}</p>}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-shop-muted">
          {shop.city && <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-shop" />{shop.city}</span>}
          {shop.hours && <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-shop" />{shop.hours}</span>}
          {shop.facebook && <a href={shop.facebook} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-shop"><Facebook className="h-3.5 w-3.5" />Facebook</a>}
          {shop.instagram && <a href={shop.instagram} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-shop"><Instagram className="h-3.5 w-3.5" />Instagram</a>}
        </div>
      </div>
    </header>
  );
}

export function ProductCard({ product, onAdd, href }: { product: Pick<Product, "name" | "price" | "currency" | "images" | "status" | "featured">; onAdd?: () => void; href?: React.ReactNode }) {
  const img = mediaUrl(product.images?.[0]);
  const out = product.status === "out_of_stock";
  return (
    <div className="group relative overflow-hidden rounded-shop bg-shop-card shadow-soft">
      <div className="relative aspect-square overflow-hidden bg-shop-bg">
        {img ? <img src={img} alt={product.name} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
          : <div className="grid h-full place-items-center text-3xl text-shop-muted">🛍️</div>}
        {product.featured && <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-shop px-2 py-0.5 text-[10px] font-bold text-shop-foreground"><Star className="h-3 w-3" />Top</span>}
        {out && <span className="absolute inset-x-0 bottom-0 bg-shop-fg/80 py-1 text-center text-xs font-semibold text-shop-bg">Rupture</span>}
      </div>
      <div className="p-3">
        <p className="line-clamp-2 text-sm font-medium leading-snug">{product.name}</p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="font-bold text-shop">{formatPrice(Number(product.price), product.currency)}</span>
          {onAdd && !out && (
            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAdd(); }} aria-label={`Ajouter ${product.name} au panier`}
              className="relative z-10 grid h-9 w-9 place-items-center rounded-full bg-shop text-shop-foreground active:scale-90">
              <Plus className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      {href}
    </div>
  );
}
