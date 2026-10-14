import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { ComponentType } from "react";
import { useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
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

export const Route = createFileRoute("/_authenticated/dashboard/abonnement")({
  head: () => ({
    meta: [
      { title: "Mon Abonnement & Paiements — MarketNet" },
      { name: "description", content: "Gérez votre formule d'abonnement MarketNet et payez en CDF via SasPay." },
    ],
  }),
  component: DashboardAbonnementPage,
});

function DashboardAbonnementPage() {
  const { data: shop } = useMyShop();
  const navigate = useNavigate();

  const [selectedPeriod, setSelectedPeriod] = useState<SubscriptionPeriod>("mensuel");
  const [payingPlanId, setPayingPlanId] = useState<string | null>(null);

  const getLimitsFn = useServerFn(getMerchantSubscription);
  const getPaymentsFn = useServerFn(getMerchantPayments);
  const getPricesFn = useServerFn(getPlanPrices);
  const createCheckoutFn = useServerFn(createCheckoutSession);

  // Données de l'abonnement
  const { data: subLimits, isLoading: limitsLoading } = useQuery({
    queryKey: ["subscription-limits", shop?.id],
    enabled: !!shop?.id,
    queryFn: () => getLimitsFn({ data: { shopId: shop!.id } }),
  });

  // Historique des paiements
  const { data: paymentHistory, isLoading: paymentsLoading } = useQuery({
    queryKey: ["merchant-payments", shop?.id],
    enabled: !!shop?.id,
    queryFn: () => getPaymentsFn({ data: { shopId: shop!.id } }),
  });

  // Tarifs CDF depuis la base de données (jamais codés en dur)
  const { data: planPrices, isLoading: pricesLoading } = useQuery({
    queryKey: ["plan-prices"],
    queryFn: () => getPricesFn(),
  });

  // Plans actifs depuis la base de données — JAMAIS codés en dur
  const { data: dbPlans, isLoading: plansLoading } = useQuery({
    queryKey: ["plans-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .eq("active", true)
        .order("position");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000, // 5 min de cache
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

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-16">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold mb-2">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Formules & Facturation</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Mon Abonnement</h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Choisissez la formule adaptée à la croissance de votre boutique et réglez en Francs Congolais (CDF).
          </p>
        </div>
      </div>

      {/* Alertes de renouvellement et de période de grâce */}
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

      {/* Carte du Plan Actuel */}
      <section className="rounded-3xl border bg-card p-5 sm:p-6 shadow-sm space-y-4">
        {limitsLoading ? (
          /* Skeleton : rien de fictif n'est jamais affiché */
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
                <div className="text-left sm:text-right">
                  <p className="text-xs text-muted-foreground">Date d'échéance :</p>
                  <p className="text-xs sm:text-sm font-bold">
                    {new Date(subLimits.ends_at).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
              )}
            </div>

            {/* Détail des quotas — uniquement quand subLimits est chargé */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-3">Limites de votre boutique :</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-2xl border bg-muted/30 p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Package className="h-3.5 w-3.5" />
                    <span>Catalogue</span>
                  </div>
                  <p className="font-extrabold text-sm sm:text-base">
                    {subLimits.max_products != null ? `${subLimits.max_products} max` : "Illimité"}
                  </p>
                </div>

                <div className="rounded-2xl border bg-muted/30 p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Camera className="h-3.5 w-3.5" />
                    <span>Photos / produit</span>
                  </div>
                  <p className="font-extrabold text-sm sm:text-base">
                    {subLimits.max_photos}
                  </p>
                </div>

                <div className="rounded-2xl border bg-muted/30 p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Tag className="h-3.5 w-3.5" />
                    <span>Promotions</span>
                  </div>
                  <p className="font-extrabold text-sm sm:text-base">
                    {subLimits.max_active_promotions != null
                      ? `${subLimits.max_active_promotions} active(s)`
                      : "Illimitées"}
                  </p>
                </div>

                <div className="rounded-2xl border bg-muted/30 p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Share2 className="h-3.5 w-3.5" />
                    <span>Meta Ads</span>
                  </div>
                  <p className="font-extrabold text-sm sm:text-base">
                    {subLimits.meta_access ? "Inclus" : "Non inclus"}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Grille des Formules Disponibles */}
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

        {/* Cartes de plans — 100% dynamiques depuis la table `plans` */}
        <div className="grid md:grid-cols-3 gap-4 sm:gap-6">
          {(plansLoading || pricesLoading) ? (
            // Skeletons pendant le chargement — rien de codé en dur n'est jamais affiché
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
                    "rounded-3xl border bg-card p-5 sm:p-6 space-y-4 flex flex-col justify-between",
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

                    {/* Prix — depuis plan_prices uniquement */}
                    <div>
                      {isFree ? (
                        <>
                          <span className="text-3xl font-black">0 CDF</span>
                          <span className="text-xs text-muted-foreground ml-1">/toujours</span>
                        </>
                      ) : price ? (
                        <>
                          <span className="text-3xl font-black">{formatCDF(price.price_cdf)}</span>
                          <span className="text-xs text-muted-foreground ml-1">
                            /{selectedPeriod === "mensuel" ? "mois" : "an"}
                          </span>
                        </>
                      ) : (
                        // Tarif non disponible pour cette période, pas de texte codé en dur
                        <span className="text-sm text-muted-foreground italic">Tarif non disponible</span>
                      )}
                    </div>

                    {/* Features 100% dynamiques */}
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

        {/* Note sur les frais */}
        <div className="rounded-2xl border bg-muted/20 p-4 text-xs text-muted-foreground flex items-start gap-2.5">
          <Shield className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
          <p className="leading-relaxed">
            Les paiements sont sécurisés par notre passerelle agréée <strong>SasPay</strong>. Des frais de réseau Mobile Money (M-Pesa, Orange Money, Airtel Money) s'appliquent lors de la confirmation sur la page de paiement.
          </p>
        </div>
      </section>

      {/* Historique des Paiements */}
      <section className="rounded-3xl border bg-card p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2 font-bold text-sm sm:text-base">
            <Receipt className="h-4 w-4 text-primary" />
            <span>Historique de vos paiements</span>
          </div>
          {paymentHistory && paymentHistory.length > 0 && (
            <span className="text-xs text-muted-foreground">{paymentHistory.length} transaction(s)</span>
          )}
        </div>

        {paymentsLoading ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
            Chargement de l'historique…
          </div>
        ) : !paymentHistory || paymentHistory.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            Aucun historique de paiement pour l'instant.
          </div>
        ) : (
          <div className="divide-y rounded-2xl border overflow-hidden">
            {paymentHistory.map((pay) => {
              const statusStyle =
                pay.statut === "payé"
                  ? "text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/20"
                  : pay.statut === "en_attente" || pay.statut === "à_vérifier"
                  ? "text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/20"
                  : "text-red-700 dark:text-red-300 bg-red-500/10 border-red-500/20";

              const statusLabel: Record<string, string> = {
                payé: "Payé",
                en_attente: "En attente",
                à_vérifier: "À vérifier",
                échoué: "Échoué",
                annulé: "Annulé",
                expiré: "Expiré",
              };

              return (
                <div key={pay.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 text-xs hover:bg-muted/30 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm capitalize">
                        Plan {pay.plan_id} ({pay.period || "mensuel"})
                      </span>
                      <span className={cn("px-2.5 py-0.5 rounded-full font-bold text-[10px] border", statusStyle)}>
                        {statusLabel[pay.statut ?? ""] ?? pay.statut}
                      </span>
                    </div>
                    <p className="text-muted-foreground flex flex-wrap items-center gap-2">
                      <span>
                        {new Date(pay.cree_le ?? "").toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {pay.saspay_transaction_id && (
                        <span className="font-mono text-[10px] opacity-75">
                          · Réf: {pay.saspay_transaction_id}
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    <div className="text-left sm:text-right">
                      <p className="font-extrabold text-sm">{formatCDF(pay.montant_cdf ?? 0)}</p>
                      {pay.frais != null && pay.frais > 0 && (
                        <p className="text-[10px] text-muted-foreground">
                          + {formatCDF(pay.frais)} frais
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* FAQ Facturation */}
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
    </div>
  );
}
