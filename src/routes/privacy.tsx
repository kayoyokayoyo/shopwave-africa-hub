import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck, CheckCircle2, Lock, Share2, Trash2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Politique de confidentialité — MarketNet" },
      { name: "description", content: "Politique de confidentialité et protection des données personnelles de la plateforme MarketNet." },
      { property: "og:title", content: "Politique de confidentialité — MarketNet" },
      { property: "og:description", content: "Découvrez comment MarketNet protège et traite vos données personnelles." },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  const { data: contactEmail } = useQuery({
    queryKey: ["contact_email_public"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "contact_email")
        .maybeSingle();
      return data?.value ? String(data.value) : "support@marketnet.com";
    },
  });

  return (
    <div className="min-h-screen bg-muted/10">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <Link to="/" className="text-xl font-black tracking-tight text-primary hover:opacity-80 transition-opacity">
            MarketNet
          </Link>
          <Button variant="ghost" asChild className="rounded-full">
            <Link to="/">Retour à l'accueil</Link>
          </Button>
        </div>

        <div className="rounded-3xl border bg-card p-8 shadow-sm sm:p-12">
          <div className="mb-12 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-5">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">Politique de Confidentialité</h1>
            <p className="mt-3 text-muted-foreground text-lg">Protection et transparence de vos données personnelles.</p>
            <p className="mt-1 text-xs text-muted-foreground">Dernière mise à jour : 12 octobre 2026</p>
          </div>

          <div className="space-y-12">
            
            <section>
              <h2 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">Présentation de MarketNet</h2>
              <p className="text-muted-foreground leading-relaxed text-base sm:text-lg">
                MarketNet est une plateforme SaaS qui permet aux petits commerçants et entrepreneurs de créer facilement leur boutique en ligne personnalisée, d'y publier leurs catalogues de produits et de recevoir directement leurs commandes via WhatsApp.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">1. Données collectées auprès des commerçants</h2>
              <p className="text-muted-foreground leading-relaxed text-base sm:text-lg mb-4">
                Pour créer et administrer votre compte et votre boutique, MarketNet collecte les informations suivantes :
              </p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3 text-muted-foreground text-base sm:text-lg">
                  <CheckCircle2 className="h-6 w-6 text-primary shrink-0 mt-0.5" />
                  <span><strong>Identité et contact :</strong> Nom complet, adresse e-mail, numéro de téléphone et numéro WhatsApp international.</span>
                </li>
                <li className="flex items-start gap-3 text-muted-foreground text-base sm:text-lg">
                  <CheckCircle2 className="h-6 w-6 text-primary shrink-0 mt-0.5" />
                  <span><strong>Boutique :</strong> Nom commercial, adresse physique, ville, horaires d'ouverture, description, logo et bannière.</span>
                </li>
                <li className="flex items-start gap-3 text-muted-foreground text-base sm:text-lg">
                  <CheckCircle2 className="h-6 w-6 text-primary shrink-0 mt-0.5" />
                  <span><strong>Catalogue :</strong> Produits, prix, devises (USD, CDF), descriptions, catégories et photos de produits.</span>
                </li>
                <li className="flex items-start gap-3 text-muted-foreground text-base sm:text-lg">
                  <CheckCircle2 className="h-6 w-6 text-primary shrink-0 mt-0.5" />
                  <span><strong>Gestion commerciale :</strong> Historique des commandes reçues et statut de votre forfait d'abonnement.</span>
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">2. Données issues de l'API Meta (Facebook & Instagram)</h2>
              <p className="text-muted-foreground leading-relaxed text-base sm:text-lg mb-4">
                Lorsque vous connectez volontairement votre page Facebook professionnelle à MarketNet :
              </p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3 text-muted-foreground text-base sm:text-lg">
                  <Share2 className="h-6 w-6 text-primary shrink-0 mt-0.5" />
                  <span><strong>Données collectées :</strong> L'identifiant (ID) et le nom de votre page Facebook, l'identifiant de compte Instagram professionnel lié, les jetons d'accès de page nécessaires, ainsi que l'identifiant des publications générées via MarketNet et leurs statistiques de lecture (vues).</span>
                </li>
                <li className="flex items-start gap-3 text-muted-foreground text-base sm:text-lg">
                  <Lock className="h-6 w-6 text-primary shrink-0 mt-0.5" />
                  <span><strong>Ce que nous ne collectons pas :</strong> MarketNet n'accède <strong>jamais</strong> à votre profil Facebook personnel, à votre liste d'amis, ni à vos messages privés. La connexion sert exclusivement à synchroniser et publier vos produits à votre demande.</span>
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">3. Données des clients des boutiques</h2>
              <p className="text-muted-foreground leading-relaxed text-base sm:text-lg">
                MarketNet <strong>ne demande aucune création de compte</strong> aux clients finaux. Les clients consultent librement la vitrine publique. Lorsqu'un client choisit des produits et clique sur « Commander sur WhatsApp », les informations de sa commande (nom renseigné, articles choisis, quantités et montant total) sont directement transmises au commerçant via la messagerie WhatsApp. Les commerçants s'engagent à respecter la vie privée de leurs acheteurs et à ne pas faire d'usage abusif de leurs coordonnées.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">4. Finalités du traitement</h2>
              <p className="text-muted-foreground leading-relaxed text-base sm:text-lg mb-4">
                Vos données sont exclusivement utilisées pour :
              </p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3 text-muted-foreground text-base sm:text-lg">
                  <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-2.5" />
                  <span>Fournir, héberger et maintenir le service de boutique en ligne.</span>
                </li>
                <li className="flex items-start gap-3 text-muted-foreground text-base sm:text-lg">
                  <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-2.5" />
                  <span>Publier vos produits sur votre page Facebook et votre compte Instagram professionnel à votre demande.</span>
                </li>
                <li className="flex items-start gap-3 text-muted-foreground text-base sm:text-lg">
                  <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-2.5" />
                  <span>Afficher les statistiques de performance de vos publications et de votre boutique.</span>
                </li>
                <li className="flex items-start gap-3 text-muted-foreground text-base sm:text-lg">
                  <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-2.5" />
                  <span>Assurer la sécurité, la détection des fraudes et le support technique.</span>
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">5. Partage et sous-traitance</h2>
              <p className="text-muted-foreground leading-relaxed text-base sm:text-lg">
                MarketNet <strong>ne vend jamais vos données personnelles ni celles de vos clients</strong> à des tiers. Les données ne sont partagées qu'avec :
              </p>
              <ul className="space-y-3 mt-3">
                <li className="flex items-start gap-3 text-muted-foreground text-base sm:text-lg">
                  <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-2.5" />
                  <span><strong>Meta Platforms :</strong> Pour les fonctionnalités de publication et de commande WhatsApp activées par le commerçant.</span>
                </li>
                <li className="flex items-start gap-3 text-muted-foreground text-base sm:text-lg">
                  <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-2.5" />
                  <span><strong>Fournisseurs d'infrastructure :</strong> Hébergement sécurisé (Supabase, Vercel) et gestion des médias (Cloudinary).</span>
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">6. Sécurité des données</h2>
              <p className="text-muted-foreground leading-relaxed text-base sm:text-lg">
                L'architecture multi-tenant de MarketNet isole strictement les données de chaque boutique via des règles de sécurité au niveau des lignes (RLS - Row Level Security). Les jetons d'accès Meta sont chiffrés de bout en bout avec l'algorithme AES-256-GCM et stockés exclusivement côté serveur : ils ne sont jamais exposés au navigateur ni consignés dans les journaux système.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">7. Durée de conservation</h2>
              <p className="text-muted-foreground leading-relaxed text-base sm:text-lg">
                Vos données sont conservées pendant toute la durée d'activité de votre compte. En cas de demande de résiliation ou de suppression de compte, vos données personnelles et vos boutiques sont définitivement purgées de nos bases dans un délai maximal de <strong>30 jours</strong>.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">8. Vos droits et révocation</h2>
              <p className="text-muted-foreground leading-relaxed text-base sm:text-lg mb-3">
                Vous disposez d'un droit d'accès, de rectification et de suppression totale de vos données personnelles.
              </p>
              <p className="text-muted-foreground leading-relaxed text-base sm:text-lg">
                Vous pouvez révoquer à tout moment l'accès de MarketNet à vos pages Meta soit depuis votre tableau de bord (« Déconnecter »), soit directement sur Facebook dans <em>Paramètres & confidentialité &gt; Paramètres &gt; Intégrations professionnelles</em>.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">9. Demande de suppression des données</h2>
              <p className="text-muted-foreground leading-relaxed text-base sm:text-lg">
                Pour faire valoir votre droit à l'oubli et demander la suppression intégrale de vos informations ou de celles de votre page Facebook, consultez nos instructions dédiées sur la page{" "}
                <Link to="/data-deletion" className="font-bold text-primary underline underline-offset-4 hover:opacity-80">
                  Suppression des données
                </Link>{" "}
                ou écrivez-nous directement par e-mail.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">10. Modifications de la politique</h2>
              <p className="text-muted-foreground leading-relaxed text-base sm:text-lg">
                MarketNet se réserve le droit d'actualiser la présente politique pour refléter les évolutions techniques ou réglementaires. En cas de modification substantielle, les commerçants seront informés via leur tableau de bord ou par e-mail.
              </p>
            </section>

            <div className="mt-8 p-6 bg-muted/50 rounded-2xl border border-muted">
              <h3 className="font-bold text-foreground mb-2">Nous contacter</h3>
              <p className="text-muted-foreground">
                Pour toute question relative à la protection de vos données personnelles, veuillez nous écrire à :{" "}
                <a href={`mailto:${contactEmail}`} className="font-bold text-primary hover:underline">
                  {contactEmail}
                </a>
              </p>
            </div>
          </div>
        </div>

        <div className="mt-12 text-center text-sm text-muted-foreground flex flex-col sm:flex-row justify-center items-center gap-4">
          <span>&copy; {new Date().getFullYear()} MarketNet. Tous droits reserves.</span>
          <span className="hidden sm:inline">&bull;</span>
          <Link to="/terms" className="hover:text-foreground underline underline-offset-4">Conditions d'utilisation (CGU)</Link>
          <span className="hidden sm:inline">&bull;</span>
          <Link to="/privacy" className="hover:text-foreground underline underline-offset-4 font-semibold text-foreground">Politique de confidentialité</Link>
        </div>
      </div>
    </div>
  );
}
