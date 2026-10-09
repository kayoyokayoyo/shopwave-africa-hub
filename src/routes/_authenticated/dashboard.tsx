import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Home, Package, Palette, ShoppingBag, LogOut, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMyShop } from "@/hooks/useMyShop";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardLayout,
});

const NAV = [
  { to: "/dashboard", label: "Accueil", icon: Home, exact: true },
  { to: "/dashboard/produits", label: "Produits", icon: Package },
  { to: "/dashboard/commandes", label: "Commandes", icon: ShoppingBag },
  { to: "/dashboard/boutique", label: "Boutique", icon: Palette },
] as const;

function DashboardLayout() {
  const { data: shop, isLoading } = useMyShop();
  const { data: isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const navigate = useNavigate();
  useEffect(() => {
    if (isAdmin) navigate({ to: "/admin" });
    else if (!isAdminLoading && !isLoading && !shop) navigate({ to: "/onboarding" });
  }, [isAdmin, isAdminLoading, isLoading, shop, navigate]);

  if (isAdminLoading || isLoading || !shop || isAdmin) return <div className="grid min-h-screen place-items-center text-muted-foreground">Chargement…</div>;

  return (
    <div className="min-h-screen bg-background lg:flex">
      <aside className="hidden w-[260px] shrink-0 border-r bg-sidebar lg:block">
        <div className="fixed inset-y-0 flex w-[260px] flex-col p-5">
          <Logo />
          <nav className="mt-8 flex-1 space-y-1 overflow-y-auto">
            {NAV.map((n) => (
              <Link key={n.to} to={n.to} activeOptions={{ exact: "exact" in n }} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent"
                activeProps={{ className: "bg-sidebar-accent text-sidebar-foreground font-semibold" }}>
                <n.icon className="h-4 w-4" />{n.label}
              </Link>
            ))}
          </nav>
          <button onClick={() => supabase.auth.signOut()} className="flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-sidebar-accent"><LogOut className="h-4 w-4" />Déconnexion</button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col min-w-0 pb-24 lg:pb-0">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-background/90 px-4 py-3 backdrop-blur lg:px-8">
          <div className="lg:hidden"><Logo /></div>
          <p className="hidden truncate font-semibold lg:block">{shop.name}</p>
          <div className="flex items-center gap-2">
            <Link to="/b/$slug" params={{ slug: shop.slug }} target="_blank" className="flex h-10 items-center gap-1.5 rounded-xl bg-secondary px-3 text-sm font-semibold">
              <ExternalLink className="h-4 w-4" /><span className="hidden sm:inline">Voir ma boutique</span>
            </Link>
            <button onClick={() => supabase.auth.signOut()} aria-label="Déconnexion" className="grid h-10 w-10 place-items-center rounded-xl text-muted-foreground lg:hidden"><LogOut className="h-4 w-4" /></button>
          </div>
        </header>
        <main className="mx-auto max-w-7xl w-full px-4 py-6 lg:px-8"><Outlet /></main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t bg-card pb-[env(safe-area-inset-bottom)] lg:hidden">
        {NAV.map((n) => (
          <Link key={n.to} to={n.to} activeOptions={{ exact: "exact" in n }} className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground"
            activeProps={{ className: "text-primary" }}>
            <n.icon className="h-5 w-5" />{n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
