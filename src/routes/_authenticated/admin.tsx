import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Menu, LayoutDashboard, Users, Store, CreditCard, Layers, Settings, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

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

function SidebarContent({ onClose }: { onClose?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-card border-r">
      <div className="flex h-16 shrink-0 items-center gap-3 px-6 border-b">
        <Logo />
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
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted" 
              activeProps={{ className: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground" }}
            >
              <Icon className="h-5 w-5" />
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t">
        <Link to="/dashboard" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
          Quitter l'admin
        </Link>
      </div>
    </div>
  );
}

function AdminLayout() {
  const [open, setOpen] = useState(false);
  
  return (
    <div className="flex min-h-screen bg-background md:bg-muted/30">
      {/* Desktop Sidebar */}
      <aside className="hidden w-[260px] shrink-0 lg:block">
        <div className="fixed inset-y-0 w-[260px]">
          <SidebarContent />
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
