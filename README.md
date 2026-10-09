# ShopWave Africa

# Prompt Lovable : MarketNet



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

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://shopwave-africa-hub.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/068af794-63d9-4fb1-994f-da08829468a0).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
