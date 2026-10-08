import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { logAction } from "@/hooks/useIsAdmin";
import { deleteMerchant } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/commercants")({ component: Merchants });

function Merchants() {
  const [q, setQ] = useState("");
  const qc = useQueryClient();
  const del = useServerFn(deleteMerchant);
  const { data } = useQuery({
    queryKey: ["adminMerchants"],
    queryFn: async () => {
      const [{ data: profiles }, { data: shops }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("shops").select("owner_id,name,slug,plan_id"),
      ]);
      return (profiles ?? []).map((p) => ({ ...p, shop: shops?.find((s) => s.owner_id === p.id) }));
    },
  });
  async function setStatus(id: string, status: string) {
    const { error } = await supabase.from("profiles").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    await logAction(`merchant.${status}`, id);
    qc.invalidateQueries({ queryKey: ["adminMerchants"] });
  }
  async function remove(id: string) {
    if (!confirm("Supprimer définitivement ce compte et sa boutique ?")) return;
    try { await del({ data: { userId: id } }); toast.success("Compte supprimé"); qc.invalidateQueries({ queryKey: ["adminMerchants"] }); }
    catch (e) { toast.error((e as Error).message); }
  }
  const list = (data ?? []).filter((m) => `${m.email} ${m.full_name} ${m.shop?.name}`.toLowerCase().includes(q.toLowerCase()));
  const badge: Record<string, string> = { active: "bg-success/15 text-success", pending: "bg-accent text-accent-foreground", suspended: "bg-destructive/15 text-destructive" };
  return (
    <div>
      <h1 className="text-2xl font-extrabold">Commerçants</h1>
      <Input className="mt-4 h-12" placeholder="Rechercher (email, nom, boutique)…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="mt-4 space-y-2">
        {list.map((m) => (
          <div key={m.id} className="rounded-2xl border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0"><p className="truncate font-semibold">{m.full_name || "—"} <span className="font-normal text-muted-foreground">{m.email}</span></p>
                <p className="text-sm text-muted-foreground">{m.shop ? `${m.shop.name} · /b/${m.shop.slug} · ${m.shop.plan_id}` : "Pas de boutique"}</p></div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badge[m.status] ?? ""}`}>{m.status === "active" ? "Actif" : m.status === "pending" ? "En attente" : "Suspendu"}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {m.status !== "active" && <Button size="sm" onClick={() => setStatus(m.id, "active")}>Valider / Réactiver</Button>}
              {m.status !== "suspended" && <Button size="sm" variant="outline" onClick={() => setStatus(m.id, "suspended")}>Suspendre</Button>}
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(m.id)}>Supprimer</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
