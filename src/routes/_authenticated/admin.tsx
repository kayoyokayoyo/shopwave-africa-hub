import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Menu, LayoutDashboard, Users, Store, CreditCard, Layers, Settings, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async ({ context }) => {
    const { data } = await supabase.rpc("has_role", { _user_id: context.user.id, _role: "admin" });
    if (!data) throw redirect({ to: "/dashboard" });
  },
  head: () => ({ meta: [{ title: "Administration — MarketNet" }, { name: "description", content: "Administration MarketNet." }, { property: "og:title", content: "Administration — MarketNet" }, { property: "og:description", content: "Espace administrateur." }, { name: "robots", content: "noindex" }] }),
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Vue d'ensemble", icon: LayoutDashboard },
  { to: "/admin/commercants", label: "Commerçants", icon: Users },
  { to: "/admin/boutiques", label: "Boutiques", icon: Store },
  { to: "/admin/paiements", label: "Paiements", icon: CreditCard },
  { to: "/admin/plans", label: "Plans", icon: Layers },
  { to: "/admin/parametres", label: "Paramètres", icon: Settings },
] as const;

function SidebarContent({ onClose, collapsed = false, onToggle }: { onClose?: () => void; collapsed?: boolean; onToggle?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-card border-r transition-all duration-300">
      <div className={cn("flex h-16 shrink-0 items-center px-6 border-b", collapsed ? "justify-center px-0" : "justify-between")}>
        {!collapsed && <Logo />}
        {collapsed && <div className="grid h-8 w-8 place-items-center rounded bg-primary text-primary-foreground font-bold">M</div>}
        {onToggle && (
          <button onClick={onToggle} className={cn("grid h-8 w-8 place-items-center rounded-md hover:bg-muted text-muted-foreground", collapsed && "hidden sm:grid")}>
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        )}
      </div>
      <nav className="flex-1 space-y-1.5 overflow-y-auto p-4">
        {NAV.map((n) => {
          const Icon = n.icon;
          return (
            <Link 
              key={n.to} 
              to={n.to} 
              onClick={onClose}
              activeOptions={{ exact: true }} 
              className={cn(
                "group flex items-center rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-muted hover:text-foreground", 
                collapsed ? "justify-center" : "gap-3"
              )} 
              activeProps={{ className: "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary font-bold" }}
              title={collapsed ? n.label : undefined}
            >
              <Icon className="h-5 w-5 shrink-0 transition-transform group-hover:scale-110" />
              {!collapsed && <span>{n.label}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t">
        <button
          onClick={() => supabase.auth.signOut().then(() => window.location.href = '/')}
          title={collapsed ? "Déconnexion" : undefined}
          className={cn("group flex w-full items-center rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-red-500/10 hover:text-red-500", collapsed ? "justify-center" : "gap-3")}
        >
          <ArrowLeft className="h-5 w-5 shrink-0 transition-transform group-hover:scale-110" />
          {!collapsed && <span>Déconnexion</span>}
        </button>
      </div>
    </div>
  );
}

function AdminLayout() {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("admin-sidebar-collapsed") === "true";
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem("admin-sidebar-collapsed", String(collapsed));
  }, [collapsed]);
  
  return (
    <div className="flex min-h-screen bg-background md:bg-muted/30">
      {/* Desktop Sidebar */}
      <aside className={cn("hidden shrink-0 lg:block transition-all duration-300", collapsed ? "w-[80px]" : "w-[260px]")}>
        <div className={cn("fixed inset-y-0 transition-all duration-300", collapsed ? "w-[80px]" : "w-[260px]")}>
          <SidebarContent collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
        </div>
      </aside>

      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b bg-card px-4 shadow-sm lg:px-8">
          <div className="flex items-center gap-3 lg:hidden">
            <Logo />
          </div>
          <div className="hidden lg:block">
            <p className="font-semibold text-muted-foreground">Administration</p>
          </div>
          <div className="flex items-center gap-2">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="-mr-2 lg:hidden"><Menu className="h-6 w-6" /></Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <SidebarContent onClose={() => setOpen(false)} />
              </SheetContent>
            </Sheet>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-10">
          <div className="mx-auto max-w-5xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
