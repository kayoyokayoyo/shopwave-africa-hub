import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Home, Package, Palette, ShoppingBag, Share2, LogOut, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyShop } from "@/hooks/useMyShop";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardLayout,
});

const NAV = [
  { to: "/dashboard", label: "Accueil", icon: Home, exact: true },
  { to: "/dashboard/produits", label: "Produits", icon: Package },
  { to: "/dashboard/commandes", label: "Commandes", icon: ShoppingBag },
  { to: "/dashboard/boutique", label: "Boutique", icon: Palette },
  { to: "/dashboard/meta", label: "Réseaux", icon: Share2 },
] as const;

function DashboardLayout() {
  const { data: shop, isLoading } = useMyShop();
  const { data: isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const navigate = useNavigate();

  const { data: newOrdersCount } = useQuery({
    queryKey: ["newOrdersCount", shop?.id],
    enabled: !!shop?.id,
    queryFn: async () => {
      const { count } = await supabase.from("orders").select("*", { count: "exact", head: true }).eq("shop_id", shop!.id).eq("status", "new");
      return count || 0;
    },
    refetchInterval: 30000
  });

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("merchant-sidebar-collapsed") === "true";
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem("merchant-sidebar-collapsed", String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    if (isAdmin) navigate({ to: "/admin" });
    else if (!isAdminLoading && !isLoading && !shop) navigate({ to: "/onboarding" });
  }, [isAdmin, isAdminLoading, isLoading, shop, navigate]);

  if (isAdminLoading || isLoading || !shop || isAdmin) return <div className="grid min-h-screen place-items-center text-muted-foreground">Chargement…</div>;

  return (
    <div className="min-h-screen bg-background lg:flex">
      <aside className={cn("hidden shrink-0 border-r bg-sidebar lg:block transition-all duration-300", collapsed ? "w-[80px]" : "w-[260px]")}>
        <div className={cn("fixed inset-y-0 flex flex-col p-5 transition-all duration-300", collapsed ? "w-[80px]" : "w-[260px]")}>
          <div className={cn("flex items-center h-14", collapsed ? "justify-center" : "justify-between")}>
            {!collapsed && (
              <div className="flex items-center gap-3 min-w-0">
                {shop.logo_url
                  ? <img src={shop.logo_url} alt={shop.name} className="h-8 w-8 rounded-lg object-cover shrink-0" />
                  : <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0">{shop.name.charAt(0).toUpperCase()}</div>
                }
                <span className="font-bold text-sm truncate">{shop.name}</span>
              </div>
            )}
            {collapsed && <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">{shop.name.charAt(0).toUpperCase()}</div>}
            <button onClick={() => setCollapsed(!collapsed)} className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-md hover:bg-sidebar-accent text-muted-foreground", collapsed && "hidden sm:grid")}>
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>
          
          <nav className="mt-8 flex-1 space-y-1 overflow-y-auto">
            {NAV.map((n) => {
              const count = n.label === "Commandes" ? (newOrdersCount || 0) : 0;
              return (
              <Link 
                key={n.to} 
                to={n.to} 
                activeOptions={{ exact: "exact" in n }} 
                className={cn("group flex items-center rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-all hover:bg-sidebar-accent hover:text-sidebar-foreground", collapsed ? "justify-center" : "gap-3")}
                activeProps={{ className: "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary font-bold" }}
                title={collapsed ? n.label : undefined}
              >
                <div className="relative">
                  <n.icon className="h-5 w-5 shrink-0 transition-transform group-hover:scale-110" />
                  {count > 0 && <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white shadow-sm ring-1 ring-background">{count > 99 ? '99+' : count}</span>}
                </div>
                {!collapsed && <span>{n.label}</span>}
              </Link>
            )})}
          </nav>
          <button 
            onClick={() => supabase.auth.signOut().then(() => window.location.href = '/')} 
            className={cn("group flex shrink-0 items-center rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-all hover:bg-red-500/10 hover:text-red-500", collapsed ? "justify-center" : "gap-3")}
            title={collapsed ? "Déconnexion" : undefined}
          >
            <LogOut className="h-5 w-5 shrink-0 transition-transform group-hover:scale-110" />
            {!collapsed && <span>Déconnexion</span>}
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col min-w-0 pb-24 lg:pb-0">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-background/90 px-4 py-3 backdrop-blur lg:px-8">
          <div className="lg:hidden"><Logo /></div>
          <p className="hidden truncate font-semibold lg:block">{shop.name}</p>
          <div className="flex items-center gap-2">
            <a href={`/b/${encodeURIComponent(shop.slug)}`} aria-label="Voir ma boutique" title="Voir ma boutique" className="flex h-10 items-center gap-1.5 rounded-xl bg-secondary px-3 text-sm font-semibold">
              <ExternalLink className="h-4 w-4" /><span className="hidden sm:inline">Voir ma boutique</span>
            </a>
            <button onClick={() => supabase.auth.signOut()} aria-label="Déconnexion" className="grid h-10 w-10 place-items-center rounded-xl text-muted-foreground lg:hidden"><LogOut className="h-4 w-4" /></button>
          </div>
        </header>
        <main className="mx-auto max-w-7xl w-full px-4 py-6 lg:px-8"><Outlet /></main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-card pb-[env(safe-area-inset-bottom)] lg:hidden">
        {NAV.map((n) => {
          const count = n.label === "Commandes" ? (newOrdersCount || 0) : 0;
          return (
          <Link key={n.to} to={n.to} activeOptions={{ exact: "exact" in n }} className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground"
            activeProps={{ className: "text-primary" }}>
            <div className="relative">
              <n.icon className="h-5 w-5" />
              {count > 0 && <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white shadow-sm ring-1 ring-background">{count > 99 ? '99+' : count}</span>}
            </div>
            {n.label}
          </Link>
        )})}
      </nav>
    </div>
  );
}
