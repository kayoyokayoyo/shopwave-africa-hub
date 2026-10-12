/**
 * Template HTML premium et responsive pour la confirmation de suppression de compte
 */
export function getDeletionEmailHtml(params: {
  fullName: string;
  email: string;
  deletedAt: string;
  supportEmail: string;
  siteUrl: string;
}): string {
  const {
    fullName,
    deletedAt,
    supportEmail,
    siteUrl,
  } = params;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Confirmation de suppression de votre compte - MarketNet</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #334155;
      -webkit-font-smoothing: antialiased;
    }
    table {
      border-collapse: collapse;
    }
    .wrapper {
      width: 100%;
      background-color: #f8fafc;
      padding: 40px 16px;
    }
    .container {
      max-width: 580px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.03);
      border: 1px solid #e2e8f0;
    }
    .header {
      background: linear-gradient(135deg, #ea580c 0%, #c2410c 100%);
      padding: 36px 32px 30px;
      text-align: center;
    }
    .brand {
      color: #ffffff;
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.5px;
      margin: 0;
    }
    .brand span {
      color: #ffedd5;
    }
    .subtitle {
      color: rgba(255, 255, 255, 0.9);
      font-size: 14px;
      margin-top: 6px;
      font-weight: 500;
    }
    .content {
      padding: 36px 32px;
    }
    .greeting {
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 0;
      margin-bottom: 12px;
    }
    .badge-box {
      background-color: #fff1f2;
      border: 1px solid #fecdd3;
      border-radius: 12px;
      padding: 16px 20px;
      margin: 24px 0;
      text-align: center;
    }
    .badge-title {
      font-size: 12px;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.5px;
      color: #e11d48;
      margin-bottom: 4px;
    }
    .badge-date {
      font-size: 16px;
      font-weight: 700;
      color: #9f1239;
    }
    .list-title {
      font-size: 14px;
      font-weight: 600;
      color: #475569;
      margin-bottom: 10px;
    }
    .data-list {
      background-color: #f8fafc;
      border-radius: 12px;
      padding: 16px 20px;
      margin: 0 0 24px;
      list-style-type: none;
    }
    .data-list li {
      position: relative;
      padding-left: 22px;
      margin-bottom: 8px;
      font-size: 13.5px;
      color: #475569;
      line-height: 1.5;
    }
    .data-list li:last-child {
      margin-bottom: 0;
    }
    .data-list li::before {
      content: "•";
      position: absolute;
      left: 6px;
      top: -1px;
      color: #ea580c;
      font-size: 18px;
      font-weight: bold;
    }
    .info-card {
      background-color: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 12px;
      padding: 16px 20px;
      margin-bottom: 24px;
    }
    .info-card p {
      margin: 0;
      font-size: 13.5px;
      color: #166534;
      line-height: 1.6;
    }
    .footer {
      background-color: #f8fafc;
      border-top: 1px solid #e2e8f0;
      padding: 24px 32px;
      text-align: center;
    }
    .footer p {
      margin: 4px 0;
      font-size: 12px;
      color: #94a3b8;
    }
    .footer a {
      color: #ea580c;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <!-- Header -->
      <div class="header">
        <h1 class="brand">Market<span>Net</span></h1>
        <div class="subtitle">Confirmation officielle de clôture de compte</div>
      </div>

      <!-- Main Content -->
      <div class="content">
        <p class="greeting">Bonjour ${fullName},</p>
        
        <p style="font-size: 14.5px; line-height: 1.6; color: #475569; margin-bottom: 16px;">
          Nous vous confirmons par cet e-mail que votre compte commerçant ainsi que toutes les données associées ont été <strong>définitivement supprimés</strong> de notre plateforme conformément à votre demande.
        </p>

        <!-- Date Badge -->
        <div class="badge-box">
          <div class="badge-title">Date effective de suppression</div>
          <div class="badge-date">${deletedAt}</div>
        </div>

        <!-- Elements deleted -->
        <div class="list-title">Éléments et données effacés définitivement :</div>
        <ul class="data-list">
          <li>Votre boutique en ligne, vitrine et domaine personnalisé</li>
          <li>L'ensemble de votre catalogue de produits et images</li>
          <li>L'historique des commandes et messages clients</li>
          <li>Les synchronisations Facebook Catalog et Instagram Shopping</li>
          <li>Vos campagnes promotionnelles et remises configurées</li>
          <li>Vos identifiants d'accès et données de facturation</li>
        </ul>

        <!-- Reassurance card -->
        <div class="info-card">
          <p>
            <strong>Besoin de relancer une activité ?</strong><br/>
            Si vous souhaitez ouvrir une nouvelle boutique dans le futur, la porte reste toujours grande ouverte. Vous pourrez créer un nouveau compte gratuitement en quelques minutes sur <a href="${siteUrl}" style="color: #166534; font-weight: 700; text-decoration: underline;">MarketNet</a>.
          </p>
        </div>

        <p style="font-size: 12.5px; line-height: 1.6; color: #64748b; margin-top: 24px; border-top: 1px dashed #e2e8f0; padding-top: 16px;">
          ⚠️ <strong>Vous n'êtes pas à l'origine de cette demande ?</strong><br/>
          Si vous n'avez pas sollicité la suppression de votre compte, veuillez contacter immédiatement notre équipe d'assistance à <a href="mailto:${supportEmail}" style="color: #ea580c; text-decoration: none; font-weight: 600;">${supportEmail}</a>.
        </p>
      </div>

      <!-- Footer -->
      <div class="footer">
        <p>© ${new Date().getFullYear()} MarketNet Africa — La plateforme e-commerce WhatsApp.</p>
        <p>Cet e-mail est un message automatique de confirmation de service.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}
