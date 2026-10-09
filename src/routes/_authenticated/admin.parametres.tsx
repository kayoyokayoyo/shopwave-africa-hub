import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { logAction } from "@/hooks/useIsAdmin";

export const Route = createFileRoute("/_authenticated/admin/parametres")({ component: Settings });

function Settings() {
  const qc = useQueryClient();
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: async () => Object.fromEntries(((await supabase.from("app_settings").select("*")).data ?? []).map((r) => [r.key, r.value])) as Record<string, unknown> });
  const { data: logs } = useQuery({ queryKey: ["audit"], queryFn: async () => (await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(100)).data ?? [] });
  const [terms, setTerms] = useState("");
  const [pay, setPay] = useState("");
  useEffect(() => { if (settings) { setTerms(String(settings.legal_terms ?? "")); setPay(String(settings.payment_instructions ?? "")); } }, [settings]);

  async function put(key: string, value: unknown) {
    const { error } = await supabase.from("app_settings").upsert({ key, value: value as never });
    if (error) return toast.error(error.message);
    await logAction("settings.update", key); toast.success("Enregistré"); qc.invalidateQueries({ queryKey: ["settings"] });
  }
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section className="space-y-5">
        <h1 className="text-2xl font-extrabold">Paramètres</h1>

        <div className="space-y-2"><Label>Instructions de paiement (mobile money)</Label><Textarea rows={3} value={pay} onChange={(e) => setPay(e.target.value)} /><Button size="sm" onClick={() => put("payment_instructions", pay)}>Enregistrer</Button></div>
        <div className="space-y-2"><Label>Textes légaux</Label><Textarea rows={6} value={terms} onChange={(e) => setTerms(e.target.value)} /><Button size="sm" onClick={() => put("legal_terms", terms)}>Enregistrer</Button></div>
      </section>
      <section>
        <h2 className="text-2xl font-extrabold">Journal d'activité</h2>
        <div className="mt-4 divide-y rounded-2xl border bg-card">
          {!logs?.length && <p className="p-4 text-sm text-muted-foreground">Aucune action.</p>}
          {logs?.map((l) => <div key={l.id} className="p-3 text-sm"><span className="font-mono font-semibold">{l.action}</span> <span className="text-muted-foreground">{l.target?.slice(0, 8)} · {new Date(l.created_at).toLocaleString("fr-FR")}</span></div>)}
        </div>
      </section>
    </div>
  );
}
