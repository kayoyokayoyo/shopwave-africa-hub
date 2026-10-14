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
  amount: string;           // Décimal texte, ex: "5.00"
  currency: "USD";
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

function unwrapSasPayResponse(payload: unknown): SasPayCheckoutResponse | null {
  if (!payload || typeof payload !== "object") return null;

  const envelope = payload as Record<string, unknown>;
  const data = envelope.data && typeof envelope.data === "object"
    ? (envelope.data as Record<string, unknown>)
    : envelope;

  if (typeof data.id !== "string" || typeof data.checkout_url !== "string") return null;
  return data as unknown as SasPayCheckoutResponse;
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
      const errorDetail = body?.detail ?? body?.message ?? body?.error ?? body;
      detail = typeof errorDetail === "string" ? errorDetail : JSON.stringify(errorDetail);
    } catch {
      detail = `HTTP ${response.status}`;
    }
    console.error(`[SasPay] Echec création session: HTTP ${response.status} — ${detail}`);
    throw new Error(
      `Erreur SasPay (${response.status}) : ${detail || "Réponse invalide de la passerelle."}`
    );
  }

  const payload: unknown = await response.json();
  const data = unwrapSasPayResponse(payload);
  if (!data) {
    const envelope = payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : {};
    const nestedData = envelope.data && typeof envelope.data === "object"
      ? (envelope.data as Record<string, unknown>)
      : null;
    console.error("[SasPay] Réponse inattendue, champs reçus :", {
      topLevel: Object.keys(envelope),
      data: nestedData ? Object.keys(nestedData) : null,
    });
    throw new Error(
      "La passerelle de paiement a renvoyé une réponse incomplète. Contactez le support."
    );
  }

  return data;
}

/**
 * Récupère les informations d'une session de paiement SasPay
 * utile pour relire les métadonnées lors d'un rapprochement.
 */
export async function getSasPayCheckoutSession(
  sessionId: string
): Promise<SasPayCheckoutResponse | null> {
  const key = getSasPayKey();
  try {
    const res = await fetch(`${SASPAY_BASE_URL}/checkout-sessions/${encodeURIComponent(sessionId)}/`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) return null;
    return unwrapSasPayResponse(await res.json());
  } catch (err) {
    console.error("[SasPay] Erreur récupération session:", err);
    return null;
  }
}

export interface WebhookVerificationResult {
  isValid: boolean;
  reason?: "missing_headers" | "timestamp_expired" | "invalid_signature" | "secret_missing";
}

/**
 * Vérifie l'en-tête X-Webhook-Signature et X-Webhook-Timestamp.
 * 1. Tolérance de 5 minutes (300 secondes)
 * 2. HMAC-SHA256 en hexadécimal minuscule de `${timestamp}.${corpsBrut}`
 * 3. Comparaison en temps constant
 */
export async function verifySasPayWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  timestampHeader?: string | null,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): Promise<WebhookVerificationResult> {
  let secret = "";
  try {
    secret = getSasPayWebhookSecret();
  } catch (_e) {
    return { isValid: false, reason: "secret_missing" };
  }

  if (!signatureHeader) {
    return { isValid: false, reason: "missing_headers" };
  }

  // Si un timestamp est fourni, vérifier la fenêtre de 5 min (300 s)
  if (timestampHeader) {
    const ts = parseInt(timestampHeader, 10);
    if (isNaN(ts) || Math.abs(nowSeconds - ts) > 300) {
      return { isValid: false, reason: "timestamp_expired" };
    }
  }

  try {
    const hexSig = signatureHeader.replace(/^sha256=/i, "").trim().toLowerCase();
    
    // Le message à signer est `${timestamp}.${corpsBrut}` si timestamp est présent, sinon corpsBrut seul
    const payloadToSign = timestampHeader ? `${timestampHeader}.${rawBody}` : rawBody;

    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(payloadToSign, "utf8")
      .digest("hex")
      .toLowerCase();

    if (hexSig.length !== expectedSig.length) {
      return { isValid: false, reason: "invalid_signature" };
    }

    const sigBuf = Buffer.from(hexSig, "utf8");
    const expectedBuf = Buffer.from(expectedSig, "utf8");
    const matches = crypto.timingSafeEqual(sigBuf, expectedBuf);

    return {
      isValid: matches,
      reason: matches ? undefined : "invalid_signature",
    };
  } catch (err) {
    console.error("[SasPay] Erreur de vérification de signature:", err);
    return { isValid: false, reason: "invalid_signature" };
  }
}
