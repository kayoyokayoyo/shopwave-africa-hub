import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, Eye, Package, Plus, ShoppingBag, MessageCircle, ArrowRight, TrendingUp, Star, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMyShop, useShopProducts } from "@/hooks/useMyShop";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  head: () => ({ meta: [{ title: "Tableau de bord — MarketNet" }, { name: "description", content: "Vue d ensemble de votre boutique." }] }),
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
  const [userName, setUserName] = useState("");
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserName(data.user?.user_metadata?.full_name || "");
    });
  }, []);

  if (!shop) return null;
  const url = typeof window !== "undefined" ? `${window.location.origin}/b/${shop.slug}` : `/b/${shop.slug}`;
  
  const hour = new Date().getHours();
  let greeting = "Bonjour";
  if (hour >= 18 || hour < 5) greeting = "Bonsoir";
  else if (hour >= 12 && hour < 18) greeting = "Bon apres-midi";

  const newOrders = orders?.filter((o) => o.status === "new").length ?? 0;

  const stats = [
    { label: "Vues totales", value: shop.views, icon: Eye, color: "text-blue-600", bg: "bg-blue-500/10", border: "border-blue-500/20", link: null },
    { label: "Produits", value: products?.length ?? 0, icon: Package, color: "text-purple-600", bg: "bg-purple-500/10", border: "border-purple-500/20", link: "/dashboard/produits" },
    { label: "Commandes", value: orders?.length ?? 0, icon: ShoppingBag, color: "text-orange-600", bg: "bg-orange-500/10", border: "border-orange-500/20", link: "/dashboard/commandes" },
    { label: "Nouvelles cmd", value: newOrders, icon: MessageCircle, color: "text-emerald-600", bg: "bg-emerald-500/10", border: "border-emerald-500/20", link: "/dashboard/commandes" },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {greeting}{userName ? `, ${userName.split(" ")[0]}` : ""} 👋
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Voici l activite de <strong className="text-foreground">{shop.name}</strong>.</p>
        </div>
        <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border bg-card px-4 py-2 text-sm font-semibold shadow-sm hover:shadow-md transition-shadow">
          <ExternalLink className="h-4 w-4 text-primary" /> Voir ma boutique
        </a>
      </div>

      {/* Shop Link Card */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-primary to-orange-400 p-6 text-primary-foreground shadow-lg">
        <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full" />
        <div className="absolute -bottom-4 -left-4 w-20 h-20 bg-white/5 rounded-full" />
        <p className="text-xs uppercase tracking-widest font-semibold opacity-80 mb-2">Lien de votre boutique</p>
        <p className="break-all font-bold text-base sm:text-lg leading-relaxed opacity-95">{url.replace(/^https?:\/\//, "")}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={() => { navigator.clipboard.writeText(url); toast.success("Lien copie !"); }}
            className="flex items-center gap-2 rounded-xl bg-white/20 hover:bg-white/30 transition-colors px-4 py-2 text-sm font-semibold backdrop-blur-sm"
          >
            <Copy className="h-4 w-4" /> Copier
          </button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`Decouvrez ma boutique ${shop.name} : ${url}`)}`}
            target="_blank" rel="noreferrer"
            className="flex items-center gap-2 rounded-xl bg-white/20 hover:bg-white/30 transition-colors px-4 py-2 text-sm font-semibold backdrop-blur-sm"
          >
            <MessageCircle className="h-4 w-4" /> Partager
          </a>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((s) => {
          const Icon = s.icon;
          const card = (
            <div className={`group rounded-2xl border bg-card p-4 sm:p-5 shadow-sm hover:shadow-md transition-all relative overflow-hidden ${s.link ? "cursor-pointer" : ""}`}>
              <div className={`absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-transparent to-${s.color.split('-')[1]}-500/10 rounded-bl-full -z-10`} />
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center border mb-3 ${s.bg} ${s.color} ${s.border}`}>
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-2xl sm:text-3xl font-black text-foreground">{s.value}</p>
              <p className="text-xs sm:text-sm font-medium text-muted-foreground mt-1">{s.label}</p>
              {s.link && <ArrowRight className="absolute bottom-4 right-4 h-4 w-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-1 transition-all" />}
            </div>
          );
          return s.link
            ? <Link key={s.label} to={s.link}>{card}</Link>
            : <div key={s.label}>{card}</div>;
        })}
      </div>

      {/* Nouvelle commande alert */}
      {newOrders > 0 && (
        <div className="flex items-center justify-between rounded-2xl bg-emerald-500/10 border border-emerald-500/20 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-sm">{newOrders}</div>
            <div>
              <p className="font-semibold text-sm">Nouvelle{newOrders > 1 ? "s" : ""} commande{newOrders > 1 ? "s" : ""} !</p>
              <p className="text-xs text-muted-foreground">Commandes en attente de traitement.</p>
            </div>
          </div>
          <Button asChild size="sm" className="rounded-xl">
            <Link to="/dashboard/commandes">Voir <ArrowRight className="ml-1 h-3 w-3" /></Link>
          </Button>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border bg-card p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="h-11 w-11 shrink-0 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-600">
            <Package className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Ajouter un produit</p>
            <p className="text-xs text-muted-foreground truncate">Une boutique avec photos vend mieux.</p>
          </div>
          <Button asChild size="sm" variant="outline" className="rounded-xl shrink-0">
            <Link to="/dashboard/produits"><Plus className="h-4 w-4" /></Link>
          </Button>
        </div>
        <div className="rounded-2xl border bg-card p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="h-11 w-11 shrink-0 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600">
            <Star className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Personnaliser ma boutique</p>
            <p className="text-xs text-muted-foreground truncate">Theme, couleurs, logo...</p>
          </div>
          <Button asChild size="sm" variant="outline" className="rounded-xl shrink-0">
            <Link to="/dashboard/boutique"><ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
      </div>

    </div>
  );
}
