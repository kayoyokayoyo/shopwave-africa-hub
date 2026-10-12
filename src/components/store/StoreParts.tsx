import { Clock, MapPin, Facebook, Instagram, MessageCircle, Plus, Star, ShoppingBag, Package, BadgeCheck, Share2, Sparkles } from "lucide-react";
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
        className={cn("relative isolate w-full overflow-hidden", compact ? "h-32" : "h-44 sm:h-64")}
        style={banner ? undefined : {
          backgroundImage: "radial-gradient(ellipse at 78% 12%, color-mix(in srgb, var(--shop-primary) 52%, transparent), transparent 48%), radial-gradient(ellipse at 8% 100%, color-mix(in srgb, var(--shop-primary) 24%, transparent), transparent 42%), linear-gradient(135deg, var(--shop-bg), color-mix(in srgb, var(--shop-bg) 75%, var(--shop-primary)))",
        }}
      >
        {banner && (
          <>
            <img src={banner} alt={`Bannière de ${shop.name}`} className="absolute inset-0 h-full w-full object-cover" fetchPriority="high" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/10" />
          </>
        )}
        {!banner && (
          <>
            <div aria-hidden="true" className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-shop/10 blur-3xl" />
            <div aria-hidden="true" className="absolute -left-8 bottom-0 h-48 w-48 rounded-full bg-shop/15 blur-2xl" />
          </>
        )}
      </div>

      <div className="mx-auto max-w-5xl px-4">
        {/* Logo + Actions Row */}
        <div className={cn(
          "relative z-10 flex items-end justify-between gap-3",
          compact ? "-mt-10" : "-mt-12 sm:-mt-14"
        )}>
          {/* Logo en squircle avec ombre douce et fond contrasté */}
          <div className="relative group shrink-0">
            <div
              className={cn(
                "relative grid place-items-center overflow-hidden rounded-2xl border-4 border-background bg-card font-shop-heading font-extrabold text-shop shadow-xl ring-1 ring-black/5 transition-transform duration-200",
                compact ? "h-16 w-16" : "h-20 w-20 sm:h-24 sm:w-24"
              )}
            >
              {logo ? (
                <img src={logo} alt={shop.name} className="h-full w-full object-cover" />
              ) : (
                <span className="select-none text-2xl sm:text-3xl font-extrabold text-primary">{shop.name.slice(0, 1)}</span>
              )}
            </div>
            {/* Badge de boutique vérifiée / active */}
            <div
              className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-background p-0.5 shadow-md"
              title="Boutique vérifiée MarketNet"
            >
              <BadgeCheck className="h-5 w-5 text-emerald-500 fill-emerald-500/20" />
            </div>
          </div>

          {/* Boutons d'actions rapides (WhatsApp + Réseaux) */}
          <div className="mb-1 flex items-center gap-1.5 sm:gap-2">
            {shop.instagram && (
              <a
                href={shop.instagram}
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-xl border border-border/80 bg-background/95 text-foreground shadow-sm backdrop-blur transition-all hover:scale-105 hover:border-[#E1306C]/50 hover:text-[#E1306C]"
              >
                <Instagram className="h-4 w-4" />
              </a>
            )}
            {shop.facebook && (
              <a
                href={shop.facebook}
                target="_blank"
                rel="noreferrer"
                aria-label="Facebook"
                className="grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-xl border border-border/80 bg-background/95 text-foreground shadow-sm backdrop-blur transition-all hover:scale-105 hover:border-[#1877F2]/50 hover:text-[#1877F2]"
              >
                <Facebook className="h-4 w-4" />
              </a>
            )}
            {hasWhatsapp && (
              <a
                href={`https://wa.me/${shop.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(`Bonjour ${shop.name}, je vous contacte depuis votre boutique MarketNet.`)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 sm:h-10 items-center gap-1.5 sm:gap-2 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] px-3.5 sm:px-4 text-xs sm:text-sm font-bold text-white shadow-md shadow-emerald-600/20 transition-all hover:scale-105 active:scale-95"
              >
                <MessageCircle className="h-4 w-4" />
                <span>Contacter</span>
              </a>
            )}
          </div>
        </div>

        {/* Détails de la boutique */}
        <div className="mt-3.5 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            {shop.category && (
              <span className="inline-flex items-center rounded-lg bg-primary/10 text-primary px-2.5 py-0.5 text-[11px] font-bold tracking-wide uppercase">
                {shop.category}
              </span>
            )}
            {/* Statut ouvert */}
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 text-[11px] font-semibold">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Ouvert
            </span>
          </div>

          <h1 className={cn(
            "font-shop-heading font-extrabold tracking-tight text-foreground",
            compact ? "text-lg sm:text-xl" : "text-xl sm:text-2xl lg:text-3xl"
          )}>
            {shop.name}
          </h1>

          {shop.description && (
            <p className="max-w-2xl text-xs sm:text-sm leading-relaxed text-muted-foreground pt-0.5">
              {shop.description}
            </p>
          )}
        </div>

        {/* Méta-données (Localisation & Horaires) */}
        {(shop.city || shop.hours) && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            {shop.city && (
              <span className="inline-flex items-center gap-1.5 font-medium">
                <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                {shop.city}
              </span>
            )}
            {shop.hours && (
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="truncate max-w-[280px] sm:max-w-none">{shop.hours}</span>
              </span>
            )}
          </div>
        )}

        <div className="mt-4 h-px bg-border/60" />
      </div>
    </header>
  );
}

export function ProductCard({ product, onAdd, href }: {
  product: Pick<Product, "name" | "price" | "currency" | "images" | "status" | "featured"> & {
    original_price?: number;
    discounted_price?: number | null;
    discount_badge?: string | null;
  };
  onAdd?: () => void;
  href?: React.ReactNode;
}) {
  const img = mediaUrl(product.images?.[0]);
  const out = product.status === "out_of_stock";
  const isDiscounted = product.discounted_price != null && product.discounted_price < Number(product.price);
  const displayPrice = isDiscounted ? product.discounted_price! : Number(product.price);

  return (
    <div className="group relative overflow-hidden rounded-2xl bg-shop-card shadow-soft transition-shadow hover:shadow-md">
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-shop-bg">
        {img
          ? <img src={img} alt={product.name} loading="lazy" decoding="async"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]" />
          : <div className="grid h-full place-items-center text-muted-foreground/40"><Package className="h-10 w-10 opacity-40" /></div>
        }
        {/* Overlays */}
        {product.discount_badge && (
          <span className="absolute left-2 top-2 z-10 flex items-center rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-black text-white shadow-md animate-pulse">
            {product.discount_badge}
          </span>
        )}
        {product.featured && !product.discount_badge && (
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
          <div className="flex flex-col">
            {isDiscounted && (
              <span className="text-[11px] text-shop-muted line-through">
                {formatPrice(Number(product.price), product.currency)}
              </span>
            )}
            <span className={cn("text-sm font-bold text-shop", isDiscounted && "text-red-600 dark:text-red-400 font-extrabold")}>
              {formatPrice(displayPrice, product.currency)}
            </span>
          </div>
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
