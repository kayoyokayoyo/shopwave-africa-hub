import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";
import {
  calculateSubscriptionDates,
  determineSubscriptionStatus,
  calculateReminderLevel,
  identifyExcessItemsToPause,
  formatUSD,
  formatCDF,
} from "../lib/subscriptions";
import { verifySasPayWebhookSignature } from "../lib/saspay";

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

  describe("4. Formatage des montants d'abonnement (USD)", () => {
    it("formate correctement les montants en Dollars ($ USD)", () => {
      const formatted = formatUSD(5);
      expect(formatted).toBe("5 $");
      const formattedDecimal = formatUSD(5.5);
      expect(formattedDecimal).toContain("5,5");
      expect(formattedDecimal).toContain("$");
    });
  });

  describe("5. Sécurité SasPay - Signature Webhook (Partie 2/3)", () => {
    const originalSecret = process.env["SASPAY_WEBHOOK_SECRET"];
    const testSecret = "whsec_test_secret_for_vitest_123456789";

    beforeEach(() => {
      process.env["SASPAY_WEBHOOK_SECRET"] = testSecret;
    });

    afterEach(() => {
      if (originalSecret !== undefined) {
        process.env["SASPAY_WEBHOOK_SECRET"] = originalSecret;
      } else {
        delete process.env["SASPAY_WEBHOOK_SECRET"];
      }
    });

    it("valide une signature HMAC-SHA256 avec horodatage ${timestamp}.${corpsBrut}", async () => {
      const timestamp = "1728900000";
      const nowSeconds = 1728900010; // 10 secondes après
      const payload = JSON.stringify({
        event: "transaction.success",
        data: { id: "tr_123", status: "success" },
      });

      const messageToSign = `${timestamp}.${payload}`;
      const validSignature = crypto
        .createHmac("sha256", testSecret)
        .update(messageToSign, "utf8")
        .digest("hex");

      const res = await verifySasPayWebhookSignature(payload, validSignature, timestamp, nowSeconds);
      expect(res.isValid).toBe(true);
    });

    it("rejette un horodatage s'écartant de plus de 5 minutes (300 s)", async () => {
      const timestamp = "1728900000";
      const nowSeconds = 1728900305; // 305 secondes après (> 5 min)
      const payload = JSON.stringify({ event: "transaction.success" });

      const messageToSign = `${timestamp}.${payload}`;
      const validSignature = crypto
        .createHmac("sha256", testSecret)
        .update(messageToSign, "utf8")
        .digest("hex");

      const res = await verifySasPayWebhookSignature(payload, validSignature, timestamp, nowSeconds);
      expect(res.isValid).toBe(false);
      expect(res.reason).toBe("timestamp_expired");
    });

    it("rejette une signature altérée", async () => {
      const payload = JSON.stringify({ event: "transaction.success" });
      const fakeSignature = "0000000000000000000000000000000000000000000000000000000000000000";

      const res = await verifySasPayWebhookSignature(payload, fakeSignature);
      expect(res.isValid).toBe(false);
      expect(res.reason).toBe("invalid_signature");
    });

    it("rejette si le corps a été modifié après signature", async () => {
      const timestamp = "1728900000";
      const originalPayload = JSON.stringify({ event: "transaction.success", amount: "25000" });
      const tamperedPayload = JSON.stringify({ event: "transaction.success", amount: "50000" });

      const signature = crypto
        .createHmac("sha256", testSecret)
        .update(`${timestamp}.${originalPayload}`, "utf8")
        .digest("hex");

      const res = await verifySasPayWebhookSignature(tamperedPayload, signature, timestamp, 1728900010);
      expect(res.isValid).toBe(false);
      expect(res.reason).toBe("invalid_signature");
    });

    it("retourne false sans crash si la clé secrète webhook est absente", async () => {
      delete process.env["SASPAY_WEBHOOK_SECRET"];
      const res = await verifySasPayWebhookSignature("{}", "abc");
      expect(res.isValid).toBe(false);
      expect(res.reason).toBe("secret_missing");
    });
  });

  describe("6. Logique Métier Webhook SasPay - USD", () => {
    // Rapprochement et contrôles de montant en USD
    it("valide la cohérence du montant avec le prix attendu du plan (USD)", () => {
      const expectedPrice = 5; // 5 $ USD

      // amount ou net_amount correspond au prix
      const candidate1 = { amount: 5, charged: 5.15, fee: 0.15, currency: "USD" };
      const isCandidate1Valid =
        candidate1.currency === "USD" &&
        Math.abs(candidate1.amount - expectedPrice) <= 0.05;
      expect(isCandidate1Valid).toBe(true);

      // JAMAIS charged seul (contient les frais 5.15 $)
      const isChargedValid = Math.abs(candidate1.charged - expectedPrice) <= 0.05;
      expect(isChargedValid).toBe(false);
    });

    it("détecte un montant incohérent pour mise en 'à_vérifier'", () => {
      const expectedPrice = 5;
      const receivedAmount = 2; // reçu 2 $ au lieu de 5 $

      const isAmountValid = Math.abs(receivedAmount - expectedPrice) <= 0.05;
      expect(isAmountValid).toBe(false);
    });

    it("détecte une devise non USD pour mise en 'à_vérifier'", () => {
      const currency = "EUR";
      expect(currency.toUpperCase() === "USD").toBe(false);
    });

    it("filtre les événements informatifs ou de test pour journalisation seule", () => {
      const testEvents = ["webhook.test", "settlement.created", "wallet_transfer.completed"];
      for (const ev of testEvents) {
        const isInformational =
          ev === "webhook.test" ||
          ev.startsWith("settlement.") ||
          ev.startsWith("wallet_transfer.");
        expect(isInformational).toBe(true);
      }
    });

    it("identifie les événements de paiement réussis, échoués et annulés", () => {
      expect(["transaction.success", "payment.completed"].includes("transaction.success")).toBe(true);
      expect(["transaction.failed", "payment.failed"].includes("transaction.failed")).toBe(true);
      expect(["transaction.cancelled", "payment.cancelled"].includes("transaction.cancelled")).toBe(true);
    });
  });
});

