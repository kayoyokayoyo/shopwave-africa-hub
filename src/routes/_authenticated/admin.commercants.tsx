import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Check, CircleAlert, Clock3, ExternalLink, Pause, RefreshCw, Search,
  ShieldCheck, Store, Trash2, Users, X, Mail, ChevronRight, AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { logAction } from "@/hooks/useIsAdmin";
import { supabase } from "@/integrations/supabase/client";
import { deleteMerchant } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/commercants")({
  component: Merchants,
});

type MerchantFilter = "all" | "active" | "pending" | "suspended" | "withoutShop";

const FILTERS: { id: MerchantFilter; label: string }[] = [
  { id: "all", label: "Tous" },
  { id: "active", label: "Actifs" },
  { id: "pending", label: "En attente" },
  { id: "suspended", label: "Suspendus" },
  { id: "withoutShop", label: "Sans boutique" },
];

function Merchants() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MerchantFilter>("all");
  const queryClient = useQueryClient();
  
  const { data, error, isError, isFetching, isLoading, refetch } = useQuery({
    queryKey: ["adminMerchants"],
    queryFn: async () => {
      const [
        { data: profiles, error: profilesError },
        { data: shops, error: shopsError },
        { data: authData, error: authError },
      ] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("shops").select("id,owner_id,name,slug,plan_id"),
        supabase.auth.getUser(),
      ]);

      if (profilesError) throw profilesError;
      if (shopsError) throw shopsError;
      if (authError) throw authError;

      return {
        currentUserId: authData.user?.id ?? null,
        merchants: (profiles ?? []).map((profile) => ({
          ...profile,
          shop: shops?.find((shop) => shop.owner_id === profile.id),
        })),
      };
    },
  });

  const merchants = data?.merchants ?? [];
  const counts = {
    all: merchants.length,
    active: merchants.filter((m) => m.status === "active").length,
    pending: merchants.filter((m) => m.status === "pending").length,
    suspended: merchants.filter((m) => m.status === "suspended").length,
    withoutShop: merchants.filter((m) => !m.shop).length,
  };
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredMerchants = merchants.filter((merchant) => {
    const searchableText = [
      merchant.email ?? "",
      merchant.full_name ?? "",
      merchant.shop?.name ?? "",
    ].join(" ").toLocaleLowerCase();
    const matchesSearch = searchableText.includes(normalizedQuery);
    const matchesFilter = filter === "all" || (filter === "withoutShop" ? !merchant.shop : merchant.status === filter);
    return matchesSearch && matchesFilter;
  });

  function initials(name: string | null, email: string | null) {
    return (name?.trim() || email?.trim() || "?").split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Commercants</h1>
          <p className="mt-1 text-sm text-muted-foreground">Gerez l'ensemble des comptes de la plateforme.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching} className="h-9">
          <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Actualiser
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard label="Total" value={counts.all} icon={<Users className="h-4 w-4 text-blue-500" />} />
        <SummaryCard label="Actifs" value={counts.active} icon={<ShieldCheck className="h-4 w-4 text-emerald-500" />} />
        <SummaryCard label="En attente" value={counts.pending} icon={<Clock3 className="h-4 w-4 text-amber-500" />} />
        <SummaryCard label="Sans boutique" value={counts.withoutShop} icon={<Store className="h-4 w-4 text-slate-500" />} />
      </div>

      <div className="rounded-2xl border bg-card shadow-sm">
        <div className="border-b p-4 sm:p-5">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-10 pl-9 pr-9"
              placeholder="Rechercher..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                onClick={() => setFilter(item.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  filter === item.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {item.label}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${filter === item.id ? "bg-primary-foreground/20" : "bg-background"}`}>
                  {counts[item.id]}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y">
          {isLoading ? (
            <div className="p-5 space-y-4">{[1,2,3].map(i => <div key={i} className="h-16 animate-pulse rounded-lg bg-muted/60" />)}</div>
          ) : filteredMerchants.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">Aucun resultat.</div>
          ) : (
            filteredMerchants.map((m) => (
              <div key={m.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
                    {initials(m.full_name, m.email)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{m.full_name || "Sans nom"}</span>
                      <span className={`h-2 w-2 rounded-full ${m.status === 'active' ? 'bg-emerald-500' : m.status === 'pending' ? 'bg-amber-500' : 'bg-rose-500'}`} />
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{m.email}</div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm sm:pl-0 pl-14">
                  {m.shop ? (
                    <Link to="/admin/boutiques/$shopId" params={{ shopId: m.shop.id }} className="flex items-center gap-1.5 text-primary hover:underline">
                      <Store className="h-3.5 w-3.5" />
                      {m.shop.name}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground text-xs italic">Pas de boutique</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function MerchantActions({ merchant: m }: { merchant: any }) {
  const queryClient = useQueryClient();
  const deleteMerchantFn = useServerFn(deleteMerchant);
  const [busy, setBusy] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const expectedName = m.shop?.name || m.full_name || m.email;

  async function setStatus(status: "active" | "suspended") {
    setBusy(true);
    try {
      const { error: updateError } = await supabase.from("profiles").update({ status }).eq("id", m.id);
      if (updateError) throw updateError;
      await logAction(`merchant.${status}`, m.id);
      toast.success(status === "active" ? "Compte active" : "Compte suspendu");
      await queryClient.invalidateQueries({ queryKey: ["adminMerchants"] });
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Impossible de modifier ce compte");
    } finally {
      setBusy(false);
      setConfirmName("");
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await deleteMerchantFn({ data: { userId: m.id } });
      toast.success("Compte supprime");
      await queryClient.invalidateQueries({ queryKey: ["adminMerchants"] });
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Impossible de supprimer ce compte");
    } finally {
      setBusy(false);
      setConfirmName("");
    }
  }

  return (
    <div className="flex gap-2">
      {m.status !== "active" && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy}>Activer</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Activer ce compte ?</AlertDialogTitle>
              <AlertDialogDescription>Le commercant ({m.email}) pourra a nouveau se connecter et gerer sa boutique.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={() => void setStatus("active")}>Confirmer l'activation</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      
      {m.status !== "suspended" && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="outline" className="h-7 text-xs text-amber-600 border-amber-200" disabled={busy}>Suspendre</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-amber-600"><AlertTriangle className="h-5 w-5" /> Suspendre ce compte ?</AlertDialogTitle>
              <AlertDialogDescription>
                Pour confirmer la suspension, veuillez taper <strong>{expectedName}</strong> ci-dessous.
              </AlertDialogDescription>
              <Input placeholder={expectedName} value={confirmName} onChange={(e) => setConfirmName(e.target.value)} />
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setConfirmName("")}>Annuler</AlertDialogCancel>
              <AlertDialogAction disabled={confirmName !== expectedName} className="bg-amber-600 hover:bg-amber-700" onClick={() => void setStatus("suspended")}>
                Suspendre le compte
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" disabled={busy}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Suppression definitive</AlertDialogTitle>
            <AlertDialogDescription>
              Pour confirmer la suppression definitive, tapez <strong>{expectedName}</strong> ci-dessous.
            </AlertDialogDescription>
            <Input placeholder={expectedName} value={confirmName} onChange={(e) => setConfirmName(e.target.value)} />
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmName("")}>Annuler</AlertDialogCancel>
            <AlertDialogAction disabled={confirmName !== expectedName} className="bg-destructive hover:bg-destructive/90" onClick={() => void remove()}>
              Supprimer definitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SummaryCard({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {icon}
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

