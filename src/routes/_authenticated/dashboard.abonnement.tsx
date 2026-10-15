import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { ComponentType } from "react";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Star,
  Rocket,
  CheckCircle2,
  Shield,
  Receipt,
  Clock,
  ArrowRight,
  Loader2,
  Sparkles,
  AlertCircle,
  HelpCircle,
  Package,
  Camera,
  Tag,
  Share2,
  MessageCircle,
  BarChart3,
  Palette,
  ChevronLeft,
  ChevronRight,
  XCircle,
  ExternalLink,
  Eye,
  RefreshCw,
  FileDown,
  Mail,
  Check,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { useMyShop } from "@/hooks/useMyShop";
import {
  getMerchantSubscription,
  getMerchantPayments,
  getPlanPrices,
  createCheckoutSession,
} from "@/lib/subscriptions.functions";
import { formatCDF, type SubscriptionPeriod } from "@/lib/subscriptions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/** Génère dynamiquement la liste des features d'un plan depuis ses colonnes DB */
function buildPlanFeatures(p: {
  max_products: number | null;
  max_photos: number | null;
  max_active_promotions: number | null;
  meta_access: boolean;
  advanced_themes: boolean;
  advanced_stats: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}): { text: string; icon: ComponentType<any>; strong?: boolean }[] {
  const features: { text: string; icon: ComponentType<any>; strong?: boolean }[] = [];

  // Produits
  features.push({
    icon: Package,
    strong: true,
    text: p.max_products != null
      ? `Jusqu'à ${p.max_products} produits`
      : "Produits illimités",
  });

  // Photos
  features.push({
    icon: Camera,
    text: `${p.max_photos ?? 3} photos par produit`,
  });

  // WhatsApp (toujours inclus)
  features.push({
    icon: MessageCircle,
    text: "Commandes directes WhatsApp",
  });

  // Promotions
  if (p.max_active_promotions === 0) {
    features.push({ icon: Tag, text: "0 promotion incluse" });
  } else if (p.max_active_promotions != null) {
    features.push({ icon: Tag, text: `${p.max_active_promotions} promotion(s) active(s)` });
  } else {
    features.push({ icon: Tag, text: "Promotions actives illimitées" });
  }

  // Meta Ads
  if (p.meta_access) {
    features.push({ icon: Share2, text: "Accès complet Meta Ads (Facebook & Instagram)" });
  }

  // Thèmes premium
  if (p.advanced_themes) {
    features.push({ icon: Palette, text: "Templates & thèmes premium" });
  }

  // Statistiques avancées
  if (p.advanced_stats) {
    features.push({ icon: BarChart3, text: "Statistiques de ventes avancées" });
  }

  return features;
}

/** Squelette de chargement d'une carte plan */
function PlanCardSkeleton() {
  return (
    <div className="rounded-3xl border bg-card p-5 sm:p-6 space-y-4 animate-pulse">
      <div className="h-5 w-24 rounded-full bg-muted" />
      <div className="h-8 w-32 rounded-lg bg-muted" />
      <div className="h-3 w-full rounded bg-muted" />
      <div className="space-y-2 pt-2 border-t">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-3 rounded bg-muted" style={{ width: `${60 + i * 10}%` }} />
        ))}
      </div>
      <div className="h-10 rounded-xl bg-muted" />
    </div>
  );
}

function SubscriptionErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  return (
    <div className="mx-auto max-w-4xl p-6 my-8 rounded-3xl border bg-card text-center space-y-4">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertCircle className="h-6 w-6" />
      </div>
      <div>
        <h2 className="text-xl font-bold">Impossible de charger la page d'abonnement</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "Une erreur de chargement est survenue. Veuillez vérifier votre session ou rafraîchir."}
        </p>
      </div>
      <div className="flex justify-center gap-3">
        <Button onClick={() => reset()} variant="default" className="rounded-xl">
          <RefreshCw className="mr-2 h-4 w-4" /> Réessayer
        </Button>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/dashboard/abonnement")({
  head: () => ({
    meta: [
      { title: "Mon Abonnement & Paiements — MarketNet" },
      { name: "description", content: "Gérez votre formule d'abonnement MarketNet et payez en Francs Congolais (FC) via SasPay." },
    ],
  }),
  errorComponent: SubscriptionErrorComponent,
  component: DashboardAbonnementPage,
});

const ITEMS_PER_PAGE = 5;

type HistoryFilter = "all" | "payé" | "en_attente" | "échoué";

function DashboardAbonnementPage() {
  const { data: shop } = useMyShop();
  const navigate = useNavigate();

  const [selectedPeriod, setSelectedPeriod] = useState<SubscriptionPeriod>("mensuel");
  const [payingPlanId, setPayingPlanId] = useState<string | null>(null);

  // Pagination et filtres de l'historique
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);
  const [copiedRef, setCopiedRef] = useState(false);

  const handleCopyRef = (refText: string) => {
    navigator.clipboard.writeText(refText);
    setCopiedRef(true);
    toast.success("Référence copiée dans le presse-papier");
    setTimeout(() => setCopiedRef(false), 2000);
  };

  const getLimitsFn = useServerFn(getMerchantSubscription);
  const getPaymentsFn = useServerFn(getMerchantPayments);
  const getPricesFn = useServerFn(getPlanPrices);
  const createCheckoutFn = useServerFn(createCheckoutSession);

  // Données de l'abonnement
  const { data: subLimits, isLoading: limitsLoading, refetch: refetchLimits } = useQuery({
    queryKey: ["subscription-limits", shop?.id],
    enabled: !!shop?.id,
    queryFn: () => getLimitsFn({ data: { shopId: shop!.id } }),
  });

  // Historique des paiements
  const { data: paymentHistory, isLoading: paymentsLoading, refetch: refetchPayments, isFetching: paymentsFetching } = useQuery({
    queryKey: ["merchant-payments", shop?.id],
    enabled: !!shop?.id,
    queryFn: () => getPaymentsFn({ data: { shopId: shop!.id } }),
  });

  // Tarifs depuis la base de données
  const { data: planPrices, isLoading: pricesLoading } = useQuery({
    queryKey: ["plan-prices"],
    queryFn: () => getPricesFn(),
  });

  // Plans actifs depuis la base de données
  const { data: dbPlans, isLoading: plansLoading } = useQuery({
    queryKey: ["plans-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .eq("active", true)
        .order("position", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Lancement du paiement SasPay
  async function handlePay(planId: string) {
    if (!shop?.id) return;
    setPayingPlanId(planId);
    try {
      const res = await createCheckoutFn({
        data: {
          shopId: shop.id,
          planId,
          period: selectedPeriod,
        },
      });

      if (res?.checkoutUrl) {
        if (res.reused) {
          toast.info("Session de paiement en cours réutilisée. Redirection…");
        } else {
          toast.success("Session SasPay créée. Redirection…");
        }
        window.location.href = res.checkoutUrl;
      } else {
        toast.error("Impossible d'obtenir le lien de paiement.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors de la création du paiement";
      toast.error(msg);
    } finally {
      setPayingPlanId(null);
    }
  }

  const currentPlanId = subLimits?.plan_id || shop?.plan_id || "free";
  const isGrace = subLimits?.is_grace_period;
  const isExpired = subLimits?.status === "expiré";

  // Résolution précise et robuste du statut (priorité à statut sur le legacy status)
  function resolvePaymentStatus(pay: any): "payé" | "en_attente" | "échoué" | "annulé" {
    if (pay.statut === "payé" || pay.status === "approved") return "payé";
    if (pay.statut === "échoué" || pay.status === "rejected") return "échoué";
    if (pay.statut === "annulé") return "annulé";
    if (pay.statut === "expiré") return "échoué";
    if (pay.statut === "en_attente" || pay.statut === "à_vérifier") return "en_attente";
    if (!pay.statut && pay.status === "pending") return "en_attente";
    return "échoué";
  }

  // Traitement et pagination de l'historique
  const allHistory = useMemo(() => paymentHistory ?? [], [paymentHistory]);

  const historyCounts = useMemo(() => {
    let paye = 0;
    let enAttente = 0;
    let echoue = 0;

    for (const p of allHistory) {
      const st = resolvePaymentStatus(p);
      if (st === "payé") paye++;
      else if (st === "en_attente") enAttente++;
      else echoue++;
    }

    return {
      all: allHistory.length,
      payé: paye,
      en_attente: enAttente,
      échoué: echoue,
    };
  }, [allHistory]);

  const filteredHistory = useMemo(() => {
    return allHistory.filter((pay) => {
      if (historyFilter === "all") return true;
      const st = resolvePaymentStatus(pay);
      if (historyFilter === "payé") return st === "payé";
      if (historyFilter === "en_attente") return st === "en_attente";
      if (historyFilter === "échoué") return st === "échoué" || st === "annulé";
      return true;
    });
  }, [allHistory, historyFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / ITEMS_PER_PAGE));
  const paginatedHistory = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredHistory.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredHistory, currentPage]);

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-16">
      {/* ── En-tête ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold mb-2">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Formules & Facturation</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Mon Abonnement</h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Choisissez la formule adaptée à la croissance de votre boutique et réglez en Francs Congolais (FC).
          </p>
        </div>
      </div>

      {/* ── Alertes de renouvellement et de période de grâce ─────────────── */}
      {subLimits?.reminder_level === "7_days" && !isGrace && (
        <div className="flex items-center gap-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 text-amber-800 dark:text-amber-200 text-xs sm:text-sm">
          <Clock className="h-5 w-5 shrink-0 text-amber-600" />
          <div className="space-y-0.5">
            <p className="font-bold">Votre formule expire dans {subLimits.days_remaining} jour(s)</p>
            <p className="opacity-90">Renouvelez dès aujourd'hui sans perdre vos jours restants.</p>
          </div>
        </div>
      )}

      {subLimits?.reminder_level === "3_days" && !isGrace && (
        <div className="flex items-center gap-3 rounded-2xl bg-orange-500/15 border border-orange-500/30 p-4 text-orange-800 dark:text-orange-200 text-xs sm:text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 text-orange-600" />
          <div className="space-y-0.5">
            <p className="font-bold">Expiration imminente : plus que {subLimits.days_remaining} jour(s)</p>
            <p className="opacity-90">Renouvelez maintenant pour éviter l'interruption des fonctionnalités avancées.</p>
          </div>
        </div>
      )}

      {isGrace && (
        <div className="flex items-center gap-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 p-4 text-amber-900 dark:text-amber-200 text-xs sm:text-sm">
          <Clock className="h-5 w-5 shrink-0 text-amber-600 animate-pulse" />
          <div className="space-y-0.5">
            <p className="font-bold">Période de grâce de 7 jours active</p>
            <p className="opacity-90">
              Votre abonnement est arrivé à échéance. Vous bénéficiez de 7 jours pour renouveler avant le masquage des produits excédentaires.
            </p>
          </div>
        </div>
      )}

      {isExpired && (
        <div className="flex items-center gap-3 rounded-2xl bg-red-500/15 border border-red-500/30 p-4 text-red-900 dark:text-red-200 text-xs sm:text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
          <div className="space-y-0.5">
            <p className="font-bold">Abonnement expiré — Formule Gratuite appliquée</p>
            <p className="opacity-90">
              Vos produits au-delà de 10 sont temporairement masqués et vos promotions mises en pause. Souscrivez à nouveau pour tout débloquer.
            </p>
          </div>
        </div>
      )}

      {/* ── Carte de la Formule Active ────────────────────────────────────── */}
      <section className="rounded-3xl border bg-card p-5 sm:p-6 shadow-sm space-y-5">
        {limitsLoading ? (
          <div className="animate-pulse space-y-4">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="space-y-2">
                <div className="h-3 w-28 rounded bg-muted" />
                <div className="h-7 w-36 rounded-lg bg-muted" />
              </div>
              <div className="h-6 w-14 rounded-full bg-muted" />
            </div>
            <div>
              <div className="h-3 w-40 rounded bg-muted mb-3" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="rounded-2xl border bg-muted/30 p-3 space-y-2">
                    <div className="h-3 w-16 rounded bg-muted" />
                    <div className="h-5 w-20 rounded bg-muted" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Votre formule active</span>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl sm:text-2xl font-black capitalize">
                    Plan {subLimits?.plan_name || shop?.plan_id || "Gratuit"}
                  </h2>
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-extrabold border",
                      isGrace
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                        : isExpired
                          ? "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30"
                          : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                    )}
                  >
                    {isGrace ? "Période de grâce" : isExpired ? "Expiré" : "Actif"}
                  </span>
                </div>
              </div>

              {subLimits?.ends_at && currentPlanId !== "free" && (
                <div className="text-left sm:text-right bg-muted/30 px-3.5 py-2 rounded-2xl border">
                  <p className="text-[11px] text-muted-foreground">Date d'échéance :</p>
                  <p className="text-xs sm:text-sm font-bold text-foreground">
                    {new Date(subLimits.ends_at).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
              )}
            </div>

            {/* Quotas & fonctionnalités de la formule */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-3">Limites incluses dans votre formule :</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-2xl border bg-muted/20 hover:bg-muted/30 transition-colors p-3.5 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Package className="h-3.5 w-3.5 text-primary" />
                    <span>Catalogue</span>
                  </div>
                  <p className="font-extrabold text-sm sm:text-base text-foreground">
                    {subLimits?.max_products != null ? `${subLimits.max_products} max` : "Illimité"}
                  </p>
                </div>

                <div className="rounded-2xl border bg-muted/20 hover:bg-muted/30 transition-colors p-3.5 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Camera className="h-3.5 w-3.5 text-primary" />
                    <span>Photos / produit</span>
                  </div>
                  <p className="font-extrabold text-sm sm:text-base text-foreground">
                    {subLimits?.max_photos}
                  </p>
                </div>

                <div className="rounded-2xl border bg-muted/20 hover:bg-muted/30 transition-colors p-3.5 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Tag className="h-3.5 w-3.5 text-primary" />
                    <span>Promotions</span>
                  </div>
                  <p className="font-extrabold text-sm sm:text-base text-foreground">
                    {subLimits?.max_active_promotions != null
                      ? `${subLimits.max_active_promotions} active(s)`
                      : "Illimitées"}
                  </p>
                </div>

                <div className="rounded-2xl border bg-muted/20 hover:bg-muted/30 transition-colors p-3.5 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Share2 className="h-3.5 w-3.5 text-primary" />
                    <span>Meta Ads</span>
                  </div>
                  <p className="font-extrabold text-sm sm:text-base text-foreground">
                    {subLimits?.meta_access ? "Inclus" : "Non inclus"}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      {/* ── Grille des Formules Disponibles ───────────────────────────────── */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">Changer ou Renouveler</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Paiement instantané par Mobile Money (M-Pesa, Orange Money, Airtel Money) ou Carte bancaire.
            </p>
          </div>

          {/* Toggle Période */}
          <div className="inline-flex rounded-2xl border bg-muted/40 p-1 gap-1 self-start sm:self-auto">
            {(["mensuel", "annuel"] as SubscriptionPeriod[]).map((p) => (
              <button
                key={p}
                onClick={() => setSelectedPeriod(p)}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                  selectedPeriod === p
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {p === "mensuel" ? "Mensuel" : "Annuel (Économisez ~17%)"}
              </button>
            ))}
          </div>
        </div>

        {/* Cartes de plans — dynamiques depuis DB */}
        <div className="grid md:grid-cols-3 gap-4 sm:gap-6">
          {(plansLoading || pricesLoading) ? (
            <>
              <PlanCardSkeleton />
              <PlanCardSkeleton />
              <PlanCardSkeleton />
            </>
          ) : (
            (dbPlans ?? []).map((plan) => {
              const price = planPrices?.find(
                (pp) => pp.plan_id === plan.id && pp.period === selectedPeriod
              );
              const isFree = plan.id === "free";
              const isCurrent = currentPlanId === plan.id && !isExpired;
              const isPaying = payingPlanId === plan.id;
              const isPro = plan.id === "pro";
              const features = buildPlanFeatures(plan);

              return (
                <div
                  key={plan.id}
                  className={cn(
                    "rounded-3xl border bg-card p-5 sm:p-6 space-y-4 flex flex-col justify-between transition-all",
                    isPro
                      ? "border-2 border-primary/50 shadow-md relative overflow-hidden"
                      : plan.id === "business"
                        ? "bg-gradient-to-b from-primary/5 via-card to-card shadow-sm"
                        : ""
                  )}
                >
                  {isPro && (
                    <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-extrabold px-3 py-1 rounded-bl-xl uppercase tracking-wider">
                      Recommandé
                    </div>
                  )}

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      {isPro ? (
                        <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                      ) : plan.id === "business" ? (
                        <Rocket className="h-4 w-4 text-primary" />
                      ) : null}
                      <span className="font-extrabold text-lg">{plan.name}</span>
                    </div>

                    {/* Prix — strictement en Franc Congolais (FC) */}
                    <div>
                      {isFree ? (
                        <>
                          <span className="text-3xl font-black">Gratuit</span>
                          <span className="text-xs text-muted-foreground ml-1">/toujours</span>
                        </>
                      ) : (price?.price_cdf != null || (plan as any).price_cdf != null) ? (
                        <>
                          <span className="text-3xl font-black">
                            {formatCDF(
                              price?.price_cdf ??
                              (selectedPeriod === "mensuel"
                                ? ((plan as any).price_cdf ?? 0)
                                : ((plan as any).price_cdf ?? 0) * 10)
                            )}
                          </span>
                          <span className="text-xs text-muted-foreground ml-1">
                            /{selectedPeriod === "mensuel" ? "mois" : "an"}
                          </span>
                        </>
                      ) : (
                        <span className="text-sm text-muted-foreground italic">Tarif non disponible</span>
                      )}
                    </div>

                    {/* Features dynamiques */}
                    <ul className="space-y-2 pt-2 border-t text-xs text-muted-foreground">
                      {features.map((f) => (
                        <li key={f.text} className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                          {f.strong ? <strong>{f.text}</strong> : f.text}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {isFree ? (
                    <Button variant="outline" disabled className="w-full rounded-xl text-xs font-bold h-10">
                      {currentPlanId === "free" ? "Plan actuel" : "Inclus"}
                    </Button>
                  ) : (
                    <Button
                      className={cn("w-full rounded-xl font-bold h-11 gap-2", isPro && "shadow-md")}
                      disabled={!price || isPaying || !!payingPlanId}
                      onClick={() => handlePay(plan.id)}
                      variant={isCurrent ? "outline" : "default"}
                    >
                      {isPaying ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Préparation…</>
                      ) : isCurrent ? (
                        <><ArrowRight className="h-4 w-4" /> Renouveler {plan.name}</>
                      ) : (
                        <><ArrowRight className="h-4 w-4" /> Passer à {plan.name}</>
                      )}
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Note de réassurance */}
        <div className="rounded-2xl border bg-muted/20 p-4 text-xs text-muted-foreground flex items-start gap-2.5">
          <Shield className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
          <p className="leading-relaxed">
            Les paiements sont sécurisés par notre passerelle agréée <strong>SasPay</strong>. Des frais de réseau Mobile Money (M-Pesa, Orange Money, Airtel Money) s'appliquent lors de la confirmation sur la page de paiement.
          </p>
        </div>
      </section>

      {/* ── Historique des Paiements ────────────────────────────────────── */}
      <section className="rounded-3xl border bg-card p-5 sm:p-6 shadow-sm space-y-4">
        {/* En-tête sobre */}
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <h3 className="font-bold text-base text-foreground">Historique des paiements</h3>
            <p className="text-xs text-muted-foreground">
              {allHistory.length} transaction{allHistory.length > 1 ? "s" : ""} enregistrée{allHistory.length > 1 ? "s" : ""}
            </p>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => void refetchPayments()}
            disabled={paymentsFetching}
            className="h-8 w-8 p-0 rounded-xl text-muted-foreground hover:text-foreground"
            title="Actualiser l'historique"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", paymentsFetching && "animate-spin")} />
          </Button>
        </div>

        {/* Filtres épurés façon contrôle segmenté (sans surcharge de badges) */}
        {allHistory.length > 0 && (
          <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-xl w-full sm:w-auto overflow-x-auto scrollbar-none">
            {(
              [
                { id: "all", label: "Toutes", count: historyCounts.all },
                { id: "payé", label: "Payées", count: historyCounts.payé },
                { id: "en_attente", label: "En attente", count: historyCounts.en_attente },
                { id: "échoué", label: "Échouées", count: historyCounts.échoué },
              ] as { id: HistoryFilter; label: string; count: number }[]
            ).map((filter) => (
              <button
                key={filter.id}
                onClick={() => {
                  setHistoryFilter(filter.id);
                  setCurrentPage(1);
                }}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all",
                  historyFilter === filter.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {filter.label} <span className="opacity-60 text-[11px]">({filter.count})</span>
              </button>
            ))}
          </div>
        )}

        {/* Contenu de la liste */}
        {paymentsLoading ? (
          <div className="py-12 text-center text-xs text-muted-foreground space-y-2">
            <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" />
            <p>Chargement de l'historique…</p>
          </div>
        ) : allHistory.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground space-y-2">
            <Receipt className="h-8 w-8 mx-auto opacity-20" />
            <p className="font-semibold text-sm text-foreground">Aucun paiement effectué</p>
            <p>Vos reçus de paiement s'afficheront ici après votre premier règlement.</p>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="py-10 text-center text-xs text-muted-foreground space-y-2">
            <p className="font-medium text-foreground">Aucune transaction pour ce filtre</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setHistoryFilter("all");
                setCurrentPage(1);
              }}
              className="rounded-xl text-xs h-8"
            >
              Afficher toutes les transactions
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Liste épurée et sans surcharge de boutons */}
            <div className="divide-y divide-border/60 rounded-2xl border bg-card overflow-hidden">
              {paginatedHistory.map((pay) => {
                const status = resolvePaymentStatus(pay);
                const amountCDF = Number(pay.montant_cdf ?? pay.amount ?? 0);

                const statusDot = {
                  payé: "bg-emerald-500",
                  en_attente: "bg-amber-500 animate-pulse",
                  annulé: "bg-muted-foreground/40",
                  échoué: "bg-rose-500",
                }[status];

                const statusLabel = {
                  payé: "Payé",
                  en_attente: "En attente",
                  annulé: "Annulé",
                  échoué: "Échoué",
                }[status];

                const statusColor = {
                  payé: "text-emerald-600 dark:text-emerald-400 font-semibold",
                  en_attente: "text-amber-600 dark:text-amber-400 font-semibold",
                  annulé: "text-muted-foreground",
                  échoué: "text-muted-foreground",
                }[status];

                return (
                  <div
                    key={pay.id}
                    onClick={() => setSelectedReceipt(pay)}
                    className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", statusDot)} />

                      <div className="space-y-0.5 min-w-0">
                        <p className="font-semibold text-sm text-foreground capitalize truncate group-hover:text-primary transition-colors">
                          Plan {pay.plan_id}{" "}
                          <span className="text-muted-foreground font-normal text-xs">
                            · {pay.period || "mensuel"}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {new Date(pay.cree_le ?? "").toLocaleDateString("fr-FR", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 text-right">
                      <div>
                        <p className="font-black text-sm text-foreground">{formatCDF(amountCDF)}</p>
                        <p className={cn("text-[11px]", statusColor)}>{statusLabel}</p>
                      </div>

                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination discrète */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2 px-1 text-xs text-muted-foreground">
                <span className="text-[11px]">
                  Page {currentPage} sur {totalPages}
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
      </section>

      {/* ── FAQ Déroulante & Claire ──────────────────────────────────────── */}
      <section className="rounded-3xl border bg-card p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3 border-b pb-4">
          <div className="w-9 h-9 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold">
            <HelpCircle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-foreground">Questions fréquentes</h3>
            <p className="text-xs text-muted-foreground">Tout comprendre facilement sur votre formule et vos paiements</p>
          </div>
        </div>

        <Accordion type="single" collapsible defaultValue="item-1" className="w-full divide-y divide-border/60">
          <AccordionItem value="item-1" className="border-b-0 py-1">
            <AccordionTrigger className="text-left font-semibold text-xs sm:text-sm hover:no-underline py-3 text-foreground">
              Comment payer mon abonnement ?
            </AccordionTrigger>
            <AccordionContent className="text-xs text-muted-foreground leading-relaxed pb-3">
              C'est très simple ! Choisissez votre formule ci-dessus (Pro ou Business), puis validez avec votre compte Mobile Money habituel (<strong>M-Pesa, Orange Money, Airtel Money</strong>) ou par <strong>carte bancaire</strong>. Vous recevrez directement un message sur votre téléphone pour taper votre code secret et confirmer.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-2" className="border-b-0 py-1">
            <AccordionTrigger className="text-left font-semibold text-xs sm:text-sm hover:no-underline py-3 text-foreground">
              Est-ce que ma boutique est activée tout de suite ?
            </AccordionTrigger>
            <AccordionContent className="text-xs text-muted-foreground leading-relaxed pb-3">
              <strong>Oui, immédiatement !</strong> Dès que vous tapez votre code secret sur votre téléphone, votre paiement est validé et votre boutique s'active automatiquement avec toutes ses options débloquées. Vous n'avez pas besoin d'attendre.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-3" className="border-b-0 py-1">
            <AccordionTrigger className="text-left font-semibold text-xs sm:text-sm hover:no-underline py-3 text-foreground">
              Est-ce que je perds des jours si je paye avant la fin ?
            </AccordionTrigger>
            <AccordionContent className="text-xs text-muted-foreground leading-relaxed pb-3">
              <strong>Non, aucun jour n'est perdu !</strong> Si vous renouvelez avant la date d'échéance, la nouvelle période (1 mois ou 1 an) s'ajoute simplement à la suite de vos jours restants. Vous profitez de chaque journée déjà payée.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-4" className="border-b-0 py-1">
            <AccordionTrigger className="text-left font-semibold text-xs sm:text-sm hover:no-underline py-3 text-foreground">
              Que se passe-t-il si mon abonnement arrive à la fin ?
            </AccordionTrigger>
            <AccordionContent className="text-xs text-muted-foreground leading-relaxed pb-3">
              Votre boutique ne ferme jamais. Vous basculez simplement sur la <strong>formule Gratuite</strong> (avec un maximum de 10 produits visibles). Tous vos autres articles restent bien enregistrés et réapparaissent dès votre réabonnement.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-5" className="border-b-0 py-1">
            <AccordionTrigger className="text-left font-semibold text-xs sm:text-sm hover:no-underline py-3 text-foreground">
              Besoin d'aide ou un souci pour payer ?
            </AccordionTrigger>
            <AccordionContent className="text-xs text-muted-foreground leading-relaxed pb-3">
              Notre équipe d'assistance est là pour vous accompagner ! Si un paiement ne passe pas ou si vous avez la moindre question, contactez-nous directement sur <strong>WhatsApp</strong> et nous vous aiderons pas à pas.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      {/* ── Modale Reçu de Paiement (Design Ticket Épuré & Élégant) ────────── */}
      <Dialog open={!!selectedReceipt} onOpenChange={(o) => !o && setSelectedReceipt(null)}>
        <DialogContent className="max-w-sm rounded-3xl p-6 sm:p-7 shadow-2xl border bg-background/98 backdrop-blur-xl space-y-0">
          <DialogHeader className="space-y-1 text-center sm:text-center pb-3">
            <DialogTitle className="text-base font-bold text-foreground">
              Reçu de paiement
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Règlement sécurisé SasPay · MarketNet
            </DialogDescription>
          </DialogHeader>

          {selectedReceipt && (() => {
            const status = resolvePaymentStatus(selectedReceipt);
            const amountCDF = Number(
              selectedReceipt.montant_cdf ?? selectedReceipt.amount ?? 0
            );

            const statusConfig = {
              payé: {
                label: "Paiement réussi",
                badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
                icon: CheckCircle2,
              },
              en_attente: {
                label: "En attente de paiement",
                badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
                icon: Clock,
              },
              annulé: {
                label: "Paiement annulé",
                badgeClass: "bg-muted text-muted-foreground border-border",
                icon: XCircle,
              },
              échoué: {
                label: "Non abouti",
                badgeClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
                icon: XCircle,
              },
            }[status];

            const StatusIcon = statusConfig.icon;

            return (
              <div className="space-y-5 pt-2">
                {/* Montant & Statut */}
                <div className="text-center space-y-1.5 py-4 rounded-2xl bg-muted/30 border border-border/50">
                  <p className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">
                    {formatCDF(amountCDF)}
                  </p>
                  <div className="flex items-center justify-center">
                    <span className={cn("inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold border", statusConfig.badgeClass)}>
                      <StatusIcon className="h-3.5 w-3.5" />
                      <span>{statusConfig.label}</span>
                    </span>
                  </div>
                </div>

                {/* Détails du paiement en lignes discrètes */}
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>Formule</span>
                    <span className="font-bold text-foreground capitalize">
                      Plan {selectedReceipt.plan_id} ({selectedReceipt.period || "mensuel"})
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>Date</span>
                    <span className="font-medium text-foreground">
                      {new Date(selectedReceipt.paye_le || selectedReceipt.cree_le).toLocaleString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>Moyen</span>
                    <span className="font-medium text-foreground">
                      SasPay (Mobile Money)
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>Boutique</span>
                    <span className="font-medium text-foreground">
                      {shop?.name || "Votre boutique"}
                    </span>
                  </div>

                  {selectedReceipt.saspay_transaction_id && (
                    <div className="pt-2 border-t flex justify-between items-center text-muted-foreground">
                      <span>Réf.</span>
                      <button
                        type="button"
                        onClick={() => handleCopyRef(selectedReceipt.saspay_transaction_id)}
                        className="inline-flex items-center gap-1.5 font-mono text-[11px] text-foreground hover:text-primary transition-colors max-w-[200px]"
                        title="Cliquer pour copier la référence"
                      >
                        <span className="truncate">{selectedReceipt.saspay_transaction_id}</span>
                        {copiedRef ? (
                          <Check className="h-3 w-3 text-emerald-500 shrink-0" />
                        ) : (
                          <Copy className="h-3 w-3 text-muted-foreground shrink-0" />
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Bouton reprendre si en attente */}
                {selectedReceipt.checkout_url && status === "en_attente" && (
                  <Button
                    className="w-full rounded-2xl font-bold h-11 gap-2 shadow-sm text-xs"
                    onClick={() => {
                      window.location.href = selectedReceipt.checkout_url;
                    }}
                  >
                    Reprendre le paiement SasPay <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                )}

                {/* Actions si paiement réussi */}
                {status === "payé" && (
                  <div className="space-y-2.5">
                    {/* Notice envoi automatique email */}
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/50 dark:border-blue-900/30 text-blue-800 dark:text-blue-300 text-[11px] leading-tight">
                      <Mail className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                      <span>Facture PDF transmise automatiquement sur votre email de compte.</span>
                    </div>

                    {/* Bouton Télécharger la facture PDF */}
                    <Button
                      variant="outline"
                      className="w-full rounded-2xl h-11 font-semibold text-xs gap-2 border-primary/25 text-primary hover:bg-primary/10 transition-colors"
                      onClick={() => {
                        window.open(`/api/public/invoice-pdf?paymentId=${selectedReceipt.id}`, "_blank");
                      }}
                    >
                      <FileDown className="h-4 w-4" />
                      Télécharger la facture PDF
                    </Button>
                  </div>
                )}

                <Button
                  variant="outline"
                  onClick={() => setSelectedReceipt(null)}
                  className="w-full rounded-2xl h-10 font-semibold text-xs border-muted-foreground/20 hover:bg-muted"
                >
                  Fermer
                </Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

