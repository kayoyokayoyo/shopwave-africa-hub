# MarketNet — Plateforme E-Commerce WhatsApp & Multi-Boutiques



Construis **MarketNet**, une plateforme SaaS multi-tenant permettant aux petits commerçants de créer leur boutique en ligne, de la personnaliser, d'y publier leurs produits et de recevoir les commandes directement sur WhatsApp. Marché cible : RDC et Afrique francophone. Interface en **français**, pensée **mobile-first** (connexions lentes, usage majoritaire sur smartphone).



## 1. Rôles (uniquement deux)

- **Commerçant** : s'inscrit, crée et gère sa boutique.

- **Administrateur MarketNet** : supervise toute la plateforme.

- Les clients finaux **n'ont pas de compte** : ils consultent la boutique et commandent via WhatsApp.



## 2. Architecture multi-tenant

- Base partagée avec isolation stricte par boutique (`shop_id` + Row Level Security). Un commerçant ne voit jamais les données d'un autre.

- Chaque boutique a une URL publique : `marketnet.com/b/{slug}` (slug unique, modifiable une fois).

- Prévoir l'extension future vers sous-domaine et domaine personnalisé.



## 3. Espace commerçant (dashboard)

**Inscription / connexion** : email + mot de passe,  Mot de passe oublié.



**Création de boutique** (assistant en étapes) : nom, slug, description, catégorie, logo, bannière, ville/adresse, numéro WhatsApp (format international), horaires, liens réseaux sociaux.



**Personnalisation** :

- 5 à 6 thèmes prédéfinis (couleurs, polices, style de cartes produits)

- Couleur principale, logo, bannière

- Aperçu en direct, mobile et desktop



**Produits** :

- Nom, description, prix, devise (USD / CDF), photos multiples (compression automatique et redimensionnement), catégorie, stock (optionnel), statut (actif / masqué / rupture)

- Variantes simples (taille, couleur) optionnelles

- Catégories personnalisées, produits mis en avant

- Import rapide : ajout de plusieurs produits à la suite



**Commandes** :

- Chaque clic sur « Commander sur WhatsApp » enregistre une commande (statut : nouvelle, confirmée, livrée, annulée)

- Liste des commandes, détail, changement de statut, notes

- Statistiques : produits les plus demandés, vues de la boutique, clics WhatsApp, commandes par période



**Marketing / Meta** (voir section 6).



**Abonnement** : voir plan actuel, limites utilisées, passer à un plan supérieur, historique de facturation.



## 4. Boutique publique (visible par les clients)

- Page d'accueil boutique : bannière, logo, description, produits mis en avant, catégories

- Liste de produits avec recherche et filtres (catégorie, prix)

- Page produit : galerie photos, prix, description, variantes

- **Panier léger** (sans compte) : le client ajoute plusieurs produits, indique son nom et sa quantité

- **Bouton « Commander sur WhatsApp »** : ouvre `https://wa.me/{numero}?text=...` avec un message pré-rempli listant les produits, quantités, total et le nom de la boutique

- Bouton de partage (WhatsApp, Facebook, copier le lien)

- Balises SEO et Open Graph (aperçu propre lors du partage sur WhatsApp et Facebook)

- Chargement très rapide : images optimisées, lazy loading



## 5. Espace administrateur MarketNet

- Tableau de bord global : nombre de commerçants, boutiques, produits, commandes, revenus

- Gestion des commerçants : liste, recherche, valider / suspendre / supprimer un compte

- Gestion des boutiques : modération, signalement de contenu

- Gestion des **plans d'abonnement** : créer, modifier prix et limites (nombre de produits, nombre de photos, accès Meta)

- Suivi des paiements d'abonnement

- Journal d'activité (audit log)

- Paramètres globaux : catégories de boutiques, devises, textes légaux

- **Inscription commerçant avec validation admin** activable ou désactivable



## 6. Intégration Meta (Facebook / Instagram)

Le commerçant connecte sa page Facebook / son compte Instagram professionnel via Meta Login (OAuth). Fonctionnalités par phases :

- **Phase 1** : publier un produit en un clic sur sa page Facebook / Instagram (image, description, prix, lien vers la boutique)

- **Phase 2** : synchronisation du catalogue produits avec Meta Commerce Manager

- **Phase 3** : création de publicités boostées depuis MarketNet (budget payé par le commerçant)

- Suivi simple des résultats (portée, clics)



Important : présenter la diffusion organique comme « publication automatique », sans promettre une publicité gratuite. Prévoir la gestion des tokens, leur expiration et la déconnexion.



## 7. Plans et paiement

- Plan **Gratuit** : limité (ex. 10 produits, 1 boutique, sans Meta)

- Plan **Pro** : plus de produits, thèmes avancés, publication Meta

- Plan **Business** : illimité, statistiques avancées, support prioritaire

- Prévoir l'intégration future du **mobile money** (M-Pesa, Airtel Money, Orange Money) via un agrégateur, plus carte bancaire. Pour la première version, une page de paiement manuelle avec validation admin suffit.



## 8. Exigences techniques

- Frontend : React + TypeScript + Tailwind, composants modernes, design propre et accessible

- Backend : authentification, base de données PostgreSQL, stockage d'images, fonctions serverless

- Sécurité : RLS sur toutes les tables, validation des entrées, limitation de débit, protection des uploads

- Notifications par email (nouvelle commande, inscription, changement de statut)

- Multilingue prévu (français par défaut, anglais plus tard)

- Support des devises USD et CDF avec affichage configurable par boutique



## 9. Design

Style moderne, chaleureux et fiable. Palette sobre (une couleur principale vive, fonds clairs), cartes arrondies, grandes photos de produits, gros boutons faciles à toucher sur mobile. Page d'accueil MarketNet (marketing) avec présentation, tarifs, témoignages et bouton « Créer ma boutique gratuitement ».



## 10. Ordre de construction

1. Authentification, rôles, base multi-tenant

2. Création et personnalisation de boutique

3. Gestion des produits et images

4. Boutique publique + panier + commande WhatsApp

5. Enregistrement et suivi des commandes

6. Tableau de bord admin, plans et limites

7. Page marketing MarketNet

8. Intégration Meta (phases 1 à 3)

9. Paiement des abonnements



Commence par les étapes 1 à 4 et demande-moi confirmation avant de passer aux suivantes.

## 4. Module Promotions (Ventes Flash & Campagnes)

Le module de promotion permet aux commerçants de lancer des campagnes marketing percutantes et ciblées :

- **5 Modèles Graphiques Modernes (`PromoTemplate`) :**
  1. `fullscreen` (Hero Immersif) : Fond plein écran avec cartouche en verre dépoli et dégradé cinématique.
  2. `split` (Duo Showcase) : Affichage asymétrique équilibré texte / produit.
  3. `badge` (Flash Impact) : Badge coloré en relief et contraste élevé.
  4. `countdown` (Chrono Urgence) : Vente flash avec compte à rebours dynamique (jours, heures, minutes, secondes).
  5. `minimal` (Studio Élégance) : Typographie soignée épurée et pastille d'édition spéciale.
- **Champs & Paramétrage :**
  - **Titre** de l'offre (max 80 car).
  - **Badge / Étiquette** : **Obligatoire** (ex: *Vente Flash*, *Promo Exclusive*, *Nouveauté*, *Liquidation*). Aucun texte fictif forcé.
  - **Description** : Détails et conditions optionnels.
  - **Réduction globale** : Pourcentage (%) ou montant fixe dans la devise de la boutique.
  - **Validité** : Date de début et fin optionnelles avec expiration automatique.
  - **Bouton d'action** : Label personnalisable (*Voir l'offre* par défaut).
  - **Articles ciblés** : Jusqu'à 24 produits avec réductions unitaires possibles. Si aucun produit n'est choisi, le bouton ouvre un contact WhatsApp direct.
- **Storefront & Expérience Client :**
  - Défilement carrousel automatique fluide avec reprise intelligente après swipe ou clic.
  - Hauteur uniforme et compacte adaptée aux écrans mobiles (190px) et ordinateurs (260px).
  - Boutons de partage et copie de lien réservés au dashboard commerçant.
  - Synchronisation en direct dans l'aperçu boutique du dashboard (`ShopPreview`).
- **Sécurité & RLS :**
  - Isolation stricte des données par boutique (`shop_id`).
  - Validation par trigger `promotion_guard` pour respecter les quotas selon le forfait.

## 5. Déploiement en Production sur Vercel

1. **Build Command :** `NITRO_PRESET=vercel npm run build` (configuré dans `vercel.json`).
2. **Fichier `.vercelignore` :** Exclut les migrations SQL brutes, scripts locaux et fichiers d'environnement secrets pour un bundle minimal et ultra-rapide.
3. **Variables d'environnement requises sur Vercel :**
   - `VITE_SUPABASE_URL` et `SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` et `SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only)
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
   - `CRON_SECRET`

## Development

Pour travailler sur le projet en local, installez Bun et ses dépendances depuis PowerShell :

```powershell
irm bun.sh/install.ps1 | iex
$env:Path += ";$env:USERPROFILE\.bun\bin"

git clone <this-repository-url>
cd <repository-name>
bun install
bun run dev
```

`bun install` installe les dépendances définies par le projet. `bun run dev` démarre le serveur ; ouvrez l’adresse locale affichée dans le terminal. Si Bun était déjà installé, les deux premières commandes ne sont pas nécessaires.

## Migrations Supabase & Déploiement

Les migrations de la base sont gérées par les fichiers de `supabase/migrations`. Configurez `LOVABLE_DB_MIGRATION_URL` (ou `SUPABASE_DB_MIGRATION_URL`) dans `.env` avec l’URI **Session pooler** du bon projet (port 5432).

### En local :
Depuis PowerShell ou votre terminal :
```powershell
bun run db:status    # Afficher l'état des migrations
bun run db:dry-run   # Prévisualiser les migrations à appliquer
bun run db:push      # Appliquer les migrations via Supabase CLI
# ou alternativement via Node.js :
bun run db:migrate   # Appliquer les migrations directement via le script Node.js
```

### Au déploiement (Vercel) :
Lors du déploiement Vercel, la commande `buildCommand` exécute automatiquement `node scripts/deploy-prebuild.mjs` avant le build Nitro/Vite :
1. **Migrations SQL** : toute nouvelle migration présente dans `supabase/migrations` est appliquée et enregistrée automatiquement dans `supabase_migrations.schema_migrations`.
2. **Administrateur** : le script `create-admin.mjs` configure le compte administrateur initial (si les variables sont renseignées dans Vercel).

N’utilisez pas `drizzle-kit migrate` ni le SQL Editor pour ce projet : les migrations Supabase sont la source unique de vérité.

## Médias Cloudinary

Les nouveaux logos, bannières et photos de produits sont compressés en WebP dans le navigateur, puis envoyés directement à Cloudinary avec une signature courte générée par le serveur. Le secret Cloudinary ne quitte jamais le serveur. Les colonnes existantes (`shops.logo_url`, `shops.banner_url` et `products.images`) stockent les URL HTTPS `secure_url` retournées par Cloudinary; aucun changement de schéma SQL n’est requis.

Ajoutez les trois variables suivantes dans `.env` depuis **Cloudinary Console > API Keys** (cloud name depuis le Dashboard). Le modèle est dans [.env.example](.env.example) :

```dotenv
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Les assets sont rangés dans `marketnet/shops/{owner_id}/storefront` et `marketnet/shops/{owner_id}/products`. Le projet impose un `owner_id` unique sur les boutiques; ce dossier stable représente donc une boutique, y compris pendant l’assistant de création avant que le `shop.id` existe. La signature Cloudinary est produite par une fonction serveur après authentification et le client ne peut pas choisir le dossier d’un autre commerçant.

### Transférer les anciennes images Supabase

Les anciennes références de forme `UUID/UUID.webp` restent servies par la route de compatibilité `/api/public/media/*`. La migration copie les médias référencés dans les champs de boutiques et de produits, puis remplace les références en base par les URL Cloudinary. Le script est réexécutable : il ignore les URL déjà migrées et utilise un identifiant Cloudinary déterministe pour éviter les doublons après un échec partiel.

1. Renseignez également `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` dans `.env` (la clé service-role reste secrète).
2. Vérifiez le périmètre sans modifier de données :

	```powershell
	npm run media:migrate
	```

3. Lancez le transfert après avoir vérifié le résumé :

	```powershell
	npm run media:migrate -- --apply
	```

4. Pour valider sur un petit lot d’abord, utilisez `npm run media:migrate -- --limit=2 --apply`, puis relancez sans `--limit` pour le reste.
5. Vérifiez les boutiques publiques et les photos de produits dans Cloudinary avant toute suppression manuelle du bucket `shop-media`. Le script ne supprime aucun objet Supabase; gardez le bucket et la route de compatibilité jusqu’à validation complète et sauvegarde.

## Configuration et état de l’intégration Meta

L’application Meta utilisée pour les tests est **MARKETNET**, App ID `4510252369235039`. Le flux est Facebook Login for Business avec l’URI locale `http://localhost:8080/dashboard/meta`. Les scopes demandés par le code sont `pages_show_list`, `pages_read_engagement`, `pages_manage_posts` et `read_insights`. Les tokens Meta restent dans `meta_connections` et ne sont lus/écrits que par les fonctions serveur après contrôle du propriétaire de la boutique.

Dans Meta for Developers, le cas d’utilisation Pages API (« Tout gérer sur votre Page ») est configuré pour ces autorisations; `read_insights` est disponible **Prête pour le test** et a été accepté dans le dernier consentement du compte de test. Cela permet de tester avec les rôles de l’application, mais ce n’est pas l’accès avancé/public : pour les comptes marchands externes, soumettez les permissions à **App Review** et effectuez la vérification d’entreprise si Meta l’exige. Le statut courant peut être vérifié dans [Meta for Developers — MARKETNET](https://developers.facebook.com/apps/4510252369235039/).

La publication Facebook a été testée sur la Page **Marketnet Community**. L’image est transférée à Meta depuis le serveur quand elle provient encore de l’ancien stockage privé Supabase; avec Cloudinary, l’URL HTTPS est fournie à l’API Meta. La publication Instagram n’est pas activée pour la Page actuellement sélectionnée, car aucun compte Instagram professionnel n’y est associé.

Les statistiques Facebook utilisent l’API Graph v26 avec `post_total_media_view_unique` (remplacement actuel de l’ancienne métrique dépréciée) et `post_clicks`. Meta peut mettre ses Insights à jour avec délai et ne fournit pas ces statistiques pour toutes les Pages; un « J’aime » est une réaction et ne constitue pas un clic. Les erreurs de permission sont remontées au lieu d’être silencieusement converties en zéro.

### Créer ou promouvoir un administrateur

Ajoutez ces variables dans le fichier local `.env` (ignoré par Git) :

```dotenv
MARKETNET_ADMIN_EMAIL=admin@example.com
MARKETNET_ADMIN_PASSWORD=un-secret-de-8-caracteres-minimum
MARKETNET_ADMIN_NAME=Administrateur MarketNet
```

Le script lit aussi `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` depuis le même `.env`. `MARKETNET_ADMIN_PASSWORD` doit contenir au moins 8 caractères, dont au moins 6 distincts. Utilisez un mot de passe robuste et unique; ne le collez jamais dans le chat ou dans Git.

Depuis PowerShell, à la racine du projet, lancez :

```powershell
bun run admin:create
```

Le script utilise la clé `SUPABASE_SERVICE_ROLE_KEY`, qui contourne les protections RLS : ne l’exécutez que localement et ne partagez jamais cette clé. Il crée le compte Auth ou active celui qui existe, définit le mot de passe de `.env`, marque l’email confirmé sans envoyer de mail, puis attribue uniquement le rôle `admin`. Si l’adresse existait comme commerçant, ses autres rôles sont retirés. Le compte est mis à jour en place, sans supprimer son UUID ni ses données liées.

**Attention :** relancer le script change à nouveau le mot de passe pour la valeur actuellement configurée dans `.env`. Après un bootstrap, retirez ou remplacez ce secret local et changez le mot de passe depuis un gestionnaire de secrets avant tout usage partagé. La confirmation immédiate concerne uniquement ce script administrateur; les inscriptions commerçants ordinaires continuent d’exiger la confirmation par email.

Pour rendre à un ancien compte commerçant son rôle après l’avoir promu, définissez temporairement `MARKETNET_RESTORE_MERCHANT_EMAIL` dans l’environnement de PowerShell avant d’exécuter le script. Le compte restauré perd alors ses autres rôles et reçoit uniquement `merchant`.

## Mises à jour récentes (Octobre 2026)

**Landing page & Expérience utilisateur :**
- **Alignement & Header stable :** Logo verrouillé à gauche (`flex-shrink-0`), empêchant tout saut ou centrage intempestif lors des rafraîchissements ou du redimensionnement de la fenêtre.
- **Mockup Hero dynamique & responsive :** Remplacement de l'ancienne grille par un mockup smartphone moderne illustrant une vraie boutique africaine (*« Awa Mode »*) avec gestion des devises locales, badges de promotions (`-20%`, `-10%`) et commandes WhatsApp.
- **Animations au scroll légères & intelligentes (`ScrollReveal`) :** Implémentation basée sur l'`IntersectionObserver` natif avec courbe `cubic-bezier(0.16, 1, 0.3, 1)` fluide à 60 FPS, déconnexion immédiate à l'apparition (zéro impact CPU) et cascade subtile sur les cartes.
- **Indicateur de chargement non-bloquant :** Barre de progression subtile au sommet de l'écran connectée à l'état du routeur TanStack pour éviter tout écran blanc lors des navigations.
- **Intégration fidèle des tarifs réels :** Suppression intégrale des tarifs et fonctionnalités fictifs. La section Tarifs s'aligne à 100 % sur les données de la table `plans` de la base de données (produits, photos, promotions max, accès Meta, thèmes avancés, statistiques pro).
- **CTA final épuré :** Suppression du bouton redondant, conservant un bouton d'action unique et contrasté : *« Créer ma boutique maintenant »*.

**Authentification & Inscription (/auth) :**
- **Refonte visuelle centrée :** Carte flottante moderne (`rounded-[2rem]`) avec switcher segmenté fluide (*Connexion* | *Inscription*), respectant rigoureusement la palette de couleurs de MarketNet.
- **Gestion du mot de passe oublié :** Écran dédié épuré avec bouton de retour direct.
- **Conditions d'utilisation :** Lien propre et direct vers `/terms` sur le formulaire d'inscription.

**Notifications & E-mails :**
- **Transition vers Gmail SMTP :** Remplacement de l'API Resend par le client SMTP Deno natif (`denomailer`) sur le port SSL 465 (`smtp.gmail.com`).
- **Template de confirmation de suppression de compte :** Template HTML responsive et compréhensible avec récapitulatif détaillé des données supprimées, heure locale et coordonnées réelles issues de l'environnement.

**Refonte de la gestion des commandes (Dashboard) :**
- **Séparation Liste / Détails :** La vue des commandes (`dashboard.commandes.tsx`) a été épurée pour ne montrer que les informations essentielles. Une nouvelle page détaillée (`dashboard.commandes_.$orderId.tsx`) affiche le récapitulatif complet du client, les articles avec photos, les notes internes, et le statut.
- **Gestion des Paniers Mixtes :** Prise en charge native des devises multiples. Le `CartSheet` enregistre la devise exacte de chaque ligne de commande. Les vues calculent et affichent dynamiquement la somme (ex: `2 700 $ + 15 000 FCFA`) au lieu du générique "Montant Mixte".
- **Filtres Avancés :** Implémentation d'un calendrier Popover natif (`react-day-picker` / Shadcn) permettant de filtrer avec précision par date unique ou par plage de dates, avec gestion parfaite des collisions et de l'espace sur mobile.
- **Responsive Design :** Amélioration de l'UX mobile sur les listes de produits avec l'adoption du mode `flex-col`, tronquant correctement les longs noms sans casser l'interface ni masquer les totaux.
- **Template WhatsApp Épuré :** Suppression des liens web des produits et des champs redondants (numéro de téléphone) dans le message WhatsApp pour un rendu beaucoup plus professionnel et propre côté client.

## Système d'Abonnements & Paiements SasPay (Intégration Complète)

MarketNet intègre un système d'abonnement multi-formules (Gratuit, Pro, Business) couplé à la passerelle de paiement **SasPay** (Mobile Money & Cartes bancaires en $ USD). L'implémentation est divisée en 3 volets sécurisés et indépendants :

### 1. Données, Tarification et Logique Métier (Partie 1/3)

- **Tables Supabase dédiées avec Row Level Security (RLS) :**
  - `plan_prices` : Tarifs administrables en Dollars ($ USD) par plan et période (`mensuel` ou `annuel`). Les montants ne sont jamais codés en dur ni modifiables par le client. Un trigger PostgreSQL (`trg_sync_plan_prices`) maintient la synchronisation automatique avec la table `plans`.
  - `subscription_payments` : Historique complet des demandes et transactions (`id`, `merchant_id`, `shop_id`, `plan_id`, `period`, `montant_usd`, `currency = 'USD'`, `statut`, `methode`, `saspay_session_id`, `checkout_url`, `saspay_transaction_id`, `montant_debite`, `montant_net`, `frais`, `cree_le`, `paye_le`, `admin_note`).
  - `merchant_subscriptions` : Périodes actives des commerçants (`debut`, `fin`, `statut` : `actif`, `grâce`, `expiré`).
  - `payment_events` : Journal d'audit immuable des webhooks bruts reçus avec statut de vérification de signature et résultat de traitement.
- **Règles d'abonnement :**
  - **Renouvellement anticipé :** Si un commerçant renouvelle avant échéance, la nouvelle période s'ajoute à la date de fin courante (aucun jour perdu).
  - **Période de grâce de 7 jours :** À l'échéance, le statut passe en `grâce` sans interruption de service pendant 7 jours.
  - **Rappels progressifs :** Des bandeaux discrets et préventifs s'affichent dans le dashboard à J-7, J-3 et pendant la période de grâce.
  - **Rétrogradation douce :** À l'expiration définitive (après les 7 jours de grâce), la boutique bascule sur le plan Gratuit. Les produits au-delà de la limite gratuite (10) sont masqués automatiquement sans suppression, et les promotions actives sont mises en pause.

### 2. Intégration SasPay & Expérience Commerçant (Partie 2/3)

- **Variables d'environnement sécurisées (côté serveur uniquement) :**
  ```dotenv
  SASPAY_ENV=test                                 # test ou live
  SASPAY_SECRET_KEY=sk_test_...                  # Clé secrète d'API SasPay
  SASPAY_WEBHOOK_SECRET=whsec_...                # Secret de signature des webhooks
  ```
- **Création de Session (`createCheckoutSession`) :**
  - Déduplication : si une demande `en_attente` identique existe depuis moins d'une heure, son `checkout_url` est réutilisé au lieu d'en créer une nouvelle.
  - Les prix proviennent impérativement de `plan_prices` / `plans` côté serveur (strictement en USD).
  - Appel de `POST https://api.saspay.me/api/v1/checkout-sessions/` avec nom de la boutique, e-mail et métadonnées de suivi (devise `USD`).
- **Interface dédiée (`/dashboard/abonnement`) :**
  - Sélecteur de période (mensuel ou annuel avec économie affichée).
  - Cartes comparatives Pro et Business avec prix en **$ USD**, liste dynamique des fonctionnalités et bouton de souscription/renouvellement.
  - Skeleton loading élégant pour éliminer tout clignotement de fausses données.
  - Tableau de l'historique des paiements en **$ USD** avec statuts et références.
- **Page de retour (`/abonnement/retour?ref=<paymentId>`) :**
  - Polling automatique toutes les 3 secondes pendant 60 secondes maximum.
  - États animés : vérification en cours, reçu de paiement détaillé en **$ USD** (référence, montant facturé, montant débité, frais, date, ID de transaction), échec avec explication, ou délai dépassé avec possibilité de revérification.

### 3. Webhook SasPay, Sécurité & Confidentialité (Partie 3/3)

- **Route publique du Webhook :** `POST /api/public/webhook-saspay`
- **Contrôles de sécurité stricts :**
  - **Corps brut :** Lecture de la charge utile non modifiée via `request.text()`.
  - **Tolérance d'horodatage :** Rejet HTTP 401 si `X-Webhook-Timestamp` s'écarte de plus de 5 minutes (300 secondes) de l'heure du serveur.
  - **Signature HMAC-SHA256 :** Calcul en temps constant (`crypto.timingSafeEqual`) de `${timestamp}.${corpsBrut}` avec `SASPAY_WEBHOOK_SECRET`. Rejet 401 en cas d'invalidité.
  - **Idempotence :** Déduplication par `transaction_id` et `type_evenement`. Un webhook réémis ne déclenche jamais une seconde prolongation.
- **Gestion des Événements :**
  - `transaction.success` (ou `payment.completed`) :
    - Rapprochement via métadonnées, référence ou session distante.
    - Contrôle que la devise est strictement `USD`.
    - Contrôle que `amount` ou `net_amount` correspond au tarif du plan attendu en dollars (**jamais** `charged` seul car les frais s'y ajoutent, tolérance de 0.05 $).
    - En cas d'incohérence, le paiement est marqué `à_vérifier` avec note explicative pour validation admin sans deviner.
    - Si tout est conforme : mise à jour en `payé`, enregistrement des frais/nets et activation immédiate de l'abonnement.
  - `transaction.failed` / `transaction.cancelled` : Mise à jour du statut en `échoué` ou `annulé`.
  - `webhook.test`, `settlement.*`, `wallet_transfer.*` : Journalisés dans `payment_events` et acquittés sans action.
- **Conformité & Politique de Confidentialité :**
  - Mise à jour de `/privacy` : SasPay est formellement déclaré comme sous-traitant de paiement, avec transmission exclusive du nom commercial de la boutique et de l'e-mail du compte lors des transactions.

### 4. Validation des Tests

Le module d'abonnements et de paiements est couvert par **20 tests automatisés** (et 29 tests totaux projet) exécutables via :
```powershell
npm test
```


          🧡🤍💛🤍💛💗💓💞 MarketNet 


---

## Changelog � Mises a jour (Octobre 2026)

### Sidebar amelioree (etat reduit)
- Icones centrees 44x44 px avec tooltips flottants au survol.
- Largeur compact 72px, scrollbar masquee, transitions fluides.

### Notifications par E-mail (Nodemailer SMTP)
Variables : SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, MARKETNET_ADMIN_EMAIL, MARKETNET_SITE_URL

| Declencheur | Destinataire | Fonction |
|---|---|---|
| Nouvel utilisateur inscrit | Admin | sendNewUserAdminNotification() |
| Boutique creee (onboarding) | Commercant + Admin | sendMerchantWelcomeEmail() |
| Auto-suppression compte | Commercant + Admin | sendDeletionConfirmationEmail() |
| Suppression par admin | Commercant + Admin | sendDeletionConfirmationEmail() |
| Attribution de plan | Commercant | sendPlanAttributionEmail() |

Fix : middleware requireSupabaseAuth retire de notifyMerchantAccountDeletion.

### Separation Revenus (Option 2)
- admin/paiements : SasPay reel, Attributions admin, En attente.
- Dashboard : Revenue Chart = SasPay reel uniquement.

### Suppression Admin securisee
- Dialog suppression : admin doit saisir son mot de passe.
- Verification via signInWithPassword() avant execution.

### URL Webhook SasPay Production
https://marketnet-chi.vercel.app/api/public/webhook-saspay
(L'URL loca.lt est reservee au developpement local uniquement.)

