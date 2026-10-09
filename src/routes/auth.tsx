import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { ArrowLeft, CheckCircle2, Loader2, Store, Lock, Mail, User, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({ mode: s.mode === "signup" ? "signup" : s.mode === "forgot" ? "forgot" : "login" }) as { mode: "login" | "signup" | "forgot" },
  head: () => ({
    meta: [
      { title: "Connexion — MarketNet" },
      { name: "description", content: "Connectez-vous ou créez votre compte commerçant MarketNet." },
      { property: "og:title", content: "Connexion — MarketNet" },
      { property: "og:description", content: "Accédez à votre espace commerçant MarketNet." },
    ],
  }),
  component: AuthPage,
});

const schema = z.object({
  email: z.string().trim().email("Email invalide").max(255),
  password: z.string().min(8, "8 caractères minimum").max(72),
  name: z.string().trim().max(80).optional(),
});

function FadeIn({ children, className, delay = 0 }: { children: React.ReactNode, className?: string, delay?: number }) {
  return (
    <div className={cn("animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both", className)} style={{ animationDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (data.user) navigate({ to: "/dashboard" }); });
  }, [navigate]);

  const setMode = (m: "login" | "signup" | "forgot") => { setSent(null); navigate({ to: "/auth", search: { mode: m } }); };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "forgot") {
        const r = z.string().email("Email invalide").safeParse(email.trim());
        if (!r.success) throw new Error(r.error.issues[0].message);
        const { error } = await supabase.auth.resetPasswordForEmail(r.data, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setSent("Si un compte existe, un lien de réinitialisation vient d'être envoyé.");
        return;
      }
      const r = schema.safeParse({ email, password, name: mode === "signup" ? name : undefined });
      if (!r.success) throw new Error(r.error.issues[0].message);
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: r.data.email, password: r.data.password,
          options: { emailRedirectTo: `${window.location.origin}/dashboard`, data: { full_name: r.data.name } },
        });
        if (error) throw error;
        if (!data.session) { setSent("Compte créé ! Vérifiez votre boîte email pour confirmer votre adresse."); return; }
        navigate({ to: "/dashboard" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: r.data.email, password: r.data.password });
        if (error) throw new Error(error.message.includes("Invalid") ? "Email ou mot de passe incorrect" : error.message);
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-background lg:bg-muted/30">
      {/* ── LEFT PANEL (Form) ── */}
      <div className="flex w-full flex-col px-6 py-8 sm:justify-center lg:w-[500px] lg:shrink-0 lg:bg-background lg:px-12 lg:shadow-2xl">
        <FadeIn className="mx-auto sm:mx-0">
          <Link to="/" className="inline-block">
            <Logo />
          </Link>
        </FadeIn>

        <div className="mt-8 flex-1 sm:mt-12 sm:flex-none">
          {mode === "forgot" && (
            <FadeIn>
              <button onClick={() => setMode("login")} className="mb-6 flex items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                <ArrowLeft className="mr-2 h-4 w-4" /> Retour à la connexion
              </button>
            </FadeIn>
          )}

          <FadeIn delay={100}>
            <h1 className="text-3xl font-extrabold tracking-tight">
              {mode === "signup" ? "Créer ma boutique" : mode === "forgot" ? "Mot de passe oublié ?" : "Bon retour !"}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {mode === "signup" ? "Gratuit, sans carte bancaire. Prêt en 5 minutes." : mode === "forgot" ? "Entrez votre email pour recevoir un lien de réinitialisation." : "Connectez-vous pour gérer votre boutique et vos commandes."}
            </p>
          </FadeIn>

          {sent ? (
            <FadeIn delay={200} className="mt-8 rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 text-primary">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-bold">Vérifiez vos emails</h3>
              <p className="mt-2 text-sm text-muted-foreground">{sent}</p>
            </FadeIn>
          ) : (
            <FadeIn delay={200}>
              <form onSubmit={submit} className="mt-8 space-y-5">
                {mode === "signup" && (
                  <div className="space-y-2">
                    <Label htmlFor="name">Prénom & Nom</Label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                      <Input id="name" className="h-12 pl-11 rounded-xl bg-muted/50 focus:bg-background transition-colors" placeholder="Jean Dupont" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
                    </div>
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="email">Adresse email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input id="email" type="email" className="h-12 pl-11 rounded-xl bg-muted/50 focus:bg-background transition-colors" placeholder="jean@exemple.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
                  </div>
                </div>

                {mode !== "forgot" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="pw">Mot de passe</Label>
                      {mode === "login" && <button type="button" onClick={() => setMode("forgot")} className="text-sm font-semibold text-primary hover:underline">Mot de passe oublié ?</button>}
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                      <Input id="pw" type={showPassword ? "text" : "password"} className="h-12 pl-11 pr-11 rounded-xl bg-muted/50 focus:bg-background transition-colors" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} required />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>
                )}
                
                <Button type="submit" size="lg" className="h-12 w-full rounded-xl text-base font-bold shadow-lg transition-transform hover:scale-[1.02] active:scale-95" disabled={busy}>
                  {busy && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                  {!busy && mode === "signup" ? "Créer mon compte" : !busy && mode === "forgot" ? "Envoyer le lien" : !busy && "Se connecter"}
                </Button>
              </form>
            </FadeIn>
          )}

          <FadeIn delay={300} className="mt-8 text-center text-sm text-muted-foreground">
            {mode === "login" ? (
              <>Pas encore de compte ? <button onClick={() => setMode("signup")} className="font-bold text-primary hover:underline">Créer ma boutique</button></>
            ) : mode === "signup" ? (
              <>Déjà inscrit ? <button onClick={() => setMode("login")} className="font-bold text-primary hover:underline">Se connecter</button></>
            ) : null}
          </FadeIn>
        </div>
      </div>

      {/* ── RIGHT PANEL (Image/Visual) ── */}
      <div className="hidden flex-1 items-center justify-center bg-zinc-900 p-12 lg:flex relative overflow-hidden">
        {/* Abstract background blobs */}
        <div className="absolute -left-20 top-20 h-96 w-96 rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute bottom-20 right-20 h-[500px] w-[500px] rounded-full bg-blue-500/20 blur-[150px]" />
        
        <div className="relative z-10 max-w-lg text-center">
          <div className="mx-auto mb-8 grid h-20 w-20 place-items-center rounded-3xl bg-white/10 text-white backdrop-blur-xl shadow-2xl border border-white/10">
            <Store className="h-10 w-10" />
          </div>
          <h2 className="text-4xl font-extrabold text-white">Gérez votre business <br/>du bout des doigts.</h2>
          <p className="mt-6 text-lg text-zinc-400">
            Rejoignez plus de 500 commerçants qui utilisent MarketNet pour simplifier la prise de commandes sur WhatsApp et développer leur activité en ligne.
          </p>
          
          {/* Mockup stats card */}
          <div className="mx-auto mt-12 max-w-sm rounded-2xl bg-white/5 p-6 text-left backdrop-blur-md border border-white/10 shadow-2xl">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-green-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-400">Nouvelle commande</p>
                <p className="text-lg font-bold text-white">WhatsApp reçu à l'instant</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
