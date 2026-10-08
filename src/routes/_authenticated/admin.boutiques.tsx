import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { logAction } from "@/hooks/useIsAdmin";

export const Route = createFileRoute("/_authenticated/admin/boutiques")({ component: Shops });

function Shops() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["adminShops"],
    queryFn: async () => {
      const [{ data: shops }, { data: reports }] = await Promise.all([
        supabase.from("shops").select("id,name,slug,city,plan_id,is_suspended,views,created_at").order("created_at", { ascending: false }),
        supabase.from("shop_reports").select("*").eq("resolved", false).order("created_at", { ascending: false }),
      ]);
      return { shops: shops ?? [], reports: reports ?? [] };
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["adminShops"] });
  async function suspend(id: string, v: boolean) { await supabase.from("shops").update({ is_suspended: v }).eq("id", id); await logAction(v ? "shop.suspend" : "shop.unsuspend", id); refresh(); }
  async function resolve(id: string) { await supabase.from("shop_reports").update({ resolved: true }).eq("id", id); await logAction("report.resolve", id); refresh(); }
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-xl font-extrabold">Signalements ({data?.reports.length ?? 0})</h2>
        <div className="mt-3 space-y-2">
          {data?.reports.map((r) => {
            const s = data.shops.find((x) => x.id === r.shop_id);
            return (
              <div key={r.id} className="flex items-start justify-between gap-3 rounded-2xl border bg-card p-4">
                <div><p className="font-semibold">{s?.name}</p><p className="text-sm text-muted-foreground">{r.reason}</p></div>
                <div className="flex gap-2">{s && !s.is_suspended && <Button size="sm" variant="outline" onClick={() => suspend(s.id, true)}>Suspendre</Button>}<Button size="sm" onClick={() => resolve(r.id)}>Traité</Button></div>
              </div>
            );
          })}
        </div>
      </section>
      <section>
        <h2 className="text-xl font-extrabold">Boutiques</h2>
        <div className="mt-3 space-y-2">
          {data?.shops.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-4">
              <div className="min-w-0"><Link to="/b/$slug" params={{ slug: s.slug }} target="_blank" className="font-semibold underline-offset-2 hover:underline">{s.name}</Link>
                <p className="text-sm text-muted-foreground">{s.city ?? "—"} · {s.plan_id} · {s.views} vues</p></div>
              <Button size="sm" variant={s.is_suspended ? "default" : "outline"} onClick={() => suspend(s.id, !s.is_suspended)}>{s.is_suspended ? "Réactiver" : "Suspendre"}</Button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
