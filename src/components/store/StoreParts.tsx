import { Clock, MapPin, Facebook, Instagram, MessageCircle, Plus, Star, ShoppingBag } from "lucide-react";
import type { Shop, Product } from "@/hooks/useMyShop";
import { formatPrice, mediaUrl } from "@/lib/marketnet";
import { cn } from "@/lib/utils";

type ShopLike = Pick<Shop, "name" | "description" | "logo_url" | "banner_url" | "category" | "city" | "hours" | "whatsapp" | "facebook" | "instagram">;

export function StoreHeader({ shop, compact }: { shop: ShopLike; compact?: boolean }) {
  const banner = mediaUrl(shop.banner_url);
  const logo = mediaUrl(shop.logo_url);
  const hasWhatsapp = shop.whatsapp?.replace(/\D/g, "").length >= 8;

  return (
    <header className="pb-0">
      {/* Banner */}
      <div
        className={cn("relative isolate w-full overflow-hidden", compact ? "h-28" : "h-44 sm:h-60")}
        style={banner ? undefined : {
          backgroundImage: "radial-gradient(ellipse at 78% 12%, color-mix(in srgb, var(--shop-primary) 52%, transparent), transparent 48%), radial-gradient(ellipse at 8% 100%, color-mix(in srgb, var(--shop-primary) 24%, transparent), transparent 42%), linear-gradient(135deg, var(--shop-bg), color-mix(in srgb, var(--shop-bg) 75%, var(--shop-primary)))",
        }}
      >
        {banner && <>
          <img src={banner} alt={`Bannière de ${shop.name}`} className="absolute inset-0 h-full w-full object-cover" fetchPriority="high" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        </>}
        {!banner && <>
          <div aria-hidden="true" className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-shop/5 blur-3xl" />
          <div aria-hidden="true" className="absolute -left-8 bottom-0 h-48 w-48 rounded-full bg-shop/8 blur-2xl" />
        </>}
      </div>

      <div className="mx-auto max-w-5xl px-4">
        {/* Logo + actions row */}
        <div className={cn(
          "relative z-10 flex items-end justify-between gap-2",
          compact ? "-mt-8" : "-mt-10 sm:-mt-12"
        )}>
          {/* Logo */}
          <div
            className="grid shrink-0 place-items-center overflow-hidden rounded-2xl border-4 border-background bg-shop-card font-shop-heading font-extrabold text-shop shadow-2xl"
            style={{ width: compact ? 60 : 76, height: compact ? 60 : 76 }}
          >
            {logo
              ? <img src={logo} alt={shop.name} className="h-full w-full object-cover" />
              : <span className="select-none text-2xl">{shop.name.slice(0, 1)}</span>
            }
          </div>

          {/* Action buttons */}
          <div className="mb-1 flex shrink-0 items-center gap-1.5">
            {shop.instagram && (
              <a href={shop.instagram} target="_blank" rel="noreferrer"
                className="grid h-8 w-8 place-items-center rounded-full border border-current/10 bg-background/90 text-shop-muted backdrop-blur-sm transition-all hover:scale-105 hover:border-[#E1306C]/40 hover:text-[#E1306C] sm:h-9 sm:w-9">
                <Instagram className="h-3.5 w-3.5" />
              </a>
            )}
            {shop.facebook && (
              <a href={shop.facebook} target="_blank" rel="noreferrer"
                className="grid h-8 w-8 place-items-center rounded-full border border-current/10 bg-background/90 text-shop-muted backdrop-blur-sm transition-all hover:scale-105 hover:border-[#1877F2]/40 hover:text-[#1877F2] sm:h-9 sm:w-9">
                <Facebook className="h-3.5 w-3.5" />
              </a>
            )}
            {hasWhatsapp && (
              <a
                href={`https://wa.me/${shop.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(`Bonjour ${shop.name}, je vous contacte depuis votre boutique MarketNet.`)}`}
                target="_blank" rel="noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#25D366] px-3 text-xs font-bold text-white shadow-lg transition-all hover:brightness-95 hover:scale-105 active:scale-[.97] sm:h-10 sm:px-4 sm:text-sm"
              >
                <MessageCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>Contacter</span>
              </a>
            )}
          </div>
        </div>

        {/* Shop info */}
        <div className="mt-3">
          {shop.category && (
            <span className="inline-flex items-center rounded-full bg-shop/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-shop">
              {shop.category}
            </span>
          )}
          <h1 className={cn(
            "font-shop-heading font-extrabold tracking-tight",
            compact ? "mt-1 text-xl" : "mt-1.5 text-2xl sm:text-3xl"
          )}>
            {shop.name}
          </h1>
          {shop.description && (
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-shop-muted">{shop.description}</p>
          )}
        </div>

        {/* Meta: city + hours */}
        {(shop.city || shop.hours) && (
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
            {shop.city && (
              <span className="inline-flex items-center gap-1.5 text-xs text-shop-muted">
                <MapPin className="h-3.5 w-3.5 text-shop/70" />{shop.city}
              </span>
            )}
            {shop.hours && (
              <span className="inline-flex items-center gap-1.5 text-xs text-shop-muted">
                <Clock className="h-3.5 w-3.5 text-shop/70" />{shop.hours}
              </span>
            )}
          </div>
        )}

        <div className="mt-4 h-px bg-current/5" />
      </div>
    </header>
  );
}

export function ProductCard({ product, onAdd, href }: {
  product: Pick<Product, "name" | "price" | "currency" | "images" | "status" | "featured">;
  onAdd?: () => void;
  href?: React.ReactNode;
}) {
  const img = mediaUrl(product.images?.[0]);
  const out = product.status === "out_of_stock";
  return (
    <div className="group relative overflow-hidden rounded-2xl bg-shop-card shadow-soft transition-shadow hover:shadow-md">
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-shop-bg">
        {img
          ? <img src={img} alt={product.name} loading="lazy" decoding="async"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]" />
          : <div className="grid h-full place-items-center text-4xl opacity-40">🛍️</div>
        }
        {/* Overlays */}
        {product.featured && (
          <span className="absolute left-2 top-2 flex items-center gap-0.5 rounded-full bg-shop px-2 py-0.5 text-[10px] font-bold text-shop-foreground shadow">
            <Star className="h-2.5 w-2.5" />Top
          </span>
        )}
        {out && (
          <div className="absolute inset-0 flex items-end justify-center bg-black/30 pb-2">
            <span className="rounded-full bg-white/90 px-3 py-0.5 text-[11px] font-semibold text-gray-700">Rupture</span>
          </div>
        )}
        {/* Quick add hover overlay */}
        {onAdd && !out && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all duration-300 group-hover:bg-black/10">
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAdd(); }}
              aria-label={`Ajouter ${product.name} au panier`}
              className="scale-75 rounded-full bg-shop p-3 text-shop-foreground opacity-0 shadow-lg transition-all duration-300 group-hover:scale-100 group-hover:opacity-100 active:scale-95"
            >
              <ShoppingBag className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="line-clamp-2 text-[13px] font-medium leading-snug">{product.name}</p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-sm font-bold text-shop">{formatPrice(Number(product.price), product.currency)}</span>
          {onAdd && !out && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAdd(); }}
              aria-label={`Ajouter ${product.name} au panier`}
              className="relative z-10 grid h-8 w-8 place-items-center rounded-full bg-shop text-shop-foreground shadow transition-transform active:scale-90 sm:hidden"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      {href}
    </div>
  );
}
