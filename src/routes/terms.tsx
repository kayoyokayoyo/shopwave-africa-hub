import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Scale, CheckCircle2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
});

function TermsPage() {
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
            <Link to="/">Retour a l'accueil</Link>
          </Button>
        </div>

        <div className="rounded-3xl border bg-card p-8 shadow-sm sm:p-12">
          <div className="mb-12 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-5">
              <Scale className="h-8 w-8" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">Conditions Generales & Confidentialite</h1>
            <p className="mt-3 text-muted-foreground text-lg">Regles et modalites d'utilisation de nos services.</p>
          </div>

          <div className="space-y-12">
            
            <section>
              <h2 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">Bienvenue sur MarketNet</h2>
              <p className="text-muted-foreground leading-relaxed text-base sm:text-lg">
                MarketNet est une plateforme vous permettant de creer et gerer facilement votre boutique en ligne. En utilisant nos services, vous acceptez les regles suivantes.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">1. Votre boutique, vos regles</h2>
              <p className="text-muted-foreground leading-relaxed text-base sm:text-lg">
                Vous etes l'unique responsable de votre boutique. Vous vous engagez a ne vendre aucun produit illegal, contrefait ou dangereux, et a toujours honorer les commandes de vos clients.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">2. Abonnements et Paiements</h2>
              <p className="text-muted-foreground leading-relaxed text-base sm:text-lg">
                Les fonctionnalites de votre boutique dependent de votre forfait. Le non-paiement de votre abonnement entrainera la suspension temporaire de votre acces. Les paiements via Mobile Money ne sont pas remboursables.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">3. Securite et Moderation</h2>
              <p className="text-muted-foreground leading-relaxed text-base sm:text-lg mb-4">
                Pour proteger les acheteurs, MarketNet se reserve le droit de :
              </p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3 text-muted-foreground text-base sm:text-lg">
                  <CheckCircle2 className="h-6 w-6 text-primary shrink-0 mt-0.5" />
                  <span><strong>Suspendre une boutique</strong> en cas de plaintes repetees ou d'arnaque suspectee.</span>
                </li>
                <li className="flex items-start gap-3 text-muted-foreground text-base sm:text-lg">
                  <CheckCircle2 className="h-6 w-6 text-primary shrink-0 mt-0.5" />
                  <span><strong>Supprimer definitivement</strong> un compte si des produits illicites sont detectes.</span>
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">4. Vos Donnees et votre Confidentialite</h2>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-muted-foreground text-base sm:text-lg">
                  <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-2.5" />
                  <span><strong>Vos donnees :</strong> Nous gardons vos informations de contact en securite et ne les vendons jamais.</span>
                </li>
                <li className="flex items-start gap-3 text-muted-foreground text-base sm:text-lg">
                  <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-2.5" />
                  <span><strong>API Meta (Facebook/Instagram) :</strong> Nous ne publions jamais sur votre page a votre insu. La connexion sert uniquement a synchroniser vos produits automatiquement.</span>
                </li>
                <li className="flex items-start gap-3 text-muted-foreground text-base sm:text-lg">
                  <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-2.5" />
                  <span><strong>Les donnees de vos clients :</strong> Vous vous engagez a respecter la vie privee de vos acheteurs et a ne pas utiliser leurs numeros de telephone de maniere abusive.</span>
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">5. Propriete</h2>
              <p className="text-muted-foreground leading-relaxed text-base sm:text-lg">
                MarketNet reste proprietaire de sa technologie. Cependant, vous etes 100% proprietaire de tout le contenu que vous mettez sur votre boutique (photos, descriptions, logo).
              </p>
            </section>

            <div className="mt-8 p-6 bg-muted/50 rounded-2xl border border-muted">
              <h3 className="font-bold text-foreground mb-2">Nous contacter</h3>
              <p className="text-muted-foreground">
                Pour toute question ou pour signaler une boutique frauduleuse, veuillez nous contacter à l'adresse officielle de la plateforme : <a href={`mailto:${contactEmail}`} className="font-bold text-primary hover:underline">{contactEmail}</a>
              </p>
            </div>
          </div>
        </div>

        <div className="mt-12 text-center text-sm text-muted-foreground flex flex-col sm:flex-row justify-center items-center gap-4">
          <span>&copy; {new Date().getFullYear()} MarketNet. Tous droits reserves.</span>
          <span className="hidden sm:inline">&bull;</span>
          <Link to="/terms" className="hover:text-foreground underline underline-offset-4">Politique de confidentialite</Link>
        </div>
      </div>
    </div>
  );
}
