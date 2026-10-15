import nodemailer from "nodemailer";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { formatCDF } from "@/lib/subscriptions";

export interface InvoiceData {
  invoiceNumber: string;
  paymentId: string;
  transactionId: string;
  shopName: string;
  shopWhatsapp?: string;
  merchantEmail: string;
  merchantName: string;
  planName: string;
  period: string;
  amountCDF: number;
  paymentDate: string;
  validUntil: string;
  paymentMethod: string;
  dashboardUrl: string;
}

/**
 * Récupère toutes les données nécessaires pour établir la facture
 */
export async function getInvoiceData(paymentId: string): Promise<InvoiceData | null> {
  const sb = supabaseAdmin;

  const { data: payment, error: payErr } = await sb
    .from("subscription_payments")
    .select("*, shops(*)")
    .eq("id", paymentId)
    .single();

  if (payErr || !payment) {
    console.error("[Invoices] Paiement introuvable pour la facture:", payErr);
    return null;
  }

  const shop = payment.shops as any;
  const merchantId = payment.merchant_id || shop?.owner_id;

  // Récupérer l'email et le nom du commerçant
  let merchantEmail = "client@marketnet.cd";
  let merchantName = shop?.name || "Commerçant";

  if (merchantId) {
    try {
      const { data: userRecord } = await sb.auth.admin.getUserById(merchantId);
      if (userRecord?.user?.email) {
        merchantEmail = userRecord.user.email;
      }
      if (userRecord?.user?.user_metadata?.full_name) {
        merchantName = userRecord.user.user_metadata.full_name;
      }
    } catch (err) {
      console.warn("[Invoices] Impossible de récupérer l'utilisateur auth:", err);
    }
  }

  // Récupérer la date de fin d'abonnement
  let validUntil = shop?.plan_expires_at;
  if (!validUntil) {
    const { data: sub } = await sb
      .from("merchant_subscriptions")
      .select("fin")
      .eq("shop_id", payment.shop_id ?? "")
      .order("fin", { ascending: false })
      .limit(1)
      .maybeSingle();
    validUntil = sub?.fin;
  }

  const invoiceNumber = `MN-${payment.id.slice(0, 8).toUpperCase()}`;
  const amountCDF = Number((payment as any).montant_cdf ?? payment.amount ?? 0);
  const paymentDate = new Date(payment.paye_le || payment.cree_le).toLocaleString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const validUntilFormatted = validUntil
    ? new Date(validUntil).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "30 jours après activation";

  const siteUrl = process.env.MARKETNET_SITE_URL || "https://marketnet-chi.vercel.app";

  return {
    invoiceNumber,
    paymentId: payment.id,
    transactionId: payment.saspay_transaction_id || payment.id,
    shopName: shop?.name || "Votre boutique",
    shopWhatsapp: shop?.whatsapp || undefined,
    merchantEmail,
    merchantName,
    planName: `Plan ${(payment.plan_id || "Pro").toUpperCase()}`,
    period: payment.period === "annuel" ? "Annuel (1 an)" : "Mensuel (30 jours)",
    amountCDF,
    paymentDate,
    validUntil: validUntilFormatted,
    paymentMethod: payment.methode === "saspay" ? "SasPay (Mobile Money / Carte)" : (payment.methode || "SasPay"),
    dashboardUrl: `${siteUrl}/dashboard/abonnement`,
  };
}

/**
 * Crée le transporteur Nodemailer pour Gmail SMTP
 */
function createSmtpTransporter() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT) || 465;
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASSWORD?.replace(/"/g, "")?.trim();

  if (!user || !pass) {
    console.warn("[Invoices] Identifiants SMTP non configurés dans l'environnement.");
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

/**
 * Génère le modèle HTML épuré et lisible pour l'e-mail de facture
 */
export function buildInvoiceHtml(inv: InvoiceData): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Facture ${inv.invoiceNumber} — MarketNet</title>
</head>
<body style="margin: 0; padding: 24px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    
    <!-- En-tête -->
    <tr>
      <td style="padding: 32px 32px 24px; background-color: #ffffff; border-bottom: 2px solid #f1f5f9;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td>
              <div style="font-size: 24px; font-weight: 900; letter-spacing: -0.5px; color: #0f172a;">
                Market<span style="color: #f97316;">Net</span>
              </div>
              <div style="font-size: 12px; color: #64748b; margin-top: 2px;">
                La plateforme e-commerce des commerçants de RDC
              </div>
            </td>
            <td align="right">
              <span style="display: inline-block; padding: 6px 12px; background-color: #ecfdf5; color: #059669; font-size: 12px; font-weight: 700; border-radius: 9999px; border: 1px solid #a7f3d0;">
                ✓ ACQUITTÉE
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Message de confirmation -->
    <tr>
      <td style="padding: 24px 32px 16px;">
        <h2 style="font-size: 18px; font-weight: 700; margin: 0 0 8px; color: #0f172a;">
          Merci pour votre règlement !
        </h2>
        <p style="font-size: 14px; line-height: 1.5; color: #475569; margin: 0;">
          Votre souscription pour la boutique <strong>${inv.shopName}</strong> a été validée avec succès. Retrouvez ci-dessous le reçu officiel de votre paiement.
        </p>
      </td>
    </tr>

    <!-- Récapitulatif Facture -->
    <tr>
      <td style="padding: 0 32px;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; margin: 12px 0 24px;">
          <tr>
            <td style="padding: 16px; border-bottom: 1px solid #e2e8f0;">
              <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; display: block; margin-bottom: 2px;">N° de Facture</span>
              <strong style="font-size: 14px; color: #0f172a; font-family: monospace;">${inv.invoiceNumber}</strong>
            </td>
            <td style="padding: 16px; border-bottom: 1px solid #e2e8f0;">
              <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; display: block; margin-bottom: 2px;">Date de paiement</span>
              <span style="font-size: 13px; color: #0f172a;">${inv.paymentDate}</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 16px;">
              <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; display: block; margin-bottom: 2px;">Moyen de règlement</span>
              <span style="font-size: 13px; color: #0f172a;">${inv.paymentMethod}</span>
            </td>
            <td style="padding: 16px;">
              <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; display: block; margin-bottom: 2px;">Validité de la formule</span>
              <span style="font-size: 13px; color: #059669; font-weight: 600;">Jusqu'au ${inv.validUntil}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Tableau de prestation -->
    <tr>
      <td style="padding: 0 32px;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 2px solid #e2e8f0;">
              <th align="left" style="padding: 10px 0; font-size: 12px; text-transform: uppercase; color: #64748b;">Description</th>
              <th align="center" style="padding: 10px 0; font-size: 12px; text-transform: uppercase; color: #64748b;">Durée</th>
              <th align="right" style="padding: 10px 0; font-size: 12px; text-transform: uppercase; color: #64748b;">Montant</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 14px 0; font-size: 14px; font-weight: 600; color: #0f172a;">
                Abonnement ${inv.planName}
                <div style="font-size: 12px; font-weight: normal; color: #64748b; margin-top: 2px;">
                  Boutique : ${inv.shopName}
                </div>
              </td>
              <td align="center" style="padding: 14px 0; font-size: 13px; color: #475569;">
                ${inv.period}
              </td>
              <td align="right" style="padding: 14px 0; font-size: 15px; font-weight: 700; color: #0f172a;">
                ${formatCDF(inv.amountCDF)}
              </td>
            </tr>
            <tr>
              <td colspan="2" align="right" style="padding: 16px 0 8px; font-size: 14px; font-weight: 600; color: #475569;">
                Total Réglé (FC) :
              </td>
              <td align="right" style="padding: 16px 0 8px; font-size: 20px; font-weight: 900; color: #0f172a;">
                ${formatCDF(inv.amountCDF)}
              </td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>

    <!-- Bouton d'action -->
    <tr>
      <td align="center" style="padding: 28px 32px 32px;">
        <a href="${inv.dashboardUrl}" style="display: inline-block; padding: 12px 28px; background-color: #0f172a; color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 13px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          Gérer mon abonnement sur MarketNet →
        </a>
      </td>
    </tr>

    <!-- Pied de page -->
    <tr>
      <td style="padding: 20px 32px; background-color: #f1f5f9; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; text-align: center; line-height: 1.5;">
        <p style="margin: 0 0 4px;">
          Réf. transaction SasPay : <span style="font-family: monospace;">${inv.transactionId}</span>
        </p>
        <p style="margin: 0;">
          Une question ou besoin d'assistance ? Contactez-nous à tout moment sur WhatsApp au support MarketNet.
        </p>
      </td>
    </tr>

  </table>
</body>
</html>`;
}

/**
 * Nettoie les caractères incompatibles avec les polices WinAnsi standard de pdf-lib
 */
function cleanPdfText(str: string | undefined | null): string {
  if (!str) return "";
  return String(str)
    .replace(/[—–]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/•/g, "-")
    .replace(/[^\x00-\xFF]/g, "");
}

/**
 * Génère le document PDF de la facture acquittée avec pdf-lib
 */
export async function generateInvoicePdf(inv: InvoiceData): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // Format A4
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  // Palette moderne et sobre
  const darkNavy = rgb(0.06, 0.09, 0.16); // #0f172a
  const orange = rgb(0.97, 0.45, 0.09); // #f97316
  const slate = rgb(0.39, 0.45, 0.55); // #64748b
  const lightBg = rgb(0.97, 0.98, 0.99); // #f8fafc
  const borderCol = rgb(0.89, 0.91, 0.94); // #e2e8f0
  const emerald = rgb(0.02, 0.59, 0.41); // #059669
  const emeraldBg = rgb(0.93, 0.99, 0.96); // #ecfdf5
  const white = rgb(1, 1, 1);

  // Bandeau supérieur
  page.drawRectangle({
    x: 45,
    y: 735,
    width: 505.28,
    height: 65,
    color: lightBg,
    borderColor: borderCol,
    borderWidth: 1,
  });

  // Logo MarketNet
  page.drawText("Market", { x: 60, y: 765, size: 24, font: fontBold, color: darkNavy });
  page.drawText("Net", { x: 142, y: 765, size: 24, font: fontBold, color: orange });
  page.drawText(cleanPdfText("Plateforme e-commerce pour commercants de RDC"), {
    x: 60,
    y: 748,
    size: 9,
    font: fontRegular,
    color: slate,
  });

  // Badge ACQUITTÉE
  page.drawRectangle({
    x: 415,
    y: 752,
    width: 120,
    height: 26,
    color: emeraldBg,
    borderColor: emerald,
    borderWidth: 1,
  });
  page.drawText(cleanPdfText("FACTURE ACQUITTEE"), {
    x: 425,
    y: 760,
    size: 9,
    font: fontBold,
    color: emerald,
  });

  // Titre principal
  page.drawText(cleanPdfText("FACTURE D'ABONNEMENT"), {
    x: 45,
    y: 700,
    size: 16,
    font: fontBold,
    color: darkNavy,
  });
  page.drawText(cleanPdfText(`Recu officiel pour la boutique ${inv.shopName}`), {
    x: 45,
    y: 686,
    size: 10,
    font: fontRegular,
    color: slate,
  });

  // Bloc 1 : Client / Commerçant (Gauche)
  page.drawRectangle({
    x: 45,
    y: 575,
    width: 245,
    height: 95,
    color: white,
    borderColor: borderCol,
    borderWidth: 1,
  });
  page.drawText("FACTURE A", { x: 55, y: 655, size: 8, font: fontBold, color: slate });
  page.drawText(cleanPdfText(inv.shopName), { x: 55, y: 638, size: 12, font: fontBold, color: darkNavy });
  page.drawText(cleanPdfText(`Responsable : ${inv.merchantName}`), { x: 55, y: 622, size: 9, font: fontRegular, color: slate });
  page.drawText(cleanPdfText(`Email : ${inv.merchantEmail}`), { x: 55, y: 607, size: 9, font: fontRegular, color: slate });
  if (inv.shopWhatsapp) {
    page.drawText(cleanPdfText(`WhatsApp : ${inv.shopWhatsapp}`), { x: 55, y: 592, size: 9, font: fontRegular, color: slate });
  }

  // Bloc 2 : Informations de Règlement (Droite)
  page.drawRectangle({
    x: 305,
    y: 575,
    width: 245,
    height: 95,
    color: white,
    borderColor: borderCol,
    borderWidth: 1,
  });
  page.drawText("INFORMATIONS REGLEMENT", { x: 315, y: 655, size: 8, font: fontBold, color: slate });
  page.drawText(cleanPdfText(`N° Facture : ${inv.invoiceNumber}`), { x: 315, y: 638, size: 10, font: fontBold, color: darkNavy });
  page.drawText(cleanPdfText(`Date : ${inv.paymentDate}`), { x: 315, y: 622, size: 9, font: fontRegular, color: slate });
  page.drawText(cleanPdfText(`Moyen : ${inv.paymentMethod}`), { x: 315, y: 607, size: 9, font: fontRegular, color: slate });
  page.drawText(cleanPdfText(`Ref SasPay : ${inv.transactionId.slice(0, 24)}`), { x: 315, y: 592, size: 8, font: fontRegular, color: slate });

  // Tableau récapitulatif
  // Header tableau
  page.drawRectangle({
    x: 45,
    y: 525,
    width: 505.28,
    height: 28,
    color: lightBg,
    borderColor: borderCol,
    borderWidth: 1,
  });
  page.drawText("DESCRIPTION", { x: 55, y: 535, size: 9, font: fontBold, color: slate });
  page.drawText("PERIODE", { x: 260, y: 535, size: 9, font: fontBold, color: slate });
  page.drawText("VALIDITE", { x: 360, y: 535, size: 9, font: fontBold, color: slate });
  page.drawText("MONTANT (USD)", { x: 460, y: 535, size: 9, font: fontBold, color: slate });

  // Ligne prestation
  page.drawRectangle({
    x: 45,
    y: 470,
    width: 505.28,
    height: 55,
    color: white,
    borderColor: borderCol,
    borderWidth: 1,
  });
  page.drawText(cleanPdfText(`Abonnement ${inv.planName}`), { x: 55, y: 505, size: 11, font: fontBold, color: darkNavy });
  page.drawText(cleanPdfText(`Boutique en ligne : ${inv.shopName}`), { x: 55, y: 488, size: 8, font: fontRegular, color: slate });
  page.drawText(cleanPdfText(inv.period), { x: 260, y: 498, size: 9, font: fontRegular, color: darkNavy });
  page.drawText(cleanPdfText(formatCDF(inv.amountCDF)), { x: 440, y: 498, size: 10, font: fontBold, color: darkNavy });

  // Ligne Total
  page.drawRectangle({
    x: 45,
    y: 425,
    width: 505.28,
    height: 45,
    color: lightBg,
    borderColor: borderCol,
    borderWidth: 1,
  });
  page.drawText("TOTAL REGLE (FC) :", { x: 280, y: 442, size: 10, font: fontBold, color: slate });
  page.drawText(cleanPdfText(formatCDF(inv.amountCDF)), { x: 420, y: 440, size: 14, font: fontBold, color: darkNavy });

  // Encadré de confirmation d'activation
  page.drawRectangle({
    x: 45,
    y: 350,
    width: 505.28,
    height: 55,
    color: emeraldBg,
    borderColor: emerald,
    borderWidth: 1,
  });
  page.drawText(cleanPdfText("Statut du paiement : CONFORME ET ACQUITTE"), {
    x: 55,
    y: 382,
    size: 9,
    font: fontBold,
    color: emerald,
  });
  page.drawText(cleanPdfText("Votre abonnement a ete credite et active instantanement sur MarketNet."), {
    x: 55,
    y: 368,
    size: 8,
    font: fontRegular,
    color: darkNavy,
  });
  page.drawText(cleanPdfText("Vous pouvez administrer vos produits, commandes et reglages sans interruption."), {
    x: 55,
    y: 356,
    size: 8,
    font: fontRegular,
    color: slate,
  });

  // Footer / mentions légales
  page.drawLine({
    start: { x: 45, y: 120 },
    end: { x: 550.28, y: 120 },
    thickness: 1,
    color: borderCol,
  });
  page.drawText(cleanPdfText("MarketNet RDC -- Plateforme officielle de commerce electronique"), {
    x: 45,
    y: 105,
    size: 8,
    font: fontBold,
    color: slate,
  });
  page.drawText(cleanPdfText("Assistance technique & Support : support@marketnet.cd -- WhatsApp MarketNet"), {
    x: 45,
    y: 92,
    size: 8,
    font: fontRegular,
    color: slate,
  });
  page.drawText(cleanPdfText(`Identifiant systeme : ${inv.paymentId} -- Genere automatiquement`), {
    x: 45,
    y: 80,
    size: 7,
    font: fontRegular,
    color: slate,
  });

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}

/**
 * Données pour la lettre d'attribution de plan (attribution manuelle par admin)
 */
export interface AssignmentLetterData {
  letterNumber: string;
  assignmentDate: string;
  shopName: string;
  merchantEmail: string;
  merchantName: string;
  planName: string;
  period: string;
  validUntil: string;
  adminNote: string;
  adminEmail: string;
  dashboardUrl: string;
}

/**
 * Génère le HTML de la lettre d'attribution de plan
 */
export function buildAssignmentLetterHtml(data: AssignmentLetterData): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lettre d'Attribution — ${data.planName} — MarketNet</title>
</head>
<body style="margin: 0; padding: 24px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">

    <!-- En-tête -->
    <tr>
      <td style="padding: 32px 32px 24px; background-color: #ffffff; border-bottom: 2px solid #f1f5f9;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td>
              <div style="font-size: 24px; font-weight: 900; letter-spacing: -0.5px; color: #0f172a;">
                Market<span style="color: #f97316;">Net</span>
              </div>
              <div style="font-size: 12px; color: #64748b; margin-top: 2px;">
                La plateforme e-commerce des commerçants de RDC
              </div>
            </td>
            <td align="right">
              <span style="display: inline-block; padding: 6px 12px; background-color: #eff6ff; color: #1d4ed8; font-size: 12px; font-weight: 700; border-radius: 9999px; border: 1px solid #bfdbfe;">
                ✦ ATTRIBUTION OFFICIELLE
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Message principal -->
    <tr>
      <td style="padding: 28px 32px 16px;">
        <h2 style="font-size: 19px; font-weight: 700; margin: 0 0 10px; color: #0f172a;">
          Votre abonnement ${data.planName} a été activé !
        </h2>
        <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0;">
          Bonjour <strong>${data.merchantName}</strong>, nous avons le plaisir de vous informer que l'équipe MarketNet a attribué et activé un abonnement <strong>${data.planName}</strong> pour votre boutique <strong>${data.shopName}</strong>. Toutes les fonctionnalités de votre formule sont désormais disponibles.
        </p>
      </td>
    </tr>

    <!-- Bloc récapitulatif -->
    <tr>
      <td style="padding: 0 32px;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; margin: 12px 0 24px;">
          <tr>
            <td style="padding: 16px; border-bottom: 1px solid #e2e8f0;">
              <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; display: block; margin-bottom: 2px;">N° de Référence</span>
              <strong style="font-size: 14px; color: #0f172a; font-family: monospace;">${data.letterNumber}</strong>
            </td>
            <td style="padding: 16px; border-bottom: 1px solid #e2e8f0;">
              <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; display: block; margin-bottom: 2px;">Date d'attribution</span>
              <span style="font-size: 13px; color: #0f172a;">${data.assignmentDate}</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 16px;">
              <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; display: block; margin-bottom: 2px;">Formule attribuée</span>
              <span style="font-size: 14px; font-weight: 700; color: #1d4ed8;">${data.planName}</span>
              <span style="font-size: 12px; color: #64748b; margin-left: 6px;">(${data.period})</span>
            </td>
            <td style="padding: 16px;">
              <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; display: block; margin-bottom: 2px;">Valide jusqu'au</span>
              <span style="font-size: 13px; color: #059669; font-weight: 600;">${data.validUntil}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Tableau prestation -->
    <tr>
      <td style="padding: 0 32px;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 2px solid #e2e8f0;">
              <th align="left" style="padding: 10px 0; font-size: 12px; text-transform: uppercase; color: #64748b;">Prestation</th>
              <th align="center" style="padding: 10px 0; font-size: 12px; text-transform: uppercase; color: #64748b;">Boutique</th>
              <th align="right" style="padding: 10px 0; font-size: 12px; text-transform: uppercase; color: #64748b;">Durée</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 14px 0; font-size: 14px; font-weight: 600; color: #0f172a;">
                Abonnement ${data.planName}
                <div style="font-size: 12px; font-weight: normal; color: #64748b; margin-top: 3px;">Attribution administrative — sans frais</div>
              </td>
              <td align="center" style="padding: 14px 0; font-size: 13px; color: #475569;">${data.shopName}</td>
              <td align="right" style="padding: 14px 0; font-size: 13px; color: #475569;">${data.period}</td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>

    <!-- Note de l'administrateur -->
    ${data.adminNote ? `
    <tr>
      <td style="padding: 20px 32px 0;">
        <div style="background-color: #fffbeb; border: 1px solid #fcd34d; border-radius: 10px; padding: 14px 16px;">
          <p style="margin: 0 0 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #92400e;">Message de l'équipe MarketNet</p>
          <p style="margin: 0; font-size: 13px; color: #78350f; line-height: 1.5;">${data.adminNote}</p>
        </div>
      </td>
    </tr>` : ""}

    <!-- Bouton d'action -->
    <tr>
      <td align="center" style="padding: 28px 32px 32px;">
        <a href="${data.dashboardUrl}" style="display: inline-block; padding: 12px 28px; background-color: #1d4ed8; color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 13px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          Accéder à mon espace MarketNet →
        </a>
      </td>
    </tr>

    <!-- Pied de page -->
    <tr>
      <td style="padding: 20px 32px; background-color: #f1f5f9; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; text-align: center; line-height: 1.5;">
        <p style="margin: 0 0 4px;">
          Réf. attribution : <span style="font-family: monospace;">${data.letterNumber}</span> · Émise par l'administrateur MarketNet
        </p>
        <p style="margin: 0;">
          Une question ? Contactez-nous à tout moment. Ce document vaut lettre officielle d'activation.
        </p>
      </td>
    </tr>

  </table>
</body>
</html>`;
}

/**
 * Génère le PDF de la lettre d'attribution de plan
 */
export async function generateAssignmentLetterPdf(data: AssignmentLetterData): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const darkNavy = rgb(0.06, 0.09, 0.16);
  const orange = rgb(0.97, 0.45, 0.09);
  const slate = rgb(0.39, 0.45, 0.55);
  const lightBg = rgb(0.97, 0.98, 0.99);
  const borderCol = rgb(0.89, 0.91, 0.94);
  const blue = rgb(0.11, 0.31, 0.87);
  const blueBg = rgb(0.94, 0.96, 1.0);
  const emerald = rgb(0.02, 0.59, 0.41);
  const white = rgb(1, 1, 1);

  // Bandeau supérieur
  page.drawRectangle({ x: 45, y: 735, width: 505.28, height: 65, color: lightBg, borderColor: borderCol, borderWidth: 1 });
  page.drawText("Market", { x: 60, y: 765, size: 24, font: fontBold, color: darkNavy });
  page.drawText("Net", { x: 142, y: 765, size: 24, font: fontBold, color: orange });
  page.drawText(cleanPdfText("Plateforme e-commerce pour commercants de RDC"), { x: 60, y: 748, size: 9, font: fontRegular, color: slate });

  // Badge ATTRIBUTION
  page.drawRectangle({ x: 390, y: 752, width: 150, height: 26, color: blueBg, borderColor: blue, borderWidth: 1 });
  page.drawText(cleanPdfText("ATTRIBUTION OFFICIELLE"), { x: 398, y: 760, size: 9, font: fontBold, color: blue });

  // Titre
  page.drawText(cleanPdfText("LETTRE D'ATTRIBUTION DE PLAN"), { x: 45, y: 700, size: 16, font: fontBold, color: darkNavy });
  page.drawText(cleanPdfText(`Attribution officielle pour la boutique ${data.shopName}`), { x: 45, y: 684, size: 10, font: fontRegular, color: slate });

  // Bloc client
  page.drawRectangle({ x: 45, y: 575, width: 245, height: 95, color: white, borderColor: borderCol, borderWidth: 1 });
  page.drawText("BENEFICIAIRE", { x: 55, y: 655, size: 8, font: fontBold, color: slate });
  page.drawText(cleanPdfText(data.shopName), { x: 55, y: 638, size: 12, font: fontBold, color: darkNavy });
  page.drawText(cleanPdfText(`Responsable : ${data.merchantName}`), { x: 55, y: 622, size: 9, font: fontRegular, color: slate });
  page.drawText(cleanPdfText(`Email : ${data.merchantEmail}`), { x: 55, y: 607, size: 9, font: fontRegular, color: slate });

  // Bloc attribution
  page.drawRectangle({ x: 305, y: 575, width: 245, height: 95, color: white, borderColor: borderCol, borderWidth: 1 });
  page.drawText("DETAILS ATTRIBUTION", { x: 315, y: 655, size: 8, font: fontBold, color: slate });
  page.drawText(cleanPdfText(`Ref : ${data.letterNumber}`), { x: 315, y: 638, size: 10, font: fontBold, color: darkNavy });
  page.drawText(cleanPdfText(`Date : ${data.assignmentDate}`), { x: 315, y: 622, size: 9, font: fontRegular, color: slate });
  page.drawText(cleanPdfText(`Formule : ${data.planName} (${data.period})`), { x: 315, y: 607, size: 9, font: fontRegular, color: blue });
  page.drawText(cleanPdfText(`Valide jusqu'au : ${data.validUntil}`), { x: 315, y: 592, size: 9, font: fontRegular, color: emerald });

  // Tableau
  page.drawRectangle({ x: 45, y: 525, width: 505.28, height: 28, color: lightBg, borderColor: borderCol, borderWidth: 1 });
  page.drawText("PRESTATION", { x: 55, y: 535, size: 9, font: fontBold, color: slate });
  page.drawText("BOUTIQUE", { x: 260, y: 535, size: 9, font: fontBold, color: slate });
  page.drawText("DUREE", { x: 380, y: 535, size: 9, font: fontBold, color: slate });
  page.drawText("STATUT", { x: 470, y: 535, size: 9, font: fontBold, color: slate });

  page.drawRectangle({ x: 45, y: 470, width: 505.28, height: 55, color: white, borderColor: borderCol, borderWidth: 1 });
  page.drawText(cleanPdfText(`Abonnement ${data.planName}`), { x: 55, y: 505, size: 11, font: fontBold, color: darkNavy });
  page.drawText(cleanPdfText("Attribution administrative - sans frais"), { x: 55, y: 488, size: 8, font: fontRegular, color: slate });
  page.drawText(cleanPdfText(data.shopName), { x: 260, y: 498, size: 9, font: fontRegular, color: darkNavy });
  page.drawText(cleanPdfText(data.period), { x: 380, y: 498, size: 9, font: fontRegular, color: darkNavy });
  page.drawText("ACTIF", { x: 470, y: 498, size: 9, font: fontBold, color: emerald });

  // Encadré activation
  page.drawRectangle({ x: 45, y: 380, width: 505.28, height: 65, color: blueBg, borderColor: blue, borderWidth: 1 });
  page.drawText(cleanPdfText("ABONNEMENT ACTIVE PAR L'EQUIPE MARKETNET"), { x: 55, y: 428, size: 9, font: fontBold, color: blue });
  page.drawText(cleanPdfText("Votre plan a ete configure et active sur votre compte MarketNet."), { x: 55, y: 412, size: 8, font: fontRegular, color: darkNavy });
  page.drawText(cleanPdfText("Toutes les fonctionnalites de votre formule sont immediatement accessibles depuis"), { x: 55, y: 399, size: 8, font: fontRegular, color: slate });
  page.drawText(cleanPdfText("votre tableau de bord marchant."), { x: 55, y: 386, size: 8, font: fontRegular, color: slate });

  // Note admin si présente
  if (data.adminNote) {
    page.drawRectangle({ x: 45, y: 300, width: 505.28, height: 60, color: rgb(1, 0.99, 0.93), borderColor: rgb(0.99, 0.83, 0.21), borderWidth: 1 });
    page.drawText("MESSAGE DE L'EQUIPE MARKETNET :", { x: 55, y: 345, size: 8, font: fontBold, color: rgb(0.57, 0.25, 0.06) });
    const noteLines = cleanPdfText(data.adminNote).match(/.{1,90}/g) || [];
    noteLines.slice(0, 3).forEach((line, i) => {
      page.drawText(line, { x: 55, y: 328 - i * 13, size: 8, font: fontRegular, color: rgb(0.47, 0.21, 0.04) });
    });
  }

  // Footer
  page.drawLine({ start: { x: 45, y: 120 }, end: { x: 550.28, y: 120 }, thickness: 1, color: borderCol });
  page.drawText(cleanPdfText("MarketNet RDC -- Plateforme officielle de commerce electronique"), { x: 45, y: 105, size: 8, font: fontBold, color: slate });
  page.drawText(cleanPdfText("Ce document est une lettre officielle d'attribution emise par l'administration MarketNet."), { x: 45, y: 92, size: 8, font: fontRegular, color: slate });
  page.drawText(cleanPdfText(`Ref systeme : ${data.letterNumber} -- Emis par : ${data.adminEmail}`), { x: 45, y: 79, size: 7, font: fontRegular, color: slate });

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}

/**
 * Envoie la lettre d'attribution par email avec le PDF en pièce jointe
 */
export async function sendAssignmentLetterEmail(params: {
  shopId: string;
  shopName: string;
  merchantEmail: string;
  merchantName: string;
  planId: string;
  period: string;
  validUntil: string;
  note: string;
  adminEmail: string;
  paymentRef: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const transporter = createSmtpTransporter();
    if (!transporter) {
      return { success: false, error: "Transporteur SMTP non disponible" };
    }

    if (!params.merchantEmail || !params.merchantEmail.includes("@")) {
      return { success: false, error: "Adresse email du commerçant invalide" };
    }

    const siteUrl = process.env.MARKETNET_SITE_URL || "https://marketnet-chi.vercel.app";
    const letterNumber = `ATT-${params.paymentRef.slice(-8).toUpperCase()}`;

    const assignmentDate = new Date().toLocaleString("fr-FR", {
      day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
    });

    const planName = `Plan ${params.planId.toUpperCase()}`;
    const period = params.period === "annuel" ? "Annuel (1 an)" : "Mensuel (30 jours)";

    const validUntilFormatted = params.validUntil
      ? new Date(params.validUntil).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
      : "30 jours après activation";

    const letterData: AssignmentLetterData = {
      letterNumber,
      assignmentDate,
      shopName: params.shopName,
      merchantEmail: params.merchantEmail,
      merchantName: params.merchantName,
      planName,
      period,
      validUntil: validUntilFormatted,
      adminNote: params.note,
      adminEmail: params.adminEmail,
      dashboardUrl: `${siteUrl}/dashboard/abonnement`,
    };

    let pdfBuffer: Buffer | null = null;
    try {
      pdfBuffer = await generateAssignmentLetterPdf(letterData);
    } catch (pdfErr) {
      console.warn("[AssignLetter] Avertissement : échec génération PDF, email envoyé sans PJ:", pdfErr);
    }

    const fromName = process.env.SMTP_FROM_NAME || "MarketNet";
    const fromEmail = process.env.SMTP_USER?.trim() || "contact@marketnet.cd";

    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: params.merchantEmail,
      subject: `[MarketNet] Votre abonnement ${planName} a été activé — ${params.shopName}`,
      html: buildAssignmentLetterHtml(letterData),
      attachments: pdfBuffer
        ? [{ filename: `attribution-${letterNumber}.pdf`, content: pdfBuffer, contentType: "application/pdf" }]
        : [],
    });

    console.log(`[AssignLetter] Lettre d'attribution envoyée à ${params.merchantEmail} (id=${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erreur envoi lettre d'attribution";
    console.error("[AssignLetter] Échec envoi:", error);
    return { success: false, error: msg };
  }
}
/**
 * Envoie la facture par email au commerçant avec le fichier PDF en pièce jointe
 */
export async function sendSubscriptionInvoiceEmail(params: {
  paymentId: string;
  customRecipientEmail?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const inv = await getInvoiceData(params.paymentId);
    if (!inv) {
      return { success: false, error: "Facture introuvable" };
    }

    const transporter = createSmtpTransporter();
    if (!transporter) {
      return { success: false, error: "Transporteur SMTP non disponible" };
    }

    const recipient = params.customRecipientEmail || inv.merchantEmail;
    if (!recipient || !recipient.includes("@")) {
      return { success: false, error: "Adresse email du commerçant invalide" };
    }

    const fromName = process.env.SMTP_FROM_NAME || "MarketNet";
    const fromEmail = process.env.SMTP_USER?.trim() || "contact@marketnet.cd";

    // Génération du PDF de facture en pièce jointe
    let pdfBuffer: Buffer | null = null;
    try {
      pdfBuffer = await generateInvoicePdf(inv);
    } catch (pdfErr) {
      console.warn("[Invoices] Avertissement : échec génération PDF, email envoyé sans PJ:", pdfErr);
    }

    const mailOptions: Parameters<typeof transporter.sendMail>[0] = {
      from: `"${fromName}" <${fromEmail}>`,
      to: recipient,
      subject: `[MarketNet] Votre facture de paiement — ${inv.planName} (${formatUSD(inv.amountUSD)})`,
      html: buildInvoiceHtml(inv),
      attachments: pdfBuffer
        ? [
            {
              filename: `facture-${inv.invoiceNumber}.pdf`,
              content: pdfBuffer,
              contentType: "application/pdf",
            },
          ]
        : [],
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[Invoices] Email avec facture PDF envoyé avec succès à ${recipient} (id=${info.messageId})`);

    return { success: true, messageId: info.messageId };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Erreur envoi email";
    console.error("[Invoices] Échec lors de l'envoi de la facture par email:", error);
    return { success: false, error: errorMsg };
  }
}

/**
 * Modèle HTML responsive et soigné pour la confirmation de suppression d'un compte
 */
export function buildDeletionEmailHtml(params: {
  fullName: string;
  email: string;
  shopName?: string;
  deletedAt: string;
  supportEmail: string;
  siteUrl: string;
  isSelfDeleted?: boolean;
}): string {
  const { fullName, deletedAt, supportEmail, siteUrl, shopName, isSelfDeleted } = params;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Confirmation de clôture de votre compte — MarketNet</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155;">
  <div style="width: 100%; background-color: #f8fafc; padding: 36px 16px;">
    <div style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
      
      <!-- En-tête dégradé orange -->
      <div style="background: linear-gradient(135deg, #ea580c 0%, #c2410c 100%); padding: 32px 28px; text-align: center;">
        <h1 style="color: #ffffff; font-size: 26px; font-weight: 900; letter-spacing: -0.5px; margin: 0;">Market<span style="color: #fed7aa;">Net</span></h1>
        <div style="color: rgba(255, 255, 255, 0.95); font-size: 13px; margin-top: 6px; font-weight: 500;">Notification officielle de clôture de compte</div>
      </div>

      <!-- Contenu principal -->
      <div style="padding: 32px 28px;">
        <p style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 12px;">Bonjour ${fullName},</p>
        
        <p style="font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 20px;">
          ${isSelfDeleted
            ? "Nous vous confirmons par cet e-mail que votre compte commerçant MarketNet ainsi que l'ensemble de vos données associées ont été <strong>définitivement supprimés</strong> conformément à votre demande."
            : "Votre compte commerçant MarketNet a été clôturé et supprimé de notre plateforme."}
        </p>

        <!-- Badge date et heure -->
        <div style="background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 12px; padding: 14px 18px; margin: 20px 0; text-align: center;">
          <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; color: #e11d48; margin-bottom: 3px;">Date effective de suppression</div>
          <div style="font-size: 15px; font-weight: 800; color: #9f1239;">${deletedAt}</div>
          ${shopName ? `<div style="font-size: 12px; color: #64748b; margin-top: 4px;">Boutique concernée : <strong>${shopName}</strong></div>` : ""}
        </div>

        <!-- Liste des éléments effacés -->
        <div style="font-size: 13px; font-weight: 700; color: #334155; margin-bottom: 8px;">Données effacées définitivement de nos serveurs :</div>
        <ul style="background-color: #f8fafc; border-radius: 12px; padding: 14px 18px 14px 34px; margin: 0 0 20px; font-size: 13px; color: #475569; line-height: 1.6;">
          <li style="margin-bottom: 6px;">Votre boutique en ligne, vitrine et lien public</li>
          <li style="margin-bottom: 6px;">L'ensemble de vos produits, images et tarifs</li>
          <li style="margin-bottom: 6px;">L'historique de vos commandes et clients</li>
          <li style="margin-bottom: 6px;">Vos synchronisations Meta (Facebook Catalog & Instagram)</li>
          <li style="margin-bottom: 6px;">Vos campagnes promotionnelles et remises</li>
          <li>Vos accès commerçant et données de profil</li>
        </ul>

        <!-- Bloc opportunité future -->
        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 14px 18px; margin-bottom: 20px;">
          <p style="margin: 0; font-size: 13px; color: #166534; line-height: 1.5;">
            <strong>Besoin de relancer une boutique ?</strong><br/>
            Si vous souhaitez reprendre une activité commerciale dans le futur, la porte reste ouverte. Vous pourrez créer un nouveau compte gratuitement sur <a href="${siteUrl}" style="color: #166534; font-weight: 700; text-decoration: underline;">MarketNet</a>.
          </p>
        </div>

        <p style="font-size: 12px; line-height: 1.6; color: #64748b; margin-top: 20px; border-top: 1px dashed #e2e8f0; padding-top: 14px;">
          ⚠️ <strong>Vous n'êtes pas à l'origine de cette suppression ?</strong><br/>
          Si vous n'avez pas sollicité cette action, veuillez contacter d'urgence notre assistance à <a href="mailto:${supportEmail}" style="color: #ea580c; text-decoration: none; font-weight: 600;">${supportEmail}</a>.
        </p>
      </div>

      <!-- Footer -->
      <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 28px; text-align: center;">
        <p style="margin: 2px 0; font-size: 11px; color: #94a3b8;">© ${new Date().getFullYear()} MarketNet Africa — La plateforme e-commerce tout-en-un.</p>
        <p style="margin: 2px 0; font-size: 11px; color: #94a3b8;">Ceci est une notification automatique de confirmation de clôture.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Envoie un email officiel de confirmation lors de la suppression d'un compte commerçant
 */
export async function sendDeletionConfirmationEmail(params: {
  email: string;
  fullName: string;
  shopName?: string;
  isSelfDeleted?: boolean;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const transporter = createSmtpTransporter();
    if (!transporter) {
      console.warn("[DeletionEmail] Transporteur SMTP non configuré dans l'environnement.");
      return { success: false, error: "SMTP non configuré" };
    }

    if (!params.email || !params.email.includes("@")) {
      return { success: false, error: "Adresse email invalide" };
    }

    const fromName = process.env.SMTP_FROM_NAME || "MarketNet";
    const fromEmail = process.env.SMTP_USER?.trim() || "contact@marketnet.cd";
    const supportEmail = process.env.MARKETNET_ADMIN_EMAIL || fromEmail;
    const siteUrl = process.env.MARKETNET_SITE_URL || "https://marketnet.cd";

    const deletedAt = new Date().toLocaleString("fr-FR", {
      timeZone: "Africa/Kinshasa",
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const html = buildDeletionEmailHtml({
      fullName: params.fullName || "Cher commerçant",
      email: params.email,
      shopName: params.shopName,
      deletedAt,
      supportEmail,
      siteUrl,
      isSelfDeleted: params.isSelfDeleted ?? true,
    });

    // 1. Envoyer la confirmation au commerçant
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: params.email,
      subject: `[MarketNet] Confirmation de suppression définitive de votre compte`,
      html,
    });

    console.log(`[DeletionEmail] Email de confirmation de suppression envoyé à ${params.email} (id=${info.messageId})`);

    // 2. Envoyer une copie d'alerte à l'administrateur
    try {
      if (supportEmail && supportEmail !== params.email) {
        await transporter.sendMail({
          from: `"${fromName}" <${fromEmail}>`,
          to: supportEmail,
          subject: `[Alerte Admin] Clôture de compte commerçant : ${params.email} (${params.shopName || "Sans boutique"})`,
          html: `
            <div style="font-family: sans-serif; padding: 20px; color: #334155;">
              <h2 style="color: #e11d48; margin-top: 0;">Alerte : Suppression de compte commerçant</h2>
              <p>Un compte commerçant vient d'être supprimé sur la plateforme MarketNet.</p>
              <table style="width: 100%; max-width: 450px; border-collapse: collapse; margin-top: 12px;">
                <tr><td style="padding: 6px 0; color: #64748b;">Commerçant :</td><td style="font-weight: bold;">${params.fullName}</td></tr>
                <tr><td style="padding: 6px 0; color: #64748b;">Email :</td><td style="font-weight: bold;">${params.email}</td></tr>
                <tr><td style="padding: 6px 0; color: #64748b;">Boutique :</td><td style="font-weight: bold;">${params.shopName || "Aucune boutique"}</td></tr>
                <tr><td style="padding: 6px 0; color: #64748b;">Date et heure :</td><td>${deletedAt}</td></tr>
                <tr><td style="padding: 6px 0; color: #64748b;">Initiateur :</td><td>${params.isSelfDeleted ? "Le commerçant lui-même (Dashboard Réglages)" : "L'administrateur (Admin Commerçants)"}</td></tr>
              </table>
            </div>
          `,
        });
      }
    } catch (adminAlertErr) {
      console.warn("[DeletionEmail] Avertissement alerte admin non bloquante:", adminAlertErr);
    }

    return { success: true, messageId: info.messageId };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Erreur envoi email suppression";
    console.error("[DeletionEmail] Échec lors de l'envoi de l'email de suppression:", error);
    return { success: false, error: errorMsg };
  }
}

/* ==========================================================================
   NOTIFICATION NOUVEL UTILISATEUR INSCRIT (POUR L'ADMIN)
   ========================================================================== */

export interface NewUserRegistrationParams {
  email: string;
  fullName?: string;
}

export function buildNewUserAdminAlertHtml(params: {
  email: string;
  fullName: string;
  registeredAt: string;
  adminUrl: string;
}): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nouvelle inscription MarketNet</title>
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
              <div style="font-size: 12px; color: #64748b; margin-top: 2px;">
                Plateforme d'Administration
              </div>
            </td>
            <td align="right">
              <span style="display: inline-block; padding: 6px 12px; background-color: #eff6ff; color: #2563eb; font-size: 12px; font-weight: 700; border-radius: 9999px; border: 1px solid #bfdbfe;">
                NOUVEAU MEMBRE
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Corps de l'email -->
    <tr>
      <td style="padding: 28px 32px 20px;">
        <h2 style="font-size: 20px; font-weight: 800; margin: 0 0 10px; color: #0f172a;">
          👤 Un nouvel utilisateur vient de s'inscrire !
        </h2>
        <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 20px;">
          Un nouveau compte utilisateur vient d'être créé sur la plateforme MarketNet. Voici le récapitulatif des détails fournis lors de l'inscription :
        </p>

        <!-- Tableau récapitulatif -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 24px;">
          <tr>
            <td style="padding: 14px 18px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #64748b; width: 140px; font-weight: 600;">Nom complet</td>
            <td style="padding: 14px 18px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #0f172a; font-weight: 700;">${params.fullName}</td>
          </tr>
          <tr>
            <td style="padding: 14px 18px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #64748b; font-weight: 600;">Adresse Email</td>
            <td style="padding: 14px 18px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #2563eb; font-weight: 600;">${params.email}</td>
          </tr>
          <tr>
            <td style="padding: 14px 18px; font-size: 13px; color: #64748b; font-weight: 600;">Date & Heure</td>
            <td style="padding: 14px 18px; font-size: 13px; color: #0f172a;">${params.registeredAt}</td>
          </tr>
        </table>

        <!-- Bouton CTA vers l'admin -->
        <div style="text-align: center; margin: 24px 0 12px;">
          <a href="${params.adminUrl}" style="display: inline-block; background-color: #f97316; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 28px; border-radius: 10px; box-shadow: 0 4px 12px rgba(249, 115, 22, 0.25);">
            Accéder à l'espace Commerçants →
          </a>
        </div>
      </td>
    </tr>

    <!-- Pied de page -->
    <tr>
      <td style="padding: 20px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8;">
        Notification automatique générée par MarketNet • Système d'alerte administrateur
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendNewUserAdminNotification(params: NewUserRegistrationParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const transporter = createSmtpTransporter();
    if (!transporter) {
      console.warn("[NewUserEmail] SMTP non configuré. Notification non envoyée.");
      return { success: false, error: "SMTP non configuré" };
    }

    const fromName = process.env.SMTP_FROM_NAME || "MarketNet";
    const fromEmail = process.env.SMTP_USER?.trim() || "contact@marketnet.cd";
    const adminEmail = process.env.MARKETNET_ADMIN_EMAIL || fromEmail;
    const siteUrl = process.env.MARKETNET_SITE_URL || "https://marketnet-chi.vercel.app";

    const registeredAt = new Date().toLocaleString("fr-FR", {
      timeZone: "Africa/Kinshasa",
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const fullName = params.fullName?.trim() || "Utilisateur sans nom";
    const html = buildNewUserAdminAlertHtml({
      email: params.email,
      fullName,
      registeredAt,
      adminUrl: `${siteUrl}/admin/commercants`,
    });

    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: adminEmail,
      subject: `[MarketNet Admin] Nouvel utilisateur inscrit : ${fullName} (${params.email})`,
      html,
    });

    console.log(`[NewUserEmail] Notification admin envoyée pour ${params.email} (id=${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Erreur envoi email nouvelle inscription";
    console.error("[NewUserEmail] Échec lors de l'envoi de l'email d'inscription:", error);
    return { success: false, error: errorMsg };
  }
}

/* ==========================================================================
   MESSAGE DE BIENVENUE AU COMMERÇANT (CRÉATION DE COMPTE / BOUTIQUE)
   ========================================================================== */

export interface MerchantWelcomeParams {
  merchantEmail: string;
  merchantName: string;
  shopName: string;
  shopSlug: string;
  whatsapp?: string;
  planName?: string;
}

export function buildMerchantWelcomeHtml(params: {
  merchantName: string;
  shopName: string;
  shopSlug: string;
  whatsapp?: string;
  planName: string;
  shopUrl: string;
  dashboardUrl: string;
  supportEmail: string;
}): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bienvenue sur MarketNet !</title>
</head>
<body style="margin: 0; padding: 24px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    
    <!-- En-tête avec Bannière dégradée -->
    <tr>
      <td style="padding: 36px 32px 28px; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); text-align: center;">
        <div style="font-size: 28px; font-weight: 900; letter-spacing: -0.5px; color: #ffffff;">
          Market<span style="color: #f97316;">Net</span>
        </div>
        <p style="font-size: 13px; color: #94a3b8; margin: 6px 0 0;">
          La plateforme e-commerce tout-en-un pour les commerçants de RDC
        </p>
      </td>
    </tr>

    <!-- Corps principal -->
    <tr>
      <td style="padding: 32px 32px 24px;">
        <div style="display: inline-block; padding: 6px 14px; background-color: #fff7ed; color: #ea580c; font-size: 12px; font-weight: 800; border-radius: 9999px; border: 1px solid #ffedd5; margin-bottom: 12px;">
          🎉 FÉLICITATIONS
        </div>
        <h1 style="font-size: 22px; font-weight: 900; color: #0f172a; margin: 0 0 12px; line-height: 1.3;">
          Bienvenue dans la communauté, ${params.merchantName} !
        </h1>
        <p style="font-size: 15px; line-height: 1.6; color: #475569; margin: 0 0 24px;">
          Votre boutique en ligne <strong style="color: #0f172a;">${params.shopName}</strong> est officiellement créée et active sur MarketNet. Vous avez franchi la première étape essentielle pour digitaliser votre commerce et multiplier vos ventes !
        </p>

        <!-- Carte récapitulative de la boutique -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border-radius: 14px; border: 1px solid #e2e8f0; margin-bottom: 28px;">
          <tr>
            <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0;">
              <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; display: block; margin-bottom: 4px;">Nom de votre boutique</span>
              <strong style="font-size: 16px; color: #0f172a;">${params.shopName}</strong>
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0;">
              <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; display: block; margin-bottom: 4px;">Lien public pour vos clients</span>
              <a href="${params.shopUrl}" style="font-size: 14px; color: #f97316; font-weight: 700; text-decoration: none; word-break: break-all;">
                ${params.shopUrl} ↗
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 20px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  ${params.whatsapp ? `
                  <td style="width: 50%;">
                    <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; display: block; margin-bottom: 2px;">WhatsApp de vente</span>
                    <span style="font-size: 13px; color: #0f172a; font-weight: 600;">${params.whatsapp}</span>
                  </td>` : ""}
                  <td>
                    <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; display: block; margin-bottom: 2px;">Formule active</span>
                    <span style="display: inline-block; padding: 2px 8px; background-color: #ecfdf5; color: #059669; font-size: 11px; font-weight: 700; border-radius: 6px;">${params.planName}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Guide de démarrage rapide en 4 étapes -->
        <h3 style="font-size: 15px; font-weight: 800; color: #0f172a; margin: 0 0 14px; text-transform: uppercase; letter-spacing: 0.5px;">
          🚀 Vos 4 prochaines étapes pour réussir :
        </h3>
        
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 28px;">
          <tr>
            <td style="padding: 10px 0; vertical-align: top; width: 32px;">
              <div style="height: 24px; width: 24px; border-radius: 50%; background-color: #f97316; color: #ffffff; font-size: 12px; font-weight: 800; text-align: center; line-height: 24px;">1</div>
            </td>
            <td style="padding: 10px 0 10px 8px; vertical-align: top;">
              <strong style="font-size: 14px; color: #0f172a; display: block;">Ajoutez vos premiers produits</strong>
              <span style="font-size: 13px; color: #64748b; line-height: 1.4;">Téléchargez de belles photos, indiquez vos prix en USD ou Franc Congolais et rédigez une description claire.</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 0; vertical-align: top; width: 32px;">
              <div style="height: 24px; width: 24px; border-radius: 50%; background-color: #f97316; color: #ffffff; font-size: 12px; font-weight: 800; text-align: center; line-height: 24px;">2</div>
            </td>
            <td style="padding: 10px 0 10px 8px; vertical-align: top;">
              <strong style="font-size: 14px; color: #0f172a; display: block;">Personnalisez votre vitrine</strong>
              <span style="font-size: 13px; color: #64748b; line-height: 1.4;">Ajoutez votre logo, choisissez vos couleurs préférées et insérez une bannière engageante.</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 0; vertical-align: top; width: 32px;">
              <div style="height: 24px; width: 24px; border-radius: 50%; background-color: #f97316; color: #ffffff; font-size: 12px; font-weight: 800; text-align: center; line-height: 24px;">3</div>
            </td>
            <td style="padding: 10px 0 10px 8px; vertical-align: top;">
              <strong style="font-size: 14px; color: #0f172a; display: block;">Partagez votre lien boutique</strong>
              <span style="font-size: 13px; color: #64748b; line-height: 1.4;">Mettez votre lien dans votre statut WhatsApp, bio Instagram, page Facebook et vidéos TikTok.</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 0; vertical-align: top; width: 32px;">
              <div style="height: 24px; width: 24px; border-radius: 50%; background-color: #f97316; color: #ffffff; font-size: 12px; font-weight: 800; text-align: center; line-height: 24px;">4</div>
            </td>
            <td style="padding: 10px 0 10px 8px; vertical-align: top;">
              <strong style="font-size: 14px; color: #0f172a; display: block;">Gérez vos commandes sans commission</strong>
              <span style="font-size: 13px; color: #64748b; line-height: 1.4;">Recevez directement les alertes commandes de vos clients avec paiement direct par Mobile Money ou cash.</span>
            </td>
          </tr>
        </table>

        <!-- Boutons d'action -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 10px 0 20px;">
          <tr>
            <td align="center">
              <a href="${params.dashboardUrl}" style="display: inline-block; background-color: #f97316; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 800; padding: 14px 32px; border-radius: 12px; box-shadow: 0 4px 14px rgba(249, 115, 22, 0.35);">
                Accéder à mon tableau de bord →
              </a>
              <div style="margin-top: 12px;">
                <a href="${params.shopUrl}" style="font-size: 13px; color: #64748b; text-decoration: underline;">
                  Aperçu de ma boutique en ligne
                </a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Assistance et contact -->
    <tr>
      <td style="padding: 20px 32px; background-color: #f1f5f9; border-top: 1px solid #e2e8f0;">
        <p style="font-size: 13px; color: #475569; margin: 0; line-height: 1.5; text-align: center;">
          Une question ou besoin d'aide pour lancer vos ventes ? Notre équipe se tient à votre entière disposition à l'adresse <a href="mailto:${params.supportEmail}" style="color: #f97316; font-weight: 700; text-decoration: none;">${params.supportEmail}</a>.
        </p>
      </td>
    </tr>

    <!-- Pied de page -->
    <tr>
      <td style="padding: 20px 32px; background-color: #ffffff; text-align: center; font-size: 12px; color: #94a3b8;">
        © ${new Date().getFullYear()} MarketNet Inc. RDC • Conçu avec passion pour propulser l'e-commerce africain.
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendMerchantWelcomeEmail(params: MerchantWelcomeParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const transporter = createSmtpTransporter();
    if (!transporter) {
      console.warn("[WelcomeEmail] SMTP non configuré. Email de bienvenue ignoré.");
      return { success: false, error: "SMTP non configuré" };
    }

    const fromName = process.env.SMTP_FROM_NAME || "MarketNet";
    const fromEmail = process.env.SMTP_USER?.trim() || "contact@marketnet.cd";
    const supportEmail = process.env.MARKETNET_ADMIN_EMAIL || fromEmail;
    const siteUrl = process.env.MARKETNET_SITE_URL || "https://marketnet-chi.vercel.app";

    const shopUrl = `${siteUrl}/b/${encodeURIComponent(params.shopSlug)}`;
    const dashboardUrl = `${siteUrl}/dashboard`;
    const planName = params.planName || "Gratuit";

    const html = buildMerchantWelcomeHtml({
      merchantName: params.merchantName || "Cher commerçant",
      shopName: params.shopName,
      shopSlug: params.shopSlug,
      whatsapp: params.whatsapp,
      planName,
      shopUrl,
      dashboardUrl,
      supportEmail,
    });

    // 1. Envoi au commerçant
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: params.merchantEmail,
      subject: `🎉 Bienvenue sur MarketNet ! Votre boutique "${params.shopName}" est prête`,
      html,
    });

    console.log(`[WelcomeEmail] Email de bienvenue envoyé à ${params.merchantEmail} (id=${info.messageId})`);

    // 2. Alerte optionnelle à l'administrateur pour l'informer de la création de la boutique
    try {
      if (supportEmail && supportEmail !== params.merchantEmail) {
        await transporter.sendMail({
          from: `"${fromName}" <${fromEmail}>`,
          to: supportEmail,
          subject: `[MarketNet Admin] Nouvelle boutique créée : "${params.shopName}" par ${params.merchantName}`,
          html: `
            <div style="font-family: sans-serif; padding: 20px; color: #334155;">
              <h2 style="color: #059669; margin-top: 0;">🎉 Nouvelle boutique créée sur MarketNet</h2>
              <table style="width: 100%; max-width: 450px; border-collapse: collapse; margin-top: 12px;">
                <tr><td style="padding: 6px 0; color: #64748b;">Boutique :</td><td style="font-weight: bold; color: #0f172a;">${params.shopName}</td></tr>
                <tr><td style="padding: 6px 0; color: #64748b;">Lien :</td><td><a href="${shopUrl}">${shopUrl}</a></td></tr>
                <tr><td style="padding: 6px 0; color: #64748b;">Commerçant :</td><td style="font-weight: bold;">${params.merchantName}</td></tr>
                <tr><td style="padding: 6px 0; color: #64748b;">Email :</td><td>${params.merchantEmail}</td></tr>
                <tr><td style="padding: 6px 0; color: #64748b;">WhatsApp :</td><td>${params.whatsapp || "Non renseigné"}</td></tr>
                <tr><td style="padding: 6px 0; color: #64748b;">Formule :</td><td>${planName}</td></tr>
              </table>
            </div>
          `,
        });
      }
    } catch (adminErr) {
      console.warn("[WelcomeEmail] Alerte admin création boutique non bloquante:", adminErr);
    }

    return { success: true, messageId: info.messageId };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Erreur envoi email bienvenue";
    console.error("[WelcomeEmail] Échec lors de l'envoi de l'email de bienvenue:", error);
    return { success: false, error: errorMsg };
  }
}



