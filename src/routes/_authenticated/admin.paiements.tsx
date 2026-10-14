import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CreditCard,
  CheckCircle2,
  XCircle,
  Activity,
  Plus,
  Eye,
  Store,
  ShieldCheck,
  ShieldAlert,
  Search,
  ExternalLink,
  Clock3,
  RefreshCw,
  X,
  DollarSign,
  User,
} from "lucide-react";
import {
  adminGetPayments,
  adminReviewPayment,
  adminAssignPlan,
  adminGetPaymentEvents,
} from "@/lib/subscriptions.functions";
import { formatUSD, type SubscriptionPeriod } from "@/lib/subscriptions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/paiements")({
  head: () => ({
    meta: [{ title: "Paiements & Abonnements — Admin MarketNet" }],
  }),
  component: AdminPaymentsPage,
});

type FilterStatus = "all" | "en_attente" | "payé" | "à_vérifier" | "échoué" | "annulé";

function getNormalizedStatus(p: any): FilterStatus {
  const s = p.statut || (p.status === "approved" ? "payé" : p.status === "rejected" ? "échoué" : "en_attente");
  if (s === "payé" || s === "en_attente" || s === "à_vérifier" || s === "échoué" || s === "annulé") {
    return s as FilterStatus;
  }
  return "en_attente";
}

function getStatusBadgeConfig(status: string | null) {
  switch (status) {
    case "payé":
    case "approved":
      return {
        label: "Payé",
        container: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
        dot: "bg-emerald-500",
      };
    case "en_attente":
    case "pending":
      return {
        label: "En attente",
        container: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
        dot: "bg-amber-500 animate-pulse",
      };
    case "à_vérifier":
      return {
        label: "À vérifier",
        container: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
        dot: "bg-blue-500",
      };
    case "échoué":
    case "rejected":
      return {
        label: "Échoué",
        container: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20",
        dot: "bg-rose-500",
      };
    case "annulé":
      return {
        label: "Annulé",
        container: "bg-muted text-muted-foreground border-border",
        dot: "bg-muted-foreground",
      };
    case "expiré":
      return {
        label: "Expiré",
        container: "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border-zinc-500/20",
        dot: "bg-zinc-400",
      };
    default:
      return {
        label: status || "Inconnu",
        container: "bg-muted text-muted-foreground border-border",
        dot: "bg-muted-foreground",
      };
  }
}

function MetricCard({
  title,
  value,
  subtitle,
  icon,
  className,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border bg-card p-5 shadow-sm space-y-2", className)}>
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-xs font-semibold tracking-wide uppercase">{title}</span>
        <div className="p-2 rounded-xl bg-muted/60">{icon}</div>
      </div>
      <div>
        <p className="text-2xl font-black tracking-tight">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function AdminPaymentsPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"payments" | "events">("payments");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPayment, setSelectedPayment] = useState<any | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  // Review confirmation modal
  const [reviewModal, setReviewModal] = useState<{
    paymentId: string;
    decision: "valider" | "refuser";
    shopName: string;
  } | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Server functions
  const fetchPaymentsFn = useServerFn(adminGetPayments);
  const fetchEventsFn = useServerFn(adminGetPaymentEvents);
  const reviewPaymentFn = useServerFn(adminReviewPayment);
  const assignPlanFn = useServerFn(adminAssignPlan);

  // Main Query: Fetch all payments so we have full metrics and instant client filtering
  const paymentsQuery = useQuery({
    queryKey: ["admin-subscription-payments-all"],
    queryFn: () => fetchPaymentsFn({ data: { statut: "all" } }),
  });

  const eventsQuery = useQuery({
    queryKey: ["admin-payment-events"],
    queryFn: () => fetchEventsFn(),
    enabled: activeTab === "events",
  });

  const shopsQuery = useQuery({
    queryKey: ["admin-shops-lite"],
    queryFn: async () => {
      const { data } = await supabase.from("shops").select("id, name, slug, plan_id").order("name");
      return data ?? [];
    },
    enabled: isAssignModalOpen,
  });

  // Assign Plan Form state
  const [assignShopId, setAssignShopId] = useState("");
  const [assignPlanId, setAssignPlanId] = useState("pro");
  const [assignPeriod, setAssignPeriod] = useState<SubscriptionPeriod>("mensuel");
  const [assignNote, setAssignNote] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);

  async function handleAssignPlan(e: React.FormEvent) {
    e.preventDefault();
    if (!assignShopId) return toast.error("Veuillez sélectionner une boutique");
    setIsAssigning(true);
    try {
      await assignPlanFn({
        data: {
          shopId: assignShopId,
          planId: assignPlanId,
          period: assignPeriod,
          note: assignNote || undefined,
        },
      });
      toast.success("Abonnement attribué avec succès !");
      setIsAssignModalOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-subscription-payments-all"] });
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'attribution");
    } finally {
      setIsAssigning(false);
    }
  }

  async function handleConfirmReview() {
    if (!reviewModal) return;
    setIsSubmittingReview(true);
    try {
      const res = await reviewPaymentFn({
        data: {
          paymentId: reviewModal.paymentId,
          decision: reviewModal.decision,
          adminNote: adminNote || undefined,
        },
      });
      toast.success(res.message);
      setReviewModal(null);
      setAdminNote("");
      qc.invalidateQueries({ queryKey: ["admin-subscription-payments-all"] });
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'opération");
    } finally {
      setIsSubmittingReview(false);
    }
  }

  const allPayments = useMemo(() => (paymentsQuery.data ?? []) as any[], [paymentsQuery.data]);

  // Compute Metrics
  const metrics = useMemo(() => {
    let totalCollectedUSD = 0;
    let paidCount = 0;
    let pendingCount = 0;
    let failedCount = 0;
    let toReviewCount = 0;
    let cancelledCount = 0;

    for (const p of allPayments) {
      const s = getNormalizedStatus(p);
      const amount = Number(p.montant_usd ?? p.montant_cdf ?? p.amount ?? 0);
      if (s === "payé") {
        paidCount++;
        totalCollectedUSD += amount;
      } else if (s === "en_attente") {
        pendingCount++;
      } else if (s === "échoué") {
        failedCount++;
      } else if (s === "à_vérifier") {
        toReviewCount++;
      } else if (s === "annulé") {
        cancelledCount++;
      }
    }

    return {
      totalCollectedUSD,
      paidCount,
      pendingCount,
      failedCount,
      toReviewCount,
      cancelledCount,
      totalCount: allPayments.length,
    };
  }, [allPayments]);

  // Filtered Payments List
  const filteredPayments = useMemo(() => {
    return allPayments.filter((p) => {
      const effectiveStatut = getNormalizedStatus(p);
      if (statusFilter !== "all" && effectiveStatut !== statusFilter) {
        return false;
      }

      if (!searchTerm) return true;
      const s = searchTerm.toLowerCase().trim();
      const shopName = p.shops?.name?.toLowerCase() || "";
      const merchantName = p.merchant_profile?.full_name?.toLowerCase() || "";
      const merchantEmail = p.merchant_profile?.email?.toLowerCase() || "";
      const session = p.saspay_session_id?.toLowerCase() || "";
      const tx = p.saspay_transaction_id?.toLowerCase() || "";
      const ref = p.reference?.toLowerCase() || "";

      return (
        shopName.includes(s) ||
        merchantName.includes(s) ||
        merchantEmail.includes(s) ||
        session.includes(s) ||
        tx.includes(s) ||
        ref.includes(s)
      );
    });
  }, [allPayments, statusFilter, searchTerm]);

  const filterTabs: { id: FilterStatus; label: string; count: number }[] = [
    { id: "all", label: "Tous", count: metrics.totalCount },
    { id: "payé", label: "Payés", count: metrics.paidCount },
    { id: "en_attente", label: "En attente", count: metrics.pendingCount },
    { id: "à_vérifier", label: "À vérifier", count: metrics.toReviewCount },
    { id: "échoué", label: "Échoués", count: metrics.failedCount },
    { id: "annulé", label: "Annulés", count: metrics.cancelledCount },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      {/* ── En-tête principal ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-primary" /> Paiements & Abonnements
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Suivi des paiements réels, gestion des tarifs en USD ($) et transactions SasPay Mobile Money.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void paymentsQuery.refetch()}
            disabled={paymentsQuery.isFetching}
            className="h-10 rounded-xl px-3 font-semibold text-xs"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", paymentsQuery.isFetching && "animate-spin")} />
            Actualiser
          </Button>

          <Button
            onClick={() => setIsAssignModalOpen(true)}
            className="rounded-xl font-bold h-10 shadow-sm text-xs sm:text-sm"
          >
            <Plus className="h-4 w-4 mr-1.5" /> Attribuer un plan
          </Button>
        </div>
      </div>

      {/* ── Cartes métriques (KPIs aérés) ─────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Encaissé"
          value={formatUSD(metrics.totalCollectedUSD)}
          subtitle={`${metrics.paidCount} transaction(s) réussie(s)`}
          icon={<DollarSign className="h-4 w-4 text-emerald-600" />}
        />
        <MetricCard
          title="En attente SasPay"
          value={metrics.pendingCount}
          subtitle="En cours sur mobile money"
          icon={<Clock3 className="h-4 w-4 text-amber-500" />}
        />
        <MetricCard
          title="À vérifier (Manuel)"
          value={metrics.toReviewCount}
          subtitle="Nécessite une action admin"
          icon={<ShieldAlert className="h-4 w-4 text-blue-500" />}
        />
        <MetricCard
          title="Total Transactions"
          value={metrics.totalCount}
          subtitle="Volume historique total"
          icon={<CreditCard className="h-4 w-4 text-primary" />}
        />
      </div>

      {/* ── Onglets Navigation ───────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-6">
        <TabsList className="bg-muted/60 p-1 rounded-2xl h-11 w-full sm:w-auto grid grid-cols-2 sm:inline-flex">
          <TabsTrigger value="payments" className="rounded-xl text-xs sm:text-sm font-semibold gap-2">
            <CreditCard className="h-4 w-4" />
            <span>Transactions ({metrics.totalCount})</span>
          </TabsTrigger>
          <TabsTrigger value="events" className="rounded-xl text-xs sm:text-sm font-semibold gap-2">
            <Activity className="h-4 w-4" />
            <span>Journal Webhooks</span>
          </TabsTrigger>
        </TabsList>

        {/* ── TAB 1: PAIEMENTS ─────────────────────────────────────────────── */}
        <TabsContent value="payments" className="space-y-4 m-0">
          <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
            {/* Barre de Recherche et Filtres aérés */}
            <div className="border-b p-4 sm:p-5 space-y-4 bg-card">
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher par boutique, commerçant, session…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 pr-9 h-10 rounded-xl text-xs sm:text-sm bg-muted/30 focus-visible:bg-background"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <span className="text-xs text-muted-foreground self-center sm:self-auto font-medium">
                  {filteredPayments.length} résultat{filteredPayments.length > 1 ? "s" : ""}
                </span>
              </div>

              {/* Filtres par pilules avec compteurs */}
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {filterTabs.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setStatusFilter(item.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors border",
                      statusFilter === item.id
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                    )}
                  >
                    <span>{item.label}</span>
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.2 text-[10px] font-bold",
                        statusFilter === item.id
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-muted text-foreground/70"
                      )}
                    >
                      {item.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* État Erreur */}
            {paymentsQuery.isError && (
              <div className="p-8 text-center bg-rose-500/5 text-rose-600 dark:text-rose-400 space-y-3">
                <ShieldAlert className="h-8 w-8 mx-auto opacity-70" />
                <p className="font-bold text-sm">Erreur lors de la récupération des transactions</p>
                <p className="text-xs max-w-md mx-auto text-muted-foreground">
                  {(paymentsQuery.error as any)?.message || "Impossible de contacter le serveur"}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => paymentsQuery.refetch()}
                  className="rounded-xl text-xs h-8"
                >
                  Réessayer
                </Button>
              </div>
            )}

            {/* État Chargement */}
            {paymentsQuery.isLoading && (
              <div className="p-16 text-center text-muted-foreground space-y-2">
                <RefreshCw className="h-6 w-6 mx-auto animate-spin text-primary" />
                <p className="text-sm font-medium">Chargement des transactions…</p>
              </div>
            )}

            {/* État Vide */}
            {!paymentsQuery.isLoading && !paymentsQuery.isError && filteredPayments.length === 0 && (
              <div className="p-16 text-center text-muted-foreground space-y-3">
                <div className="h-12 w-12 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto">
                  <CreditCard className="h-6 w-6 opacity-40" />
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-base text-foreground">Aucune transaction trouvée</p>
                  <p className="text-xs max-w-sm mx-auto">
                    {searchTerm
                      ? `Aucune transaction ne correspond à « ${searchTerm} ».`
                      : "Aucun paiement ne correspond au filtre sélectionné."}
                  </p>
                </div>
                {(searchTerm || statusFilter !== "all") && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchTerm("");
                      setStatusFilter("all");
                    }}
                    className="rounded-xl text-xs"
                  >
                    Réinitialiser les filtres
                  </Button>
                )}
              </div>
            )}

            {/* Liste aérée et structurée des paiements */}
            {!paymentsQuery.isLoading && !paymentsQuery.isError && filteredPayments.length > 0 && (
              <div className="divide-y divide-border">
                {filteredPayments.map((p: any) => {
                  const effectiveStatut = getNormalizedStatus(p);
                  const badge = getStatusBadgeConfig(effectiveStatut);
                  const amountUSD = Number(p.montant_usd ?? p.montant_cdf ?? p.amount ?? 0);

                  // Les actions Valider/Refuser ne concernent QUE les paiements manuels ou à vérifier.
                  // Les sessions automatisées SasPay (mobile money) se gèrent automatiquement par webhook.
                  const isManualReview =
                    (p.methode === "manuel" || p.method === "manuel") ||
                    effectiveStatut === "à_vérifier";

                  return (
                    <div
                      key={p.id}
                      className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-muted/20 transition-colors"
                    >
                      {/* Colonne 1: Boutique & Marchand */}
                      <div className="min-w-0 space-y-1 sm:max-w-md">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm text-foreground truncate">
                            {p.shops?.name || "Boutique sans nom"}
                          </p>
                          <span className="font-semibold text-[10px] uppercase px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                            Plan {p.plan_id}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {p.merchant_profile?.full_name ? (
                            <span className="flex items-center gap-1 font-medium text-foreground/80">
                              <User className="h-3 w-3 text-muted-foreground" />
                              {p.merchant_profile.full_name}
                            </span>
                          ) : (
                            <span>Commerçant</span>
                          )}

                          {p.merchant_profile?.email && (
                            <>
                              <span>·</span>
                              <span className="truncate max-w-[200px]">{p.merchant_profile.email}</span>
                            </>
                          )}
                        </div>

                        {p.admin_note && (
                          <p className="text-[11px] bg-muted/40 px-2 py-1 rounded-md text-muted-foreground border inline-block">
                            Note : {p.admin_note}
                          </p>
                        )}
                      </div>

                      {/* Colonne 2: Date, Montant et Méthode */}
                      <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs text-muted-foreground">
                        <div>
                          <p className="text-[10px] uppercase font-semibold text-muted-foreground/70">Montant</p>
                          <p className="text-base font-black text-foreground">
                            {formatUSD(amountUSD)}
                          </p>
                        </div>

                        <div>
                          <p className="text-[10px] uppercase font-semibold text-muted-foreground/70">Date</p>
                          <p className="font-medium text-foreground/90">
                            {new Date(p.cree_le || p.created_at).toLocaleDateString("fr-FR", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>

                        <div>
                          <p className="text-[10px] uppercase font-semibold text-muted-foreground/70">Passerelle</p>
                          <p className="font-medium capitalize text-foreground/90">
                            {p.methode === "saspay" ? "SasPay (Mobile Money)" : p.methode || p.method || "SasPay"}
                          </p>
                        </div>
                      </div>

                      {/* Colonne 3: Statut & Actions */}
                      <div className="flex items-center justify-between lg:justify-end gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0">
                        {/* Badge de Statut propre */}
                        <div
                          className={cn(
                            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border",
                            badge.container
                          )}
                        >
                          <span className={cn("h-1.5 w-1.5 rounded-full", badge.dot)} />
                          <span>{badge.label}</span>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedPayment(p)}
                            className="rounded-xl h-8 px-3 text-xs gap-1.5 font-semibold"
                          >
                            <Eye className="h-3.5 w-3.5 text-muted-foreground" /> Détails
                          </Button>

                          {/* Uniquement pour les paiements nécessitant une revue manuelle */}
                          {isManualReview && (
                            <>
                              <Button
                                size="sm"
                                onClick={() =>
                                  setReviewModal({
                                    paymentId: p.id,
                                    decision: "valider",
                                    shopName: p.shops?.name || "cette boutique",
                                  })
                                }
                                className="rounded-xl h-8 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Valider
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setReviewModal({
                                    paymentId: p.id,
                                    decision: "refuser",
                                    shopName: p.shops?.name || "cette boutique",
                                  })
                                }
                                className="rounded-xl h-8 px-2.5 text-xs text-rose-500 hover:bg-rose-500/10 border-rose-200 font-bold"
                              >
                                <XCircle className="h-3.5 w-3.5 mr-1" /> Refuser
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── TAB 2: JOURNAL DES WEBHOOKS ──────────────────────────────────── */}
        <TabsContent value="events" className="space-y-4 m-0">
          <div className="rounded-2xl border bg-card p-5 space-y-1">
            <h3 className="font-extrabold text-base flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" /> Journal Brut des Notifications Webhooks
            </h3>
            <p className="text-xs text-muted-foreground">
              Toutes les notifications instantanées transmises par SasPay vers votre serveur.
            </p>
          </div>

          {eventsQuery.isLoading ? (
            <div className="p-12 text-center rounded-2xl border bg-card text-muted-foreground animate-pulse">
              Chargement du journal…
            </div>
          ) : ((eventsQuery.data as any[]) ?? []).length === 0 ? (
            <div className="p-12 text-center border-2 border-dashed rounded-3xl bg-muted/10 text-muted-foreground">
              <Activity className="h-10 w-10 mx-auto opacity-20 mb-2" />
              <p className="font-semibold text-sm">Aucun événement webhook reçu pour le moment</p>
              <p className="text-xs mt-1">Les webhooks s'afficheront ici automatiquement dès réception.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {((eventsQuery.data as any[]) ?? []).map((ev: any) => (
                <div
                  key={ev.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border bg-card text-xs hover:bg-muted/20 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold bg-muted px-2 py-0.5 rounded text-[11px]">
                        {ev.type_evenement}
                      </span>
                      {ev.signature_valide ? (
                        <span className="flex items-center gap-1 text-emerald-600 font-semibold text-[11px]">
                          <ShieldCheck className="h-3.5 w-3.5" /> Signature valide
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-rose-500 font-semibold text-[11px]">
                          <ShieldAlert className="h-3.5 w-3.5" /> Signature invalide
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground">
                      Reçu le : {new Date(ev.recu_le).toLocaleString("fr-FR")}
                      {ev.session_id && ` · Session: ${ev.session_id}`}
                      {ev.resultat && ` · Résultat: ${ev.resultat}`}
                    </p>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedEvent(ev)}
                    className="rounded-xl h-7 px-2.5 text-[11px] self-start sm:self-center"
                  >
                    Voir corps JSON
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── MODAL : DÉTAIL DU PAIEMENT ────────────────────────────────────── */}
      <Dialog open={!!selectedPayment} onOpenChange={(o) => !o && setSelectedPayment(null)}>
        <DialogContent className="max-w-lg rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" /> Détails du paiement
            </DialogTitle>
            <DialogDescription>
              Identifiant de transaction : <span className="font-mono text-xs">{selectedPayment?.id}</span>
            </DialogDescription>
          </DialogHeader>

          {selectedPayment && (
            <div className="space-y-3 py-2 text-xs">
              <div className="grid grid-cols-2 gap-2 p-3.5 rounded-2xl bg-muted/40 border">
                <div>
                  <span className="text-muted-foreground">Boutique</span>
                  <p className="font-bold text-sm text-foreground">{selectedPayment.shops?.name || "N/A"}</p>
                  {selectedPayment.merchant_profile && (
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      <p className="font-medium text-foreground">{selectedPayment.merchant_profile.full_name}</p>
                      <p>{selectedPayment.merchant_profile.email}</p>
                      {selectedPayment.merchant_profile.phone && <p>{selectedPayment.merchant_profile.phone}</p>}
                    </div>
                  )}
                </div>
                <div>
                  <span className="text-muted-foreground">Plan demandé</span>
                  <p className="font-bold text-sm text-foreground uppercase">
                    {selectedPayment.plan_id} ({selectedPayment.period || "mensuel"})
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Créé le : {new Date(selectedPayment.cree_le || selectedPayment.created_at).toLocaleString("fr-FR")}
                  </p>
                  {selectedPayment.paye_le && (
                    <p className="text-[11px] text-emerald-600 font-medium">
                      Payé le : {new Date(selectedPayment.paye_le).toLocaleString("fr-FR")}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 p-3.5 rounded-2xl bg-muted/40 border">
                <div>
                  <span className="text-muted-foreground">Montant total</span>
                  <p className="font-bold text-base text-primary">
                    {formatUSD(selectedPayment.montant_usd ?? selectedPayment.montant_cdf ?? (selectedPayment.amount || 0))}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Statut</span>
                  <p className="font-bold text-sm capitalize">{selectedPayment.statut || selectedPayment.status}</p>
                </div>
              </div>

              <div className="space-y-2 p-3.5 rounded-2xl border">
                <p className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider">Passerelle de paiement</p>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Méthode :</span>
                  <span className="font-semibold">{selectedPayment.methode === "saspay" ? "SasPay (Mobile Money)" : selectedPayment.methode || "saspay"}</span>
                </div>
                {selectedPayment.saspay_session_id && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Session ID :</span>
                    <span className="font-mono text-[11px] truncate max-w-[240px]">{selectedPayment.saspay_session_id}</span>
                  </div>
                )}
                {selectedPayment.saspay_transaction_id && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Transaction ID :</span>
                    <span className="font-mono text-[11px] truncate max-w-[240px]">{selectedPayment.saspay_transaction_id}</span>
                  </div>
                )}
                {selectedPayment.checkout_url && (
                  <div className="flex justify-between items-center pt-1.5 border-t">
                    <span className="text-muted-foreground">Page de paiement :</span>
                    <a
                      href={selectedPayment.checkout_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline font-semibold flex items-center gap-1 text-[11px]"
                    >
                      Ouvrir la session SasPay <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
                {selectedPayment.frais != null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Frais :</span>
                    <span>{formatUSD(selectedPayment.frais)}</span>
                  </div>
                )}
                {selectedPayment.montant_net != null && (
                  <div className="flex justify-between font-bold">
                    <span>Montant net :</span>
                    <span>{formatUSD(selectedPayment.montant_net)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedPayment(null)} className="rounded-xl">
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MODAL : CORPS JSON DU WEBHOOK ─────────────────────────────────── */}
      <Dialog open={!!selectedEvent} onOpenChange={(o) => !o && setSelectedEvent(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Détails de l'événement webhook</DialogTitle>
            <DialogDescription>
              Événement : <span className="font-mono">{selectedEvent?.type_evenement}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto bg-muted/60 p-4 rounded-2xl border font-mono text-[11px] leading-relaxed">
            <pre>{JSON.stringify(selectedEvent?.corps ?? {}, null, 2)}</pre>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedEvent(null)} className="rounded-xl">
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MODAL : VALIDATION / REFUS MANUEL (Uniquement si manuel ou à vérifier) ── */}
      <AlertDialog open={!!reviewModal} onOpenChange={(o) => !o && setReviewModal(null)}>
        <AlertDialogContent className="max-w-md rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold">
              {reviewModal?.decision === "valider" ? "Valider le paiement et activer le plan ?" : "Refuser le paiement ?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {reviewModal?.decision === "valider"
                ? `La validation activera immédiatement l'abonnement pour ${reviewModal?.shopName} en appliquant les dates et limites de son plan.`
                : `Le paiement sera marqué comme refusé pour ${reviewModal?.shopName}.`}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-2 space-y-1.5">
            <Label className="text-xs">Note administrative (optionnelle)</Label>
            <Input
              placeholder="ex: Vérifié sur relevé bancaire / rejeté motif..."
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              className="h-9 rounded-xl text-xs"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl" disabled={isSubmittingReview}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmReview}
              disabled={isSubmittingReview}
              className={cn(
                "rounded-xl font-bold",
                reviewModal?.decision === "valider"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              )}
            >
              {isSubmittingReview ? "Traitement…" : reviewModal?.decision === "valider" ? "Confirmer la validation" : "Confirmer le refus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── MODAL : ATTRIBUTION MANUELLE D'UN PLAN ────────────────────────── */}
      <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <form onSubmit={handleAssignPlan} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <Store className="h-5 w-5 text-primary" /> Attribution manuelle d'un plan
              </DialogTitle>
              <DialogDescription>
                Attribuez ou renouvelez directement un plan sans passer par une transaction bancaire en ligne.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-1">
              <div className="space-y-1">
                <Label className="text-xs">Boutique bénéficiaire</Label>
                <select
                  value={assignShopId}
                  onChange={(e) => setAssignShopId(e.target.value)}
                  className="flex h-11 w-full rounded-xl border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  required
                >
                  <option value="">Sélectionnez une boutique...</option>
                  {(shopsQuery.data ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.slug}) — Plan actuel : {s.plan_id}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Plan à attribuer</Label>
                  <select
                    value={assignPlanId}
                    onChange={(e) => setAssignPlanId(e.target.value)}
                    className="flex h-11 w-full rounded-xl border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <option value="pro">Pro</option>
                    <option value="business">Business</option>
                    <option value="free">Gratuit</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Période</Label>
                  <select
                    value={assignPeriod}
                    onChange={(e) => setAssignPeriod(e.target.value as SubscriptionPeriod)}
                    className="flex h-11 w-full rounded-xl border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <option value="mensuel">Mensuel (+1 mois)</option>
                    <option value="annuel">Annuel (+1 an)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Note ou justification (optionnelle)</Label>
                <Input
                  placeholder="ex: Partenariat, test offert, paiement cash direct..."
                  value={assignNote}
                  onChange={(e) => setAssignNote(e.target.value)}
                  className="h-10 rounded-xl text-xs"
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setIsAssignModalOpen(false)} className="rounded-xl">
                Annuler
              </Button>
              <Button type="submit" disabled={isAssigning} className="rounded-xl font-bold">
                {isAssigning ? "Attribution…" : "Activer l'abonnement"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
