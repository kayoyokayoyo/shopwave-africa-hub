import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyShop, useShopProducts, type Order } from "@/hooks/useMyShop";
import { formatPrice, mediaUrl } from "@/lib/marketnet";
import { ArrowLeft, CheckCircle2, Clock, Truck, XCircle, FileText, Image as ImageIcon, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/commandes_/$orderId")({
  head: () => ({ meta: [{ title: "Détails de la commande — MarketNet" }] }),
  component: OrderDetailPage,
});

const STATUS_CONFIG: Record<Order["status"], { label: string; icon: any; color: string; bg: string }> = {
  new: { label: "Nouvelle", icon: Clock, color: "text-blue-500", bg: "bg-blue-500/10" },
  confirmed: { label: "Confirmée", icon: CheckCircle2, color: "text-amber-500", bg: "bg-amber-500/10" },
  delivered: { label: "Livrée", icon: Truck, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  cancelled: { label: "Annulée", icon: XCircle, color: "text-red-500", bg: "bg-red-500/10" },
};

type Item = { productId: string; name: string; qty: number; price: number; currency?: string; variant?: string };

function OrderDetailPage() {
  const { orderId } = Route.useParams();
  const { data: shop } = useMyShop();
  const { data: products } = useShopProducts(shop?.id);
  const qc = useQueryClient();

  const { data: o, isLoading } = useQuery({
    queryKey: ["order", orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*").eq("id", orderId).single();
      if (error) throw error;
      return data as Order;
    },
  });

  async function update(patch: Partial<Pick<Order, "status" | "notes">>) {
    const promise = Promise.resolve(supabase.from("orders").update(patch).eq("id", orderId)).then(({ error }) => { if (error) throw error; });
    toast.promise(promise, {
      loading: "Mise à jour...",
      success: () => {
        qc.invalidateQueries({ queryKey: ["order", orderId] });
        qc.invalidateQueries({ queryKey: ["orders"] });
        return "Commande mise à jour";
      },
      error: "Erreur de mise à jour",
    });
  }

  if (isLoading) return <div className="py-20 text-center text-muted-foreground">Chargement...</div>;
  if (!o) return <div className="py-20 text-center text-red-500">Commande introuvable</div>;

  const config = STATUS_CONFIG[o.status];
  const StatusIcon = config.icon;
  const items = o.items as Item[];

  const totals = items.reduce((acc, it) => {
    const c = it.currency || products?.find(p => p.id === it.productId)?.currency || o.currency;
    acc[c] = (acc[c] || 0) + (it.price * it.qty);
    return acc;
  }, {} as Record<string, number>);
  const totalStr = Object.keys(totals).length > 0 
    ? Object.entries(totals).map(([c, v]) => formatPrice(v, c)).join(" + ")
    : formatPrice(Number(o.total), o.currency);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link to="/dashboard/commandes" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Retour aux commandes
      </Link>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Commande de {o.customer_name.split(' - ')[0]?.split(' (')[0] ?? o.customer_name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Reçue le {new Date(o.created_at).toLocaleDateString("fr-FR", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <select 
              value={o.status} 
              onChange={(e) => update({ status: e.target.value as Order["status"] })} 
              className={cn("appearance-none cursor-pointer h-11 rounded-xl border-0 pl-11 pr-8 text-sm font-bold ring-1 ring-inset transition-colors hover:bg-black/5 dark:hover:bg-white/5", config.bg, config.color, `ring-${config.color.split('-')[1]}-500/20`)}
            >
              {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <StatusIcon className={cn("absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none", config.color)} />
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="rounded-3xl border bg-card overflow-hidden">
            <div className="p-5 border-b bg-muted/10 font-bold flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-muted-foreground" />
              Produits commandés
            </div>
            <ul className="divide-y divide-dashed">
              {items.map((it, i) => {
                const prod = products?.find(p => p.id === it.productId);
                return (
                  <li key={i} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 sm:p-5 hover:bg-muted/5 transition-colors">
                    <div className="flex items-start gap-4 w-full sm:w-auto flex-1 min-w-0">
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted relative">
                        {prod?.images?.[0] ? (
                          <img src={mediaUrl(prod.images[0])!} alt={it.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="grid h-full place-items-center text-muted-foreground/30"><ImageIcon className="h-6 w-6" /></div>
                        )}
                        <div className="absolute -bottom-2 -right-2 flex h-6 min-w-[24px] px-1 items-center justify-center rounded-lg bg-foreground text-[11px] font-bold text-background ring-2 ring-card shadow-sm">
                          {it.qty}x
                        </div>
                      </div>
                      <div className="min-w-0 flex-1 pt-1">
                        <p className="font-bold text-sm line-clamp-2 break-words leading-tight">
                          <span className="text-primary mr-1">{it.qty} ×</span>
                          {it.name}
                        </p>
                        {it.variant && <p className="text-xs text-muted-foreground mt-1.5 bg-muted px-2 py-1 rounded-md line-clamp-2 break-words leading-snug">{it.variant}</p>}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between sm:block w-full sm:w-auto sm:text-right shrink-0 mt-2 sm:mt-0 pt-3 sm:pt-0 border-t sm:border-0 border-dashed border-muted/50">
                      <span className="text-xs font-medium text-muted-foreground sm:hidden">Sous-total</span>
                      <div>
                        <span className="font-semibold text-sm tabular-nums whitespace-nowrap">{formatPrice(it.price * it.qty, it.currency || prod?.currency || o.currency)}</span>
                        {it.qty > 1 && <p className="text-[10px] text-muted-foreground mt-1 text-right">{formatPrice(it.price, it.currency || prod?.currency || o.currency)} / unité</p>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="p-5 bg-muted/5 border-t">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-muted-foreground">Total à payer</span>
                <span className="text-2xl font-black text-primary">{totalStr}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border bg-card overflow-hidden">
            <div className="p-5 border-b bg-muted/10 font-bold flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Informations du client
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Coordonnées complètes</p>
                <div className="rounded-xl bg-muted/30 p-4 border border-dashed">
                  <p className="text-sm font-medium whitespace-pre-wrap leading-relaxed">{o.customer_name}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border bg-card overflow-hidden border-amber-500/20 shadow-sm shadow-amber-500/5">
            <div className="p-5 border-b bg-amber-500/10 font-bold flex items-center gap-2 text-amber-600 dark:text-amber-500">
              Notes internes
            </div>
            <div className="p-5">
              <textarea 
                defaultValue={o.notes ?? ""} 
                placeholder="Ex: Le client a demandé d'appeler avant d'arriver..." 
                onBlur={(e) => e.target.value !== (o.notes ?? "") && update({ notes: e.target.value || null })} 
                className="w-full min-h-[120px] resize-none rounded-xl border bg-transparent p-3 text-sm transition-colors focus:border-amber-500/50 focus:outline-none focus:ring-2 focus:ring-amber-500/20" 
              />
              <p className="text-[10px] text-muted-foreground mt-2">Ces notes sont privées et uniquement visibles par vous.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
