// Domaine Métier: Abonnements, Tarifs CDF, Calculs des dates et Limites Serveur
export type SubscriptionPeriod = "mensuel" | "annuel";

export type PaymentStatus =
  | "en_attente"
  | "payé"
  | "échoué"
  | "expiré"
  | "annulé"
  | "à_vérifier";

export type PaymentMethod = "saspay" | "manuel";

export type SubscriptionStatus = "actif" | "grâce" | "expiré";

export type ReminderLevel = "none" | "7_days" | "3_days" | "grace" | "expired";

export interface PlanPrice {
  id: string;
  plan_id: string;
  period: SubscriptionPeriod;
  price_cdf: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MerchantSubscription {
  id: string;
  merchant_id: string;
  shop_id: string;
  plan_id: string;
  debut: string;
  fin: string;
  statut: SubscriptionStatus;
  period: SubscriptionPeriod;
  payment_id?: string | null;
  cree_le: string;
  mis_a_jour_le: string;
}

export interface SubscriptionPayment {
  id: string;
  merchant_id?: string | null;
  shop_id?: string | null;
  plan_id: string;
  period: SubscriptionPeriod;
  montant_cdf: number;
  statut: PaymentStatus;
  methode: PaymentMethod;
  saspay_session_id?: string | null;
  checkout_url?: string | null;
  saspay_transaction_id?: string | null;
  montant_debite?: number | null;
  montant_net?: number | null;
  frais?: number | null;
  cree_le: string;
  paye_le?: string | null;
  admin_note?: string | null;
  reviewed_at?: string | null;
}

export interface PaymentEvent {
  id: string;
  corps: unknown;
  signature_valide: boolean;
  type_evenement: string;
  recu_le: string;
  traite_le?: string | null;
  resultat?: string | null;
  session_id?: string | null;
  transaction_id?: string | null;
}

export interface ComputedPlanLimits {
  plan_id: string;
  plan_name: string;
  status: SubscriptionStatus;
  is_grace_period: boolean;
  days_remaining: number;
  reminder_level: ReminderLevel;
  starts_at: string;
  ends_at: string;
  grace_ends_at: string;
  max_products: number | null;
  max_photos: number;
  max_active_promotions: number | null;
  promo_templates: string[];
  meta_access: boolean;
  advanced_stats: boolean;
  advanced_themes: boolean;
}

const GRACE_PERIOD_DAYS = 7;

/**
 * Ajoute en toute sécurité un nombre de mois à une date en évitant le débordement
 * (ex: 31 octobre + 1 mois => 30 novembre, et non 1er décembre).
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const expectedMonth = (result.getMonth() + months) % 12;
  result.setMonth(result.getMonth() + months);
  if (result.getMonth() !== (expectedMonth < 0 ? expectedMonth + 12 : expectedMonth)) {
    result.setDate(0); // Dernier jour du mois précédent
  }
  return result;
}

/**
 * Calcule la date de fin d'un abonnement selon la période.
 * RÈGLE MÉTIER : Début maintenant, ou à la fin de l'abonnement en cours si renouvellement anticipé.
 */
export function calculateSubscriptionDates(params: {
  currentEnd?: Date | string | null;
  period: SubscriptionPeriod;
  now?: Date;
}): { debut: Date; fin: Date } {
  const now = params.now ? new Date(params.now) : new Date();
  let baseDate = now;

  // Si renouvellement anticipé (abonnement en cours dont la fin est dans le futur)
  if (params.currentEnd) {
    const currentEndDate = new Date(params.currentEnd);
    if (currentEndDate.getTime() > now.getTime()) {
      baseDate = currentEndDate;
    }
  }

  let fin: Date;
  if (params.period === "annuel") {
    fin = new Date(baseDate.getTime());
    fin.setFullYear(fin.getFullYear() + 1);
  } else {
    // Période mensuelle (+ 1 mois sans débordement)
    fin = addMonths(baseDate, 1);
  }

  return {
    debut: baseDate.getTime() > now.getTime() ? now : baseDate,
    fin,
  };
}

/**
 * Détermine le statut d'un abonnement :
 * - 'actif' si maintenant <= date de fin
 * - 'grâce' si date de fin < maintenant <= date de fin + 7 jours
 * - 'expiré' au-delà des 7 jours de grâce
 */
export function determineSubscriptionStatus(params: {
  endDate: Date | string;
  now?: Date;
  graceDays?: number;
}): SubscriptionStatus {
  const now = params.now ? new Date(params.now) : new Date();
  const fin = new Date(params.endDate);
  const graceDays = params.graceDays ?? GRACE_PERIOD_DAYS;
  const graceEnd = new Date(fin.getTime() + graceDays * 24 * 60 * 60 * 1000);

  if (now.getTime() <= fin.getTime()) {
    return "actif";
  }

  if (now.getTime() <= graceEnd.getTime()) {
    return "grâce";
  }

  return "expiré";
}

/**
 * Calcule le niveau de rappel pour les alertes dans l'application :
 * - '7_days' : entre 4 et 7 jours avant la fin
 * - '3_days' : 3 jours ou moins avant la fin
 * - 'grace' : échu mais encore dans la période de grâce de 7 jours
 * - 'expired' : complètement expiré
 * - 'none' : plus de 7 jours restants
 */
export function calculateReminderLevel(params: {
  endDate: Date | string;
  now?: Date;
  graceDays?: number;
}): {
  level: ReminderLevel;
  daysRemaining: number;
  graceDaysRemaining: number;
} {
  const now = params.now ? new Date(params.now) : new Date();
  const fin = new Date(params.endDate);
  const graceDays = params.graceDays ?? GRACE_PERIOD_DAYS;
  const graceEnd = new Date(fin.getTime() + graceDays * 24 * 60 * 60 * 1000);

  const msRemaining = fin.getTime() - now.getTime();
  const daysRemaining = Math.ceil(msRemaining / (24 * 60 * 60 * 1000));

  const msGraceRemaining = graceEnd.getTime() - now.getTime();
  const graceDaysRemaining = Math.max(0, Math.ceil(msGraceRemaining / (24 * 60 * 60 * 1000)));

  if (daysRemaining > 7) {
    return { level: "none", daysRemaining, graceDaysRemaining };
  }

  if (daysRemaining > 3 && daysRemaining <= 7) {
    return { level: "7_days", daysRemaining, graceDaysRemaining };
  }

  if (daysRemaining >= 0 && daysRemaining <= 3) {
    return { level: "3_days", daysRemaining, graceDaysRemaining };
  }

  if (daysRemaining < 0 && graceDaysRemaining > 0) {
    return { level: "grace", daysRemaining, graceDaysRemaining };
  }

  return { level: "expired", daysRemaining, graceDaysRemaining: 0 };
}

/**
 * RÈGLE MÉTIER : Fin d'abonnement sans suppression :
 * Identifie les produits et promotions au-delà des limites du plan Gratuit
 * pour les mettre en pause (sans jamais rien supprimer).
 */
export function identifyExcessItemsToPause(params: {
  products: { id: string; status: string; created_at: string }[];
  promotions: { id: string; status: string; created_at: string }[];
  maxProducts: number | null; // ex: 10 pour le plan gratuit
  maxActivePromotions: number | null; // ex: 0 ou 1 pour le plan gratuit
}): {
  productIdsToHide: string[];
  promotionIdsToPause: string[];
} {
  const productIdsToHide: string[] = [];
  const promotionIdsToPause: string[] = [];

  // 1. Produits : seuls les produits actifs comptent vers la limite
  if (params.maxProducts !== null) {
    const activeProducts = params.products
      .filter((p) => p.status === "active")
      // Conserver les plus anciens (premiers créés), masquer les plus récents en surplus
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    if (activeProducts.length > params.maxProducts) {
      const excess = activeProducts.slice(params.maxProducts);
      for (const p of excess) {
        productIdsToHide.push(p.id);
      }
    }
  }

  // 2. Promotions : seules les promotions publiées / actives comptent vers la limite
  if (params.maxActivePromotions !== null) {
    const publishedPromos = params.promotions
      .filter((pr) => pr.status === "published")
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    if (publishedPromos.length > params.maxActivePromotions) {
      const excess = publishedPromos.slice(params.maxActivePromotions);
      for (const pr of excess) {
        promotionIdsToPause.push(pr.id);
      }
    }
  }

  return { productIdsToHide, promotionIdsToPause };
}

/** Formatage standard des montants en Francs Congolais (CDF) */
export function formatCDF(amount: number): string {
  return new Intl.NumberFormat("fr-CD", {
    style: "currency",
    currency: "CDF",
    maximumFractionDigits: 0,
  }).format(amount);
}
