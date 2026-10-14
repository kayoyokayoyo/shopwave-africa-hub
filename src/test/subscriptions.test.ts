import { describe, it, expect } from "vitest";
import {
  calculateSubscriptionDates,
  determineSubscriptionStatus,
  calculateReminderLevel,
  identifyExcessItemsToPause,
  formatCDF,
} from "../lib/subscriptions";

describe("Système d'abonnements & Paiements - Partie 1/3", () => {
  describe("1. Renouvellement anticipé", () => {
    it("démarre à la date de fin en cours si renouvellement avant expiration (mensuel)", () => {
      // Date actuelle : 10 octobre 2026 à midi
      const now = new Date("2026-10-10T12:00:00Z");
      // Fin de l'abonnement en cours : 31 octobre 2026 à midi
      const currentEnd = new Date("2026-10-31T12:00:00Z");

      const dates = calculateSubscriptionDates({
        currentEnd,
        period: "mensuel",
        now,
      });

      // La nouvelle fin doit être prolongée d'un mois (30 novembre 2026) sans déborder sur décembre !
      expect(dates.fin.getUTCFullYear()).toBe(2026);
      expect(dates.fin.getUTCMonth()).toBe(10); // 10 = Novembre
      expect(dates.fin.getUTCDate()).toBe(30);
      expect(dates.fin.getTime()).toBeGreaterThan(currentEnd.getTime());
    });

    it("démarre à la date de fin en cours si renouvellement avant expiration (annuel)", () => {
      const now = new Date("2026-10-10T12:00:00Z");
      const currentEnd = new Date("2026-12-15T12:00:00Z");

      const dates = calculateSubscriptionDates({
        currentEnd,
        period: "annuel",
        now,
      });

      // La nouvelle fin est fin 2027
      expect(dates.fin.getUTCFullYear()).toBe(2027);
      expect(dates.fin.getUTCMonth()).toBe(11); // Décembre
      expect(dates.fin.getUTCDate()).toBe(15);
    });

    it("démarre à 'now' si l'abonnement précédent est déjà expiré", () => {
      const now = new Date("2026-10-14T10:00:00Z");
      // Abonnement échu le 1er octobre
      const currentEnd = new Date("2026-10-01T00:00:00Z");

      const dates = calculateSubscriptionDates({
        currentEnd,
        period: "mensuel",
        now,
      });

      expect(dates.debut.getTime()).toBe(now.getTime());
      expect(dates.fin.getMonth()).toBe(10); // Novembre
      expect(dates.fin.getDate()).toBe(14);
    });
  });

  describe("2. Fin d'abonnement avec période de grâce de 7 jours", () => {
    const finAbonnement = new Date("2026-10-10T00:00:00Z");

    it("est 'actif' tant que la date actuelle est avant la fin", () => {
      const now = new Date("2026-10-09T23:59:00Z");
      const status = determineSubscriptionStatus({ endDate: finAbonnement, now });
      expect(status).toBe("actif");
    });

    it("passe en 'grâce' dès l'expiration jusqu'à 7 jours plus tard", () => {
      // 3 jours après la fin
      const nowJ3 = new Date("2026-10-13T00:00:00Z");
      expect(determineSubscriptionStatus({ endDate: finAbonnement, now: nowJ3 })).toBe("grâce");

      // 6 jours et 23h après la fin (encore dans les 7 jours de grâce)
      const nowJ7 = new Date("2026-10-16T23:00:00Z");
      expect(determineSubscriptionStatus({ endDate: finAbonnement, now: nowJ7 })).toBe("grâce");
    });

    it("passe en 'expiré' après les 7 jours de grâce", () => {
      // 8 jours après la fin
      const nowJ8 = new Date("2026-10-18T00:00:01Z");
      expect(determineSubscriptionStatus({ endDate: finAbonnement, now: nowJ8 })).toBe("expiré");
    });

    it("calcule les rappels dans l'application (7 jours et 3 jours)", () => {
      const fin = new Date("2026-10-20T00:00:00Z");

      // 6 jours avant la fin -> '7_days'
      const now6j = new Date("2026-10-14T00:00:00Z");
      expect(calculateReminderLevel({ endDate: fin, now: now6j }).level).toBe("7_days");

      // 2 jours avant la fin -> '3_days'
      const now2j = new Date("2026-10-18T00:00:00Z");
      expect(calculateReminderLevel({ endDate: fin, now: now2j }).level).toBe("3_days");

      // Échu depuis 2 jours -> 'grace'
      const nowGrace = new Date("2026-10-22T00:00:00Z");
      expect(calculateReminderLevel({ endDate: fin, now: nowGrace }).level).toBe("grace");

      // 10 jours après fin -> 'expired'
      const nowExpired = new Date("2026-10-31T00:00:00Z");
      expect(calculateReminderLevel({ endDate: fin, now: nowExpired }).level).toBe("expired");
    });
  });

  describe("3. Retour au Gratuit sans suppression", () => {
    it("met en pause les produits au-delà de la limite gratuite (10) sans les supprimer", () => {
      // 15 produits créés à différentes dates
      const products = Array.from({ length: 15 }, (_, i) => ({
        id: `prod-${i + 1}`,
        status: "active",
        created_at: new Date(2026, 0, i + 1).toISOString(),
      }));

      const promotions = [
        { id: "promo-1", status: "published", created_at: "2026-01-01T00:00:00Z" },
        { id: "promo-2", status: "published", created_at: "2026-01-02T00:00:00Z" },
      ];

      const { productIdsToHide, promotionIdsToPause } = identifyExcessItemsToPause({
        products,
        promotions,
        maxProducts: 10, // limite gratuite
        maxActivePromotions: 0, // gratuit = 0 promo payante
      });

      // Les 10 premiers (les plus anciens prod-1 à prod-10) restent actifs
      // Les 5 surplus (prod-11 à prod-15) sont identifiés pour masquage
      expect(productIdsToHide).toHaveLength(5);
      expect(productIdsToHide).toEqual(["prod-11", "prod-12", "prod-13", "prod-14", "prod-15"]);

      // Les promotions actives passent en pause
      expect(promotionIdsToPause).toHaveLength(2);
      expect(promotionIdsToPause).toEqual(["promo-1", "promo-2"]);
    });

    it("ne met rien en pause si le commerçant respecte déjà les limites gratuites", () => {
      const products = [
        { id: "p1", status: "active", created_at: "2026-01-01" },
        { id: "p2", status: "active", created_at: "2026-01-02" },
      ];
      const promotions: any[] = [];

      const { productIdsToHide, promotionIdsToPause } = identifyExcessItemsToPause({
        products,
        promotions,
        maxProducts: 10,
        maxActivePromotions: 0,
      });

      expect(productIdsToHide).toHaveLength(0);
      expect(promotionIdsToPause).toHaveLength(0);
    });
  });

  describe("4. Anciennes fonctions & formatage inchangés", () => {
    it("formate correctement les montants en Francs Congolais (CDF)", () => {
      const formatted = formatCDF(25000);
      expect(formatted).toContain("25");
      expect(formatted.includes("FC") || formatted.includes("CDF")).toBe(true);
    });
  });
});
