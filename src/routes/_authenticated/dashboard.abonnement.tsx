import { createFileRoute, useNavigate } from "@tanstack/react-router";
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

  // Lancement du paiement SasPay
  async function handlePay(planId: "pro" | "business") {
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

        {/* Détail des quotas inclus */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-3">Limites de votre boutique :</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-2xl border bg-muted/30 p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Package className="h-3.5 w-3.5" />
                <span>Catalogue</span>
              </div>
              <p className="font-extrabold text-sm sm:text-base">
                {subLimits?.max_products != null ? `${subLimits.max_products} max` : "Illimité"}
              </p>
            </div>

            <div className="rounded-2xl border bg-muted/30 p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Camera className="h-3.5 w-3.5" />
                <span>Photos / produit</span>
              </div>
              <p className="font-extrabold text-sm sm:text-base">
                {subLimits?.max_photos ? `${subLimits.max_photos}` : "3"}
              </p>
            </div>

            <div className="rounded-2xl border bg-muted/30 p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Tag className="h-3.5 w-3.5" />
                <span>Promotions</span>
              </div>
              <p className="font-extrabold text-sm sm:text-base">
                {subLimits?.max_active_promotions != null
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
                {subLimits?.meta_access ? "Inclus" : "Non inclus"}
              </p>
            </div>
          </div>
        </div>
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

        {/* 3 Cartes : Gratuit, Pro, Business */}
        <div className="grid md:grid-cols-3 gap-4 sm:gap-6">
          {/* 1. Gratuit */}
          <div className="rounded-3xl border bg-card p-5 sm:p-6 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <span className="font-extrabold text-lg">Gratuit</span>
              <div>
                <span className="text-3xl font-black">0 CDF</span>
                <span className="text-xs text-muted-foreground ml-1">/toujours</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Idéal pour tester la plateforme et démarrer ses premières ventes.
              </p>
              <ul className="space-y-2 pt-2 border-t text-xs text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  Jusqu'à 10 produits
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  3 photos par produit
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  Commandes directes WhatsApp
                </li>
                <li className="flex items-center gap-2 text-muted-foreground/60">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 ml-1.5 mr-0.5" />
                  0 promotion incluse
                </li>
              </ul>
            </div>

            <Button variant="outline" disabled className="w-full rounded-xl text-xs font-bold h-10">
              {currentPlanId === "free" ? "Plan actuel" : "Inclus"}
            </Button>
          </div>

          {/* 2. Pro */}
          {(() => {
            const planId = "pro" as const;
            const price = planPrices?.find((pp) => pp.plan_id === planId && pp.period === selectedPeriod);
            const isCurrent = currentPlanId === planId && !isExpired;
            const isPaying = payingPlanId === planId;

            return (
              <div className="rounded-3xl border-2 border-primary/50 bg-card p-5 sm:p-6 space-y-4 flex flex-col justify-between shadow-md relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-extrabold px-3 py-1 rounded-bl-xl uppercase tracking-wider">
                  Recommandé
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                    <span className="font-extrabold text-lg">Pro</span>
                  </div>

                  <div>
                    {price ? (
                      <>
                        <span className="text-3xl font-black">{formatCDF(price.price_cdf)}</span>
                        <span className="text-xs text-muted-foreground ml-1">
                          /{selectedPeriod === "mensuel" ? "mois" : "an"}
                        </span>
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground">Chargement…</span>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Pour les commerces en pleine expansion souhaitant un grand catalogue et des promotions.
                  </p>

                  <ul className="space-y-2 pt-2 border-t text-xs text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      Jusqu'à 50 produits
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      5 photos par produit
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      Promotions illimitées
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      Statistiques de ventes avancées
                    </li>
                  </ul>
                </div>

                <Button
                  className="w-full rounded-xl font-bold h-11 gap-2 shadow-md"
                  disabled={!price || isPaying || !!payingPlanId}
                  onClick={() => handlePay(planId)}
                  variant={isCurrent ? "outline" : "default"}
                >
                  {isPaying ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Préparation…</>
                  ) : isCurrent ? (
                    <><ArrowRight className="h-4 w-4" /> Renouveler mon Pro</>
                  ) : (
                    <><ArrowRight className="h-4 w-4" /> Passer à Pro</>
                  )}
                </Button>
              </div>
            );
          })()}

          {/* 3. Business */}
          {(() => {
            const planId = "business" as const;
            const price = planPrices?.find((pp) => pp.plan_id === planId && pp.period === selectedPeriod);
            const isCurrent = currentPlanId === planId && !isExpired;
            const isPaying = payingPlanId === planId;

            return (
              <div className="rounded-3xl border bg-gradient-to-b from-primary/5 via-card to-card p-5 sm:p-6 space-y-4 flex flex-col justify-between shadow-sm">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Rocket className="h-4 w-4 text-primary" />
                    <span className="font-extrabold text-lg">Business</span>
                  </div>

                  <div>
                    {price ? (
                      <>
                        <span className="text-3xl font-black">{formatCDF(price.price_cdf)}</span>
                        <span className="text-xs text-muted-foreground ml-1">
                          /{selectedPeriod === "mensuel" ? "mois" : "an"}
                        </span>
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground">Chargement…</span>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Catalogue illimité, synchronisation Meta Ads et support prioritaire.
                  </p>

                  <ul className="space-y-2 pt-2 border-t text-xs text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      <strong>Produits illimités</strong>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      10 photos par produit
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      Templates premium exclusifs
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      Accès complet Meta Ads
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      Support prioritaire 7j/7
                    </li>
                  </ul>
                </div>

                <Button
                  className="w-full rounded-xl font-bold h-11 gap-2"
                  disabled={!price || isPaying || !!payingPlanId}
                  onClick={() => handlePay(planId)}
                  variant={isCurrent ? "outline" : "default"}
                >
                  {isPaying ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Préparation…</>
                  ) : isCurrent ? (
                    <><ArrowRight className="h-4 w-4" /> Renouveler Business</>
                  ) : (
                    <><ArrowRight className="h-4 w-4" /> Choisir Business</>
                  )}
                </Button>
              </div>
            );
          })()}
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
