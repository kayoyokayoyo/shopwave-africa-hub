import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import {
  CreditCard,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  DollarSign,
  Plus,
  Eye,
  Activity,
  Layers,
  Store,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import {
  getPlanPrices,
  adminUpdatePlanPrice,
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

const STATUS_FILTERS = [
  { id: "all", label: "Tous" },
  { id: "en_attente", label: "En attente" },
  { id: "à_vérifier", label: "À vérifier" },
  { id: "payé", label: "Payés" },
  { id: "échoué", label: "Échoués" },
  { id: "expiré", label: "Expirés" },
  { id: "annulé", label: "Annulés" },
];

function statusColor(status: string | null) {
  switch (status) {
    case "payé":
    case "approved":
      return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
    case "en_attente":
    case "pending":
      return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30";
    case "à_vérifier":
      return "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30";
    case "échoué":
    case "rejected":
    case "annulé":
      return "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function AdminPaymentsPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"payments" | "prices" | "events">("payments");
  const [statusFilter, setStatusFilter] = useState("all");
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
  const fetchPricesFn = useServerFn(getPlanPrices);
  const fetchEventsFn = useServerFn(adminGetPaymentEvents);
  const reviewPaymentFn = useServerFn(adminReviewPayment);
  const updatePriceFn = useServerFn(adminUpdatePlanPrice);
  const assignPlanFn = useServerFn(adminAssignPlan);

  // Queries
  const paymentsQuery = useQuery({
    queryKey: ["admin-subscription-payments", statusFilter],
    queryFn: () => fetchPaymentsFn({ data: { statut: statusFilter } }),
  });

  const pricesQuery = useQuery({
    queryKey: ["admin-plan-prices"],
    queryFn: () => fetchPricesFn(),
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
      qc.invalidateQueries({ queryKey: ["admin-subscription-payments"] });
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
      qc.invalidateQueries({ queryKey: ["admin-subscription-payments"] });
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'opération");
    } finally {
      setIsSubmittingReview(false);
    }
  }

  // Filter payments locally by search term
  const paymentsList = (paymentsQuery.data ?? []).filter((p: any) => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    const shopName = p.shops?.name?.toLowerCase() || "";
    const session = p.saspay_session_id?.toLowerCase() || "";
    const tx = p.saspay_transaction_id?.toLowerCase() || "";
    const ref = p.reference?.toLowerCase() || "";
    return shopName.includes(s) || session.includes(s) || tx.includes(s) || ref.includes(s);
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-primary" /> Paiements & Abonnements
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Suivi des paiements réels, gestion des tarifs en CDF et journal des webhooks.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => setIsAssignModalOpen(true)}
            className="rounded-xl font-bold h-10 shadow-sm"
          >
            <Plus className="h-4 w-4 mr-1.5" /> Attribuer un plan
          </Button>
        </div>
      </div>

      {/* Tabs navigation */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-6">
        <TabsList className="bg-muted/60 p-1 rounded-2xl h-11 w-full sm:w-auto grid grid-cols-3 sm:inline-flex">
          <TabsTrigger value="payments" className="rounded-xl text-xs sm:text-sm font-semibold gap-2">
            <CreditCard className="h-4 w-4" />
            <span>Paiements</span>
          </TabsTrigger>
          <TabsTrigger value="prices" className="rounded-xl text-xs sm:text-sm font-semibold gap-2">
            <DollarSign className="h-4 w-4" />
            <span>Tarifs CDF</span>
          </TabsTrigger>
          <TabsTrigger value="events" className="rounded-xl text-xs sm:text-sm font-semibold gap-2">
            <Activity className="h-4 w-4" />
            <span>Journal Webhooks</span>
          </TabsTrigger>
        </TabsList>

        {/* ── TAB 1: PAIEMENTS ─────────────────────────────────────────────── */}
        <TabsContent value="payments" className="space-y-4 m-0">
          {/* Filters & Search */}
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setStatusFilter(f.id)}
                  className={cn(
                    "rounded-xl px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-colors border",
                    statusFilter === f.id
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-card text-muted-foreground border-border hover:bg-muted"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="relative min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher boutique, réf, session…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-10 rounded-xl"
              />
            </div>
          </div>

          {/* Payments list */}
          {paymentsQuery.isLoading ? (
            <div className="p-12 text-center rounded-2xl border bg-card text-muted-foreground animate-pulse">
              Chargement des paiements…
            </div>
          ) : paymentsList.length === 0 ? (
            <div className="p-12 text-center border-2 border-dashed rounded-3xl bg-muted/10 text-muted-foreground space-y-2">
              <CreditCard className="h-10 w-10 mx-auto opacity-20" />
              <p className="font-semibold text-base">Aucun paiement trouvé</p>
              <p className="text-xs">Aucune transaction ne correspond aux critères sélectionnés.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {paymentsList.map((p: any) => {
                const effectiveStatut = p.statut || (p.status === "approved" ? "payé" : p.status === "rejected" ? "échoué" : "en_attente");
                const amountCDF = p.montant_cdf ?? (p.amount ? p.amount * 2800 : 0);
                const isActionable = effectiveStatut === "à_vérifier" || effectiveStatut === "en_attente" || p.methode === "manuel";

                return (
                  <div
                    key={p.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border bg-card hover:border-primary/40 transition-colors shadow-sm"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-base truncate">
                          {p.shops?.name || "Boutique"}
                        </span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="font-bold text-xs uppercase px-2 py-0.5 rounded-md bg-muted">
                          Plan {p.plan_id} ({p.period || `${p.months || 1} mois`})
                        </span>
                        <span
                          className={cn(
                            "text-xs font-black uppercase px-2 py-0.5 rounded-md border",
                            statusColor(effectiveStatut)
                          )}
                        >
                          {effectiveStatut}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="font-black text-foreground text-sm">
                          {formatCDF(amountCDF)}
                        </span>
                        <span>•</span>
                        <span className="capitalize">Méthode : {p.methode || p.method || "saspay"}</span>
                        <span>•</span>
                        <span>
                          {new Date(p.cree_le || p.created_at).toLocaleDateString("fr-FR", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      {p.admin_note && (
                        <p className="text-xs bg-muted/40 p-1.5 rounded-lg border text-muted-foreground">
                          Note admin : {p.admin_note}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedPayment(p)}
                        className="rounded-xl h-8 px-2.5 text-xs gap-1"
                      >
                        <Eye className="h-3.5 w-3.5" /> Détails
                      </Button>

                      {isActionable && (
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
                            className="rounded-xl h-8 px-2.5 text-xs text-red-500 hover:bg-red-500/10 border-red-200 font-bold"
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" /> Refuser
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── TAB 2: TARIFS DES PLANS (CDF) ─────────────────────────────────── */}
        <TabsContent value="prices" className="space-y-6 m-0">
          <div className="rounded-2xl border bg-card p-5 space-y-2">
            <h3 className="font-extrabold text-base flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" /> Grille Tarifaire en Francs Congolais (CDF)
            </h3>
            <p className="text-xs text-muted-foreground">
              Ces prix sont utilisés lors de la génération des liens de paiement et des renouvellements.
              Aucun prix n'est codé en dur : vous pouvez les modifier en temps réel.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(pricesQuery.data ?? []).map((price) => (
              <PlanPriceCard key={price.id} item={price} onSave={pricesQuery.refetch} updateFn={updatePriceFn} />
            ))}
          </div>
        </TabsContent>

        {/* ── TAB 3: JOURNAL DES WEBHOOKS ──────────────────────────────────── */}
        <TabsContent value="events" className="space-y-4 m-0">
          <div className="rounded-2xl border bg-card p-5 space-y-1">
            <h3 className="font-extrabold text-base flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" /> Journal Brut des Événements Webhooks
            </h3>
            <p className="text-xs text-muted-foreground">
              Historique des notifications instantanées reçues de la passerelle de paiement.
            </p>
          </div>

          {eventsQuery.isLoading ? (
            <div className="p-12 text-center rounded-2xl border bg-card text-muted-foreground animate-pulse">
              Chargement du journal…
            </div>
          ) : ((eventsQuery.data as any[]) ?? []).length === 0 ? (
            <div className="p-12 text-center border-2 border-dashed rounded-3xl bg-muted/10 text-muted-foreground">
              <Activity className="h-10 w-10 mx-auto opacity-20 mb-2" />
              <p className="font-semibold">Aucun événement webhook reçu pour le moment</p>
            </div>
          ) : (
            <div className="space-y-2">
              {((eventsQuery.data as any[]) ?? []).map((ev: any) => (
                <div
                  key={ev.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border bg-card text-xs"
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
                        <span className="flex items-center gap-1 text-red-500 font-semibold text-[11px]">
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
                    className="rounded-xl h-7 px-2 text-[11px] self-start sm:self-center"
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
              <div className="grid grid-cols-2 gap-2 p-3 rounded-2xl bg-muted/40 border">
                <div>
                  <span className="text-muted-foreground">Boutique</span>
                  <p className="font-bold text-sm text-foreground">{selectedPayment.shops?.name || "N/A"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Plan demandé</span>
                  <p className="font-bold text-sm text-foreground uppercase">
                    {selectedPayment.plan_id} ({selectedPayment.period || "mensuel"})
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 p-3 rounded-2xl bg-muted/40 border">
                <div>
                  <span className="text-muted-foreground">Montant total</span>
                  <p className="font-bold text-sm text-primary">
                    {formatCDF(selectedPayment.montant_cdf ?? (selectedPayment.amount ? selectedPayment.amount * 2800 : 0))}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Statut</span>
                  <p className="font-bold text-sm capitalize">{selectedPayment.statut || selectedPayment.status}</p>
                </div>
              </div>

              <div className="space-y-1.5 p-3 rounded-2xl border">
                <p className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider">Passerelle de paiement</p>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Méthode :</span>
                  <span className="font-semibold">{selectedPayment.methode || selectedPayment.method || "saspay"}</span>
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

      {/* ── MODAL : VALIDATION / REFUS MANUEL ─────────────────────────────── */}
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
              className="h-9 rounded-xl"
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
                  className="h-10 rounded-xl"
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

// ── COMPOSANT CARTE DE TARIF (PLAN_PRICES) ──────────────────────────────────

function PlanPriceCard({
  item,
  onSave,
  updateFn,
}: {
  item: any;
  onSave: () => void;
  updateFn: any;
}) {
  const [priceCdf, setPriceCdf] = useState(String(item.price_cdf));
  const [isActive, setIsActive] = useState(Boolean(item.is_active));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const val = Number(priceCdf);
    if (isNaN(val) || val < 0) return toast.error("Montant CDF invalide");
    setSaving(true);
    try {
      await updateFn({
        data: {
          id: item.id,
          price_cdf: val,
          is_active: isActive,
        },
      });
      toast.success(`Tarif mis à jour : ${item.plan_id} (${item.period})`);
      onSave();
    } catch (err: any) {
      toast.error(err.message || "Erreur de mise à jour");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border bg-card p-5 space-y-4 shadow-sm flex flex-col justify-between">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-black text-lg uppercase tracking-wide text-foreground">
            Plan {item.plan_id}
          </span>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize">
            {item.period}
          </span>
        </div>

        <div className="space-y-1.5 pt-2">
          <Label className="text-xs text-muted-foreground">Prix en Francs Congolais (CDF)</Label>
          <div className="relative">
            <Input
              type="number"
              min="0"
              step="500"
              value={priceCdf}
              onChange={(e) => setPriceCdf(e.target.value)}
              className="h-10 rounded-xl pr-12 font-bold text-base"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
              CDF
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="text-xs font-medium text-muted-foreground">Actif à la vente</span>
          <Switch checked={isActive} onCheckedChange={setIsActive} />
        </div>
      </div>

      <Button
        size="sm"
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-xl font-bold h-9 mt-2"
      >
        {saving ? "Enregistrement…" : "Enregistrer ce tarif"}
      </Button>
    </div>
  );
}
