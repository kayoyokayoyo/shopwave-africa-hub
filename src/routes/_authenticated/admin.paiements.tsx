import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
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
  ChevronLeft,
  ChevronRight,
  FileDown,
  Mail,
  Lock,
  EyeOff,
  Sparkles,
} from "lucide-react";
import {
  adminGetPayments,
  adminReviewPayment,
  adminAssignPlan,
  adminGetPaymentEvents,
} from "@/lib/subscriptions.functions";
import { formatCDF, type SubscriptionPeriod } from "@/lib/subscriptions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/paiements")({
  head: () => ({
    meta: [{ title: "Paiements & Abonnements — Admin MarketNet" }],
  }),
  component: AdminPaymentsPage,
});

type FilterStatus = "all" | "saspay" | "attribue" | "en_attente" | "à_vérifier" | "échoué" | "annulé";

function isPaymentAttributed(p: any): boolean {
  const isPaid = p.statut === "payé" || p.status === "approved";
  const isManual = p.methode === "manuel" || p.method === "manuel" || p.method === "cash" || p.admin_note?.includes("Attribution");
  return isPaid && isManual;
}

function getNormalizedStatus(p: any): string {
  const s = p.statut || (p.status === "approved" ? "payé" : p.status === "rejected" ? "échoué" : "en_attente");
  if (s === "payé" || s === "en_attente" || s === "à_vérifier" || s === "échoué" || s === "annulé") {
    return s;
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
  accent,
  className,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  accent?: "green" | "amber" | "blue" | "primary";
  className?: string;
}) {
  const accentMap = {
    green:   { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-600", ring: "ring-emerald-500/20" },
    amber:   { bg: "bg-amber-500/10",   border: "border-amber-500/20",   text: "text-amber-600",   ring: "ring-amber-500/20" },
    blue:    { bg: "bg-blue-500/10",    border: "border-blue-500/20",    text: "text-blue-600",    ring: "ring-blue-500/20" },
    primary: { bg: "bg-primary/10",     border: "border-primary/20",     text: "text-primary",     ring: "ring-primary/20" },
  };
  const a = accentMap[accent ?? "primary"];
  return (
    <div className={cn("relative rounded-2xl border bg-card p-5 shadow-sm space-y-3 overflow-hidden group hover:shadow-md transition-shadow", className)}>
      <div className="absolute inset-x-0 top-0 h-0.5 rounded-t-2xl" style={{ background: accent === "green" ? "#10b981" : accent === "amber" ? "#f59e0b" : accent === "blue" ? "#3b82f6" : "hsl(var(--primary))" }} />
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">{title}</span>
        <div className={cn("p-2.5 rounded-xl border", a.bg, a.border)}>
          <span className={a.text}>{icon}</span>
        </div>
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
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8;
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
  const [assignAdminPassword, setAssignAdminPassword] = useState("");
  const [showAssignPassword, setShowAssignPassword] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);

  async function handleAssignPlan(e: React.FormEvent) {
    e.preventDefault();
    if (!assignShopId) return toast.error("Veuillez sélectionner une boutique");
    if (!assignNote || assignNote.trim().length < 3) {
      return toast.error("Veuillez préciser le motif de l'attribution (ex: paiement cash, partenariat)");
    }
    if (!assignAdminPassword) {
      return toast.error("Veuillez entrer votre mot de passe administrateur pour confirmer");
    }

    setIsAssigning(true);
    try {
      await assignPlanFn({
        data: {
          shopId: assignShopId,
          planId: assignPlanId,
          period: assignPeriod,
          note: assignNote.trim(),
          adminPassword: assignAdminPassword,
        },
      });
      toast.success("Abonnement attribué et activé ! La lettre d'attribution a été envoyée par email au commerçant.");
      setIsAssignModalOpen(false);
      setAssignAdminPassword("");
      setAssignNote("");
      qc.invalidateQueries({ queryKey: ["admin-subscription-payments-all"] });
      qc.invalidateQueries({ queryKey: ["admin-shops-lite"] });
      qc.invalidateQueries({ queryKey: ["admin-payment-events"] });
      qc.invalidateQueries({ queryKey: ["adminStats"] });
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

  // Compute Metrics (Option 2 : Séparation Encaissé SasPay vs Attributions Admin)
  const metrics = useMemo(() => {
    let saspayCollectedCDF = 0;
    let saspayPaidCount = 0;
    let assignedValueCDF = 0;
    let assignedCount = 0;
    let pendingCount = 0;
    let failedCount = 0;
    let toReviewCount = 0;
    let cancelledCount = 0;

    for (const p of allPayments) {
      const s = getNormalizedStatus(p);
      const amount = Number(p.montant_cdf ?? p.amount ?? 0);
      const attributed = isPaymentAttributed(p);

      if (attributed) {
        assignedCount++;
        assignedValueCDF += amount;
      } else if (s === "payé") {
        saspayPaidCount++;
        saspayCollectedCDF += amount;
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
      saspayCollectedCDF,
      saspayPaidCount,
      assignedValueCDF,
      assignedCount,
      pendingCount,
      failedCount,
      toReviewCount,
      cancelledCount,
      totalCount: allPayments.length,
      totalCombinedCDF: saspayCollectedCDF + assignedValueCDF,
    };
  }, [allPayments]);

  // Filtered Payments List
  const filteredPayments = useMemo(() => {
    return allPayments.filter((p) => {
      const effectiveStatut = getNormalizedStatus(p);
      const attributed = isPaymentAttributed(p);

      if (statusFilter === "saspay") {
        if (effectiveStatut !== "payé" || attributed) return false;
      } else if (statusFilter === "attribue") {
        if (!attributed) return false;
      } else if (statusFilter !== "all" && effectiveStatut !== statusFilter) {
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

  // Reset page when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / ITEMS_PER_PAGE));
  const paginatedPayments = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredPayments.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredPayments, currentPage]);

  const filterTabs: { id: FilterStatus; label: string; count: number }[] = [
    { id: "all", label: "Tous", count: metrics.totalCount },
    { id: "saspay", label: "Payés SasPay", count: metrics.saspayPaidCount },
    { id: "attribue", label: "Attribués (Admin)", count: metrics.assignedCount },
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
            Suivi des transactions, plans actifs et gestion des abonnements en Franc Congolais (FC) via SasPay.
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
            className="rounded-xl font-bold h-10 shadow-sm text-xs sm:text-sm gap-1.5"
          >
            <Plus className="h-4 w-4" /> Attribuer un plan
          </Button>
        </div>
      </div>

      {/* ── Cartes métriques (Option 2 : SasPay Réel vs Attributions Admin) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          accent="green"
          title="Encaissé SasPay (Réel)"
          value={formatCDF(metrics.saspayCollectedCDF)}
          subtitle={`${metrics.saspayPaidCount} paiement(s) mobile money`}
          icon={<CreditCard className="h-4 w-4" />}
        />
        <MetricCard
          accent="blue"
          title="Attributions Admin"
          value={formatCDF(metrics.assignedValueCDF)}
          subtitle={`${metrics.assignedCount} plan(s) attribué(s)`}
          icon={<Sparkles className="h-4 w-4" />}
        />
        <MetricCard
          accent="amber"
          title="En attente SasPay"
          value={metrics.pendingCount}
          subtitle="Sessions en cours"
          icon={<Clock3 className="h-4 w-4" />}
        />
        <MetricCard
          accent="primary"
          title="Total Transactions"
          value={metrics.totalCount}
          subtitle={`Volume global (${formatCDF(metrics.totalCombinedCDF)})`}
          icon={<CreditCard className="h-4 w-4" />}
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

            {/* Liste épurée, aérée et moderne style historique commerçant */}
            {!paymentsQuery.isLoading && !paymentsQuery.isError && filteredPayments.length > 0 && (
              <div>
                <div className="divide-y divide-border/60">
                  {paginatedPayments.map((p: any) => {
                    const effectiveStatut = getNormalizedStatus(p);
                    const amountCDF = Number(p.montant_cdf ?? p.amount ?? 0);

                    const isAttributed =
                      (p.methode === "manuel" || p.method === "manuel" || p.method === "cash" || p.admin_note?.includes("Attribution")) &&
                      effectiveStatut === "payé";

                    const statusDot = isAttributed
                      ? "bg-blue-500"
                      : (
                          {
                            payé: "bg-emerald-500",
                            en_attente: "bg-amber-500 animate-pulse",
                            à_vérifier: "bg-blue-500 animate-pulse",
                            échoué: "bg-rose-500",
                            annulé: "bg-muted-foreground/40",
                          } as Record<string, string>
                        )[effectiveStatut] ?? "bg-muted-foreground/40";

                    const statusLabel = isAttributed
                      ? "Attribué"
                      : (
                          {
                            payé: "Payé",
                            en_attente: "En attente",
                            à_vérifier: "À vérifier",
                            échoué: "Échoué",
                            annulé: "Annulé",
                          } as Record<string, string>
                        )[effectiveStatut] ?? effectiveStatut;

                    const statusColor = isAttributed
                      ? "text-blue-600 dark:text-blue-400 font-semibold"
                      : (
                          {
                            payé: "text-emerald-600 dark:text-emerald-400 font-semibold",
                            en_attente: "text-amber-600 dark:text-amber-400 font-semibold",
                            à_vérifier: "text-blue-600 dark:text-blue-400 font-semibold",
                            échoué: "text-rose-600 dark:text-rose-400 font-semibold",
                            annulé: "text-muted-foreground",
                          } as Record<string, string>
                        )[effectiveStatut] ?? "text-muted-foreground";

                    // Seuls les paiements en attente manuelle (non payés/validés) nécessitent une action
                    const isManualReview =
                      (p.methode === "manuel" || p.method === "manuel" || effectiveStatut === "à_vérifier") &&
                      effectiveStatut !== "payé" &&
                      effectiveStatut !== "échoué" &&
                      effectiveStatut !== "annulé";

                    return (
                      <div
                        key={p.id}
                        onClick={() => setSelectedPayment(p)}
                        className="flex items-center justify-between p-4 sm:p-4.5 hover:bg-muted/30 transition-colors cursor-pointer group"
                      >
                        {/* Colonne gauche : Pastille statut + Infos Boutique, Plan et Commerçant */}
                        <div className="flex items-center gap-3.5 min-w-0 pr-3">
                          <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", statusDot)} />

                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-bold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                                {p.shops?.name || "Boutique sans nom"}
                              </p>
                              <span className="font-semibold text-[10px] uppercase px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                                Plan {p.plan_id}
                              </span>
                              <span className="text-muted-foreground font-normal text-xs">
                                · {p.period || "mensuel"}
                              </span>
                            </div>

                            <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5 flex-wrap">
                              <span className="font-medium text-foreground/80">
                                {p.merchant_profile?.full_name || "Commerçant"}
                              </span>
                              {p.merchant_profile?.email && (
                                <>
                                  <span>·</span>
                                  <span className="truncate max-w-[200px]">{p.merchant_profile.email}</span>
                                </>
                              )}
                              <span>·</span>
                              <span>
                                {new Date(p.cree_le || p.created_at).toLocaleDateString("fr-FR", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                              <span>·</span>
                              <span className="capitalize text-muted-foreground/80 font-medium">
                                {isAttributed ? "Attribution admin" : p.methode === "saspay" ? "SasPay" : p.methode || "SasPay"}
                              </span>
                            </p>
                          </div>
                        </div>

                        {/* Colonne droite : Montant + Statut + Actions manuelles éventuelles + Chevron */}
                        <div className="flex items-center gap-3 shrink-0 text-right">
                          <div>
                            <p className="font-black text-sm text-foreground">{formatCDF(amountCDF)}</p>
                            <p className={cn("text-[11px]", statusColor)}>{statusLabel}</p>
                          </div>

                          {/* Actions rapides de validation pour paiement manuel */}
                          {isManualReview && (
                            <div className="flex items-center gap-1.5 ml-1" onClick={(e) => e.stopPropagation()}>
                              <Button
                                size="sm"
                                onClick={() =>
                                  setReviewModal({
                                    paymentId: p.id,
                                    decision: "valider",
                                    shopName: p.shops?.name || "cette boutique",
                                  })
                                }
                                className="rounded-xl h-7 px-2 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                              >
                                <CheckCircle2 className="h-3 w-3 mr-1" /> Valider
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
                                className="rounded-xl h-7 px-2 text-[11px] text-rose-500 hover:bg-rose-500/10 border-rose-200 font-bold"
                              >
                                <XCircle className="h-3 w-3 mr-1" /> Refuser
                              </Button>
                            </div>
                          )}

                          <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination épurée */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between p-3.5 border-t bg-muted/15 text-xs text-muted-foreground">
                    <span className="text-[11px]">
                      Page {currentPage} sur {totalPages} · {filteredPayments.length} transaction{filteredPayments.length > 1 ? "s" : ""}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="h-8 rounded-xl px-2.5 text-xs gap-1"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" /> Précédent
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="h-8 rounded-xl px-2.5 text-xs gap-1"
                      >
                        Suivant <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
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
        <DialogContent className="w-[calc(100%-2rem)] sm:w-full max-w-lg rounded-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" /> Détails du paiement
            </DialogTitle>
            <DialogDescription>
              Identifiant de transaction : <span className="font-mono text-xs">{selectedPayment?.id}</span>
            </DialogDescription>
          </DialogHeader>

          {selectedPayment && (
            <div className="space-y-3 py-2 text-xs overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3.5 rounded-2xl bg-muted/40 border">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3.5 rounded-2xl bg-muted/40 border">
                <div>
                  <span className="text-muted-foreground">Montant total</span>
                  <p className="font-bold text-base text-primary">
                    {formatCDF(Number(selectedPayment.montant_cdf ?? selectedPayment.amount ?? 0))}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Statut</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {(() => {
                      const isModalAttributed =
                        (selectedPayment.methode === "manuel" || selectedPayment.method === "manuel" || selectedPayment.method === "cash" || selectedPayment.admin_note?.includes("Attribution")) &&
                        getNormalizedStatus(selectedPayment) === "payé";
                      if (isModalAttributed) {
                        return (
                          <span className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-bold text-sm">
                            <span className="h-2 w-2 rounded-full bg-blue-500" /> Attribué (Validé)
                          </span>
                        );
                      }
                      return (
                        <p className="font-bold text-sm capitalize">{selectedPayment.statut || selectedPayment.status}</p>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {selectedPayment.admin_note && (
                <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs">
                  <span className="font-bold text-blue-700 dark:text-blue-300">Note d'attribution / Motif :</span>
                  <p className="text-muted-foreground mt-0.5">{selectedPayment.admin_note}</p>
                </div>
              )}

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
                    <span>{formatCDF(selectedPayment.frais)}</span>
                  </div>
                )}
                {selectedPayment.montant_net != null && (
                  <div className="flex justify-between font-bold">
                    <span>Montant net :</span>
                    <span>{formatCDF(selectedPayment.montant_net)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
            {selectedPayment && getNormalizedStatus(selectedPayment) === "payé" && (
              <Button
                variant="outline"
                onClick={() =>
                  window.open(`/api/public/invoice-pdf?paymentId=${selectedPayment.id}`, "_blank")
                }
                className="rounded-xl font-semibold text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
              >
                <FileDown className="h-3.5 w-3.5" /> Télécharger la facture PDF
              </Button>
            )}
            <Button variant="outline" onClick={() => setSelectedPayment(null)} className="rounded-xl">
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MODAL : CORPS JSON DU WEBHOOK ─────────────────────────────────── */}
      <Dialog open={!!selectedEvent} onOpenChange={(o) => !o && setSelectedEvent(null)}>
        <DialogContent className="w-[calc(100%-2rem)] sm:w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Détails de l'événement webhook</DialogTitle>
            <DialogDescription>
              Événement : <span className="font-mono text-xs break-all">{selectedEvent?.type_evenement}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-auto bg-muted/60 p-4 rounded-2xl border font-mono text-[11px] leading-relaxed">
            <pre className="whitespace-pre-wrap break-words">{JSON.stringify(selectedEvent?.corps ?? {}, null, 2)}</pre>
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
        <AlertDialogContent className="w-[calc(100%-2rem)] sm:w-full max-w-md rounded-3xl">
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

          <AlertDialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
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
        <DialogContent className="w-[calc(100%-2rem)] sm:w-full max-w-md rounded-3xl max-h-[90vh] flex flex-col">
          <form onSubmit={handleAssignPlan} className="flex flex-col flex-1 overflow-y-auto space-y-4">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <Store className="h-5 w-5 text-primary" /> Attribution manuelle d'un plan
              </DialogTitle>
              <DialogDescription>
                Attribuez ou prolongez directement un abonnement (espèces, virement, partenariat ou test).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 py-1">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Boutique bénéficiaire</Label>
                <select
                  value={assignShopId}
                  onChange={(e) => setAssignShopId(e.target.value)}
                  className="flex h-11 w-full rounded-xl border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-medium"
                  required
                >
                  <option value="">Sélectionnez une boutique...</option>
                  {(shopsQuery.data ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.slug}) — Plan actuel : {s.plan_id.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Plan à attribuer</Label>
                  <select
                    value={assignPlanId}
                    onChange={(e) => setAssignPlanId(e.target.value)}
                    className="flex h-11 w-full rounded-xl border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-medium"
                  >
                    <option value="pro">Plan Pro</option>
                    <option value="business">Plan Business</option>
                    <option value="free">Formule Gratuite (Free)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Période</Label>
                  <select
                    value={assignPeriod}
                    onChange={(e) => setAssignPeriod(e.target.value as SubscriptionPeriod)}
                    className="flex h-11 w-full rounded-xl border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-medium"
                  >
                    <option value="mensuel">Mensuel (+1 mois)</option>
                    <option value="annuel">Annuel (+1 an)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Motif de l'attribution <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="ex: Paiement cash reçu, partenariat officiel, période d'essai..."
                  value={assignNote}
                  onChange={(e) => setAssignNote(e.target.value)}
                  className="h-10 rounded-xl text-xs"
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Cette justification sera inscrite dans le journal d'audit et la référence comptable.
                </p>
              </div>

              {/* Champ Mot de passe Administrateur */}
              <div className="space-y-1.5 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                    <Lock className="h-3.5 w-3.5 text-primary" />
                    Mot de passe administrateur <span className="text-destructive">*</span>
                  </Label>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                    Sécurité
                  </span>
                </div>
                <div className="relative">
                  <Input
                    type={showAssignPassword ? "text" : "password"}
                    placeholder="Tapez votre mot de passe pour confirmer"
                    value={assignAdminPassword}
                    onChange={(e) => setAssignAdminPassword(e.target.value)}
                    className="h-10 rounded-xl text-xs pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowAssignPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    title={showAssignPassword ? "Masquer" : "Afficher"}
                  >
                    {showAssignPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Notice de sécurité */}
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px] leading-relaxed">
                🔒 <strong>Sécurité renforcée :</strong> Votre mot de passe est vérifié avant d'appliquer le changement. L'attribution sera tracée dans le journal d'audit et l'historique des paiements.
              </div>
            </div>

            <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsAssignModalOpen(false)} className="rounded-xl">
                Annuler
              </Button>
              <Button type="submit" disabled={isAssigning} className="rounded-xl font-bold gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                {isAssigning ? "Validation en cours…" : "Confirmer et activer le plan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
