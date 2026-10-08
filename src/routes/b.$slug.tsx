import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { publicShopQuery } from "@/lib/storefront.query";
import { CartProvider, useCart } from "@/components/store/cart";
import { CartSheet } from "@/components/store/CartSheet";
import { mediaUrl, shopStyle } from "@/lib/marketnet";

export const Route = createFileRoute("/b/$slug")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(publicShopQuery(params.slug)),
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Boutique introuvable — MarketNet" }, { name: "robots", content: "noindex" }] };
    const { shop, origin } = loaderData;
    const title = `${shop.name} — Boutique en ligne`;
    const desc = shop.description?.slice(0, 160) || `Découvrez les produits de ${shop.name} et commandez directement sur WhatsApp.`;
    const img = shop.banner_url || shop.logo_url;
    const meta = [
      { title }, { name: "description", content: desc },
      { property: "og:title", content: title }, { property: "og:description", content: desc },
      { property: "og:type", content: "website" }, { property: "og:url", content: `${origin}/b/${shop.slug}` },
      { name: "twitter:card", content: "summary_large_image" },
    ];
    if (img && origin) meta.push({ property: "og:image", content: `${origin}${mediaUrl(img)}` }, { name: "twitter:image", content: `${origin}${mediaUrl(img)}` });
    return { meta };
  },
  component: ShopLayout,
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center px-4 text-center">
      <div><h1 className="text-3xl font-extrabold">Boutique introuvable</h1><p className="mt-2 text-muted-foreground">Ce lien n'existe pas ou la boutique est hors ligne.</p>
        <Link to="/" className="mt-6 inline-flex h-11 items-center rounded-xl bg-primary px-5 font-semibold text-primary-foreground">Découvrir MarketNet</Link></div>
    </div>
  ),
  errorComponent: () => <div className="grid min-h-screen place-items-center p-4 text-center text-muted-foreground">Impossible de charger la boutique. Vérifiez votre connexion.</div>,
});

function ShopLayout() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(publicShopQuery(slug));
  const { shop, origin } = data;
  useEffect(() => {
    const k = `mn-view-${slug}`;
    if (!sessionStorage.getItem(k)) { sessionStorage.setItem(k, "1"); supabase.rpc("increment_shop_view", { _slug: slug }); }
  }, [slug]);
  return (
    <CartProvider slug={slug}>
      <div className={`theme-${shop.theme} storefront min-h-screen pb-28`} style={shopStyle(shop.primary_color)}>
        <TopBar name={shop.name} logo={shop.logo_url} slug={slug} />
        <Outlet />
        <footer className="mt-16 px-4 text-center text-xs text-shop-muted">
          Boutique propulsée par <Link to="/" className="font-semibold underline">MarketNet</Link>
        </footer>
        <CartSheet shop={shop} origin={origin || (typeof window !== "undefined" ? window.location.origin : "")} />
      </div>
    </CartProvider>
  );
}

function TopBar({ name, logo, slug }: { name: string; logo: string | null; slug: string }) {
  const { items, setOpen } = useCart();
  const count = items.reduce((s, i) => s + i.qty, 0);
  return (
    <div className="sticky top-0 z-20 border-b border-current/10 bg-shop-bg/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link to="/b/$slug" params={{ slug }} className="flex items-center gap-2 font-shop-heading font-bold">
          {logo && <img src={mediaUrl(logo)!} alt="" className="h-8 w-8 rounded-full object-cover" />}{name}
        </Link>
        <button onClick={() => setOpen(true)} aria-label="Panier" className="relative grid h-11 w-11 place-items-center">
          <ShoppingBag className="h-5 w-5" />
          {count > 0 && <span className="absolute right-1 top-1 grid h-5 min-w-5 place-items-center rounded-full bg-shop px-1 text-[10px] font-bold text-shop-foreground">{count}</span>}
        </button>
      </div>
    </div>
  );
}
