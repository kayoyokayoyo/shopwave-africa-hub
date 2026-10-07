import { Clock, MapPin, Facebook, Instagram, Plus, Star } from "lucide-react";
import type { Shop, Product } from "@/hooks/useMyShop";
import { formatPrice, mediaUrl } from "@/lib/marketnet";
import { cn } from "@/lib/utils";

type ShopLike = Pick<Shop, "name" | "description" | "logo_url" | "banner_url" | "city" | "hours" | "facebook" | "instagram">;

export function StoreHeader({ shop, compact }: { shop: ShopLike; compact?: boolean }) {
  const banner = mediaUrl(shop.banner_url);
  const logo = mediaUrl(shop.logo_url);
  return (
    <header>
      <div className={cn("relative w-full overflow-hidden bg-shop", compact ? "h-28" : "h-40 sm:h-64")}>
        {banner && <img src={banner} alt="" className="h-full w-full object-cover" fetchPriority="high" />}
      </div>
      <div className="mx-auto max-w-5xl px-4">
        <div className="-mt-10 flex items-end gap-3">
          <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-shop border-4 border-shop-bg bg-shop-card text-2xl font-bold text-shop shadow-soft">
            {logo ? <img src={logo} alt={shop.name} className="h-full w-full object-cover" /> : shop.name.slice(0, 1)}
          </div>
        </div>
        <h1 className="mt-3 font-shop-heading text-2xl font-extrabold sm:text-3xl">{shop.name}</h1>
        {shop.description && <p className="mt-1 max-w-2xl text-sm text-shop-muted">{shop.description}</p>}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-shop-muted">
          {shop.city && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{shop.city}</span>}
          {shop.hours && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{shop.hours}</span>}
          {shop.facebook && <a href={shop.facebook} target="_blank" rel="noreferrer" className="flex items-center gap-1"><Facebook className="h-3.5 w-3.5" />Facebook</a>}
          {shop.instagram && <a href={shop.instagram} target="_blank" rel="noreferrer" className="flex items-center gap-1"><Instagram className="h-3.5 w-3.5" />Instagram</a>}
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
