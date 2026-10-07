import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Copy, Eye, Package, Plus, ShoppingBag, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMyShop, useShopProducts } from "@/hooks/useMyShop";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  head: () => ({ meta: [{ title: "Tableau de bord — MarketNet" }, { name: "description", content: "Vue d'ensemble de votre boutique." }, { property: "og:title", content: "Tableau de bord — MarketNet" }, { property: "og:description", content: "Vue d'ensemble de votre boutique MarketNet." }] }),
  component: Overview,
});

function Overview() {
  const { data: shop } = useMyShop();
  const { data: products } = useShopProducts(shop?.id);
  const { data: orders } = useQuery({
    queryKey: ["orders", shop?.id],
    enabled: !!shop,
    queryFn: async () => (await supabase.from("orders").select("*").eq("shop_id", shop!.id).order("created_at", { ascending: false })).data ?? [],
  });
  if (!shop) return null;
  const url = typeof window !== "undefined" ? `${window.location.origin}/b/${shop.slug}` : `/b/${shop.slug}`;
  const stats = [
    { label: "Vues", value: shop.views, icon: Eye },
    { label: "Produits", value: products?.length ?? 0, icon: Package },
    { label: "Commandes", value: orders?.length ?? 0, icon: ShoppingBag },
    { label: "Nouvelles", value: orders?.filter((o) => o.status === "new").length ?? 0, icon: MessageCircle },
  ];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">Bonjour 👋</h1>
        <p className="text-muted-foreground">Voici l'activité de {shop.name}.</p>
      </div>
      <div className="rounded-2xl bg-gradient-warm p-5 text-primary-foreground shadow-lift">
        <p className="text-sm opacity-90">Lien de votre boutique</p>
        <p className="mt-1 break-all font-display text-lg font-bold">{url.replace(/^https?:\/\//, "")}</p>
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => { navigator.clipboard.writeText(url); toast.success("Lien copié"); }}><Copy />Copier</Button>
          <Button variant="secondary" size="sm" asChild><a href={`https://wa.me/?text=${encodeURIComponent(`Découvrez ma boutique ${shop.name} : ${url}`)}`} target="_blank" rel="noreferrer"><MessageCircle />Partager</a></Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border bg-card p-4">
            <s.icon className="h-5 w-5 text-primary" />
            <p className="mt-3 font-display text-3xl font-extrabold">{s.value}</p>
            <p className="text-sm text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>
      {products?.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed p-6 text-center">
          <p className="font-semibold">Ajoutez votre premier produit</p>
          <p className="mt-1 text-sm text-muted-foreground">Une boutique avec photos vend beaucoup mieux.</p>
          <Button asChild className="mt-4"><Link to="/dashboard/produits"><Plus />Ajouter un produit</Link></Button>
        </div>
      )}
    </div>
  );
}
