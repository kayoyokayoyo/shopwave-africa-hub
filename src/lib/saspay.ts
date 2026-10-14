import crypto from "node:crypto";

/**
 * Client SasPay — côté SERVEUR uniquement.
 * Les secrets SASPAY_SECRET_KEY, SASPAY_WEBHOOK_SECRET et SASPAY_ENV
 * sont dans les variables d'environnement serveur. Jamais dans le code,
 * le navigateur, GitHub ni les journaux.
 */

const SASPAY_BASE_URL = "https://api.saspay.me/api/v1";

function getSasPayKey(): string {
  const key = process.env["SASPAY_SECRET_KEY"];
  if (!key) throw new Error("[SasPay] Variable d'environnement SASPAY_SECRET_KEY manquante.");
  return key;
}

export function getSasPayEnv(): "test" | "live" {
  const env = process.env["SASPAY_ENV"];
  return env === "live" ? "live" : "test";
}

export function getSasPayWebhookSecret(): string {
  const secret = process.env["SASPAY_WEBHOOK_SECRET"];
  if (!secret) throw new Error("[SasPay] Variable d'environnement SASPAY_WEBHOOK_SECRET manquante.");
  return secret;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SasPayCheckoutInput {
  amount: string;           // Décimal texte, ex: "10000.00"
  currency: "CDF";
  description: string;      // ex: "Abonnement MarketNet : Pro mensuel"
  country: "CD";
  customer_email: string;
  customer_name: string;
  return_url: string;
  metadata: Record<string, string>;
  expires_at: string;       // ISO 8601
}

export interface SasPayCheckoutResponse {
  id: string;               // saspay_session_id
  checkout_url: string;
  status: string;
  amount: string;
  currency: string;
  expires_at?: string;
}

export interface SasPayWebhookPayload {
  event: string;            // ex: "payment.completed"
  data: {
    session_id: string;
    transaction_id?: string;
    status: string;
    amount_charged?: string;
    amount_net?: string;
    fees?: string;
    metadata?: Record<string, string>;
  };
}

// ── Fonctions ─────────────────────────────────────────────────────────────────

/**
 * Crée une session de paiement SasPay.
 * Ne jamais logger la clé secrète.
 */
export async function createSasPayCheckout(
  input: SasPayCheckoutInput
): Promise<SasPayCheckoutResponse> {
  const key = getSasPayKey();

  let response: Response;
  try {
    response = await fetch(`${SASPAY_BASE_URL}/checkout-sessions/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(input),
    });
  } catch (networkErr) {
    console.error("[SasPay] Erreur réseau lors de la création de session:", networkErr);
    throw new Error(
      "Impossible de contacter la passerelle de paiement SasPay. Vérifiez la connexion serveur."
    );
  }

  if (!response.ok) {
    let detail = "";
    try {
      const body = await response.json();
      // Ne pas logger le corps complet car il peut contenir des infos sensibles
      detail = body?.detail || body?.message || body?.error || JSON.stringify(body);
    } catch {
      detail = `HTTP ${response.status}`;
    }
    console.error(`[SasPay] Echec création session: HTTP ${response.status} — ${detail}`);
    throw new Error(
      `Erreur SasPay (${response.status}) : ${detail || "Réponse invalide de la passerelle."}`
    );
  }

  const data = await response.json();
  if (!data?.id || !data?.checkout_url) {
    console.error("[SasPay] Réponse inattendue (id ou checkout_url manquant)");
    throw new Error(
      "La passerelle de paiement a renvoyé une réponse incomplète. Contactez le support."
    );
  }

  return data as SasPayCheckoutResponse;
}

/**
 * Vérifie la signature HMAC-SHA256 d'un webhook SasPay.
 * Le corps brut (string) est requis — ne pas le parser avant.
 */
export async function verifySasPayWebhookSignature(
  rawBody: string,
  signatureHeader: string
): Promise<boolean> {
  try {
    const secret = getSasPayWebhookSecret();
    const hexSig = signatureHeader.replace(/^sha256=/i, "").trim().toLowerCase();
    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(rawBody, "utf8")
      .digest("hex")
      .toLowerCase();

    if (hexSig.length !== expectedSig.length) {
      return false;
    }

    const sigBuf = Buffer.from(hexSig, "utf8");
    const expectedBuf = Buffer.from(expectedSig, "utf8");
    return crypto.timingSafeEqual(sigBuf, expectedBuf);
  } catch (err) {
    console.error("[SasPay] Erreur de vérification de signature:", err);
    return false;
  }
}
