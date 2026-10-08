import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { logAction } from "@/hooks/useIsAdmin";

export const Route = createFileRoute("/_authenticated/admin/paiements")({ component: Payments });
const METHODS: Record<string, string> = { mpesa: "M-Pesa", airtel: "Airtel Money", orange: "Orange Money", card: "Carte", cash: "Espèces" };

function Payments() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["adminPayments"],
    queryFn: async () => {
      const [{ data: pays }, { data: shops }] = await Promise.all([
        supabase.from("subscription_payments").select("*").order("created_at", { ascending: false }),
        supabase.from("shops").select("id,name"),
      ]);
      return (pays ?? []).map((p) => ({ ...p, shopName: shops?.find((s) => s.id === p.shop_id)?.name }));
    },
  });
  async function review(id: string, status: "approved" | "rejected") {
    const { error } = await supabase.from("subscription_payments").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    await logAction(`payment.${status}`, id);
    toast.success(status === "approved" ? "Paiement validé, plan activé" : "Paiement refusé");
    qc.invalidateQueries({ queryKey: ["adminPayments"] });
  }
  return (
    <div>
      <h1 className="text-2xl font-extrabold">Paiements d'abonnement</h1>
      <div className="mt-4 space-y-2">
        {!data?.length && <p className="text-muted-foreground">Aucun paiement.</p>}
        {data?.map((p) => (
          <div key={p.id} className="rounded-2xl border bg-card p-4">
            <div className="flex justify-between gap-2">
              <div><p className="font-semibold">{p.shopName} — {p.plan_id} × {p.months} mois</p>
                <p className="text-sm text-muted-foreground">{p.amount} $ · {METHODS[p.method]} · Réf. <span className="font-mono">{p.reference}</span> · {new Date(p.created_at).toLocaleDateString("fr-FR")}</p></div>
              <span className="text-sm font-semibold">{p.status === "pending" ? "En attente" : p.status === "approved" ? "Validé" : "Refusé"}</span>
            </div>
            {p.status === "pending" && <div className="mt-3 flex gap-2"><Button size="sm" onClick={() => review(p.id, "approved")}>Valider</Button><Button size="sm" variant="outline" onClick={() => review(p.id, "rejected")}>Refuser</Button></div>}
          </div>
        ))}
      </div>
    </div>
  );
}
