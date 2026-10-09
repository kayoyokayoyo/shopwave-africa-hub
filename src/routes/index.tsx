import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, MessageCircle, Palette, Smartphone, Store, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MarketNet — Votre boutique en ligne, commandes sur WhatsApp" },
      { name: "description", content: "Créez gratuitement votre boutique en ligne en 5 minutes et recevez vos commandes directement sur WhatsApp. Pour les commerçants de RDC et d'Afrique francophone." },
      { property: "og:title", content: "MarketNet — Votre boutique en ligne, commandes sur WhatsApp" },
      { property: "og:description", content: "Boutique en ligne gratuite, commandes sur WhatsApp. Pensé pour le mobile." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const FEATURES = [
  { icon: Zap, title: "Prête en 5 minutes", text: "Nom, logo, numéro WhatsApp : votre boutique est en ligne." },
  { icon: MessageCircle, title: "Commandes sur WhatsApp", text: "Le client remplit son panier, vous recevez la commande détaillée." },
  { icon: Palette, title: "À votre image", text: "6 thèmes, vos couleurs, votre bannière et vos catégories." },
  { icon: Smartphone, title: "Pensé pour le mobile", text: "Léger et rapide, même avec une connexion lente." },
];

function Index() {
  const { data: plans } = useQuery({
    queryKey: ["plans-public"],
    queryFn: async () => (await supabase.from("plans").select("*").eq("active", true).order("position")).data ?? [],
  });
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Logo />
        <div className="flex gap-2">
          <Button variant="ghost" asChild><Link to="/auth" search={{ mode: "login" }}>Connexion</Link></Button>
          <Button asChild className="hidden sm:inline-flex"><Link to="/auth" search={{ mode: "signup" }}>Créer ma boutique</Link></Button>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-10 text-center sm:pt-20">
        <span className="inline-block rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">Pour les commerçants de RDC et d'Afrique francophone</span>
        <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-extrabold leading-tight sm:text-6xl">
          Votre boutique en ligne. <span className="text-primary">Vos commandes sur WhatsApp.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">Publiez vos produits, partagez votre lien et vendez plus — sans site compliqué ni commission.</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button size="lg" asChild className="shadow-lift"><Link to="/auth" search={{ mode: "signup" }}><Store />Créer ma boutique gratuite</Link></Button>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">Gratuit, sans carte bancaire.</p>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-16 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-2xl border bg-card p-5">
            <f.icon className="h-6 w-6 text-primary" />
            <h3 className="mt-3 text-lg font-bold">{f.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <h2 className="text-center text-3xl font-extrabold">Comment ça marche</h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-3">
          {["Créez votre boutique et ajoutez vos produits", "Partagez votre lien sur WhatsApp, Facebook, TikTok", "Recevez les commandes directement sur WhatsApp"].map((s, i) => (
            <li key={s} className="rounded-2xl bg-secondary p-5">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-warm font-bold text-primary-foreground">{i + 1}</span>
              <p className="mt-3 font-semibold">{s}</p>
            </li>
          ))}
        </ol>
      </section>

      {!!plans?.length && (
        <section className="mx-auto max-w-6xl px-4 pb-20">
          <h2 className="text-center text-3xl font-extrabold">Des tarifs simples</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {plans.map((p) => (
              <div key={p.id} className={`rounded-2xl border bg-card p-6 ${p.id === "pro" ? "border-primary shadow-lift" : ""}`}>
                <h3 className="text-xl font-bold">{p.name}</h3>
                <p className="mt-2 font-display text-4xl font-extrabold">{Number(p.price_usd) === 0 ? "Gratuit" : `${p.price_usd} $`}<span className="text-base font-normal text-muted-foreground">{Number(p.price_usd) ? " /mois" : ""}</span></p>
                <ul className="mt-4 space-y-2 text-sm">
                  <li className="flex gap-2"><Check className="h-4 w-4 text-primary" />{p.max_products ? `${p.max_products} produits` : "Produits illimités"}</li>
                  <li className="flex gap-2"><Check className="h-4 w-4 text-primary" />{p.max_photos} photos par produit</li>
                  {p.advanced_themes && <li className="flex gap-2"><Check className="h-4 w-4 text-primary" />Thèmes avancés</li>}
                  {p.advanced_stats && <li className="flex gap-2"><Check className="h-4 w-4 text-primary" />Statistiques avancées</li>}
                  {p.meta_access && <li className="flex gap-2"><Check className="h-4 w-4 text-primary" />Publication Facebook & Instagram</li>}
                </ul>
                <Button asChild className="mt-6 w-full" variant={p.id === "pro" ? "default" : "outline"}><Link to="/auth" search={{ mode: "signup" }}>Commencer</Link></Button>
              </div>
            ))}
          </div>
        </section>
      )}

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">© {new Date().getFullYear()} MarketNet</footer>
    </div>
  );
}
