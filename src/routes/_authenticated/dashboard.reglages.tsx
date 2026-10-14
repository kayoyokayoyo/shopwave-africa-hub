import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { User, CreditCard, LogOut, CheckCircle2, Shield, Sparkles, Trash2, AlertTriangle, Lock, Eye, EyeOff, Loader2, Store, Clock, Zap, ArrowRight, Receipt, Star, Rocket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMerchantSubscription, getMerchantPayments, getPlanPrices, createCheckoutSession } from "@/lib/subscriptions.functions";
import { formatCDF, type SubscriptionPeriod } from "@/lib/subscriptions";
import { useMyShop } from "@/hooks/useMyShop";
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
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard/reglages")({
  head: () => ({
    meta: [
      { title: "Réglages — MarketNet" },
      { name: "description", content: "Paramètres de votre compte et abonnement." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { data: shop } = useMyShop();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteStep, setDeleteStep] = useState<"closed" | "password" | "confirm">("closed");
  const [deletePassword, setDeletePassword] = useState("");
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [confirmShopName, setConfirmShopName] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState<SubscriptionPeriod>("mensuel");
  const [payingPlanId, setPayingPlanId] = useState<string | null>(null);

  const { data: user } = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user;
    },
  });

  const { data: plan } = useQuery({
    queryKey: ["shop-plan", shop?.plan_id],
    enabled: !!shop?.plan_id,
    queryFn: async () => {
      const { data } = await supabase.from("plans").select("*").eq("id", shop!.plan_id).single();
      return data;
    },
  });

  const getSubFn = useServerFn(getMerchantSubscription);
  const getPaymentsFn = useServerFn(getMerchantPayments);
  const getPricesFn = useServerFn(getPlanPrices);
  const createCheckoutFn = useServerFn(createCheckoutSession);

  const { data: subLimits } = useQuery({
    queryKey: ["merchant-subscription-limits", shop?.id],
    enabled: !!shop?.id,
    queryFn: () => getSubFn({ data: { shopId: shop!.id } }),
  });

  const { data: planPrices } = useQuery({
    queryKey: ["plan-prices"],
    queryFn: () => getPricesFn(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: paymentHistory } = useQuery({
    queryKey: ["merchant-payments", shop?.id],
    enabled: !!shop?.id,
    queryFn: () => getPaymentsFn({ data: { shopId: shop!.id } }),
  });

  async function handlePay(planId: string) {
    if (!shop?.id) return toast.error("Boutique introuvable");
    setPayingPlanId(planId);
    try {
      const result = await createCheckoutFn({
        data: {
          shopId: shop.id,
          planId: planId as "pro" | "business",
          period: selectedPeriod,
        },
      });
      // Redirection vers la page de paiement SasPay
      window.location.href = result.checkoutUrl;
    } catch (err: any) {
      toast.error(err.message || "Impossible de créer la session de paiement.");
      setPayingPlanId(null);
    }
  }

  useEffect(() => {
    if (user) {
      setFullName(user.user_metadata?.full_name || "");
      setEmail(user.email || "");
    }
  }, [user]);

  function closeDeleteModal() {
    setDeleteStep("closed");
    setDeletePassword("");
    setShowDeletePassword(false);
    setConfirmText("");
    setConfirmShopName("");
    setVerifyingPassword(false);
  }

  async function handleVerifyPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!deletePassword) {
      toast.error("Veuillez saisir votre mot de passe");
      return;
    }
    if (!email) {
      toast.error("Adresse e-mail introuvable");
      return;
    }

    setVerifyingPassword(true);
    try {
      // Vérifier le mot de passe actuel auprès de Supabase Auth
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: deletePassword,
      });

      if (error) {
        toast.error("Mot de passe incorrect");
        return;
      }

      // Mot de passe validé avec succès -> passage à l'étape de confirmation finale
      setDeleteStep("confirm");
    } catch (err) {
      toast.error("Erreur lors de la vérification du mot de passe");
    } finally {
      setVerifyingPassword(false);
    }
  }

  async function deleteAccount() {
    setDeleting(true);
    try {
      // 1. Envoyer l'e-mail de confirmation AVANT la suppression (utilisateur encore authentifié)
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        if (accessToken) {
          await supabase.functions.invoke("send-deletion-email", {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
        }
      } catch (emailErr) {
        // L'e-mail a échoué → on continue quand même la suppression
        console.warn("Envoi de l'e-mail de confirmation échoué (suppression continue):", emailErr);
      }

      // 2. Suppression côté serveur : RPC qui cascade sur shops, products, orders, meta_tokens…
      const { error } = await (supabase as any).rpc("delete_my_account");
      if (error) throw error;

      toast.success("Votre compte a été supprimé. Un e-mail de confirmation vous a été envoyé.");

      // 3. Déconnexion et redirection
      await supabase.auth.signOut();
      window.location.href = "/";
    } catch (err) {
      console.error("Erreur lors de la suppression:", err);
      toast.error("Impossible de supprimer le compte. Veuillez réessayer.");
      setDeleting(false);
    }
  }

  async function updateProfile() {
    if (!fullName.trim()) return toast.error("Le nom complet est requis");
    setSaving(true);
    const { error } = await supabase.auth.updateUser({
      data: { full_name: fullName.trim() },
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profil mis à jour");
    qc.invalidateQueries({ queryKey: ["auth-user"] });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 sm:space-y-8 pb-10">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">Réglages du compte</h1>
        <p className="mt-1 text-xs sm:text-sm text-muted-foreground">Gérez votre profil, abonnement et connexion.</p>
      </div>

      {/* Profil */}
      <section className="rounded-2xl border bg-card p-4 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3 border-b pb-3 sm:pb-4">
          <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
            <User className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div>
            <h2 className="font-bold text-sm sm:text-base">Profil</h2>
            <p className="text-[11px] sm:text-xs text-muted-foreground">Vos informations personnelles.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="fullname" className="text-xs sm:text-sm">Nom complet</Label>
            <Input id="fullname" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Votre nom" className="h-10 sm:h-9" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs sm:text-sm">Adresse e-mail</Label>
            <Input id="email" value={email} disabled className="h-10 sm:h-9 bg-muted text-muted-foreground cursor-not-allowed" />
            <p className="text-[11px] text-muted-foreground">L'adresse e-mail de connexion ne peut pas être changée ici.</p>
          </div>
          <div className="pt-2">
            <Button onClick={updateProfile} disabled={saving} className="w-full sm:w-auto rounded-xl h-10 sm:h-9">
              {saving ? "Enregistrement…" : "Enregistrer les modifications"}
            </Button>
          </div>
        </div>
      </section>

      {/* Abonnement */}
      <section className="rounded-2xl border bg-card p-4 sm:p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-3 border-b pb-3 sm:pb-4">
          <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500 shrink-0">
            <CreditCard className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div>
            <h2 className="font-bold text-sm sm:text-base">Abonnement &amp; Plan</h2>
            <p className="text-[11px] sm:text-xs text-muted-foreground">Gérez votre formule et effectuez vos paiements en toute sécurité.</p>
          </div>
        </div>

        {/* Rappels */}
        {subLimits?.reminder_level === "7_days" && (
          <div className="flex items-center gap-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 p-3.5 text-amber-700 dark:text-amber-300 text-xs sm:text-sm">
            <Clock className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-bold">Rappel : votre abonnement expire dans {subLimits.days_remaining} jour(s)</p>
              <p className="text-xs opacity-90">Pensez à renouveler pour éviter toute interruption.</p>
            </div>
          </div>
        )}
        {subLimits?.reminder_level === "3_days" && (
          <div className="flex items-center gap-3 rounded-2xl bg-red-500/10 border border-red-500/20 p-3.5 text-red-700 dark:text-red-300 text-xs sm:text-sm">
            <AlertTriangle className="h-5 w-5 shrink-0 animate-bounce" />
            <div>
              <p className="font-bold">Urgent : expire dans {subLimits.days_remaining} jour(s) — Renouvelez maintenant</p>
            </div>
          </div>
        )}
        {subLimits?.is_grace_period && (
          <div className="flex items-center gap-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 p-3.5 text-amber-800 dark:text-amber-200 text-xs sm:text-sm">
            <Clock className="h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="font-bold">Période de grâce active (7 jours)</p>
              <p className="text-xs opacity-90">Renouvelez maintenant pour ne pas perdre vos fonctionnalités avancées.</p>
            </div>
          </div>
        )}

        {/* Plan actuel */}
        <div className="rounded-xl bg-muted/40 border p-3.5 sm:p-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base sm:text-lg capitalize">
                {subLimits?.plan_name || shop?.plan_id || "Gratuit"}
              </span>
              <span className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-bold border",
                subLimits?.status === "grâce"
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                  : subLimits?.status === "expiré"
                  ? "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30"
                  : "bg-primary/15 text-primary border-primary/20"
              )}>
                {subLimits?.status === "grâce" ? "Période de grâce" : subLimits?.status === "expiré" ? "Expiré" : "Actif"}
              </span>
            </div>
            {subLimits?.ends_at && subLimits.plan_id !== "free" && (
              <p className="text-xs text-muted-foreground">
                Valide jusqu'au {new Date(subLimits.ends_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            )}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            <span className="bg-background px-2 py-0.5 rounded border">
              {subLimits?.max_products != null ? `Jusqu'à ${subLimits.max_products} produits` : "Produits illimités"}
            </span>
            <span className="bg-background px-2 py-0.5 rounded border">
              {subLimits?.max_active_promotions != null ? `${subLimits.max_active_promotions} promo(s)` : "Promos illimitées"}
            </span>
            <span className="bg-background px-2 py-0.5 rounded border">
              {subLimits?.max_photos ? `${subLimits.max_photos} photos/produit` : "3 photos/produit"}
            </span>
          </div>
        </div>

        {/* Sélecteur de période */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2">Choisir une période :</p>
          <div className="inline-flex rounded-xl border bg-muted/40 p-1 gap-1">
            {(["mensuel", "annuel"] as SubscriptionPeriod[]).map((p) => (
              <button
                key={p}
                onClick={() => setSelectedPeriod(p)}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                  selectedPeriod === p
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {p === "mensuel" ? "Mensuel" : "Annuel (économisez ~17%)"}  
              </button>
            ))}
          </div>
        </div>

        {/* Cartes des plans */}
        <div className="grid sm:grid-cols-2 gap-3">
          {(["pro", "business"] as const).map((planId) => {
            const price = planPrices?.find((pp) => pp.plan_id === planId && pp.period === selectedPeriod);
            const isCurrentPlan = subLimits?.plan_id === planId && subLimits.status === "actif";
            const isPaying = payingPlanId === planId;
            const features = planId === "pro"
              ? ["Jusqu'à 50 produits", "5 photos / produit", "Promotions illimitées", "Statistiques avancées"]
              : ["Produits illimités", "10 photos / produit", "Templates premium", "Accès Meta Ads", "Priorité support"];

            return (
              <div
                key={planId}
                className={cn(
                  "rounded-2xl border p-4 space-y-3 transition-all",
                  planId === "business"
                    ? "border-primary/40 bg-primary/5 shadow-md shadow-primary/10"
                    : "border-border bg-card"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {planId === "pro" ? (
                      <Star className="h-4 w-4 text-amber-500" />
                    ) : (
                      <Rocket className="h-4 w-4 text-primary" />
                    )}
                    <span className="font-extrabold text-base capitalize">{planId}</span>
                  </div>
                  {isCurrentPlan && (
                    <span className="text-[10px] font-bold bg-primary/15 text-primary border border-primary/20 px-2 py-0.5 rounded-full">
                      Plan actuel
                    </span>
                  )}
                </div>

                <div>
                  {price ? (
                    <>
                      <span className="text-2xl font-extrabold">{formatCDF(price.price_cdf)}</span>
                      <span className="text-xs text-muted-foreground ml-1">/{selectedPeriod === "mensuel" ? "mois" : "an"}</span>
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">Prix non disponible</span>
                  )}
                </div>

                <ul className="space-y-1">
                  {features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                <Button
                  className={cn(
                    "w-full rounded-xl font-bold h-10 gap-1.5",
                    planId === "business" && !isCurrentPlan
                      ? "bg-primary hover:bg-primary/90"
                      : ""
                  )}
                  disabled={!price || isPaying || !!payingPlanId}
                  onClick={() => handlePay(planId)}
                  variant={isCurrentPlan ? "outline" : "default"}
                >
                  {isPaying ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Redirection...</>
                  ) : isCurrentPlan ? (
                    <><ArrowRight className="h-4 w-4" /> Renouveler</>
                  ) : (
                    <><ArrowRight className="h-4 w-4" /> Choisir {planId === "pro" ? "Pro" : "Business"}</>
                  )}
                </Button>
              </div>
            );
          })}
        </div>

        {/* Avertissement frais */}
        <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
          <Shield className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground/70" />
          Des frais de paiement s'ajoutent au prix affiché, ils seront indiqués sur la page de paiement SasPay avant de confirmer.
        </p>

        {/* Historique des paiements */}
        {paymentHistory && paymentHistory.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Receipt className="h-3.5 w-3.5" /> Historique des paiements
            </p>
            <div className="divide-y rounded-xl border bg-card overflow-hidden">
              {paymentHistory.slice(0, 5).map((pay) => {
                const statusStyle =
                  pay.statut === "payé"
                    ? "text-emerald-600 bg-emerald-500/10"
                    : pay.statut === "en_attente" || pay.statut === "à_vérifier"
                    ? "text-amber-600 bg-amber-500/10"
                    : "text-red-600 bg-red-500/10";
                const statusLabel: Record<string, string> = {
                  payé: "Payé",
                  en_attente: "En attente",
                  à_vérifier: "À vérifier",
                  échoué: "Échoué",
                  annulé: "Annulé",
                  expiré: "Expiré",
                };
                return (
                  <div key={pay.id} className="flex items-center justify-between gap-3 px-4 py-3 text-xs">
                    <div className="space-y-0.5">
                      <p className="font-bold capitalize">
                        {pay.plan_id} — {pay.period || "mensuel"}
                      </p>
                      <p className="text-muted-foreground">
                        {new Date(pay.cree_le ?? "").toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                        {pay.saspay_transaction_id && (
                          <span className="ml-1 font-mono text-[10px] opacity-60">
                            · {pay.saspay_transaction_id.slice(0, 12)}…
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-bold">{formatCDF(pay.montant_cdf ?? 0)}</span>
                      <span className={cn("px-2 py-0.5 rounded-full font-semibold text-[10px]", statusStyle)}>
                        {statusLabel[pay.statut ?? ""] ?? pay.statut}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Déconnexion */}
      <section className="rounded-2xl border bg-card p-4 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="font-bold text-sm sm:text-base">Session</h2>
          <p className="text-[11px] sm:text-xs text-muted-foreground">Se déconnecter de votre espace commerçant.</p>
        </div>
        <Button
          variant="outline"
          onClick={() => supabase.auth.signOut().then(() => (window.location.href = "/auth"))}
          className="w-full sm:w-auto text-red-500 hover:text-red-600 hover:bg-red-500/10 rounded-xl justify-center h-10 sm:h-9"
        >
          <LogOut className="h-4 w-4 mr-2" /> Déconnexion
        </Button>
      </section>

      {/* Supprimer mon compte */}
      <section className="rounded-2xl border border-red-200 dark:border-red-900/40 bg-red-500/5 p-4 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
              <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div>
              <h2 className="font-bold text-sm sm:text-base text-red-600 dark:text-red-400">Supprimer mon compte</h2>
              <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Supprime définitivement votre compte, votre boutique, vos produits, vos commandes et
                tous vos jetons Meta. Cette action est <strong>irréversible</strong>.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            disabled={deleting}
            onClick={() => setDeleteStep("password")}
            className="w-full sm:w-auto text-red-500 hover:text-red-600 hover:bg-red-500/10 border-red-300 dark:border-red-800 rounded-xl shrink-0 h-10 sm:h-9 justify-center"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {deleting ? "Suppression…" : "Supprimer"}
          </Button>
        </div>

          {/* Étape 1 : Vérification du mot de passe */}
          <Dialog
            open={deleteStep === "password"}
            onOpenChange={(open) => {
              if (!open) closeDeleteModal();
            }}
          >
            <DialogContent className="w-[calc(100vw-2rem)] max-w-md max-h-[90vh] overflow-y-auto p-5 sm:p-6 rounded-2xl sm:rounded-2xl">
              <DialogHeader className="text-left">
                <DialogTitle className="flex items-center gap-2 text-red-600 text-lg sm:text-xl">
                  <Lock className="h-5 w-5 shrink-0" /> Confirmation d'identité
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm text-left">
                  Pour des raisons de sécurité, veuillez saisir votre mot de passe de compte pour continuer.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleVerifyPassword} className="space-y-4 py-1">
                <div className="space-y-1.5">
                  <Label htmlFor="delete-account-password" className="text-xs font-medium">Mot de passe de votre compte</Label>
                  <div className="relative">
                    <Input
                      id="delete-account-password"
                      type={showDeletePassword ? "text" : "password"}
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      placeholder="••••••••"
                      autoFocus
                      disabled={verifyingPassword}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowDeletePassword(!showDeletePassword)}
                      tabIndex={-1}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showDeletePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeDeleteModal}
                    disabled={verifyingPassword}
                    className="w-full sm:w-auto"
                  >
                    Annuler
                  </Button>
                  <Button
                    type="submit"
                    disabled={!deletePassword.trim() || verifyingPassword}
                    className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white"
                  >
                    {verifyingPassword ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Vérification…
                      </>
                    ) : (
                      "Vérifier mon mot de passe"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Étape 2 : Confirmation irréversible avec vérification boutique et phrase */}
          <AlertDialog
            open={deleteStep === "confirm"}
            onOpenChange={(open) => {
              if (!open && !deleting) closeDeleteModal();
            }}
          >
            <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-lg max-h-[90vh] overflow-y-auto p-5 sm:p-6 rounded-2xl sm:rounded-2xl">
              <AlertDialogHeader className="text-left">
                <AlertDialogTitle className="flex items-center gap-2 text-red-600 text-lg sm:text-xl">
                  <AlertTriangle className="h-5 w-5 shrink-0" /> Supprimer mon compte définitivement
                </AlertDialogTitle>
                <AlertDialogDescription className="text-xs sm:text-sm text-left">
                  Cette action est <strong>définitive et irréversible</strong>. Votre boutique,
                  vos produits, vos commandes et tous vos jetons d'accès Meta seront supprimés
                  immédiatement. Vous serez déconnecté automatiquement.
                </AlertDialogDescription>
              </AlertDialogHeader>

              <div className="space-y-4 py-1">
                {/* Vérification 1 : Nom de la boutique si elle existe */}
                {shop?.name && (
                  <div className="space-y-1.5 rounded-xl border border-red-200/80 dark:border-red-900/40 bg-red-500/5 p-3">
                    <Label htmlFor="confirm-shop-name" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <Store className="h-3.5 w-3.5 text-red-600 shrink-0" />
                      1. Tapez le nom de votre boutique : <span className="font-bold text-red-600 select-all">{shop.name}</span>
                    </Label>
                    <Input
                      id="confirm-shop-name"
                      value={confirmShopName}
                      onChange={(e) => setConfirmShopName(e.target.value)}
                      placeholder={shop.name}
                      autoComplete="off"
                      disabled={deleting}
                      className="border-red-200 focus-visible:ring-red-500 text-sm bg-background"
                    />
                    {confirmShopName.trim() && confirmShopName.trim() !== shop.name && (
                      <p className="text-[11px] text-red-500">Le nom ne correspond pas exactement.</p>
                    )}
                  </div>
                )}

                {/* Vérification 2 : Phrase de confirmation */}
                <div className="space-y-1.5 rounded-xl border border-red-200/80 dark:border-red-900/40 bg-red-500/5 p-3">
                  <Label htmlFor="confirm-delete" className="text-xs font-medium text-foreground block">
                    {shop?.name ? "2. Tapez exactement :" : "Pour confirmer, tapez exactement :"}{" "}
                    <span className="font-bold text-red-600 select-all tracking-wider">Je supprime mon compte</span>
                  </Label>
                  <Input
                    id="confirm-delete"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="Je supprime mon compte"
                    autoComplete="off"
                    disabled={deleting}
                    className="border-red-200 focus-visible:ring-red-500 text-sm bg-background"
                  />
                  {confirmText.trim() && confirmText.trim() !== "Je supprime mon compte" && (
                    <p className="text-[11px] text-red-500">La phrase ne correspond pas exactement.</p>
                  )}
                </div>
              </div>

              <AlertDialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-2 pt-1">
                <AlertDialogCancel
                  disabled={deleting}
                  onClick={closeDeleteModal}
                  className="w-full sm:w-auto mt-0"
                >
                  Annuler
                </AlertDialogCancel>
                <AlertDialogAction
                  disabled={
                    (!!shop?.name && confirmShopName.trim() !== shop.name) ||
                    confirmText.trim() !== "Je supprime mon compte" ||
                    deleting
                  }
                  onClick={deleteAccount}
                  className="w-full sm:w-auto bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Suppression en cours…
                    </>
                  ) : (
                    "Oui, supprimer définitivement"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
      </section>
    </div>
  );
}
