import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createSasPayCheckout } from "./saspay";
import {
  calculateSubscriptionDates,
  determineSubscriptionStatus,
  calculateReminderLevel,
  identifyExcessItemsToPause,
  type SubscriptionPeriod,
  type PaymentStatus,
  type PlanPrice,
  type MerchantSubscription,
  type SubscriptionPayment,
  type ComputedPlanLimits,
} from "./subscriptions";

// Type sérialisable pour les événements webhook (corps JSON stringifié pour TanStack Start)
export interface SerializablePaymentEvent {
  id: string;
  corps: string; // JSON.stringify du corps brut
  signature_valide: boolean;
  type_evenement: string;
  recu_le: string;
  traite_le?: string | null;
  resultat?: string | null;
  session_id?: string | null;
  transaction_id?: string | null;
}

// ── 1. Tarifs des plans ────────────────────────────────────────────────────────

export const getPlanPrices = createServerFn({ method: "GET" }).handler(
  async (): Promise<PlanPrice[]> => {
    const sb = supabaseAdmin;
    const { data, error } = await sb
      .from("plan_prices")
      .select("*")
      .order("price_cdf", { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []) as PlanPrice[];
  }
);

export const adminUpdatePlanPrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      id: z.string().uuid(),
      price_cdf: z.number().min(0),
      is_active: z.boolean(),
    })
  )
  .handler(async ({ data: input, context }) => {
    // Vérifier rôle admin
    const { data: role } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!role) throw new Error("Accès refusé : rôle administrateur requis");

    const sb = supabaseAdmin;
    const { error } = await sb
      .from("plan_prices")
      .update({
        price_cdf: input.price_cdf,
        is_active: input.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.id);

    if (error) throw new Error(error.message);
    return { success: true };
  });

// ── 2. Calcul et consultation de l'abonnement commerçant ──────────────────────

export const getMerchantSubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ shopId: z.string().uuid() }))
  .handler(async ({ data: input, context }): Promise<ComputedPlanLimits> => {
    const sb = supabaseAdmin;

    // Vérifier que l'utilisateur est bien le propriétaire de la boutique ou admin
    const { data: shop } = await sb
      .from("shops")
      .select("id, owner_id, plan_id, plan_expires_at")
      .eq("id", input.shopId)
      .maybeSingle();

    if (!shop) throw new Error("Boutique introuvable");
    const isOwner = shop.owner_id === context.userId;

    const { data: adminRole } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!isOwner && !adminRole) throw new Error("Accès non autorisé");

    // Récupérer le dernier abonnement enregistré pour cette boutique
    const { data: sub } = await sb
      .from("merchant_subscriptions")
      .select("*")
      .eq("shop_id", input.shopId)
      .order("fin", { ascending: false })
      .limit(1)
      .maybeSingle();

    const now = new Date();
    let currentPlanId = "free";
    let status: "actif" | "grâce" | "expiré" = "actif";
    let startsAt = now.toISOString();
    let endsAt = new Date(now.getTime() + 365 * 100 * 24 * 3600 * 1000).toISOString(); // infini par défaut pour gratuit

    if (sub) {
      status = determineSubscriptionStatus({ endDate: sub.fin, now });
      startsAt = sub.debut;
      endsAt = sub.fin;
      // Pendant la période de grâce ou actif, le commerçant conserve son plan payant
      if (status === "actif" || status === "grâce") {
        currentPlanId = sub.plan_id;
      } else {
        currentPlanId = "free";
      }
    } else if (shop.plan_id && shop.plan_id !== "free" && shop.plan_expires_at) {
      status = determineSubscriptionStatus({ endDate: shop.plan_expires_at, now });
      startsAt = shop.plan_expires_at;
      endsAt = shop.plan_expires_at;
      currentPlanId = (status === "actif" || status === "grâce") ? shop.plan_id : "free";
    }

    // Récupérer la configuration du plan effectif
    const { data: planData } = await sb
      .from("plans")
      .select("*")
      .eq("id", currentPlanId)
      .maybeSingle();

    const plan = planData || {
      id: "free",
      name: "Gratuit",
      max_products: 10,
      max_photos: 3,
      max_active_promotions: 1,
      promo_templates: ["fullscreen", "split", "minimal"],
      meta_access: false,
      advanced_stats: false,
      advanced_themes: false,
    };

    const reminder = calculateReminderLevel({ endDate: endsAt, now });
    const graceEndsAt = new Date(new Date(endsAt).getTime() + 7 * 24 * 3600 * 1000).toISOString();

    return {
      plan_id: plan.id,
      plan_name: plan.name,
      status,
      is_grace_period: status === "grâce",
      days_remaining: reminder.daysRemaining,
      reminder_level: reminder.level,
      starts_at: startsAt,
      ends_at: endsAt,
      grace_ends_at: graceEndsAt,
      max_products: plan.max_products,
      max_photos: plan.max_photos ?? 3,
      max_active_promotions: plan.max_active_promotions,
      promo_templates: (plan.promo_templates as string[]) ?? ["minimal"],
      meta_access: plan.meta_access ?? false,
      advanced_stats: plan.advanced_stats ?? false,
      advanced_themes: plan.advanced_themes ?? false,
    };
  });

// ── 3. Historique des paiements commerçant ─────────────────────────────────────

export const getMerchantPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ shopId: z.string().uuid() }))
  .handler(async ({ data: input, context }): Promise<SubscriptionPayment[]> => {
    const sb = supabaseAdmin;

    const { data: shop } = await sb
      .from("shops")
      .select("id, owner_id")
      .eq("id", input.shopId)
      .maybeSingle();

    if (!shop || (shop.owner_id !== context.userId)) {
      throw new Error("Accès non autorisé");
    }

    const { data, error } = await sb
      .from("subscription_payments")
      .select("*")
      .or(`shop_id.eq.${input.shopId},merchant_id.eq.${context.userId}`)
      .order("cree_le", { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []) as SubscriptionPayment[];
  });

// ── 4. Activation sécurisée (serveur uniquement) ──────────────────────────────

export async function internalActivateSubscription({
  shopId,
  merchantId,
  planId,
  period,
  paymentId,
}: {
  shopId: string;
  merchantId?: string;
  planId: string;
  period: SubscriptionPeriod;
  paymentId?: string;
}) {
  const sb = supabaseAdmin;

  // 1. Récupérer la boutique
  const { data: shop } = await sb
    .from("shops")
    .select("id, owner_id, plan_id, plan_expires_at")
    .eq("id", shopId)
    .single();

  if (!shop) throw new Error("Boutique introuvable");
  const actualMerchantId = merchantId || shop.owner_id;

  // 2. Vérifier s'il existe un abonnement en cours pour renouvellement anticipé
  const { data: latestSub } = await sb
    .from("merchant_subscriptions")
    .select("*")
    .eq("shop_id", shopId)
    .order("fin", { ascending: false })
    .limit(1)
    .maybeSingle();

  const currentEnd = latestSub?.fin || shop.plan_expires_at;
  const { debut, fin } = calculateSubscriptionDates({
    currentEnd,
    period,
  });

  // 3. Insérer le nouvel enregistrement d'abonnement
  const { data: newSub, error: subErr } = await sb
    .from("merchant_subscriptions")
    .insert({
      merchant_id: actualMerchantId,
      shop_id: shopId,
      plan_id: planId,
      debut: debut.toISOString(),
      fin: fin.toISOString(),
      statut: "actif",
      period,
      payment_id: paymentId ?? null,
      cree_le: new Date().toISOString(),
      mis_a_jour_le: new Date().toISOString(),
    })
    .select()
    .single();

  if (subErr) throw new Error(subErr.message);

  // 4. Mettre à jour la boutique (plan et expiration)
  const { error: shopErr } = await sb
    .from("shops")
    .update({
      plan_id: planId,
      plan_expires_at: fin.toISOString(),
    })
    .eq("id", shopId);

  if (shopErr) throw new Error(shopErr.message);

  // 5. Si un paiement est associé, marquer payé
  if (paymentId) {
    await sb
      .from("subscription_payments")
      .update({
        statut: "payé",
        paye_le: new Date().toISOString(),
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", paymentId);
  }

  return newSub;
}

// ── 5. Administration : Liste des paiements & validation manuelle ─────────────

export const adminGetPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      statut: z.string().optional(),
      search: z.string().optional(),
    })
  )
  .handler(async ({ data: input, context }) => {
    // Vérification admin
    const { data: adminRole } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!adminRole) throw new Error("Accès refusé");

    const sb = supabaseAdmin;
    let query = sb
      .from("subscription_payments")
      .select("*, shops:shop_id(name, slug, owner_id, profiles:owner_id(full_name, email))")
      .order("cree_le", { ascending: false });

    if (input.statut && input.statut !== "all") {
      query = query.eq("statut", input.statut);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return data ?? [];
  });

export const adminReviewPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      paymentId: z.string().uuid(),
      decision: z.enum(["valider", "refuser"]),
      adminNote: z.string().optional(),
    })
  )
  .handler(async ({ data: input, context }) => {
    const { data: adminRole } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!adminRole) throw new Error("Accès refusé : administrateur requis");

    const sb = supabaseAdmin;
    const { data: payment } = await sb
      .from("subscription_payments")
      .select("*")
      .eq("id", input.paymentId)
      .single();

    if (!payment) throw new Error("Paiement introuvable");

    if (input.decision === "valider") {
      if (!payment.shop_id) throw new Error("Paiement non relié à une boutique");
      await internalActivateSubscription({
        shopId: payment.shop_id,
        merchantId: payment.merchant_id || undefined,
        planId: payment.plan_id,
        period: (payment.period as SubscriptionPeriod) || "mensuel",
        paymentId: payment.id,
      });

      if (input.adminNote) {
        await sb
          .from("subscription_payments")
          .update({ admin_note: input.adminNote })
          .eq("id", payment.id);
      }

      return { success: true, message: "Paiement validé et plan activé avec succès." };
    } else {
      await sb
        .from("subscription_payments")
        .update({
          statut: "annulé",
          admin_note: input.adminNote ?? "Refusé par l'administrateur",
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", payment.id);

      return { success: true, message: "Paiement refusé." };
    }
  });

export const adminAssignPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      shopId: z.string().uuid(),
      planId: z.string(),
      period: z.enum(["mensuel", "annuel"]),
      note: z.string().optional(),
    })
  )
  .handler(async ({ data: input, context }) => {
    const { data: adminRole } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!adminRole) throw new Error("Accès refusé : administrateur requis");

    const sub = await internalActivateSubscription({
      shopId: input.shopId,
      planId: input.planId,
      period: input.period,
    });

    return { success: true, sub };
  });

export const adminGetPaymentEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: adminRole } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!adminRole) throw new Error("Accès refusé");

    const sb = supabaseAdmin;
    const { data, error } = await sb
      .from("payment_events")
      .select("*")
      .order("recu_le", { ascending: false })
      .limit(100);

    if (error) throw new Error(error.message);
    return (data ?? []).map((ev) => ({
      ...ev,
      corps: typeof ev.corps === "string" ? ev.corps : JSON.stringify(ev.corps),
    })) as SerializablePaymentEvent[];
  });

// ── 6. Tâche quotidienne planifiée (Fin avec grâce & retour Gratuit sans suppression) ──

export async function internalProcessDailySubscriptionChecks() {
  const sb = supabaseAdmin;
  const now = new Date();

  // 1. Récupérer tous les abonnements encore marqués 'actif' ou 'grâce'
  const { data: subs, error } = await sb
    .from("merchant_subscriptions")
    .select("*, shops:shop_id(id, plan_id)")
    .in("statut", ["actif", "grâce"]);

  if (error || !subs) return { processed: 0, transitionedToGrace: 0, expired: 0 };

  let transitionedToGrace = 0;
  let expired = 0;

  for (const s of subs) {
    const currentStatus = determineSubscriptionStatus({ endDate: s.fin, now });

    if (currentStatus === "grâce" && s.statut === "actif") {
      // Transition vers la période de grâce
      await sb
        .from("merchant_subscriptions")
        .update({ statut: "grâce", mis_a_jour_le: now.toISOString() })
        .eq("id", s.id);
      transitionedToGrace++;
    } else if (currentStatus === "expiré" && (s.statut === "actif" || s.statut === "grâce")) {
      // Expiration définitive au-delà de 7 jours de grâce
      await sb
        .from("merchant_subscriptions")
        .update({ statut: "expiré", mis_a_jour_le: now.toISOString() })
        .eq("id", s.id);

      // Basculer la boutique sur le plan Gratuit
      await sb
        .from("shops")
        .update({ plan_id: "free" })
        .eq("id", s.shop_id);

      // RÈGLE : Ne rien supprimer ! Mettre en pause les surplus au-delà des limites Gratuites (10 produits, 0 promo payante)
      const [{ data: products }, { data: promotions }] = await Promise.all([
        sb.from("products").select("id, status, created_at").eq("shop_id", s.shop_id),
        sb.from("promotions").select("id, status, created_at").eq("shop_id", s.shop_id),
      ]);

      const { productIdsToHide, promotionIdsToPause } = identifyExcessItemsToPause({
        products: products ?? [],
        promotions: promotions ?? [],
        maxProducts: 10,
        maxActivePromotions: 0,
      });

      if (productIdsToHide.length > 0) {
        await sb
          .from("products")
          .update({ status: "hidden" })
          .in("id", productIdsToHide);
      }

      if (promotionIdsToPause.length > 0) {
        await sb
          .from("promotions")
          .update({ status: "paused" })
          .in("id", promotionIdsToPause);
      }

      expired++;
    }
  }

  return {
    processed: subs.length,
    transitionedToGrace,
    expired,
  };
}

export const processDailySubscriptionChecks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: adminRole } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!adminRole) throw new Error("Accès refusé");
    return await internalProcessDailySubscriptionChecks();
  });

// ── 7. Création session de paiement SasPay ─────────────────────────────────────

const APP_URL = "https://marketnet-chi.vercel.app";

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      shopId: z.string().uuid(),
      planId: z.string().min(1),
      period: z.enum(["mensuel", "annuel"]),
    })
  )
  .handler(async ({ data: input, context }) => {
    const sb = supabaseAdmin;

    if (input.planId === "free") {
      throw new Error("Le plan gratuit ne nécessite aucun paiement.");
    }

    // 1. Vérifier propriété de la boutique
    const { data: shop } = await sb
      .from("shops")
      .select("id, owner_id, name")
      .eq("id", input.shopId)
      .maybeSingle();

    if (!shop || shop.owner_id !== context.userId) {
      throw new Error("Boutique introuvable ou accès non autorisé.");
    }

    // Récupérer les informations réelles du plan depuis la base de données
    const { data: dbPlan } = await sb
      .from("plans")
      .select("id, name")
      .eq("id", input.planId)
      .maybeSingle();

    const planLabel = dbPlan?.name || (input.planId.charAt(0).toUpperCase() + input.planId.slice(1));

    // 2. Récupérer l'email du compte
    const { data: userRecord } = await sb.auth.admin.getUserById(context.userId);
    const customerEmail = userRecord?.user?.email;
    const customerName = shop.name || "Commerçant MarketNet";

    if (!customerEmail) {
      throw new Error("Impossible de récupérer l'adresse e-mail du compte.");
    }

    // 3. Récupérer le prix depuis plan_prices (jamais depuis le navigateur)
    const { data: planPrice } = await sb
      .from("plan_prices")
      .select("price_cdf, is_active")
      .eq("plan_id", input.planId)
      .eq("period", input.period)
      .eq("is_active", true)
      .maybeSingle();

    if (!planPrice) {
      throw new Error(
        `Aucun tarif actif trouvé pour le plan ${planLabel} (${input.period}). Contactez l'administration.`
      );
    }

    // 4. Déduplication : renvoyer une session existante si déjà en attente et non expirée
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: existingPayment } = await sb
      .from("subscription_payments")
      .select("id, checkout_url, cree_le")
      .eq("merchant_id", context.userId)
      .eq("shop_id", input.shopId)
      .eq("plan_id", input.planId)
      .eq("period", input.period)
      .eq("statut", "en_attente")
      .gt("cree_le", oneHourAgo)
      .not("checkout_url", "is", null)
      .order("cree_le", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingPayment?.checkout_url) {
      return {
        paymentId: existingPayment.id,
        checkoutUrl: existingPayment.checkout_url,
        reused: true,
      };
    }

    // 5. Créer l'enregistrement subscription_payments (statut: en_attente)
    const { data: payment, error: insertError } = await sb
      .from("subscription_payments")
      .insert({
        merchant_id: context.userId,
        shop_id: input.shopId,
        plan_id: input.planId,
        period: input.period,
        montant_cdf: planPrice.price_cdf,
        statut: "en_attente",
        methode: "saspay",
      })
      .select("id")
      .single();

    if (insertError || !payment) {
      throw new Error("Impossible de créer l'enregistrement de paiement.");
    }

    const amountText = planPrice.price_cdf.toFixed(2);
    const periodLabel = input.period === "mensuel" ? "mensuel" : "annuel";
    const description = `Abonnement MarketNet : ${planLabel} ${periodLabel}`;
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // +1h

    // 6. Appeler l'API SasPay
    let sasPaySession;
    try {
      sasPaySession = await createSasPayCheckout({
        amount: amountText,
        currency: "CDF",
        description,
        country: "CD",
        customer_email: customerEmail,
        customer_name: customerName,
        return_url: `${APP_URL}/abonnement/retour?ref=${payment.id}`,
        metadata: {
          payment_id: payment.id,
          merchant_id: context.userId,
          plan: input.planId,
          period: input.period,
        },
        expires_at: expiresAt,
      });
    } catch (err) {
      // Marquer le paiement comme échoué
      await sb
        .from("subscription_payments")
        .update({ statut: "échoué" })
        .eq("id", payment.id);

      const msg = err instanceof Error ? err.message : "Erreur SasPay inconnue";
      throw new Error(msg);
    }

    // 7. Enregistrer saspay_session_id et checkout_url
    await sb
      .from("subscription_payments")
      .update({
        saspay_session_id: sasPaySession.id,
        checkout_url: sasPaySession.checkout_url,
      })
      .eq("id", payment.id);

    return {
      paymentId: payment.id,
      checkoutUrl: sasPaySession.checkout_url,
      reused: false,
    };
  });

// ── 8. Statut d'un paiement (polling page de retour) ──────────────────────────

export const getPaymentStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ paymentId: z.string().uuid() }))
  .handler(async ({ data: input, context }) => {
    const sb = supabaseAdmin;

    const { data: payment, error } = await sb
      .from("subscription_payments")
      .select("id, statut, plan_id, period, montant_cdf, montant_debite, montant_net, frais, cree_le, paye_le, merchant_id, shop_id, saspay_transaction_id")
      .eq("id", input.paymentId)
      .maybeSingle();

    if (error || !payment) {
      throw new Error("Paiement introuvable.");
    }

    // Sécurité : un commerçant ne peut voir que ses propres paiements
    if (payment.merchant_id !== context.userId) {
      throw new Error("Accès non autorisé.");
    }

    return {
      id: payment.id,
      statut: payment.statut as PaymentStatus,
      plan_id: payment.plan_id,
      period: payment.period as SubscriptionPeriod,
      montant_cdf: payment.montant_cdf,
      montant_debite: payment.montant_debite ?? null,
      montant_net: payment.montant_net ?? null,
      frais: payment.frais ?? null,
      cree_le: payment.cree_le,
      paye_le: payment.paye_le ?? null,
      transaction_id: payment.saspay_transaction_id ?? null,
    };
  });

