import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { logAction } from "@/hooks/useIsAdmin";

export const Route = createFileRoute("/_authenticated/admin/plans")({ component: Plans });
type Plan = Tables<"plans">;

function Plans() {
  const { data } = useQuery({ queryKey: ["plans"], queryFn: async () => (await supabase.from("plans").select("*").order("position")).data ?? [] });
  const [newId, setNewId] = useState("");
  const qc = useQueryClient();
  async function create() {
    const id = newId.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!id) return;
    const { error } = await supabase.from("plans").insert({ id, name: newId, position: (data?.length ?? 0) });
    if (error) return toast.error(error.message);
    await logAction("plan.create", id); setNewId(""); qc.invalidateQueries({ queryKey: ["plans"] });
  }
  return (
    <div>
      <h1 className="text-2xl font-extrabold">Plans d'abonnement</h1>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">{data?.map((p) => <PlanEditor key={p.id} plan={p} />)}</div>
      <div className="mt-6 flex max-w-sm gap-2"><Input placeholder="Nom du nouveau plan" value={newId} onChange={(e) => setNewId(e.target.value)} /><Button onClick={create}>Créer</Button></div>
    </div>
  );
}

function PlanEditor({ plan }: { plan: Plan }) {
  const [p, setP] = useState(plan);
  const qc = useQueryClient();
  async function save() {
    const { error } = await supabase.from("plans").update({ name: p.name, price_usd: p.price_usd, max_products: p.max_products, max_photos: p.max_photos, meta_access: p.meta_access, advanced_themes: p.advanced_themes, advanced_stats: p.advanced_stats, active: p.active }).eq("id", p.id);
    if (error) return toast.error(error.message);
    await logAction("plan.update", p.id, { price: p.price_usd, max_products: p.max_products });
    toast.success("Plan enregistré"); qc.invalidateQueries({ queryKey: ["plans"] });
  }
  const sw = (k: "meta_access" | "advanced_themes" | "advanced_stats" | "active", l: string) => (
    <div className="flex items-center justify-between text-sm"><span>{l}</span><Switch checked={p[k]} onCheckedChange={(v) => setP({ ...p, [k]: v })} /></div>
  );
  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4">
      <p className="text-xs font-mono text-muted-foreground">{p.id}</p>
      <div className="space-y-1"><Label>Nom</Label><Input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} /></div>
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1"><Label>Prix $/mois</Label><Input inputMode="decimal" value={p.price_usd} onChange={(e) => setP({ ...p, price_usd: Number(e.target.value) || 0 })} /></div>
        <div className="space-y-1"><Label>Produits</Label><Input placeholder="∞" value={p.max_products ?? ""} onChange={(e) => setP({ ...p, max_products: e.target.value ? Number(e.target.value) : null })} /></div>
        <div className="space-y-1"><Label>Photos</Label><Input value={p.max_photos} onChange={(e) => setP({ ...p, max_photos: Number(e.target.value) || 1 })} /></div>
      </div>
      {sw("meta_access", "Accès Meta")}{sw("advanced_themes", "Thèmes avancés")}{sw("advanced_stats", "Statistiques avancées")}{sw("active", "Plan proposé")}
      <Button className="w-full" onClick={save}>Enregistrer</Button>
    </div>
  );
}
