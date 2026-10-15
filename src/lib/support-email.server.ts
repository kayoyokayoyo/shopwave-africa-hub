import nodemailer from "nodemailer";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Réutilise exactement le même transporteur SMTP Google que invoices.server.ts
 */
function createSmtpTransporter() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT) || 465;
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASSWORD?.replace(/"/g, "")?.trim();
  if (!user || !pass) {
    console.warn("[SupportEmail] Identifiants SMTP non configurés.");
    return null;
  }
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

/** Récupère l'adresse e-mail de support admin depuis app_settings */
async function getSupportAdminEmail(): Promise<string> {
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", "support_email")
    .maybeSingle();
  const fromEnv = process.env.MARKETNET_ADMIN_EMAIL || process.env.SMTP_USER || "support@marketnet.cd";
  if (!data?.value) return fromEnv;
  const v = typeof data.value === "string" ? data.value : JSON.stringify(data.value);
  const cleaned = v.replace(/^"|"$/g, "").trim();
  return cleaned || fromEnv;
}

function buildEmailShell(params: {
  badgeText: string;
  badgeColor: string;
  title: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
}): string {
  const siteUrl = process.env.MARKETNET_SITE_URL || "https://marketnet-chi.vercel.app";
  const fromName = process.env.SMTP_FROM_NAME || "MarketNet";
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${params.title} — ${fromName}</title>
</head>
<body style="margin: 0; padding: 24px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <!-- En-tête -->
    <tr>
      <td style="padding: 28px 32px 20px; background-color: #ffffff; border-bottom: 2px solid #f1f5f9;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td>
              <div style="font-size: 24px; font-weight: 900; letter-spacing: -0.5px; color: #0f172a;">
                Market<span style="color: #f97316;">Net</span>
              </div>
              <div style="font-size: 12px; color: #64748b; margin-top: 2px;">La plateforme e-commerce des commerçants de RDC</div>
            </td>
            <td align="right">
              <span style="display: inline-block; padding: 6px 12px; background-color: ${params.badgeColor}; font-size: 11px; font-weight: 700; border-radius: 9999px; border: 1px solid #e2e8f0;">
                ${params.badgeText}
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <!-- Corps -->
    <tr>
      <td style="padding: 28px 32px 20px;">
        ${params.body}
        ${params.ctaLabel && params.ctaUrl ? `
        <div style="text-align: center; margin: 28px 0 12px;">
          <a href="${params.ctaUrl}" style="display: inline-block; background-color: #f97316; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 28px; border-radius: 10px; box-shadow: 0 4px 12px rgba(249, 115, 22, 0.25);">
            ${params.ctaLabel} →
          </a>
        </div>` : ""}
      </td>
    </tr>
    <!-- Pied de page -->
    <tr>
      <td style="padding: 20px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8;">
        <p style="margin: 2px 0;">© ${new Date().getFullYear()} MarketNet Africa — La plateforme e-commerce tout-en-un.</p>
        <p style="margin: 2px 0;">Ceci est une notification automatique. Ne répondez pas directement à cet e-mail.</p>
        <p style="margin: 4px 0;"><a href="${siteUrl}" style="color: #f97316; text-decoration: none;">${siteUrl}</a></p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Modèle : Notification admin → nouveau ticket ───────────────────────────

export function buildNewTicketAdminHtml(params: {
  numero: string;
  titre: string;
  categorie: string;
  boutique: string;
  email: string;
  whatsapp?: string;
  texteMessage: string;
  adminUrl: string;
}): string {
  const labelCat: Record<string, string> = {
    paiement_abonnement: "Paiement & abonnement",
    connexion_facebook: "Connexion Facebook",
    boutique_produits: "Boutique & produits",
    commandes: "Commandes",
    autre: "Autre",
  };
  const body = `
    <h2 style="font-size: 18px; font-weight: 800; margin: 0 0 8px; color: #0f172a;">🎫 Nouveau ticket de support</h2>
    <p style="font-size: 14px; color: #475569; margin: 0 0 20px;">Un commerçant vient d'ouvrir un ticket.</p>
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 20px;">
      <tr><td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #64748b; font-weight: 600; width: 140px;">Numéro</td><td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 14px; font-weight: 700; color: #f97316;">${params.numero}</td></tr>
      <tr><td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #64748b; font-weight: 600;">Titre</td><td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 14px; font-weight: 600;">${params.titre}</td></tr>
      <tr><td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #64748b; font-weight: 600;">Catégorie</td><td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px;">${labelCat[params.categorie] ?? params.categorie}</td></tr>
      <tr><td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #64748b; font-weight: 600;">Boutique</td><td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px;">${params.boutique}</td></tr>
      <tr><td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #64748b; font-weight: 600;">E-mail</td><td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px;">${params.email || "—"}</td></tr>
      <tr><td style="padding: 12px 16px; font-size: 12px; color: #64748b; font-weight: 600;">WhatsApp</td><td style="padding: 12px 16px; font-size: 13px;">${params.whatsapp || "—"}</td></tr>
    </table>
    <div style="background-color: #fff7ed; border: 1px solid #fed7aa; border-radius: 10px; padding: 14px 18px; margin-bottom: 16px;">
      <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #ea580c; margin-bottom: 6px;">Message initial</div>
      <p style="margin: 0; font-size: 13px; color: #1e293b; line-height: 1.6; white-space: pre-wrap;">${params.texteMessage}</p>
    </div>`;
  return buildEmailShell({
    badgeText: "NOUVEAU TICKET",
    badgeColor: "#fff7ed",
    title: `Ticket ${params.numero}`,
    body,
    ctaLabel: "Répondre dans l'espace Admin",
    ctaUrl: params.adminUrl,
  });
}

// ─── Modèle : Notification commerçant → réponse admin ──────────────────────

export function buildAdminReplyHtml(params: {
  numero: string;
  titre: string;
  texteReponse: string;
  merchantName: string;
  ticketUrl: string;
}): string {
  const body = `
    <h2 style="font-size: 18px; font-weight: 800; margin: 0 0 8px; color: #0f172a;">💬 Nouvelle réponse à votre ticket</h2>
    <p style="font-size: 14px; color: #475569; margin: 0 0 4px;">Bonjour <strong>${params.merchantName}</strong>,</p>
    <p style="font-size: 14px; color: #475569; margin: 0 0 20px;">Notre équipe vient de répondre à votre ticket <strong style="color: #f97316;">${params.numero}</strong> — « ${params.titre} ».</p>
    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 16px 18px; margin-bottom: 20px;">
      <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #166534; margin-bottom: 8px;">Réponse de l'équipe MarketNet</div>
      <p style="margin: 0; font-size: 14px; color: #1e293b; line-height: 1.7; white-space: pre-wrap;">${params.texteReponse}</p>
    </div>
    <p style="font-size: 12px; color: #64748b; margin: 0 0 8px;">Pour répondre ou voir l'historique complet, connectez-vous à votre espace commerçant (connexion requise) :</p>`;
  return buildEmailShell({
    badgeText: "RÉPONSE SUPPORT",
    badgeColor: "#f0fdf4",
    title: `Réponse ticket ${params.numero}`,
    body,
    ctaLabel: "Voir le ticket",
    ctaUrl: params.ticketUrl,
  });
}

// ─── Modèle : Rappel d'abonnement ──────────────────────────────────────────

export function buildSubscriptionReminderHtml(params: {
  merchantName: string;
  planName: string;
  finDate: string;
  typeRappel: "j_moins_7" | "j_moins_3" | "debut_grace" | "expiration";
  abonnementUrl: string;
}): string {
  const MESSAGES: Record<string, { emoji: string; titre: string; texte: string; urgent: boolean }> = {
    j_moins_7: {
      emoji: "📅",
      titre: "Votre abonnement expire dans 7 jours",
      texte: `Votre abonnement <strong>${params.planName}</strong> arrive à échéance le <strong>${params.finDate}</strong>. Renouvelez dès maintenant pour continuer à vendre sans interruption.`,
      urgent: false,
    },
    j_moins_3: {
      emoji: "⏰",
      titre: "Plus que 3 jours — pensez à renouveler",
      texte: `Votre abonnement <strong>${params.planName}</strong> expire le <strong>${params.finDate}</strong>. Évitez toute coupure de service en procédant au renouvellement sans tarder.`,
      urgent: false,
    },
    debut_grace: {
      emoji: "⚠️",
      titre: "Période de grâce activée — 7 jours restants",
      texte: `Votre abonnement <strong>${params.planName}</strong> a expiré le <strong>${params.finDate}</strong>. Vous bénéficiez d'une période de grâce de <strong>7 jours</strong> pendant laquelle votre boutique reste accessible. Renouvelez avant la fin de cette période pour éviter le passage au plan Gratuit.`,
      urgent: true,
    },
    expiration: {
      emoji: "🔴",
      titre: "Abonnement expiré — boutique limitée",
      texte: `Votre abonnement <strong>${params.planName}</strong> est arrivé à expiration. Votre boutique est maintenant limitée aux fonctionnalités du plan Gratuit. Renouvelez immédiatement pour rétablir tous vos accès et masquer les produits supplémentaires.`,
      urgent: true,
    },
  };
  const msg = MESSAGES[params.typeRappel];
  const bgColor = msg.urgent ? "#fff1f2" : "#fff7ed";
  const borderColor = msg.urgent ? "#fecdd3" : "#fed7aa";
  const body = `
    <h2 style="font-size: 18px; font-weight: 800; margin: 0 0 8px; color: #0f172a;">${msg.emoji} ${msg.titre}</h2>
    <p style="font-size: 14px; color: #475569; margin: 0 0 20px;">Bonjour <strong>${params.merchantName}</strong>,</p>
    <div style="background-color: ${bgColor}; border: 1px solid ${borderColor}; border-radius: 12px; padding: 16px 18px; margin-bottom: 20px;">
      <p style="margin: 0; font-size: 14px; color: #1e293b; line-height: 1.7;">${msg.texte}</p>
    </div>
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0; margin-bottom: 20px;">
      <tr><td style="padding: 10px 16px; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #64748b; font-weight: 600;">Plan actuel</td><td style="padding: 10px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 700;">${params.planName}</td></tr>
      <tr><td style="padding: 10px 16px; font-size: 12px; color: #64748b; font-weight: 600;">Date de fin</td><td style="padding: 10px 16px; font-size: 13px; font-weight: 700; color: #e11d48;">${params.finDate}</td></tr>
    </table>`;
  return buildEmailShell({
    badgeText: msg.urgent ? "URGENT" : "RAPPEL",
    badgeColor: msg.urgent ? "#fff1f2" : "#fff7ed",
    title: msg.titre,
    body,
    ctaLabel: "Renouveler mon abonnement",
    ctaUrl: params.abonnementUrl,
  });
}

// ─── Envoi avec retry × 3, sans bloquer l'appelant ─────────────────────────

async function sendWithRetry(params: {
  to: string;
  subject: string;
  html: string;
  tag: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const transporter = createSmtpTransporter();
  if (!transporter) return { success: false, error: "SMTP non configuré" };
  const fromName = process.env.SMTP_FROM_NAME || "MarketNet";
  const fromEmail = process.env.SMTP_USER?.trim() || "contact@marketnet.cd";

  let lastError = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const info = await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: params.to,
        subject: params.subject,
        html: params.html,
      });
      console.log(`[${params.tag}] Envoyé à ${params.to} (id=${info.messageId}, tentative=${attempt})`);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.warn(`[${params.tag}] Tentative ${attempt}/3 échouée.`);
      if (attempt < 3) await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  console.error(`[${params.tag}] Échec définitif après 3 tentatives.`);
  return { success: false, error: lastError };
}

// ─── Enregistrement dans notification_outbox ────────────────────────────────

async function recordOutbox(params: {
  destinataire: string;
  type: string;
  reference?: string;
  sujet: string;
  success: boolean;
  messageId?: string;
  error?: string;
  tentatives: number;
}) {
  try {
    await (supabaseAdmin as any).from("notification_outbox").insert({
      destinataire: params.destinataire,
      type: params.type,
      reference: params.reference ?? null,
      sujet: params.sujet,
      statut: params.success ? "envoyé" : "échoué",
      tentatives: params.tentatives,
      erreur: params.error ?? null,
      envoye_le: params.success ? new Date().toISOString() : null,
    });
  } catch (e) {
    console.warn("[SupportEmail] Erreur enregistrement outbox:", e);
  }
}

// ─── API publique : nouveau ticket ─────────────────────────────────────────

export async function sendNewTicketAdminNotification(params: {
  ticketId: string;
  numero: string;
  titre: string;
  categorie: string;
  boutique: string;
  email: string;
  whatsapp?: string;
  texteMessage: string;
}): Promise<void> {
  const siteUrl = process.env.MARKETNET_SITE_URL || "https://marketnet-chi.vercel.app";
  const adminEmail = await getSupportAdminEmail();
  const subject = `[MarketNet Support] Nouveau ticket ${params.numero} — ${params.titre}`;
  const html = buildNewTicketAdminHtml({
    ...params,
    adminUrl: `${siteUrl}/admin/support/${params.ticketId}`,
  });
  const result = await sendWithRetry({ to: adminEmail, subject, html, tag: "NewTicket" });
  await recordOutbox({
    destinataire: adminEmail,
    type: "support_new_ticket",
    reference: params.ticketId,
    sujet: subject,
    success: result.success,
    messageId: result.messageId,
    error: result.error,
    tentatives: 3,
  });
}

// ─── API publique : réponse admin → commerçant ─────────────────────────────

export async function sendAdminReplyNotification(params: {
  ticketId: string;
  numero: string;
  titre: string;
  texteReponse: string;
  merchantName: string;
  merchantEmail: string;
}): Promise<void> {
  if (!params.merchantEmail || !params.merchantEmail.includes("@")) return;
  const siteUrl = process.env.MARKETNET_SITE_URL || "https://marketnet-chi.vercel.app";
  const subject = `[MarketNet] Réponse à votre ticket ${params.numero} — ${params.titre}`;
  const html = buildAdminReplyHtml({
    numero: params.numero,
    titre: params.titre,
    texteReponse: params.texteReponse,
    merchantName: params.merchantName,
    ticketUrl: `${siteUrl}/dashboard/support/${params.ticketId}`,
  });
  const result = await sendWithRetry({ to: params.merchantEmail, subject, html, tag: "AdminReply" });
  await recordOutbox({
    destinataire: params.merchantEmail,
    type: "support_admin_reply",
    reference: params.ticketId,
    sujet: subject,
    success: result.success,
    messageId: result.messageId,
    error: result.error,
    tentatives: 3,
  });
}

// ─── API publique : rappel d'abonnement ────────────────────────────────────

export async function sendSubscriptionReminderEmail(params: {
  subscriptionId: string;
  merchantEmail: string;
  merchantName: string;
  planName: string;
  finDate: string;
  typeRappel: "j_moins_7" | "j_moins_3" | "debut_grace" | "expiration";
}): Promise<{ success: boolean }> {
  if (!params.merchantEmail || !params.merchantEmail.includes("@")) {
    return { success: false };
  }
  const siteUrl = process.env.MARKETNET_SITE_URL || "https://marketnet-chi.vercel.app";
  const LABELS: Record<string, string> = {
    j_moins_7: "Abonnement expirant dans 7 jours",
    j_moins_3: "Abonnement expirant dans 3 jours",
    debut_grace: "Période de grâce activée — renouvelez maintenant",
    expiration: "Abonnement expiré — action requise",
  };
  const subject = `[MarketNet] ${LABELS[params.typeRappel]}`;
  const html = buildSubscriptionReminderHtml({
    merchantName: params.merchantName,
    planName: params.planName,
    finDate: params.finDate,
    typeRappel: params.typeRappel,
    abonnementUrl: `${siteUrl}/dashboard/abonnement`,
  });
  const result = await sendWithRetry({ to: params.merchantEmail, subject, html, tag: `Reminder:${params.typeRappel}` });
  await recordOutbox({
    destinataire: params.merchantEmail,
    type: "subscription_reminder",
    reference: params.subscriptionId,
    sujet: subject,
    success: result.success,
    messageId: result.messageId,
    error: result.error,
    tentatives: 3,
  });
  return { success: result.success };
}
