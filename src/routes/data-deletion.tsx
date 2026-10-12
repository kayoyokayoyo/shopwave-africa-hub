import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Trash2, LogIn, Facebook, Mail, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/data-deletion")({
  head: () => ({
    meta: [
      { title: "Suppression des données — MarketNet" },
      {
        name: "description",
        content:
          "Comment supprimer vos données personnelles et votre compte MarketNet. Instructions détaillées pour les commerçants et utilisateurs Facebook.",
      },
      { property: "og:title", content: "Suppression des données — MarketNet" },
      {
        property: "og:description",
        content:
          "Supprimez votre compte MarketNet ou révoquez l'accès de l'application Facebook en quelques étapes.",
      },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: DataDeletionPage,
});

function DataDeletionPage() {
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
        {/* ── Header nav ── */}
        <div className="mb-8 flex items-center justify-between">
          <Link
            to="/"
            className="text-xl font-black tracking-tight text-primary hover:opacity-80 transition-opacity"
          >
            MarketNet
          </Link>
          <Button variant="ghost" asChild className="rounded-full">
            <Link to="/">Retour à l'accueil</Link>
          </Button>
        </div>

        {/* ── Card ── */}
        <div className="rounded-3xl border bg-card p-8 shadow-sm sm:p-12">
          {/* Title */}
          <div className="mb-12 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 text-red-500 mb-5">
              <Trash2 className="h-8 w-8" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
              Suppression des données
            </h1>
            <p className="mt-3 text-muted-foreground text-lg">
              Vous avez le droit à l'oubli. Voici toutes les façons de supprimer vos données.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Dernière mise à jour : 12 octobre 2026
            </p>
          </div>

          <div className="space-y-10">
            {/* ── Méthode 1 : Dans l'application ── */}
            <section className="rounded-2xl border bg-muted/30 p-6 sm:p-8">
              <div className="flex items-center gap-4 mb-5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <LogIn className="h-6 w-6" />
                </div>
                <h2 className="text-xl font-bold text-foreground">
                  1. Supprimer votre compte depuis MarketNet
                </h2>
              </div>

              <p className="text-muted-foreground text-base sm:text-lg mb-4">
                Si vous avez accès à votre compte, c'est la méthode la plus rapide et la plus
                complète. La suppression est <strong>immédiate et définitive</strong>.
              </p>

              <ol className="space-y-3 mb-5">
                <li className="flex items-start gap-3 text-muted-foreground text-base">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold mt-0.5">1</span>
                  <span>Connectez-vous sur <Link to="/auth" className="font-semibold text-primary underline underline-offset-4 hover:opacity-80">MarketNet</Link>.</span>
                </li>
                <li className="flex items-start gap-3 text-muted-foreground text-base">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold mt-0.5">2</span>
                  <span>Dans le menu de gauche, accédez à <strong>Réglages</strong>.</span>
                </li>
                <li className="flex items-start gap-3 text-muted-foreground text-base">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold mt-0.5">3</span>
                  <span>Faites défiler jusqu'à la section <strong>« Supprimer mon compte »</strong> et cliquez sur le bouton rouge.</span>
                </li>
                <li className="flex items-start gap-3 text-muted-foreground text-base">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold mt-0.5">4</span>
                  <span>Confirmez la suppression dans la fenêtre de dialogue. L'action est <strong>irréversible</strong>.</span>
                </li>
              </ol>

              <div className="flex items-start gap-3 rounded-xl bg-red-500/10 border border-red-500/20 p-4">
                <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-400">
                  <strong>Suppression immédiate et définitive.</strong> Votre compte, vos boutiques,
                  vos produits, vos commandes, vos jetons Meta et toutes vos données personnelles
                  sont effacés de façon permanente et ne peuvent pas être récupérés.
                </p>
              </div>
            </section>

            {/* ── Méthode 2 : Via Facebook ── */}
            <section className="rounded-2xl border bg-muted/30 p-6 sm:p-8">
              <div className="flex items-center gap-4 mb-5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
                  <Facebook className="h-6 w-6" />
                </div>
                <h2 className="text-xl font-bold text-foreground">
                  2. Révoquer l'accès depuis Facebook
                </h2>
              </div>

              <p className="text-muted-foreground text-base sm:text-lg mb-4">
                Vous pouvez retirer à MarketNet l'accès à votre page Facebook directement depuis
                les paramètres de votre compte Facebook, sans vous connecter à MarketNet.
              </p>

              <ol className="space-y-3 mb-5">
                <li className="flex items-start gap-3 text-muted-foreground text-base">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white text-xs font-bold mt-0.5">1</span>
                  <span>Ouvrez <strong>Facebook</strong> et accédez à <strong>Paramètres et confidentialité → Paramètres</strong>.</span>
                </li>
                <li className="flex items-start gap-3 text-muted-foreground text-base">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white text-xs font-bold mt-0.5">2</span>
                  <span>Dans le menu de gauche, cliquez sur <strong>Intégrations professionnelles</strong>.</span>
                </li>
                <li className="flex items-start gap-3 text-muted-foreground text-base">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white text-xs font-bold mt-0.5">3</span>
                  <span>Trouvez <strong>MARKETNET</strong> dans la liste et cliquez sur <strong>Retirer</strong>.</span>
                </li>
                <li className="flex items-start gap-3 text-muted-foreground text-base">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white text-xs font-bold mt-0.5">4</span>
                  <span>Confirmez la suppression de l'autorisation d'accès.</span>
                </li>
              </ol>

              <div className="flex items-start gap-3 rounded-xl bg-blue-500/10 border border-blue-500/20 p-4">
                <CheckCircle2 className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-sm text-blue-700 dark:text-blue-400">
                  <strong>Ce que cela fait :</strong> MarketNet ne peut plus accéder à votre page
                  Facebook ni la gérer. Les données associées à cette connexion (jeton d'accès,
                  identifiant de page) sont supprimées de nos serveurs dans un délai de{" "}
                  <strong>30 jours</strong>. Votre compte MarketNet reste actif si vous souhaitez
                  continuer à utiliser le service sans la connexion Meta.
                </p>
              </div>
            </section>

            {/* ── Méthode 3 : Par e-mail ── */}
            <section className="rounded-2xl border bg-muted/30 p-6 sm:p-8">
              <div className="flex items-center gap-4 mb-5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                  <Mail className="h-6 w-6" />
                </div>
                <h2 className="text-xl font-bold text-foreground">
                  3. Demande par e-mail
                </h2>
              </div>

              <p className="text-muted-foreground text-base sm:text-lg mb-4">
                Si vous n'avez plus accès à votre compte, vous pouvez envoyer une demande de
                suppression par e-mail. Nous traiterons votre demande dans un délai maximal de{" "}
                <strong>30 jours</strong>.
              </p>

              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-5">
                <p className="text-sm text-muted-foreground mb-3">
                  Envoyez un e-mail à l'adresse suivante en précisant :{" "}
                  <strong>votre adresse e-mail de connexion MarketNet</strong>, le nom de votre
                  boutique (si vous en avez une), et la mention{" "}
                  <em>« Demande de suppression de compte et de données »</em>.
                </p>
                <a
                  href={`mailto:${contactEmail}?subject=Demande%20de%20suppression%20de%20compte%20MarketNet`}
                  className="inline-flex items-center gap-2 font-bold text-primary text-lg hover:underline"
                >
                  <Mail className="h-4 w-4" />
                  {contactEmail}
                </a>
              </div>
            </section>

            {/* ── Ce qui est supprimé ── */}
            <section>
              <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-red-500" />
                Ce qui est supprimé
              </h2>
              <ul className="space-y-3">
                {[
                  "Votre compte utilisateur (e-mail, mot de passe, nom)",
                  "Votre boutique en ligne et son URL publique",
                  "Tous vos produits, catégories, photos et descriptions",
                  "Votre historique de commandes",
                  "Vos jetons d'accès Meta (Facebook & Instagram) chiffrés",
                  "Les statistiques et publications associées à votre boutique",
                  "Votre abonnement et votre historique de paiement",
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-3 text-muted-foreground text-base sm:text-lg"
                  >
                    <CheckCircle2 className="h-6 w-6 text-red-400 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* ── Contact ── */}
            <div className="mt-8 p-6 bg-muted/50 rounded-2xl border border-muted">
              <h3 className="font-bold text-foreground mb-2">Questions ou droits supplémentaires ?</h3>
              <p className="text-muted-foreground">
                Pour exercer vos droits d'accès, de rectification ou d'opposition, ou pour toute
                question relative à la protection de vos données, contactez-nous à{" "}
                <a
                  href={`mailto:${contactEmail}`}
                  className="font-bold text-primary hover:underline"
                >
                  {contactEmail}
                </a>
                . Consultez également notre{" "}
                <Link
                  to="/privacy"
                  className="font-semibold text-primary underline underline-offset-4 hover:opacity-80"
                >
                  Politique de confidentialité
                </Link>
                .
              </p>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="mt-12 text-center text-sm text-muted-foreground flex flex-col sm:flex-row justify-center items-center gap-4">
          <span>&copy; {new Date().getFullYear()} MarketNet. Tous droits réservés.</span>
          <span className="hidden sm:inline">&bull;</span>
          <Link to="/terms" className="hover:text-foreground underline underline-offset-4">
            Conditions d'utilisation (CGU)
          </Link>
          <span className="hidden sm:inline">&bull;</span>
          <Link to="/privacy" className="hover:text-foreground underline underline-offset-4">
            Politique de confidentialité
          </Link>
        </div>
      </div>
    </div>
  );
}
