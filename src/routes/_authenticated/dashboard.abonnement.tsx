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
import { useMyShop } from "@/hooks/useMyShop";
import {
  getMerchantSubscription,
  getMerchantPayments,
  getPlanPrices,
  createCheckoutSession,
} from "@/lib/subscriptions.functions";
import { formatUSD, type SubscriptionPeriod } from "@/lib/subscriptions";
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

export const Route = createFileRoute("/_authenticated/dashboard/abonnement")({
  head: () => ({
    meta: [
      { title: "Mon Abonnement & Paiements — MarketNet" },
      { name: "description", content: "Gérez votre formule d'abonnement MarketNet et payez en USD ($) via SasPay." },
    ],
  }),
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
        .order("price_usd", { ascending: true });
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
            Choisissez la formule adaptée à la croissance de votre boutique et réglez en Dollars ($ USD).
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

                    {/* Prix — strictement en Dollars ($ USD) */}
                    <div>
                      {isFree ? (
                        <>
                          <span className="text-3xl font-black">0 $</span>
                          <span className="text-xs text-muted-foreground ml-1">/toujours</span>
                        </>
                      ) : (price != null || plan.price_usd != null) ? (
                        <>
                          <span className="text-3xl font-black">
                            {formatUSD(
                              price?.price_usd ??
                                (selectedPeriod === "mensuel"
                                  ? (plan.price_usd ?? 0)
                                  : (plan.price_usd ?? 0) * 10)
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

      {/* ── Historique des Paiements avec Pagination ─────────────────────── */}
      <section className="rounded-3xl border bg-card p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Receipt className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-base">Historique de vos paiements</h3>
              <p className="text-xs text-muted-foreground">
                Consultez vos transactions, reçus et l'état de vos règlements SasPay.
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => void refetchPayments()}
            disabled={paymentsFetching}
            className="h-8 rounded-xl px-2.5 text-xs text-muted-foreground self-start sm:self-center"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", paymentsFetching && "animate-spin")} />
            Actualiser
          </Button>
        </div>

        {/* Filtres rapides par pilules */}
        {allHistory.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {(
              [
                { id: "all", label: "Toutes", count: historyCounts.all },
                { id: "payé", label: "Payées", count: historyCounts.payé },
                { id: "en_attente", label: "En attente", count: historyCounts.en_attente },
                { id: "échoué", label: "Échouées / Annulées", count: historyCounts.échoué },
              ] as { id: HistoryFilter; label: string; count: number }[]
            ).map((filter) => (
              <button
                key={filter.id}
                onClick={() => {
                  setHistoryFilter(filter.id);
                  setCurrentPage(1);
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap transition-colors border",
                  historyFilter === filter.id
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                )}
              >
                <span>{filter.label}</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.2 text-[10px] font-bold",
                    historyFilter === filter.id
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-muted text-foreground/70"
                  )}
                >
                  {filter.count}
                </span>
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
            <p>Vos reçus et transactions SasPay s'afficheront ici après votre premier règlement.</p>
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
            <div className="divide-y divide-border rounded-2xl border overflow-hidden bg-card">
              {paginatedHistory.map((pay) => {
                const status = resolvePaymentStatus(pay);
                const amountUSD = Number(pay.montant_usd ?? pay.montant_cdf ?? pay.amount ?? 0);

                const statusConfig = {
                  payé: {
                    label: "Payé",
                    style: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
                    icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
                    bg: "bg-emerald-500/10",
                  },
                  en_attente: {
                    label: "En attente",
                    style: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
                    icon: <Clock className="h-4 w-4 text-amber-600 animate-pulse" />,
                    bg: "bg-amber-500/10",
                  },
                  annulé: {
                    label: "Annulé",
                    style: "bg-muted text-muted-foreground border-border",
                    icon: <XCircle className="h-4 w-4 text-muted-foreground" />,
                    bg: "bg-muted",
                  },
                  échoué: {
                    label: "Échoué",
                    style: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20",
                    icon: <XCircle className="h-4 w-4 text-rose-600" />,
                    bg: "bg-rose-500/10",
                  },
                }[status];

                return (
                  <div
                    key={pay.id}
                    className="flex items-center justify-between p-4 sm:p-5 hover:bg-muted/20 transition-colors gap-3"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className={cn("h-8 w-8 rounded-xl flex items-center justify-center shrink-0", statusConfig.bg)}>
                        {statusConfig.icon}
                      </div>

                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-foreground capitalize truncate">
                            Plan {pay.plan_id}
                          </span>
                          <span className="text-xs text-muted-foreground capitalize">
                            · {pay.period || "mensuel"}
                          </span>
                        </div>
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
                        <p className="font-black text-sm text-foreground">{formatUSD(amountUSD)}</p>
                        <span className={cn("inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border", statusConfig.style)}>
                          {statusConfig.label}
                        </span>
                      </div>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedReceipt(pay)}
                        className="h-8 w-8 p-0 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted"
                        title="Consulter les détails"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2 px-1 text-xs text-muted-foreground">
                <span className="text-[11px]">
                  Affichage {((currentPage - 1) * ITEMS_PER_PAGE) + 1} à {Math.min(currentPage * ITEMS_PER_PAGE, filteredHistory.length)} sur {filteredHistory.length} transaction(s)
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

                  <span className="px-2 font-bold text-foreground text-xs">
                    {currentPage} / {totalPages}
                  </span>

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

      {/* ── FAQ Facturation ──────────────────────────────────────────────── */}
      <section className="rounded-3xl border bg-muted/20 p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2 font-bold text-sm">
          <HelpCircle className="h-4 w-4 text-primary" />
          <span>Foire aux questions sur la facturation</span>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 text-xs text-muted-foreground">
          <div className="space-y-1">
            <p className="font-bold text-foreground">Quels moyens de paiement sont acceptés ?</p>
            <p>Nous acceptons M-Pesa, Orange Money, Airtel Money ainsi que les cartes Visa et Mastercard en RDC.</p>
          </div>
          <div className="space-y-1">
            <p className="font-bold text-foreground">L'activation est-elle immédiate ?</p>
            <p>Oui ! Dès validation de votre paiement par SasPay, votre boutique est activée automatiquement en temps réel.</p>
          </div>
          <div className="space-y-1">
            <p className="font-bold text-foreground">Que se passe-t-il si je renouvelle en avance ?</p>
            <p>Aucun jour n'est perdu ! La nouvelle période s'ajoute directement à la suite de votre date d'expiration actuelle.</p>
          </div>
          <div className="space-y-1">
            <p className="font-bold text-foreground">Besoin d'aide pour payer ?</p>
            <p>Notre équipe d'assistance est joignable directement par WhatsApp pour vous accompagner.</p>
          </div>
        </div>
      </section>

      {/* ── Modale Reçu / Détail de Paiement ─────────────────────────────── */}
      <Dialog open={!!selectedReceipt} onOpenChange={(o) => !o && setSelectedReceipt(null)}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" /> Reçu de paiement
            </DialogTitle>
            <DialogDescription>
              Réf transaction : <span className="font-mono text-xs">{selectedReceipt?.id}</span>
            </DialogDescription>
          </DialogHeader>

          {selectedReceipt && (
            <div className="space-y-3 py-2 text-xs">
              <div className="p-4 rounded-2xl bg-muted/40 border space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Formule</span>
                  <span className="font-bold uppercase text-foreground">
                    Plan {selectedReceipt.plan_id} ({selectedReceipt.period || "mensuel"})
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Statut</span>
                  <span className="font-bold capitalize text-foreground">
                    {selectedReceipt.statut || selectedReceipt.status}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Date d'initiation</span>
                  <span>{new Date(selectedReceipt.cree_le || selectedReceipt.created_at).toLocaleString("fr-FR")}</span>
                </div>
                {selectedReceipt.paye_le && (
                  <div className="flex justify-between items-center text-emerald-600 font-semibold">
                    <span>Payé le</span>
                    <span>{new Date(selectedReceipt.paye_le).toLocaleString("fr-FR")}</span>
                  </div>
                )}
              </div>

              <div className="p-4 rounded-2xl border space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Montant formule :</span>
                  <span className="font-bold text-foreground">
                    {formatUSD(Number(selectedReceipt.montant_usd ?? selectedReceipt.montant_cdf ?? selectedReceipt.amount ?? 0))}
                  </span>
                </div>
                {selectedReceipt.frais != null && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Frais réseau :</span>
                    <span>{formatUSD(selectedReceipt.frais)}</span>
                  </div>
                )}
                {selectedReceipt.saspay_transaction_id && (
                  <div className="flex justify-between pt-1 border-t text-[11px]">
                    <span className="text-muted-foreground">ID Transaction SasPay :</span>
                    <span className="font-mono">{selectedReceipt.saspay_transaction_id}</span>
                  </div>
                )}
              </div>

              {selectedReceipt.checkout_url && selectedReceipt.statut === "en_attente" && (
                <div className="pt-2">
                  <Button
                    className="w-full rounded-xl font-bold gap-2"
                    onClick={() => {
                      window.location.href = selectedReceipt.checkout_url;
                    }}
                  >
                    Procéder au paiement sur SasPay <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedReceipt(null)} className="rounded-xl">
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
