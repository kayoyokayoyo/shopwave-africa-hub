import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import {
  Home,
  Package,
  Palette,
  ShoppingBag,
  Share2,
  LogOut,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Tag,
  MoreHorizontal,
  Settings,
  X,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyShop } from "@/hooks/useMyShop";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardLayout,
});

// Desktop Navigation (Promotions right after Produits)
const DESKTOP_NAV = [
  { to: "/dashboard", label: "Accueil", icon: Home, exact: true },
  { to: "/dashboard/produits", label: "Produits", icon: Package },
  { to: "/dashboard/promotions", label: "Promotions", icon: Tag },
  { to: "/dashboard/commandes", label: "Commandes", icon: ShoppingBag },
  { to: "/dashboard/boutique", label: "Boutique", icon: Palette },
  { to: "/dashboard/meta", label: "Réseaux", icon: Share2 },
] as const;

function DashboardLayout() {
  const { data: shop, isLoading } = useMyShop();
  const { data: isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const navigate = useNavigate();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  const [plusOpen, setPlusOpen] = useState(false);
  const plusTriggerRef = useRef<HTMLButtonElement>(null);

  const { data: newOrdersCount } = useQuery({
    queryKey: ["newOrdersCount", shop?.id],
    enabled: !!shop?.id,
    queryFn: async () => {
      const { count } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("shop_id", shop!.id)
        .eq("status", "new");
      return count || 0;
    },
    refetchInterval: 30000,
  });

  // Check shop completion and meta connection for notification dots
  const isShopIncomplete = !shop?.logo_url || !shop?.banner_url || !shop?.description;
  const isMetaDisconnected = !shop?.facebook && !shop?.instagram;
  const hasPlusBadge = isShopIncomplete || isMetaDisconnected;

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

  // Handle ESC key for Plus sheet
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && plusOpen) {
        setPlusOpen(false);
        plusTriggerRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [plusOpen]);

  if (isAdminLoading || isLoading || !shop || isAdmin) {
    return <div className="grid min-h-screen place-items-center text-muted-foreground">Chargement…</div>;
  }

  // Active status helpers for mobile nav
  const isHomeActive = currentPath === "/dashboard";
  const isProductsActive = currentPath.startsWith("/dashboard/produits");
  const isPromosActive = currentPath.startsWith("/dashboard/promotions");
  const isOrdersActive = currentPath.startsWith("/dashboard/commandes");
  const isPlusActive =
    currentPath.startsWith("/dashboard/boutique") ||
    currentPath.startsWith("/dashboard/meta") ||
    currentPath.startsWith("/dashboard/reglages");

  return (
    <div className="min-h-screen bg-background lg:flex">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden shrink-0 border-r bg-sidebar lg:block transition-all duration-300",
          collapsed ? "w-[80px]" : "w-[260px]"
        )}
      >
        <div
          className={cn(
            "fixed inset-y-0 flex flex-col p-5 transition-all duration-300",
            collapsed ? "w-[80px]" : "w-[260px]"
          )}
        >
          {/* En-tête de la sidebar avec logo et bouton collapse propre */}
          <div className={cn("relative flex items-center h-12 shrink-0", collapsed ? "justify-center" : "justify-between")}>
            {!collapsed ? (
              <div className="flex items-center gap-3 min-w-0 pr-2">
                {shop.logo_url ? (
                  <img src={shop.logo_url} alt={shop.name} className="h-8 w-8 rounded-xl object-cover shrink-0 shadow-xs" />
                ) : (
                  <div className="h-8 w-8 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-black text-sm shrink-0 shadow-xs">
                    {shop.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="font-extrabold text-sm truncate">{shop.name}</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCollapsed(false)}
                title="Agrandir le menu"
                className="group relative flex items-center justify-center"
              >
                {shop.logo_url ? (
                  <img src={shop.logo_url} alt={shop.name} className="h-9 w-9 rounded-xl object-cover shrink-0 shadow-xs transition-transform group-hover:scale-105" />
                ) : (
                  <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-black text-sm shrink-0 shadow-xs transition-transform group-hover:scale-105">
                    {shop.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="absolute -right-2 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-background border border-border shadow-xs text-muted-foreground group-hover:text-primary transition-colors">
                  <ChevronRight className="h-3 w-3" />
                </div>
              </button>
            )}

            {!collapsed && (
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                title="Réduire le menu"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg hover:bg-sidebar-accent text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
          </div>

          <nav className="mt-8 flex-1 space-y-1.5 overflow-y-auto">
            {DESKTOP_NAV.map((n) => {
              const count = n.label === "Commandes" ? newOrdersCount || 0 : 0;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  activeOptions={{ exact: "exact" in n }}
                  className={cn(
                    "group flex items-center rounded-2xl text-sm font-medium text-sidebar-foreground/70 transition-all hover:bg-sidebar-accent hover:text-sidebar-foreground",
                    collapsed ? "h-12 w-12 mx-auto justify-center" : "gap-3 px-3 py-2.5"
                  )}
                  activeProps={{ className: "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary font-bold shadow-xs" }}
                  title={collapsed ? n.label : undefined}
                >
                  <div className="relative flex items-center justify-center">
                    <n.icon className="h-5 w-5 shrink-0 transition-transform group-hover:scale-110" />
                    {count > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white shadow-sm ring-2 ring-sidebar">
                        {count > 99 ? "99+" : count}
                      </span>
                    )}
                  </div>
                  {!collapsed && <span>{n.label}</span>}
                </Link>
              );
            })}
          </nav>

          <div className="space-y-1.5 pt-4 border-t border-sidebar-border">
            <Link
              to="/dashboard/reglages"
              className={cn(
                "group flex shrink-0 items-center rounded-2xl text-sm text-sidebar-foreground/70 transition-all hover:bg-sidebar-accent hover:text-sidebar-foreground",
                collapsed ? "h-12 w-12 mx-auto justify-center" : "gap-3 px-3 py-2.5"
              )}
              activeProps={{ className: "bg-primary/10 text-primary font-bold shadow-xs" }}
              title={collapsed ? "Réglages" : undefined}
            >
              <Settings className="h-5 w-5 shrink-0 transition-transform group-hover:scale-110" />
              {!collapsed && <span>Réglages</span>}
            </Link>

            <button
              onClick={() => supabase.auth.signOut().then(() => (window.location.href = "/"))}
              className={cn(
                "group flex shrink-0 items-center rounded-2xl text-sm text-muted-foreground transition-all hover:bg-red-500/10 hover:text-red-500",
                collapsed ? "h-12 w-12 mx-auto justify-center" : "w-full gap-3 px-3 py-2.5"
              )}
              title={collapsed ? "Déconnexion" : undefined}
            >
              <LogOut className="h-5 w-5 shrink-0 transition-transform group-hover:scale-110" />
              {!collapsed && <span>Déconnexion</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0 pb-24 lg:pb-0">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-background/90 px-4 py-3 backdrop-blur lg:px-8">
          <div className="lg:hidden">
            <Logo />
          </div>
          <p className="hidden truncate font-semibold lg:block">{shop.name}</p>
          <div className="flex items-center gap-2">
            <a
              href={`/b/${encodeURIComponent(shop.slug)}`}
              aria-label="Voir ma boutique"
              title="Voir ma boutique"
              className="flex h-10 items-center gap-1.5 rounded-xl bg-secondary px-3 text-sm font-semibold"
            >
              <ExternalLink className="h-4 w-4" />
              <span className="hidden sm:inline">Voir ma boutique</span>
            </a>
            <button
              onClick={() => supabase.auth.signOut()}
              aria-label="Déconnexion"
              className="grid h-10 w-10 place-items-center rounded-xl text-muted-foreground lg:hidden"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>
        <main className="mx-auto max-w-7xl w-full px-4 py-6 lg:px-8">
          <Outlet />
        </main>
      </div>

      {/* Section 11: 5-Item Mobile Bottom Bar */}
      <nav
        aria-label="Navigation principale mobile"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 items-end border-t bg-card/95 backdrop-blur pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {/* 1. Accueil */}
        <Link
          to="/dashboard"
          aria-label="Accueil"
          aria-current={isHomeActive ? "page" : undefined}
          className={cn(
            "flex flex-col items-center justify-center min-h-[52px] py-2 text-[11px] font-medium transition-colors",
            isHomeActive ? "text-primary font-bold" : "text-muted-foreground"
          )}
        >
          <Home className="h-5 w-5" />
          <span className="mt-1 truncate max-w-[56px]">Accueil</span>
        </Link>

        {/* 2. Produits */}
        <Link
          to="/dashboard/produits"
          aria-label="Produits"
          aria-current={isProductsActive ? "page" : undefined}
          className={cn(
            "flex flex-col items-center justify-center min-h-[52px] py-2 text-[11px] font-medium transition-colors",
            isProductsActive ? "text-primary font-bold" : "text-muted-foreground"
          )}
        >
          <Package className="h-5 w-5" />
          <span className="mt-1 truncate max-w-[56px]">Produits</span>
        </Link>

        {/* 3. Promotions (Centre, Surélevé de ~20px) */}
        <Link
          to="/dashboard/promotions"
          aria-label="Promotions"
          aria-current={isPromosActive ? "page" : undefined}
          className="relative flex flex-col items-center justify-center -top-3.5 group"
        >
          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-card transition-transform group-active:scale-95",
              isPromosActive && "ring-primary/30"
            )}
          >
            <Tag className="h-5 w-5" />
          </div>
          <span
            className={cn(
              "mt-1 text-[11px] font-medium transition-colors truncate max-w-[56px]",
              isPromosActive ? "text-primary font-bold" : "text-muted-foreground"
            )}
          >
            Promos
          </span>
        </Link>

        {/* 4. Commandes */}
        <Link
          to="/dashboard/commandes"
          aria-label="Commandes"
          aria-current={isOrdersActive ? "page" : undefined}
          className={cn(
            "flex flex-col items-center justify-center min-h-[52px] py-2 text-[11px] font-medium transition-colors relative",
            isOrdersActive ? "text-primary font-bold" : "text-muted-foreground"
          )}
        >
          <div className="relative">
            <ShoppingBag className="h-5 w-5" />
            {(newOrdersCount ?? 0) > 0 && (
              <span className="absolute -top-1.5 -right-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white shadow-sm ring-1 ring-card">
                {(newOrdersCount ?? 0) > 99 ? "99+" : newOrdersCount}
              </span>
            )}
          </div>
          <span className="mt-1 truncate max-w-[56px]">Commandes</span>
        </Link>

        {/* 5. Plus (Feuille coulissante) */}
        <button
          ref={plusTriggerRef}
          type="button"
          aria-label="Menu Plus"
          aria-haspopup="dialog"
          aria-expanded={plusOpen}
          aria-current={isPlusActive ? "page" : undefined}
          onClick={() => setPlusOpen(true)}
          className={cn(
            "flex flex-col items-center justify-center min-h-[52px] py-2 text-[11px] font-medium transition-colors relative",
            isPlusActive ? "text-primary font-bold" : "text-muted-foreground"
          )}
        >
          <div className="relative">
            <MoreHorizontal className="h-5 w-5" />
            {hasPlusBadge && (
              <span className="absolute -top-1 -right-1.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-card" />
            )}
          </div>
          <span className="mt-1 truncate max-w-[56px]">Plus</span>
        </button>
      </nav>

      {/* Feuille coulissante « Plus » */}
      {plusOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu Plus">
          {/* Backdrop assombri */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => {
              setPlusOpen(false);
              plusTriggerRef.current?.focus();
            }}
          />

          {/* Bottom Sheet */}
          <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t bg-card p-6 shadow-2xl transition-transform pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            {/* Grab handle */}
            <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-muted-foreground/20" />

            <div className="flex items-center justify-between pb-4 border-b">
              <h3 className="font-extrabold text-lg">Menu Plus</h3>
              <button
                type="button"
                onClick={() => {
                  setPlusOpen(false);
                  plusTriggerRef.current?.focus();
                }}
                className="rounded-full p-1 text-muted-foreground hover:bg-muted"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {/* Boutique */}
              <Link
                to="/dashboard/boutique"
                onClick={() => setPlusOpen(false)}
                className="flex items-center justify-between rounded-2xl border p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Palette className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">Boutique</span>
                      {isShopIncomplete && (
                        <span className="h-2 w-2 rounded-full bg-red-500" title="Informations à compléter" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">Personnalisation, logo, apparence</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </Link>

              {/* Réseaux sociaux */}
              <Link
                to="/dashboard/meta"
                onClick={() => setPlusOpen(false)}
                className="flex items-center justify-between rounded-2xl border p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
                    <Share2 className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">Réseaux sociaux</span>
                      {isMetaDisconnected && (
                        <span className="h-2 w-2 rounded-full bg-red-500" title="Réseaux non connectés" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">Publication Facebook & Instagram</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </Link>

              {/* Réglages */}
              <Link
                to="/dashboard/reglages"
                onClick={() => setPlusOpen(false)}
                className="flex items-center justify-between rounded-2xl border p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    <Settings className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="font-bold text-sm">Réglages</span>
                    <p className="text-xs text-muted-foreground">Profil, abonnement, déconnexion</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

