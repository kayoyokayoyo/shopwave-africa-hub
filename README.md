# MarketNet — Plateforme E-Commerce WhatsApp & Multi-Boutiques

**MarketNet** est une plateforme SaaS multi-tenant conçue spécifiquement pour les commerçants de la République Démocratique du Congo (RDC) et d'Afrique francophone. Elle permet à tout vendeur de créer sa boutique en ligne en 5 minutes, de la personnaliser, d'y publier ses produits et ses campagnes promotionnelles, et de recevoir directement ses commandes sur **WhatsApp**.

L'ensemble de l'interface est pensée **mobile-first** pour garantir une fluidité totale même sur connexions mobiles réduites.

---

## 1. Rôles (uniquement deux)

- **Commerçant** : S'inscrit, crée et gère sa boutique (catalogue, promotions, commandes, paiements, réseaux sociaux).
- **Administrateur MarketNet** : Supervise toute la plateforme (commerçants, boutiques, revenus en Franc Congolais, attribution et configuration des plans).
- Les clients finaux **n'ont pas de compte** : ils consultent la boutique et commandent directement via WhatsApp.

---

## 2. Architecture multi-tenant

- Base partagée avec isolation stricte par boutique (`shop_id` + Row Level Security PostgreSQL). Un commerçant ne voit jamais les données d'un autre.
- Chaque boutique a une URL publique dédiée : `marketnet.cd/b/{slug}` (slug unique, modifiable une fois).
- Prévu pour l'extension future vers sous-domaine et domaine personnalisé.

---

## 3. Espace commerçant (Dashboard)

- **Inscription / connexion** : Email + mot de passe, récupération mot de passe oublié.
- **Création de boutique (assistant en étapes)** : Nom, slug, description, catégorie, logo, bannière, ville/adresse, numéro WhatsApp (format international), horaires, liens réseaux sociaux.
- **Personnalisation** :
  - Thèmes prédéfinis (couleurs, typographies modernes, style de cartes produits).
  - Couleur principale, logo, bannière de marque.
  - Aperçu en direct mobile et desktop (`ShopPreview`).
- **Produits** :
  - Nom, description, prix, devise de boutique (USD / CDF), photos multiples (compression automatique WebP et redimensionnement Cloudinary), catégorie, stock optionnel, statut (actif / masqué / rupture).
  - Variantes simples (taille, couleur) optionnelles.
  - Catégories personnalisées, produits mis en avant.
  - Import rapide : ajout de plusieurs produits à la suite.
- **Commandes** :
  - Chaque clic sur « Commander sur WhatsApp » enregistre une commande (statut : nouvelle, confirmée, livrée, annulée).
  - Liste des commandes, détail, changement de statut, notes internes.
  - Statistiques : produits les plus demandés, vues de la boutique, clics WhatsApp, commandes par période.
- **Marketing / Meta** (voir section 6).
- **Abonnement** : Voir plan actif, limites utilisées, passer à un plan supérieur, historique de facturation et téléchargement des reçus PDF.

---

## 4. Boutique publique (Visible par les clients)

- **Page d'accueil boutique** : Bannière, logo, description, produits mis en avant, carrousel promotions, catégories.
- **Recherche & filtres** : Recherche temps réel et filtres par catégorie et prix.
- **Page produit détaillée** : Galerie photos, prix en devise boutique, description, sélecteur de variantes.
- **Panier léger (sans compte requis)** : Le client ajoute plusieurs produits, indique son nom et sa quantité.
- **Bouton « Commander sur WhatsApp »** : Ouvre `https://wa.me/{numero}?text=...` avec un message pré-rempli listant les produits, quantités, total calculé et le nom de la boutique.
- **Boutons de partage** : WhatsApp, Facebook, copier le lien.
- **SEO & Balises Open Graph dynamiques** (voir section 8).
- **Performances** : Images optimisées WebP Cloudinary, lazy-loading, chargement instantané.

---

## 5. Espace administrateur MarketNet

- **Tableau de bord global (`/admin`)** : Nombre de commerçants, boutiques actives, produits en ligne, volume encaissé SasPay réel en Franc Congolais (FC), volume des attributions manuelles et courbe d'évolution des revenus.
- **Gestion des commerçants (`/admin/commercants`)** : Liste complète, recherche, validation, suspension, réinitialisation de mot de passe, suppression sécurisée avec confirmation par mot de passe admin.
- **Gestion des boutiques (`/admin/boutiques`)** : Modération, signalement de contenu, inspection des catalogues.
- **Gestion des plans d'abonnement (`/admin/plans`)** : Création et modification dynamique des tarifs en Franc Congolais (FC) et des limites (nombre de produits, nombre de photos, promotions actives, accès Meta) avec synchronisation en temps réel.
- **Suivi des paiements (`/admin/paiements`)** : Liste détaillée des transactions SasPay réelles vs attributions manuelles, filtrage par statut (`payé`, `en_attente`, `échoué`, `à_vérifier`), réconciliation et attribution de plans.
- **Journal d'activité (Audit log)** : Traçabilité immuable des actions sensibles.
- **Paramètres globaux (`/admin/parametres`)** : Catégories de boutiques, passerelle SasPay en CDF, textes légaux.

---

## 6. Intégration Meta (Facebook & Instagram)

Connexion de la page Facebook / compte Instagram professionnel du commerçant via Meta Login (OAuth) :
- **Phase 1** : Publication d'un produit en un clic sur Facebook et Instagram (image, description, prix, lien direct boutique).
- **Phase 2** : Synchronisation du catalogue produits avec Meta Commerce Manager.
- **Phase 3** : Création de campagnes publicitaires sponsorisées.
- Gestion robuste des tokens de session, expiration automatique et déconnexion propre.

---

## 7. Système d'Abonnements & Paiements SasPay (Strictement en Franc Congolais — FC / CDF)

MarketNet intègre un système d'abonnement multi-formules (Gratuit, Pro, Business) couplé à la passerelle de paiement **SasPay** (Mobile Money RDC : M-Pesa, Orange Money, Airtel Money, et Cartes bancaires).

### 7.1. Devise exclusive de la plateforme
L'ensemble de la tarification des abonnements MarketNet et des flux SasPay fonctionne **exclusivement en Franc Congolais (FC / CDF)** :
- Aucun recours au Dollar ($ USD) dans les calculs de transaction SasPay.
- Les montants sont traités en entiers stricts (ex: `25 000 FC`, `70 000 FC`), éliminant tout écart d'arrondi ou de conversion.
- Fonction utilitaire centrale [`formatCDF(amount)`](file:///l:/PROJET/Marketing/shopwave-africa-hub/src/lib/subscriptions.ts#L273) garantissant un affichage cohérent (espace insécable normalisé + suffixe `FC`).

### 7.2. Données et Tarification en Base de Données
- `plans` : Formules d'abonnement administrables (`id`, `name`, `price_cdf`, `position`, `active`, `max_products`, `max_photos`, `max_active_promotions`, `meta_access`, `advanced_themes`, `advanced_stats`).
- `plan_prices` : Périodes tarifaires synchronisées automatiquement par trigger PostgreSQL (`trg_sync_plan_prices` via fonction `sync_plan_prices_from_plans()`) pour `mensuel` et `annuel` avec `currency = 'CDF'`.
- `subscription_payments` : Historique des transactions (`id`, `merchant_id`, `shop_id`, `plan_id`, `period`, `montant_cdf`, `currency = 'CDF'`, `statut`, `methode`, `saspay_session_id`, `checkout_url`, `saspay_transaction_id`, `montant_debite`, `montant_net`, `frais`, `cree_le`, `paye_le`, `admin_note`).
- `merchant_subscriptions` : Périodes actives des commerçants (`debut`, `fin`, `statut` : `actif`, `grâce`, `expiré`).
- `payment_events` : Journal d'audit immuable des webhooks bruts reçus avec statut de vérification de signature.

### 7.3. Cycle de vie des abonnements
- **Renouvellement anticipé** : Tout renouvellement avant échéance s'ajoute à la date de fin courante (aucun jour perdu).
- **Période de grâce de 7 jours** : À l'échéance, le statut bascule en `grâce` sans coupure de service pendant 7 jours.
- **Alertes progressives** : Bandeaux préventifs discrets dans le dashboard commerçant à J-7, J-3 et en période de grâce.
- **Rétrogradation douce** : À expiration définitive, la boutique bascule sur le plan Gratuit (les produits au-delà de 10 sont temporairement masqués sans être supprimés, les promotions sont mises en pause).

### 7.4. Intégration SasPay & Webhook Sécurisé
- **Variables d'environnement (côté serveur uniquement)** :
  ```dotenv
  SASPAY_ENV=live                                # test ou live
  SASPAY_SECRET_KEY=sk_...                      # Clé d'API SasPay
  SASPAY_WEBHOOK_SECRET=whsec_...               # Secret de signature webhook
  ```
- **Création de Session (`createCheckoutSession`)** :
  - Déduplication : réutilisation automatique d'une session `en_attente` identique de moins d'une heure.
  - Montants extraits impérativement de `plan_prices` côté serveur en `CDF`.
  - Appel API SasPay avec devise stricte `CDF`.
- **Webhook Public (`POST /api/public/webhook-saspay`)** :
  - Lecture de la charge brute via `request.text()`.
  - Tolérance d'horodatage anti-rejeu : rejet HTTP 401 si `X-Webhook-Timestamp` > 300 secondes.
  - Signature HMAC-SHA256 validée en temps constant (`crypto.timingSafeEqual`).
  - Idempotence garantie par déduplication sur `transaction_id` et `type_evenement`.
  - Contrôle de devise : `currency` doit être `CDF` ou `FC`.
  - Contrôle du montant exact reçu comparé à `paymentRecord.montant_cdf` (tolérance de ±100 FC pour absorber les frais réseau).
  - En cas d'incohérence, passage en statut `à_vérifier` avec note explicative sans bloquer silencieusement.
  - Si conforme : statut `payé`, enregistrement des montants débités/nets/frais et activation immédiate de l'abonnement commerçant.

### 7.5. Facturation & Reçus PDF
- Génération côté serveur avec `pdf-lib` de reçus officiels sécurisés :
  - En-tête officiel MarketNet, référence unique (`MN-XXXXXXXX`), informations commerçant et boutique.
  - Tableau de prestation avec colonne explicite `MONTANT (FC)`.
  - Montant acquitté en Franc Congolais, mode de règlement (SasPay Mobile Money / Carte), date de validité.
- Envoi automatique de la quittance par e-mail au commerçant avec le PDF attaché.

---

## 8. SEO & Balises Open Graph Dynamiques (Partage Réseaux Sociaux)

Le système injecte dynamiquement les balises Meta et Open Graph (`og:title`, `og:description`, `og:image`, `twitter:card`) pour garantir un aperçu visuel parfait lors des partages sur WhatsApp, Facebook, LinkedIn, Twitter et Telegram :
- **Produits (`/b/:slug/p/:productId`)** : L'image principale du produit est définie comme couverture Open Graph, complétée par le nom, le prix dans la devise de la boutique et la description.
- **Boutiques (`/b/:slug`)** : La bannière officielle ou le logo de la boutique est injecté en image de prévisualisation.
- **Promotions (`/b/:slug/promo/:promoId`)** : L'affiche promotionnelle ou le logo de l'enseigne est mis en avant avec le titre de la remise et sa période de validité.
- **Plateforme MarketNet (`/`)** : Aperçu officiel mettant en avant le logo de MarketNet et son slogan d'accroche.

---

## 9. Module Promotions (Ventes Flash & Campagnes)

Permet aux commerçants de lancer des campagnes marketing ciblées :
- **5 Modèles Graphiques Modernes (`PromoTemplate`)** :
  1. `fullscreen` (Hero Immersif) : Fond plein écran avec cartouche en verre dépoli et dégradé cinématique.
  2. `split` (Duo Showcase) : Affichage asymétrique équilibré texte / produit.
  3. `badge` (Flash Impact) : Badge coloré en relief et contraste élevé.
  4. `countdown` (Chrono Urgence) : Vente flash avec compte à rebours dynamique (jours, heures, minutes, secondes).
  5. `minimal` (Studio Élégance) : Typographie soignée épurée et pastille d'édition spéciale.
- **Paramétrage complet** : Titre de l'offre, étiquette obligatoire, description, pourcentage ou montant fixe de réduction, dates de début/fin, bouton d'action personnalisable, sélection jusqu'à 24 produits ou contact WhatsApp direct.
- **Storefront & Expérience Client** : Défilement carrousel automatique fluide, hauteur compacte responsive (190px mobile, 260px desktop), prévisualisation instantanée dans `ShopPreview`.
- **Sécurité** : Validation PostgreSQL pour le respect des plafonds de promotions selon le forfait souscrit.

---

## 10. Améliorations de l'Expérience Storefront & Panier

- **Gestion des Paniers Mixtes** : Prise en charge native des devises multiples. Le `CartSheet` enregistre la devise exacte de chaque ligne de commande et calcule la somme détaillée.
- **Filtres Avancés** : Sélecteur de dates Popover natif (`react-day-picker` / Shadcn) permettant de filtrer par date ou plage de dates.
- **Responsive Design** : Affichage mobile optimisé évitant la troncature de noms longs et garantissant la lisibilité des montants.
- **Template WhatsApp Épuré** : Message WhatsApp préformaté professionnel, clair et concis pour faciliter le traitement immédiat de la commande.

---

## 11. Notifications par E-mail (Nodemailer SMTP)

Variables requises : `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MARKETNET_ADMIN_EMAIL`, `MARKETNET_SITE_URL`.

| Déclencheur | Destinataire | Fonction |
|---|---|---|
| Nouvel utilisateur inscrit | Administrateur | `sendNewUserAdminNotification()` |
| Boutique créée (onboarding) | Commerçant + Administrateur | `sendMerchantWelcomeEmail()` |
| Facture de paiement acquittée | Commerçant | `sendInvoiceEmail()` (avec PDF joint) |
| Auto-suppression de compte | Commerçant + Administrateur | `sendDeletionConfirmationEmail()` |
| Suppression de compte par admin | Commerçant + Administrateur | `sendDeletionConfirmationEmail()` |
| Attribution manuelle de plan | Commerçant | `sendPlanAttributionEmail()` |

---

## 12. Développement Local & Commandes

### Installation

```bash
# Cloner le dépôt
git clone <repository-url>
cd shopwave-africa-hub

# Installer les dépendances
npm install
```

### Lancement du serveur de développement

```bash
npm run dev
```
L'application est accessible localement sur `http://localhost:8080`.

### Exécution des tests automatisés

```bash
# Exécute l'ensemble de la suite Vitest (32 tests automatisés)
npm run test
```

### Migrations Supabase

Les migrations PostgreSQL sont stockées dans `supabase/migrations/` et constituent la source unique de vérité.

```bash
# Appliquer les migrations directement sur la base Supabase
npm run db:migrate
```

---

## 13. Déploiement en Production (Vercel)

1. **Build Command** : `NITRO_PRESET=vercel npm run build` (configuré dans `vercel.json`).
2. **Pré-build automatique** : `node scripts/deploy-prebuild.mjs` exécute les migrations SQL non appliquées et vérifie le compte administrateur initial.
3. **Variables d'environnement requises sur Vercel** :
   - `VITE_SUPABASE_URL` et `SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` et `SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (serveur uniquement)
   - `SASPAY_ENV=live`
   - `SASPAY_SECRET_KEY` et `SASPAY_WEBHOOK_SECRET`
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_NAME`
   - `CRON_SECRET`
