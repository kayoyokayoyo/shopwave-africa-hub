import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyShop, useShopProducts, type Order } from "@/hooks/useMyShop";
import { formatPrice } from "@/lib/marketnet";
import { ShoppingBag, Search, Clock, CheckCircle2, Truck, XCircle, ChevronRight, SlidersHorizontal, Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { DateRange } from "react-day-picker";

export const Route = createFileRoute("/_authenticated/dashboard/commandes")({
  head: () => ({ meta: [{ title: "Commandes — MarketNet" }, { name: "description", content: "Suivez vos commandes WhatsApp." }] }),
  component: OrdersPage,
});

const STATUS_CONFIG: Record<Order["status"], { label: string; icon: any; color: string; bg: string; ring: string }> = {
  new:       { label: "Nouvelle",  icon: Clock,        color: "text-blue-500",    bg: "bg-blue-500/10",    ring: "ring-blue-500/20"    },
  confirmed: { label: "Confirmée", icon: CheckCircle2, color: "text-amber-500",   bg: "bg-amber-500/10",   ring: "ring-amber-500/20"   },
  delivered: { label: "Livrée",    icon: Truck,        color: "text-emerald-500", bg: "bg-emerald-500/10", ring: "ring-emerald-500/20" },
  cancelled: { label: "Annulée",   icon: XCircle,      color: "text-red-500",     bg: "bg-red-500/10",     ring: "ring-red-500/20"     },
};

type Item = { name: string; qty: number; price: number; variant?: string };

const DATE_FILTERS = [
  { label: "Toutes les dates", value: "all" },
  { label: "Aujourd'hui",      value: "today" },
  { label: "7 derniers jours", value: "week" },
  { label: "Ce mois-ci",       value: "month" },
  { label: "Date précise / Plage...", value: "custom" },
];


function OrdersPage() {
  const { data: shop } = useMyShop();
  const { data: products } = useShopProducts(shop?.id);
  const [search, setSearch]         = useState("");
  const [statusFilter, setStatus]   = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [dateRange, setDateRange]   = useState<DateRange | undefined>();
  const [showFilters, setShowFilters] = useState(false);

  const { data: orders } = useQuery({
    queryKey: ["orders", shop?.id],
    enabled: !!shop,
    queryFn: async () =>
      (await supabase.from("orders").select("*").eq("shop_id", shop!.id).order("created_at", { ascending: false }).limit(200)).data ?? [],
  });

  const filtered = useMemo(() => {
    if (!orders) return [];
    let list = [...orders];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(o => o.customer_name.toLowerCase().includes(q));
    }

    if (statusFilter !== "all") {
      list = list.filter(o => o.status === statusFilter);
    }

    if (dateFilter !== "all" && dateFilter !== "custom") {
      const now = new Date();
      list = list.filter(o => {
        const d = new Date(o.created_at);
        if (dateFilter === "today") return d.toDateString() === now.toDateString();
        if (dateFilter === "week") return (now.getTime() - d.getTime()) < 7 * 86400000;
        if (dateFilter === "month") return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        return true;
      });
    }

    if (dateFilter === "custom" && dateRange?.from) {
      const from = new Date(dateRange.from);
      from.setHours(0, 0, 0, 0);
      const fromTime = from.getTime();

      if (dateRange.to) {
        const to = new Date(dateRange.to);
        to.setHours(23, 59, 59, 999);
        list = list.filter(o => {
          const t = new Date(o.created_at).getTime();
          return t >= fromTime && t <= to.getTime();
        });
      } else {
        const endOfDay = new Date(from);
        endOfDay.setHours(23, 59, 59, 999);
        list = list.filter(o => {
          const t = new Date(o.created_at).getTime();
          return t >= fromTime && t <= endOfDay.getTime();
        });
      }
    }

    return list;
  }, [orders, search, statusFilter, dateFilter, dateRange]);

  const newCount = orders?.filter(o => o.status === "new").length ?? 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Vos Commandes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {orders?.length ?? 0} commande{(orders?.length ?? 0) > 1 ? "s" : ""} reçue{(orders?.length ?? 0) > 1 ? "s" : ""}
            {newCount > 0 && <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-bold text-blue-500">{newCount} nouvelle{newCount > 1 ? "s" : ""}</span>}
          </p>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un client, une adresse..."
              className="h-11 w-full rounded-xl border bg-background pl-10 pr-4 text-sm transition-colors focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10"
            />
          </div>
          <button
            onClick={() => setShowFilters(v => !v)}
            className={cn("flex h-11 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors", showFilters ? "bg-primary/10 border-primary/30 text-primary" : "bg-background text-muted-foreground hover:text-foreground")}
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">Filtres</span>
          </button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-3 rounded-2xl border bg-muted/20 p-4 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex flex-col gap-1 min-w-[140px]">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-1">Statut</label>
              <select value={statusFilter} onChange={e => setStatus(e.target.value)} className="h-9 rounded-lg border bg-background px-3 text-sm cursor-pointer">
                <option value="all">Tous les statuts</option>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1 min-w-[160px]">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-1">Période</label>
              <select value={dateFilter} onChange={e => { setDateFilter(e.target.value); setDateRange(undefined); }} className="h-9 rounded-lg border bg-background px-3 text-sm cursor-pointer">
                {DATE_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            
            {dateFilter === "custom" && (
              <div className="flex flex-col gap-1 min-w-[240px] flex-1 sm:flex-none">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-1">Date exacte ou Plage</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <button className={cn("flex h-9 w-full items-center justify-between rounded-lg border bg-background px-3 text-sm font-normal text-left transition-colors hover:bg-muted/50", !dateRange && "text-muted-foreground")}>
                      <span className="truncate">
                        {dateRange?.from ? (
                          dateRange.to ? (
                            <>
                              {format(dateRange.from, "dd LLL", { locale: fr })} -{" "}
                              {format(dateRange.to, "dd LLL", { locale: fr })}
                            </>
                          ) : (
                            format(dateRange.from, "dd LLL yyyy", { locale: fr })
                          )
                        ) : (
                          "Sélectionnez une date..."
                        )}
                      </span>
                      <CalendarIcon className="h-4 w-4 opacity-50 ml-2 shrink-0" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="center" side="top" sideOffset={8}>
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={dateRange?.from}
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={1}
                      locale={fr}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {(statusFilter !== "all" || dateFilter !== "all") && (
              <div className="flex items-end flex-1 sm:flex-none">
                <button onClick={() => { setStatus("all"); setDateFilter("all"); setDateRange(undefined); }} className="h-9 w-full sm:w-auto rounded-lg border border-red-500/30 bg-red-500/10 px-4 text-sm font-medium text-red-500 hover:bg-red-500/20 transition-colors">
                  Réinitialiser
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Orders list */}
      {!orders?.length ? (
        <div className="mt-8 rounded-3xl border-2 border-dashed bg-muted/20 p-12 text-center flex flex-col items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
            <ShoppingBag className="h-8 w-8 text-muted-foreground/60" />
          </div>
          <h3 className="text-lg font-bold">Aucune commande pour le moment</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Partagez le lien de votre boutique à vos clients pour commencer à recevoir des commandes.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed bg-muted/20 p-10 text-center text-muted-foreground text-sm">
          Aucune commande ne correspond à votre recherche.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((o) => {
            const config = STATUS_CONFIG[o.status];
            const StatusIcon = config.icon;
            const items = o.items as Item[];
            const itemCount = items.reduce((s, i) => s + i.qty, 0);
            
            let totalStr = formatPrice(Number(o.total), o.currency);
            if (o.currency === "MIXTE") {
              const totals = items.reduce((acc, it) => {
                const c = it.currency || products?.find(p => p.id === it.productId)?.currency || o.currency;
                acc[c] = (acc[c] || 0) + (it.price * it.qty);
                return acc;
              }, {} as Record<string, number>);
              const entries = Object.entries(totals).filter(([c]) => c !== "MIXTE");
              if (entries.length > 0) {
                totalStr = entries.map(([c, v]) => formatPrice(v, c)).join(" + ");
              }
            }

            return (
              <Link
                key={o.id}
                to="/dashboard/commandes/$orderId"
                params={{ orderId: o.id }}
                className={cn(
                  "group flex items-center justify-between gap-4 rounded-2xl border bg-card p-4 sm:p-5 transition-all hover:shadow-md hover:-translate-y-0.5",
                  o.status === "new" ? "ring-2 ring-blue-500/20" : ""
                )}
              >
                {/* Left: info */}
                <div className="flex items-center gap-4 min-w-0">
                  <div className={cn("hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", config.bg)}>
                    <StatusIcon className={cn("h-5 w-5", config.color)} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold truncate">{o.customer_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(o.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      <span className="mx-1.5">·</span>
                      {itemCount} article{itemCount > 1 ? "s" : ""}
                    </p>
                  </div>
                </div>

                {/* Right: status badge + total + arrow */}
                <div className="flex items-center gap-3 shrink-0">
                  <span className={cn("hidden md:inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold ring-1 ring-inset", config.bg, config.color, config.ring)}>
                    <StatusIcon className="h-3.5 w-3.5" />
                    {config.label}
                  </span>
                  <span className="font-black tabular-nums text-sm">
                    {totalStr}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
