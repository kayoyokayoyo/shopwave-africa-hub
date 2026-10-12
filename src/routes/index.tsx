import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Check, MessageCircle, Palette, Smartphone, Store, Zap, ArrowRight,
  TrendingUp, Users, ShieldCheck, Menu, X, Sparkles, Layers, DollarSign,
  LogIn, Tag, Megaphone, BarChart3, Globe2, BadgePercent, Star, Clock,
  Facebook, Instagram, Share2, Gift, Rocket,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEffect, useState, useRef } from "react";

export const Route = createFileRoute("/")(({
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
} as any));

const FEATURES = [
  { icon: Zap, color: "text-amber-500", bg: "bg-amber-500/10", title: "Prête en 5 minutes", text: "Nom, logo, numéro WhatsApp : votre boutique est en ligne sans attendre." },
  { icon: MessageCircle, color: "text-green-500", bg: "bg-green-500/10", title: "Commandes WhatsApp", text: "Le client remplit son panier, vous recevez la commande détaillée directement." },
  { icon: Palette, color: "text-purple-500", bg: "bg-purple-500/10", title: "À votre image", text: "Personnalisez couleurs, bannière, thème et catégories en quelques clics." },
  { icon: Smartphone, color: "text-blue-500", bg: "bg-blue-500/10", title: "Pensé pour le mobile", text: "Léger et rapide, optimisé pour les connexions mobiles africaines." },
  { icon: BarChart3, color: "text-primary", bg: "bg-primary/10", title: "Statistiques en direct", text: "Suivez vos ventes, produits populaires et commandes en temps réel." },
  { icon: ShieldCheck, color: "text-emerald-500", bg: "bg-emerald-500/10", title: "Sécurisé & fiable", text: "Données hébergées sur infrastructure sécurisée, disponible 99% du temps." },
  { icon: Globe2, color: "text-cyan-500", bg: "bg-cyan-500/10", title: "Lien partageable", text: "Un lien unique que vous pouvez partager partout : WhatsApp, TikTok, Facebook." },
  { icon: Tag, color: "text-rose-500", bg: "bg-rose-500/10", title: "Gestion des stocks", text: "Ajoutez, modifiez ou retirez des produits à tout moment depuis votre téléphone." },
];

const STEPS = [
  { icon: Store, title: "Créez votre boutique", desc: "Ajoutez vos produits, vos prix et vos photos depuis votre téléphone en moins de 5 minutes." },
  { icon: Share2, title: "Partagez votre lien", desc: "Mettez le lien sur WhatsApp, Facebook, TikTok ou Instagram. Vos abonnés deviennent des clients." },
  { icon: MessageCircle, title: "Recevez les commandes", desc: "Discutez directement avec vos clients sur WhatsApp pour conclure la vente et organiser la livraison." },
];

const PROMO_FEATURES = [
  { icon: BadgePercent, title: "Réductions en %", desc: "Définissez un pourcentage de réduction sur n'importe quel produit ou catégorie." },
  { icon: Clock, title: "Promotions temporaires", desc: "Activez des offres avec une date de début et de fin. Elles s'arrêtent automatiquement." },
  { icon: Gift, title: "Codes promo", desc: "Créez des codes que vos clients saisissent au moment de commander." },
  { icon: Star, title: "Mise en avant", desc: "Les produits en promotion s'affichent en premier dans votre boutique avec un badge visible." },
];

const META_FEATURES = [
  { icon: Facebook, color: "text-[#1877F2]", title: "Facebook Catalog", desc: "Synchronisez automatiquement vos produits avec votre catalogue Facebook pour vendre directement sur Marketplace." },
  { icon: Instagram, color: "text-[#E1306C]", title: "Instagram Shopping", desc: "Taguez vos produits dans vos posts Instagram. Vos abonnés achètent sans quitter l'application." },
  { icon: Share2, color: "text-primary", title: "Partage multi-plateformes", desc: "Partagez votre catalogue directement sur vos pages Facebook et Instagram en quelques secondes." },
  { icon: BarChart3, color: "text-cyan-500", title: "Suivi des performances", desc: "Visualisez combien de visiteurs viennent de Facebook ou Instagram dans vos statistiques." },
];

function ScrollReveal({
  children,
  className,
  delay = 0,
  direction = "up",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "down" | "left" | "right" | "none";
}) {
  const [isVisible, setIsVisible] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    // Si l'élément est plus bas que l'écran initial, on applique l'apparition au scroll
    if (rect.top > window.innerHeight) {
      setIsVisible(false);
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        },
        { threshold: 0.05, rootMargin: "0px 0px 50px 0px" }
      );
      observer.observe(el);
      return () => observer.disconnect();
    }
  }, []);

  const getOffset = () => {
    switch (direction) {
      case "up": return "translate-y-5";
      case "down": return "-translate-y-5";
      case "left": return "-translate-x-5";
      case "right": return "translate-x-5";
      case "none": return "scale-98";
    }
  };

  return (
    <div
      ref={ref}
      style={{
        transitionDelay: isVisible ? `${delay}ms` : "0ms",
        transitionDuration: "500ms",
      }}
      className={cn(
        "transition-all ease-out",
        isVisible
          ? "opacity-100 translate-x-0 translate-y-0 scale-100"
          : cn("opacity-0", getOffset()),
        className
      )}
    >
      {children}
    </div>
  );
}

const FadeIn = ScrollReveal;

function CountUp({ end, suffix = "", prefix = "", duration = 2000 }: { end: number; suffix?: string; prefix?: string; duration?: number }) {
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
      if (progress < 1) animationFrame = requestAnimationFrame(startAnimation);
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

function SectionBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-4 py-1.5 text-sm font-semibold text-primary backdrop-blur-sm mb-4">
      {children}
    </span>
  );
}

function Index() {
  const { data: plans } = useQuery({
    queryKey: ["plans-public"],
    queryFn: async () => {
      const { data } = await supabase.from("plans").select("*").eq("active", true).order("position");
      // Seulement les vrais plans de la base de données
      return data && data.length > 0 ? data : null;
    },
  });

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background overflow-hidden selection:bg-primary/20">

      {/* ── HEADER ── */}
      <header className="fixed top-0 z-50 w-full border-b bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-6 lg:px-8" style={{ justifyContent: "space-between" }}>

          {/* Logo — toujours à gauche, jamais centré */}
          <div className="flex-shrink-0">
            <Link
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 font-extrabold tracking-tight text-foreground text-xl"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-black text-lg shadow-md shadow-primary/30">
                M
              </span>
              Market<span className="text-primary">Net</span>
            </Link>
          </div>

          {/* Desktop nav — centre */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features" className="transition-colors hover:text-foreground">Fonctionnalités</a>
            <a href="#promotions" className="transition-colors hover:text-foreground">Promotions</a>
            <a href="#meta" className="transition-colors hover:text-foreground">Meta / Réseaux</a>
            <a href="#how-it-works" className="transition-colors hover:text-foreground">Comment ça marche</a>
            <a href="#pricing" className="transition-colors hover:text-foreground">Tarifs</a>
          </nav>

          {/* Desktop CTA — droite */}
          <div className="hidden sm:flex items-center gap-3 flex-shrink-0">
            <Button variant="ghost" className="text-muted-foreground hover:text-foreground rounded-full text-sm font-semibold" asChild>
              <Link to="/auth" search={{ mode: "login" }}>Connexion</Link>
            </Button>
            <Button size="sm" className="rounded-full px-5 font-bold shadow-md hover:scale-105 active:scale-95 transition-transform" asChild>
              <Link to="/auth" search={{ mode: "signup" }}>Créer ma boutique</Link>
            </Button>
          </div>

          {/* Mobile burger */}
          <div className="flex items-center sm:hidden flex-shrink-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="grid h-10 w-10 place-items-center rounded-xl border bg-card text-foreground transition-colors hover:bg-muted"
              aria-label={mobileMenuOpen ? "Fermer le menu" : "Ouvrir le menu"}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-b bg-background/98 backdrop-blur-lg px-4 pt-2 pb-6 space-y-1 shadow-xl animate-in slide-in-from-top-4 duration-200">
            <nav className="flex flex-col space-y-1 pt-2">
              {[
                { href: "#features", icon: Sparkles, label: "Fonctionnalités", color: "text-primary" },
                { href: "#promotions", icon: BadgePercent, label: "Promotions", color: "text-rose-500" },
                { href: "#meta", icon: Facebook, label: "Meta / Réseaux", color: "text-[#1877F2]" },
                { href: "#how-it-works", icon: Layers, label: "Comment ça marche", color: "text-blue-500" },
                { href: "#pricing", icon: DollarSign, label: "Tarifs", color: "text-emerald-500" },
              ].map(({ href, icon: Icon, label, color }) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm text-foreground hover:bg-muted transition-colors"
                >
                  <Icon className={cn("h-4 w-4 shrink-0", color)} />
                  {label}
                </a>
              ))}
            </nav>
            <div className="pt-3 border-t space-y-2">
              <Button variant="outline" size="lg" className="w-full rounded-xl font-bold h-11 justify-center text-sm" asChild>
                <Link to="/auth" search={{ mode: "login" }} onClick={() => setMobileMenuOpen(false)}>
                  <LogIn className="h-4 w-4 mr-2" /> Connexion
                </Link>
              </Button>
              <Button size="lg" className="w-full rounded-xl font-bold h-11 justify-center text-sm" asChild>
                <Link to="/auth" search={{ mode: "signup" }} onClick={() => setMobileMenuOpen(false)}>
                  <Store className="h-4 w-4 mr-2" /> Créer ma boutique
                </Link>
              </Button>
            </div>
          </div>
        )}
      </header>

      {/* ── HERO ── */}
      <section className="relative pt-32 pb-20 lg:pt-44 lg:pb-32">
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-[10%] left-[20%] h-[500px] w-[500px] rounded-full bg-primary/6 blur-[120px]" />
          <div className="absolute right-[10%] top-[30%] h-[400px] w-[400px] rounded-full bg-blue-500/5 blur-[100px]" />
          <div className="absolute left-[5%] bottom-[10%] h-[300px] w-[300px] rounded-full bg-rose-500/4 blur-[100px]" />
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div className="text-center lg:text-left">
              <FadeIn className="delay-0">
                <span className="inline-flex items-center gap-2 rounded-full border bg-secondary/50 px-4 py-1.5 text-sm font-semibold text-secondary-foreground backdrop-blur-sm">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                  </span>
                  Pour l'Afrique francophone
                </span>
              </FadeIn>

              <FadeIn className="delay-100">
                <h1 className="mt-8 text-5xl font-extrabold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
                  Votre boutique en ligne.{" "}
                  <br className="hidden sm:block" />
                  <span className="bg-gradient-to-r from-primary to-blue-500 bg-clip-text text-transparent">
                    Commandes WhatsApp.
                  </span>
                </h1>
              </FadeIn>

              <FadeIn className="delay-200">
                <p className="mt-6 text-lg leading-relaxed text-muted-foreground sm:text-xl lg:max-w-xl">
                  Arrêtez de perdre des ventes en message privé. Offrez à vos clients un catalogue clair, des promotions attractives et recevez des commandes parfaitement structurées.
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
                <span className="flex items-center gap-1.5"><Megaphone className="h-4 w-4 text-primary" /> Promos incluses</span>
              </FadeIn>
            </div>

            <FadeIn className="delay-500 relative mx-auto w-full max-w-[300px] sm:max-w-sm lg:max-w-xs xl:max-w-sm">
              {/* Phone mockup */}
              <div className="relative rounded-[2.5rem] border-4 border-foreground/10 bg-background shadow-2xl overflow-hidden">
                {/* Status bar */}
                <div className="bg-muted/60 px-6 pt-3 pb-2 flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-muted-foreground">9:41</span>
                  <div className="flex items-center gap-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
                    <div className="h-1.5 w-3 rounded-full bg-muted-foreground/60" />
                    <div className="h-1.5 w-4 rounded-full bg-foreground/80" />
                  </div>
                </div>
                {/* App bar */}
                <div className="bg-primary px-4 py-3 flex items-center gap-3">
                  <div className="h-8 w-8 rounded-xl bg-white/20 flex items-center justify-center font-black text-white text-sm">M</div>
                  <div>
                    <p className="text-white font-bold text-xs">MarketNet</p>
                    <p className="text-white/60 text-[10px]">Boutique Awa Mode</p>
                  </div>
                  <div className="ml-auto h-6 w-6 rounded-full bg-white/10 flex items-center justify-center">
                    <MessageCircle className="h-3 w-3 text-white" />
                  </div>
                </div>
                {/* Products */}
                <div className="p-3 space-y-2 bg-background">
                  {[
                    { name: "Robe Wax Ankara", price: "25 000 FC", badge: "-20%", color: "from-amber-400/30 to-orange-300/30" },
                    { name: "Sac Cuir Premium", price: "45 000 FC", badge: null, color: "from-purple-400/30 to-pink-300/30" },
                    { name: "Sandales Été", price: "18 000 FC", badge: "-10%", color: "from-teal-400/30 to-cyan-300/30" },
                  ].map((item) => (
                    <div key={item.name} className="flex items-center gap-2.5 rounded-xl border bg-card p-2.5 shadow-sm">
                      <div className={cn("h-11 w-11 rounded-xl bg-gradient-to-br shrink-0", item.color)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-semibold truncate">{item.name}</p>
                          {item.badge && (
                            <span className="shrink-0 rounded-full bg-rose-500 px-1.5 py-px text-[9px] font-black text-white">{item.badge}</span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{item.price}</p>
                      </div>
                      <div className="h-7 w-7 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                        <MessageCircle className="h-3.5 w-3.5 text-white" />
                      </div>
                    </div>
                  ))}
                </div>
                {/* Bottom bar */}
                <div className="bg-muted/40 px-4 py-2.5 flex items-center justify-center gap-1">
                  <span className="text-[10px] text-muted-foreground font-medium">Boutique propulsée par</span>
                  <span className="text-[10px] font-black text-primary">MarketNet</span>
                </div>
              </div>
              {/* Floating badges */}
              <div className="absolute -left-5 top-1/4 rounded-2xl bg-white dark:bg-zinc-800 border px-3 py-2 shadow-xl flex items-center gap-2 animate-[bounce_3s_infinite]">
                <MessageCircle className="h-4 w-4 text-green-500" />
                <span className="text-xs font-bold">Commande reçue !</span>
              </div>
              <div className="absolute -right-5 bottom-1/4 rounded-2xl bg-white dark:bg-zinc-800 border px-3 py-2 shadow-xl flex items-center gap-2 animate-[bounce_3.5s_infinite]">
                <BadgePercent className="h-4 w-4 text-rose-500" />
                <span className="text-xs font-bold">Promo active</span>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="border-y bg-card/50 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 text-center md:grid-cols-4">
            {[
              { icon: Users, color: "text-primary bg-primary/10", end: 500, suffix: "+", label: "Vendeurs actifs" },
              { icon: TrendingUp, color: "text-blue-500 bg-blue-500/10", end: 3, prefix: "x", label: "Hausse des ventes" },
              { icon: MessageCircle, color: "text-green-500 bg-green-500/10", end: 10, suffix: "k+", label: "Commandes WhatsApp" },
              { icon: Zap, color: "text-amber-500 bg-amber-500/10", end: 99, suffix: "%", label: "Disponibilité" },
            ].map(({ icon: Icon, color, end, suffix, prefix, label }, i) => (
              <ScrollReveal key={label} delay={i * 80} direction="up">
                <div className={cn("mx-auto grid h-12 w-12 place-items-center rounded-2xl mb-3", color)}>
                  <Icon className="h-6 w-6" />
                </div>
                <h4 className="text-3xl font-extrabold text-foreground">
                  <CountUp end={end} suffix={suffix} prefix={prefix} />
                </h4>
                <p className="mt-1 text-sm font-medium text-muted-foreground">{label}</p>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="py-24 scroll-mt-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center" direction="up">
            <SectionBadge><Sparkles className="h-3.5 w-3.5" /> Fonctionnalités</SectionBadge>
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">Tout ce dont vous avez besoin</h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              MarketNet a été pensé spécifiquement pour les réalités du commerce en Afrique francophone.
            </p>
          </ScrollReveal>

          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f, i) => (
              <ScrollReveal key={f.title} delay={i * 60} direction="up">
                <div className="group relative h-full overflow-hidden rounded-3xl border bg-card p-7 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1.5 hover:border-primary/20">
                  <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-primary/4 transition-transform group-hover:scale-[2]" />
                  <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl mb-5", f.bg)}>
                    <f.icon className={cn("h-5 w-5", f.color)} />
                  </div>
                  <h3 className="text-base font-bold">{f.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.text}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── PROMOTIONS ── */}
      <section id="promotions" className="py-24 scroll-mt-20 bg-gradient-to-b from-rose-500/4 to-transparent">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
            {/* Left text */}
            <ScrollReveal direction="left">
              <SectionBadge><BadgePercent className="h-3.5 w-3.5 text-rose-500" /> Promotions</SectionBadge>
              <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                Boostez vos ventes avec des{" "}
                <span className="text-rose-500">promotions puissantes</span>
              </h2>
              <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
                Créez des offres limitées dans le temps, des réductions par catégorie, et attirez plus de clients. Vos promotions s'affichent automatiquement sur votre boutique avec des badges accrocheurs.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {PROMO_FEATURES.map((pf, i) => (
                  <ScrollReveal key={pf.title} delay={i * 80} direction="up">
                    <div className="flex items-start gap-3 rounded-2xl border bg-card p-4 shadow-sm h-full">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/10">
                        <pf.icon className="h-4 w-4 text-rose-500" />
                      </div>
                      <div>
                        <p className="text-sm font-bold">{pf.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{pf.desc}</p>
                      </div>
                    </div>
                  </ScrollReveal>
                ))}
              </div>

              <div className="mt-8">
                <Button size="lg" className="rounded-full px-7 font-bold" asChild>
                  <Link to="/auth" search={{ mode: "signup" }}>
                    <Rocket className="mr-2 h-4 w-4" /> Créer ma première promotion
                  </Link>
                </Button>
              </div>
            </ScrollReveal>

            {/* Right visual */}
            <ScrollReveal direction="right" delay={150}>
              <div className="relative mx-auto max-w-sm">
                <div className="rounded-3xl border bg-card shadow-2xl overflow-hidden">
                  {/* Mock store header */}
                  <div className="bg-gradient-to-r from-rose-500 to-orange-500 p-4 text-white">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center font-black text-lg">B</div>
                      <div>
                        <p className="font-bold text-sm">Boutique Exemple</p>
                        <p className="text-xs text-white/70">Promotions en cours</p>
                      </div>
                    </div>
                  </div>
                  {/* Mock products */}
                  <div className="p-4 space-y-3">
                    {[
                      { name: "Robe d'été", price: "25 000 FC", promo: "-30%", newPrice: "17 500 FC" },
                      { name: "Sac à main", price: "45 000 FC", promo: "-20%", newPrice: "36 000 FC" },
                      { name: "Chaussures", price: "60 000 FC", promo: null, newPrice: null },
                    ].map((product) => (
                      <div key={product.name} className="flex items-center gap-3 rounded-xl border bg-background p-3">
                        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/20 to-blue-500/20 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold truncate">{product.name}</p>
                            {product.promo && (
                              <span className="shrink-0 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-black text-white">{product.promo}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {product.promo ? (
                              <>
                                <span className="text-xs text-muted-foreground line-through">{product.price}</span>
                                <span className="text-xs font-bold text-rose-500">{product.newPrice}</span>
                              </>
                            ) : (
                              <span className="text-xs font-medium text-foreground">{product.price}</span>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0 h-7 w-7 rounded-full bg-green-500 flex items-center justify-center">
                          <MessageCircle className="h-3.5 w-3.5 text-white" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Floating badge */}
                <div className="absolute -top-4 -right-4 rounded-2xl bg-rose-500 px-4 py-2 text-white font-black text-lg shadow-xl shadow-rose-500/30 animate-[bounce_2.5s_infinite]">
                  -30%
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── META / RÉSEAUX SOCIAUX ── */}
      <section id="meta" className="py-24 scroll-mt-20 bg-gradient-to-b from-[#1877F2]/4 to-transparent">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
            {/* Left visual */}
            <ScrollReveal direction="left" delay={120} className="order-2 lg:order-1">
              <div className="relative mx-auto max-w-sm">
                <div className="rounded-3xl border bg-card shadow-2xl p-6 space-y-4">
                  <div className="flex items-center gap-3 pb-3 border-b">
                    <div className="h-10 w-10 rounded-xl bg-[#1877F2]/10 flex items-center justify-center">
                      <Facebook className="h-5 w-5 text-[#1877F2]" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">Catalogue Facebook</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-xs text-green-600 font-medium">Synchronisé</span>
                      </div>
                    </div>
                    <div className="ml-auto text-xs text-muted-foreground bg-muted rounded-full px-2.5 py-1">48 produits</div>
                  </div>

                  {/* Sync stats */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Publiés", val: "48", color: "text-green-500" },
                      { label: "En attente", val: "3", color: "text-amber-500" },
                      { label: "Erreurs", val: "0", color: "text-muted-foreground" },
                    ].map(({ label, val, color }) => (
                      <div key={label} className="rounded-xl border bg-background p-3 text-center">
                        <p className={cn("text-xl font-black", color)}>{val}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Instagram row */}
                  <div className="flex items-center gap-3 rounded-2xl border bg-gradient-to-r from-[#E1306C]/5 to-[#F77737]/5 p-3">
                    <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#E1306C] to-[#F77737] flex items-center justify-center">
                      <Instagram className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-bold">Instagram Shopping</p>
                      <p className="text-[11px] text-muted-foreground">Taguez vos produits dans vos posts</p>
                    </div>
                    <div className="rounded-full bg-green-500/10 px-2.5 py-1">
                      <Check className="h-3.5 w-3.5 text-green-500" />
                    </div>
                  </div>

                  {/* Last sync */}
                  <p className="text-[11px] text-center text-muted-foreground">
                    Dernière synchronisation : il y a 2 minutes
                  </p>
                </div>

                {/* Floating elements */}
                <div className="absolute -top-4 -left-4 rounded-2xl bg-white dark:bg-zinc-800 border px-3 py-2 shadow-xl flex items-center gap-2 animate-[bounce_3s_infinite]">
                  <Facebook className="h-4 w-4 text-[#1877F2]" />
                  <span className="text-xs font-bold">+120 vues</span>
                </div>
                <div className="absolute -bottom-4 -right-4 rounded-2xl bg-white dark:bg-zinc-800 border px-3 py-2 shadow-xl flex items-center gap-2 animate-[bounce_3.5s_infinite]">
                  <Instagram className="h-4 w-4 text-[#E1306C]" />
                  <span className="text-xs font-bold">+85 clics</span>
                </div>
              </div>
            </ScrollReveal>

            {/* Right text */}
            <ScrollReveal direction="right" className="order-1 lg:order-2">
              <SectionBadge>
                <Facebook className="h-3.5 w-3.5 text-[#1877F2]" />
                <Instagram className="h-3.5 w-3.5 text-[#E1306C]" />
                Intégration Meta
              </SectionBadge>
              <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                Vendez sur{" "}
                <span className="text-[#1877F2]">Facebook</span>{" "}
                &{" "}
                <span className="text-[#E1306C]">Instagram</span>
              </h2>
              <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
                Connectez votre boutique MarketNet à Facebook et Instagram. Vos produits se synchronisent automatiquement et vos clients peuvent commander directement depuis leurs réseaux sociaux préférés.
              </p>

              <div className="mt-8 space-y-4">
                {META_FEATURES.map((mf, i) => (
                  <ScrollReveal key={mf.title} delay={i * 80} direction="up">
                    <div className="flex items-start gap-4 rounded-2xl border bg-card p-4 shadow-sm transition-all hover:shadow-md hover:border-primary/20">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                        <mf.icon className={cn("h-5 w-5", mf.color)} />
                      </div>
                      <div>
                        <p className="font-bold text-sm">{mf.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{mf.desc}</p>
                      </div>
                    </div>
                  </ScrollReveal>
                ))}
              </div>

              <div className="mt-8 flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Disponible dans le plan</span>
                <span className="rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-bold">Premium</span>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="bg-secondary/30 py-24 scroll-mt-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <ScrollReveal direction="up" className="text-center">
            <SectionBadge><Layers className="h-3.5 w-3.5" /> Processus</SectionBadge>
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">Comment ça marche ?</h2>
            <p className="mt-4 text-lg text-muted-foreground">Trois étapes simples pour transformer vos abonnés en clients fidèles.</p>
          </ScrollReveal>

          <div className="mt-16 grid gap-8 lg:grid-cols-3">
            {STEPS.map((s, i) => (
              <ScrollReveal key={s.title} delay={i * 120} direction="up">
                <div className="relative h-full rounded-3xl bg-card p-8 shadow-sm transition-transform hover:-translate-y-1.5 border hover:border-primary/20 hover:shadow-xl">
                  <div className="flex items-center gap-4 mb-6">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-xl font-bold text-primary-foreground shadow-lg shadow-primary/30">
                      {i + 1}
                    </span>
                    <h3 className="text-lg font-bold">{s.title}</h3>
                  </div>
                  <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/8">
                    <s.icon className="h-7 w-7 text-primary" />
                  </div>
                  <p className="text-muted-foreground leading-relaxed">{s.desc}</p>
                  {i < STEPS.length - 1 && (
                    <ArrowRight className="hidden lg:block absolute -right-6 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground/30" />
                  )}
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      {!!plans?.length && (
        <section id="pricing" className="py-24 scroll-mt-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <ScrollReveal direction="up" className="text-center">
              <SectionBadge><DollarSign className="h-3.5 w-3.5" /> Tarifs</SectionBadge>
              <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">Des tarifs transparents</h2>
              <p className="mt-4 text-lg text-muted-foreground">Commencez gratuitement, passez à la vitesse supérieure quand vous êtes prêt.</p>
            </ScrollReveal>

            <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3 lg:gap-12 max-w-4xl mx-auto">
              {plans.map((p, i) => (
                <ScrollReveal key={p.id} delay={i * 100} direction="up">
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

                    <ul className="mt-8 flex-1 space-y-3">
                      {[
                        { show: true, text: p.max_products ? `${p.max_products} produits` : "Produits illimités", strong: true },
                        { show: Boolean(p.max_photos), text: `${p.max_photos} photos par produit` },
                        { 
                          show: true, 
                          text: (p as any).max_active_promotions 
                            ? `${(p as any).max_active_promotions} promotions actives max` 
                            : "Promotions actives illimitées" 
                        },
                        { show: p.meta_access, text: "Accès API Meta (Facebook & Instagram)" },
                        { show: p.advanced_themes, text: "Thèmes avancés" },
                        { show: p.advanced_stats, text: "Statistiques Pro" },
                        { show: true, text: "Commandes WhatsApp directes" },
                      ].filter(f => f.show).map(f => (
                        <li key={f.text} className="flex items-center gap-3">
                          <div className="rounded-full bg-primary/10 p-1 shrink-0">
                            <Check className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <span className={cn("text-sm", f.strong ? "font-semibold" : "text-muted-foreground")}>{f.text}</span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      asChild
                      className="mt-8 w-full rounded-full h-12 text-base font-bold"
                      variant={p.price_usd && Number(p.price_usd) > 0 ? "default" : "outline"}
                    >
                      <Link to="/auth" search={{ mode: "signup" }}>
                        {Number(p.price_usd) === 0 ? "Commencer gratuitement" : `Choisir ${p.name}`}
                      </Link>
                    </Button>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA BOTTOM ── */}
      <section className="relative overflow-hidden bg-primary py-24 text-primary-foreground">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "32px 32px" }} />
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8 relative z-10">
          <ScrollReveal direction="up">
            <h2 className="text-4xl font-extrabold sm:text-5xl">Prêt à digitaliser vos ventes ?</h2>
            <p className="mt-6 text-xl text-primary-foreground/80">
              Rejoignez des centaines de commerçants qui ont déjà transformé leur business avec MarketNet.
            </p>
            <div className="mt-10 flex justify-center">
              <Button size="lg" variant="secondary" className="h-14 rounded-full px-10 text-lg font-bold shadow-2xl transition-transform hover:scale-105 active:scale-95" asChild>
                <Link to="/auth" search={{ mode: "signup" }}>
                  <Store className="mr-2 h-5 w-5" />
                  Créer ma boutique maintenant
                </Link>
              </Button>
            </div>
            <p className="mt-6 text-sm text-primary-foreground/60">Sans carte bancaire · Prêt en 5 minutes · Annulable à tout moment</p>
          </ScrollReveal>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t bg-card py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            {/* Logo footer */}
            <Link to="/" className="flex items-center gap-2 font-extrabold tracking-tight text-foreground text-lg">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground font-black text-base shadow-md shadow-primary/30">M</span>
              Market<span className="text-primary">Net</span>
            </Link>
            <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} MarketNet. Tous droits réservés.</p>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <Link to="/terms" className="hover:text-foreground transition-colors">Conditions d'utilisation</Link>
              <span className="opacity-40">•</span>
              <Link to="/privacy" className="hover:text-foreground transition-colors">Confidentialité</Link>
              <span className="opacity-40">•</span>
              <Link to="/data-deletion" className="hover:text-foreground transition-colors">Suppression des données</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
