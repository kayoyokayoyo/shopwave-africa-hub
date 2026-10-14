import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
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
      max_active_promotions: 0,
      promo_templates: ["minimal"],
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
