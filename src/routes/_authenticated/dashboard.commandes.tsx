import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyShop, type Order } from "@/hooks/useMyShop";
import { formatPrice } from "@/lib/marketnet";

export const Route = createFileRoute("/_authenticated/dashboard/commandes")({
  head: () => ({ meta: [{ title: "Commandes — MarketNet" }, { name: "description", content: "Suivez vos commandes WhatsApp." }, { property: "og:title", content: "Commandes — MarketNet" }, { property: "og:description", content: "Commandes reçues via WhatsApp." }] }),
  component: OrdersPage,
});

const LABELS: Record<Order["status"], string> = { new: "Nouvelle", confirmed: "Confirmée", delivered: "Livrée", cancelled: "Annulée" };
type Item = { name: string; qty: number; price: number; variant?: string };

function OrdersPage() {
  const { data: shop } = useMyShop();
  const qc = useQueryClient();
  const { data: orders } = useQuery({
    queryKey: ["orders", shop?.id], enabled: !!shop,
    queryFn: async () => (await supabase.from("orders").select("*").eq("shop_id", shop!.id).order("created_at", { ascending: false }).limit(200)).data ?? [],
  });
  async function update(id: string, patch: Partial<Pick<Order, "status" | "notes">>) {
    await supabase.from("orders").update(patch).eq("id", id);
    qc.invalidateQueries({ queryKey: ["orders", shop?.id] });
  }
  return (
    <div>
      <h1 className="text-2xl font-extrabold">Commandes</h1>
      <p className="text-sm text-muted-foreground">Chaque clic sur « Commander sur WhatsApp » apparaît ici.</p>
      {!orders?.length ? <div className="mt-8 rounded-2xl border-2 border-dashed p-8 text-center text-muted-foreground">Aucune commande pour l'instant.</div> : (
        <div className="mt-6 space-y-3">
          {orders.map((o) => (
            <div key={o.id} className="rounded-2xl border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div><p className="font-semibold">{o.customer_name}</p><p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString("fr-FR")}</p></div>
                <select value={o.status} onChange={(e) => update(o.id, { status: e.target.value as Order["status"] })} className="h-9 rounded-lg border bg-background px-2 text-sm font-semibold">
                  {Object.entries(LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <ul className="mt-3 space-y-1 text-sm">
                {(o.items as Item[]).map((it, i) => <li key={i} className="flex justify-between"><span>{it.qty} × {it.name}{it.variant && ` (${it.variant})`}</span><span>{formatPrice(it.price * it.qty, o.currency)}</span></li>)}
              </ul>
              <p className="mt-2 border-t pt-2 text-right font-bold">{formatPrice(Number(o.total), o.currency)}</p>
              <input defaultValue={o.notes ?? ""} placeholder="Ajouter une note…" onBlur={(e) => e.target.value !== (o.notes ?? "") && update(o.id, { notes: e.target.value || null })} className="mt-2 h-10 w-full rounded-lg border bg-background px-3 text-sm" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
