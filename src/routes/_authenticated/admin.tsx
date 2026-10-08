import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async ({ context }) => {
    const { data } = await supabase.rpc("has_role", { _user_id: context.user.id, _role: "admin" });
    if (!data) throw redirect({ to: "/dashboard" });
  },
  head: () => ({ meta: [{ title: "Administration — MarketNet" }, { name: "description", content: "Administration MarketNet." }, { property: "og:title", content: "Administration — MarketNet" }, { property: "og:description", content: "Espace administrateur." }, { name: "robots", content: "noindex" }] }),
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Vue d'ensemble" },
  { to: "/admin/commercants", label: "Commerçants" },
  { to: "/admin/boutiques", label: "Boutiques" },
  { to: "/admin/paiements", label: "Paiements" },
  { to: "/admin/plans", label: "Plans" },
  { to: "/admin/parametres", label: "Paramètres & journal" },
] as const;

function AdminLayout() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Logo /><span className="rounded-full bg-foreground px-3 py-1 text-xs font-bold text-background">Admin</span>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} activeOptions={{ exact: true }} className="shrink-0 rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground" activeProps={{ className: "bg-primary text-primary-foreground" }}>{n.label}</Link>
          ))}
          <Link to="/dashboard" className="shrink-0 rounded-full px-3 py-1.5 text-sm text-muted-foreground">← Mon espace</Link>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6"><Outlet /></main>
    </div>
  );
}
