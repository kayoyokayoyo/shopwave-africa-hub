import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { logAction } from "@/hooks/useIsAdmin";
import { Store, ShieldAlert, Eye, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/admin/boutiques")({ component: Shops });

function Shops() {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["adminShops"],
    queryFn: async () => {
      const [{ data: shops }, { data: reports }] = await Promise.all([
        supabase.from("shops").select("id,name,slug,city,plan_id,is_suspended,views,created_at").order("created_at", { ascending: false }),
        supabase.from("shop_reports").select("*").eq("resolved", false).order("created_at", { ascending: false }),
      ]);
      return { shops: shops ?? [], reports: reports ?? [] };
    },
  });

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Chargement des boutiques...</div>;

  const normalizedQuery = query.trim().toLowerCase();
  const filteredShops = data?.shops.filter((s) => 
    s.name.toLowerCase().includes(normalizedQuery) ||
    s.slug.toLowerCase().includes(normalizedQuery) ||
    (s.city && s.city.toLowerCase().includes(normalizedQuery))
  ) ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Boutiques & Signalements</h1>
        <p className="mt-1 text-sm text-muted-foreground">Supervisez l'activite des boutiques et moderez les contenus signales.</p>
      </div>

      <section>
        <div className="flex items-center gap-2 mb-4">
          <ShieldAlert className="h-5 w-5 text-amber-500" />
          <h2 className="text-lg font-bold">Signalements a traiter ({data?.reports.length ?? 0})</h2>
        </div>
        
        {data?.reports.length === 0 ? (
          <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">Aucun signalement en attente. Tout va bien !</div>
        ) : (
          <div className="grid gap-3">
            {data?.reports.map((r) => {
              const s = data.shops.find((x) => x.id === r.shop_id);
              return <ReportRow key={r.id} report={r} shop={s} />;
            })}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center gap-2 mb-4">
          <Store className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">Toutes les boutiques ({data?.shops.length ?? 0})</h2>
        </div>
        
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="border-b p-4 sm:p-5 bg-muted/10">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-10 pl-9 pr-9 bg-background"
                placeholder="Rechercher une boutique par nom, lien ou ville..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="divide-y">
            {filteredShops.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Aucune boutique trouvee pour cette recherche.</div>
            ) : (
              filteredShops.map((s) => <ShopRow key={s.id} shop={s} />)
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function ReportRow({ report: r, shop: s }: { report: any, shop: any }) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["adminShops"] });

  async function resolve(id: string) { 
    await supabase.from("shop_reports").update({ resolved: true }).eq("id", id); 
    await logAction("report.resolve", id); 
    toast.success("Signalement marque comme traite");
    refresh(); 
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-amber-200/50 bg-amber-50/30 p-4 dark:border-amber-900/30 dark:bg-amber-950/20">
      <div>
        <div className="flex items-center gap-2">
          <p className="font-semibold">{s?.name || "Boutique supprimee"}</p>
          <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
        </div>
        <p className="text-sm text-amber-800 dark:text-amber-300 mt-1">Motif : {r.reason}</p>
      </div>
      <div className="flex items-center gap-2">
        {s && (
          <Link to="/admin/boutiques/$shopId" params={{ shopId: s.id }}>
            <Button size="sm" variant="outline" className="text-amber-700 border-amber-300 hover:bg-amber-100">Voir la boutique</Button>
          </Link>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600">Marquer traite</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cloturer ce signalement ?</AlertDialogTitle>
              <AlertDialogDescription>Confirmez que ce signalement a ete analyse et traite.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction className="bg-emerald-600 hover:bg-emerald-700" onClick={() => resolve(r.id)}>Confirmer</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function ShopRow({ shop: s }: { shop: any }) {
  return (
    <Link to="/admin/boutiques/$shopId" params={{ shopId: s.id }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 hover:bg-muted/30 transition-colors group">
      <div className="flex items-start gap-4 min-w-0">
        <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${s.is_suspended ? 'bg-destructive' : 'bg-emerald-500'}`} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold truncate group-hover:text-primary transition-colors">{s.name}</span>
            {s.is_suspended && <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-bold text-destructive uppercase">Suspendue</span>}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span className="truncate">{s.city ?? "Ville non renseignee"}</span>
            <span>&bull;</span>
            <span className="uppercase font-medium text-primary/80">{s.plan_id}</span>
            <span>&bull;</span>
            <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {s.views} vues</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
