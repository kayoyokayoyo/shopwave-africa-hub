import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/")({ component: AdminHome });

async function count(table: "profiles" | "shops" | "products" | "orders") {
  const { count } = await supabase.from(table).select("*", { count: "exact", head: true });
  return count ?? 0;
}

function AdminHome() {
  const { data } = useQuery({
    queryKey: ["adminStats"],
    queryFn: async () => {
      const [m, s, p, o] = await Promise.all([count("profiles"), count("shops"), count("products"), count("orders")]);
      const { data: pays } = await supabase.from("subscription_payments").select("amount,status");
      const revenue = (pays ?? []).filter((x) => x.status === "approved").reduce((a, b) => a + Number(b.amount), 0);
      const pending = (pays ?? []).filter((x) => x.status === "pending").length;
      return { m, s, p, o, revenue, pending };
    },
  });
  const cards = [["Commerçants", data?.m], ["Boutiques", data?.s], ["Produits", data?.p], ["Commandes", data?.o], ["Revenus", data ? `${data.revenue} $` : undefined], ["Paiements en attente", data?.pending]] as const;
  return (
    <div>
      <h1 className="text-2xl font-extrabold">Vue d'ensemble</h1>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        {cards.map(([l, v]) => <div key={l} className="rounded-2xl border bg-card p-4"><p className="font-display text-3xl font-extrabold">{v ?? "…"}</p><p className="text-sm text-muted-foreground">{l}</p></div>)}
      </div>
    </div>
  );
}
