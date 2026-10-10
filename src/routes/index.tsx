import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, MessageCircle, Palette, Smartphone, Store, Zap, ArrowRight, TrendingUp, Users, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEffect, useState, useRef } from "react";

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
  { icon: Zap, title: "Prête en 5 minutes", text: "Nom, logo, numéro WhatsApp : votre boutique est en ligne sans attendre." },
  { icon: MessageCircle, title: "Commandes sur WhatsApp", text: "Le client remplit son panier, vous recevez la commande détaillée." },
  { icon: Palette, title: "À votre image", text: "Personnalisez vos couleurs, votre bannière et vos catégories." },
  { icon: Smartphone, title: "Pensé pour le mobile", text: "Léger et rapide, optimisé pour les connexions mobiles africaines." },
];

const STEPS = [
  { title: "Créez votre boutique", desc: "Ajoutez vos produits, vos prix et vos photos depuis votre téléphone." },
  { title: "Partagez votre lien", desc: "Mettez le lien sur WhatsApp, Facebook, TikTok ou Instagram." },
  { title: "Recevez les commandes", desc: "Discutez directement avec vos clients sur WhatsApp pour conclure la vente." },
];

function FadeIn({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={cn("animate-in fade-in slide-in-from-bottom-6 duration-1000 fill-mode-both", className)}>
      {children}
    </div>
  );
}

function CountUp({ end, suffix = "", prefix = "", duration = 2000 }: { end: number, suffix?: string, prefix?: string, duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let startTimestamp: number | null = null;
    let animationFrame: number;
    let observer: IntersectionObserver;

    const startAnimation = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setCount(Math.floor(easeProgress * end));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(startAnimation);
      }
    };

    if (ref.current) {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            animationFrame = requestAnimationFrame(startAnimation);
            observer.disconnect();
          }
        },
        { threshold: 0.1 }
      );
      observer.observe(ref.current);
    }

    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      if (observer) observer.disconnect();
    };
  }, [end, duration]);

  return <span ref={ref}>{prefix}{count}{suffix}</span>;
}

function Index() {
  const { data: plans } = useQuery({
    queryKey: ["plans-public"],
    queryFn: async () => {
      const { data } = await supabase.from("plans").select("*").eq("active", true).order("position");
      if (data && data.length > 0) return data;
      
      // Fallback data if table is empty or not configured yet
      return [
        {
          id: "free",
          name: "Gratuit",
          price_usd: 0,
          max_products: 50,
          max_photos: 3,
          advanced_themes: false,
          advanced_stats: false,
          meta_access: false,
          active: true,
          position: 1
        },
        {
          id: "pro",
          name: "Premium",
          price_usd: 5,
          max_products: null, // unlimited
          max_photos: 10,
          advanced_themes: true,
          advanced_stats: true,
          meta_access: true,
          active: true,
          position: 2
        }
      ];
    },
  });

  return (
    <div className="min-h-screen bg-background overflow-hidden selection:bg-primary/20">
      
      {/* ── HEADER ── */}
      <header className="fixed top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Logo />
          <div className="flex items-center gap-3">
            <Button variant="ghost" className="hidden text-muted-foreground hover:text-foreground sm:inline-flex" asChild>
              <Link to="/auth" search={{ mode: "login" }}>Connexion</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* ── HERO SECTION ── */}
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-32">
        {/* Background decorations */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-[10%] left-[20%] h-[500px] w-[500px] rounded-full bg-primary/5 blur-[120px]" />
          <div className="absolute right-[10%] top-[30%] h-[400px] w-[400px] rounded-full bg-blue-500/5 blur-[100px]" />
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div className="text-center lg:text-left">
              <FadeIn className="delay-0">
                <span className="inline-flex items-center gap-2 rounded-full border bg-secondary/50 px-4 py-1.5 text-sm font-semibold text-secondary-foreground backdrop-blur-sm">
                  <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span><span className="relative inline-flex h-2 w-2 rounded-full bg-primary"></span></span>
                  Pour l'Afrique francophone
                </span>
              </FadeIn>
              
              <FadeIn className="delay-100">
                <h1 className="mt-8 text-5xl font-extrabold tracking-tight text-foreground sm:text-7xl">
                  Votre boutique en ligne. <br className="hidden sm:block" />
                  <span className="bg-gradient-to-r from-primary to-blue-500 bg-clip-text text-transparent">Commandes WhatsApp.</span>
                </h1>
              </FadeIn>

              <FadeIn className="delay-200">
                <p className="mt-6 text-lg leading-relaxed text-muted-foreground sm:text-xl lg:max-w-xl">
                  Arrêtez de perdre des ventes en message privé. Offrez à vos clients un catalogue clair, un panier simple et recevez des commandes parfaitement structurées.
                </p>
              </FadeIn>

              <FadeIn className="mt-10 flex flex-col items-center gap-4 sm:flex-row lg:justify-start delay-300">
                <Button size="lg" className="h-14 w-full rounded-full px-8 text-lg font-bold shadow-xl transition-all hover:scale-105 active:scale-95 sm:w-auto" asChild>
                  <Link to="/auth" search={{ mode: "signup" }}>
                    <Store className="mr-2 h-5 w-5" />
                    Lancer ma boutique
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="h-14 w-full rounded-full px-8 text-lg font-bold transition-all hover:bg-secondary active:scale-95 sm:w-auto" asChild>
                  <Link to="/auth" search={{ mode: "login" }}>Se connecter</Link>
                </Button>
              </FadeIn>
              
              <FadeIn className="mt-8 flex items-center justify-center gap-6 text-sm text-muted-foreground lg:justify-start delay-500">
                <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-primary" /> Sans carte bancaire</span>
                <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-primary" /> Prêt en 5 min</span>
              </FadeIn>
            </div>

            <FadeIn className="delay-500 relative mx-auto w-full max-w-[280px] sm:max-w-lg lg:max-w-none">
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[2rem] border bg-background shadow-2xl lg:aspect-square animate-in slide-in-from-bottom-2 duration-[3000ms] direction-alternate repeat-infinite ease-in-out">
                <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-transparent" />
                <img 
                  src="/hero-mockup.jpg" 
                  alt="MarketNet Interface" 
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-1000 hover:scale-105" 
                />
              </div>
              {/* Decorative floating elements */}
              <div className="absolute -left-4 top-1/4 sm:-left-6 rounded-full bg-white p-2.5 sm:p-3 shadow-xl dark:bg-zinc-800 animate-[bounce_3s_infinite]">
                <MessageCircle className="h-6 w-6 sm:h-8 sm:w-8 text-green-500" />
              </div>
              <div className="absolute -right-4 bottom-1/4 sm:-right-6 rounded-full bg-white p-2.5 sm:p-3 shadow-xl dark:bg-zinc-800 animate-[bounce_3.5s_infinite]">
                <Store className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── STATS DIVIDER ── */}
      <section className="border-y bg-card/50 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 text-center md:grid-cols-4">
            <div className="animate-in fade-in zoom-in duration-1000 delay-100 fill-mode-both">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary mb-3"><Users className="h-6 w-6" /></div>
              <h4 className="text-3xl font-extrabold text-foreground"><CountUp end={500} suffix="+" /></h4>
              <p className="mt-1 text-sm font-medium text-muted-foreground">Vendeurs actifs</p>
            </div>
            <div className="animate-in fade-in zoom-in duration-1000 delay-200 fill-mode-both">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-blue-500/10 text-blue-500 mb-3"><TrendingUp className="h-6 w-6" /></div>
              <h4 className="text-3xl font-extrabold text-foreground"><CountUp end={3} prefix="x" /></h4>
              <p className="mt-1 text-sm font-medium text-muted-foreground">Hausse des ventes</p>
            </div>
            <div className="animate-in fade-in zoom-in duration-1000 delay-300 fill-mode-both">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-green-500/10 text-green-500 mb-3"><MessageCircle className="h-6 w-6" /></div>
              <h4 className="text-3xl font-extrabold text-foreground"><CountUp end={10} suffix="k+" /></h4>
              <p className="mt-1 text-sm font-medium text-muted-foreground">Commandes WhatsApp</p>
            </div>
            <div className="animate-in fade-in zoom-in duration-1000 delay-500 fill-mode-both">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-orange-500/10 text-orange-500 mb-3"><Zap className="h-6 w-6" /></div>
              <h4 className="text-3xl font-extrabold text-foreground"><CountUp end={99} suffix="%" /></h4>
              <p className="mt-1 text-sm font-medium text-muted-foreground">Disponibilité</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES GRID ── */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center animate-in fade-in slide-in-from-bottom-8 duration-1000 fill-mode-both">
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">Tout ce dont vous avez besoin</h2>
            <p className="mt-4 text-lg text-muted-foreground">MarketNet a été pensé spécifiquement pour les réalités du commerce en Afrique.</p>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f, i) => (
              <div key={f.title} className={cn("animate-in fade-in slide-in-from-bottom-8 duration-1000 fill-mode-both", `delay-${(i+1)*100}`)}>
                <div className="group relative h-full overflow-hidden rounded-3xl border bg-card p-8 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1">
                  <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-primary/5 transition-transform group-hover:scale-150" />
                  <f.icon className="h-8 w-8 text-primary" />
                  <h3 className="mt-6 text-xl font-bold">{f.title}</h3>
                  <p className="mt-3 text-muted-foreground leading-relaxed">{f.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="bg-secondary/30 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center animate-in fade-in duration-1000 fill-mode-both">
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">Comment ça marche ?</h2>
            <p className="mt-4 text-lg text-muted-foreground">Trois étapes simples pour transformer vos abonnés en clients.</p>
          </div>

          <div className="mt-16 grid gap-8 lg:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.title} className={cn("animate-in fade-in slide-in-from-left-4 duration-1000 fill-mode-both", `delay-${(i+1)*150}`)}>
                <div className="relative h-full rounded-3xl bg-card p-8 shadow-sm transition-transform hover:-translate-y-1">
                  <div className="flex items-center gap-4 mb-6">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-xl font-bold text-primary-foreground shadow-lg shadow-primary/30">
                      {i + 1}
                    </span>
                    <h3 className="text-xl font-bold">{s.title}</h3>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">{s.desc}</p>
                  {i < STEPS.length - 1 && (
                    <ArrowRight className="hidden lg:block absolute -right-6 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground/30" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      {!!plans?.length && (
        <section className="py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center animate-in fade-in slide-in-from-bottom-8 duration-1000 fill-mode-both">
              <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">Des tarifs transparents</h2>
              <p className="mt-4 text-lg text-muted-foreground">Commencez gratuitement, passez à la vitesse supérieure quand vous êtes prêt.</p>
            </div>

            <div className="mt-16 grid gap-8 md:grid-cols-3 lg:gap-12">
              {plans.map((p, i) => (
                <div key={p.id} className={cn("animate-in fade-in slide-in-from-bottom-12 duration-1000 fill-mode-both", `delay-${(i+1)*100}`)}>
                  <div className={cn(
                    "relative flex h-full flex-col rounded-3xl border bg-card p-8",
                    p.id === "pro" ? "border-primary/50 shadow-2xl shadow-primary/10" : "shadow-sm hover:shadow-md transition-shadow"
                  )}>
                    {p.id === "pro" && (
                      <span className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-sm font-bold tracking-wide text-primary-foreground shadow-sm">
                        RECOMMANDÉ
                      </span>
                    )}
                    
                    <h3 className="text-2xl font-bold">{p.name}</h3>
                    <p className="mt-4 font-display text-5xl font-extrabold">
                      {Number(p.price_usd) === 0 ? "Gratuit" : `${p.price_usd} $`}
                      <span className="text-lg font-normal text-muted-foreground">{Number(p.price_usd) ? " /mois" : ""}</span>
                    </p>
                    
                    <ul className="mt-8 flex-1 space-y-4">
                      <li className="flex items-center gap-3">
                        <div className="rounded-full bg-primary/10 p-1"><Check className="h-4 w-4 text-primary" /></div>
                        <span className="font-medium">{p.max_products ? `${p.max_products} produits` : "Produits illimités"}</span>
                      </li>
                      <li className="flex items-center gap-3">
                        <div className="rounded-full bg-primary/10 p-1"><Check className="h-4 w-4 text-primary" /></div>
                        <span className="text-muted-foreground">{p.max_photos} photos par produit</span>
                      </li>
                      {p.advanced_themes && (
                        <li className="flex items-center gap-3">
                          <div className="rounded-full bg-primary/10 p-1"><Check className="h-4 w-4 text-primary" /></div>
                          <span className="text-muted-foreground">Thèmes avancés</span>
                        </li>
                      )}
                      {p.advanced_stats && (
                        <li className="flex items-center gap-3">
                          <div className="rounded-full bg-primary/10 p-1"><Check className="h-4 w-4 text-primary" /></div>
                          <span className="text-muted-foreground">Statistiques avancées</span>
                        </li>
                      )}
                      {p.meta_access && (
                        <li className="flex items-center gap-3">
                          <div className="rounded-full bg-primary/10 p-1"><Check className="h-4 w-4 text-primary" /></div>
                          <span className="text-muted-foreground">Intégration Facebook & IG</span>
                        </li>
                      )}
                    </ul>
                    
                    <Button 
                      asChild 
                      className="mt-8 w-full rounded-full h-12 text-base font-bold" 
                      variant={p.id === "pro" ? "default" : "outline"}
                    >
                      <Link to="/auth" search={{ mode: "signup" }}>{p.id === "pro" ? "Devenir Pro" : "Commencer"}</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA BOTTOM ── */}
      <section className="relative overflow-hidden bg-primary py-24 text-primary-foreground">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8 relative z-10 animate-in fade-in zoom-in duration-1000 fill-mode-both">
          <h2 className="text-4xl font-extrabold sm:text-5xl">Prêt à digitaliser vos ventes ?</h2>
          <p className="mt-6 text-xl text-primary-foreground/80">Rejoignez des centaines de commerçants qui ont déjà transformé leur business sur WhatsApp.</p>
          <Button size="lg" variant="secondary" className="mt-10 h-14 rounded-full px-10 text-lg font-bold shadow-2xl transition-transform hover:scale-105 active:scale-95" asChild>
            <Link to="/auth" search={{ mode: "signup" }}>Créer ma boutique maintenant</Link>
          </Button>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t bg-card py-12">
        <div className="mx-auto max-w-7xl px-4 flex flex-col items-center justify-between gap-6 sm:flex-row sm:px-6 lg:px-8">
          <Logo />
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} MarketNet. Tous droits réservés.</p>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <Link to="/terms" className="hover:text-foreground transition-colors">CGU & Confidentialité</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
