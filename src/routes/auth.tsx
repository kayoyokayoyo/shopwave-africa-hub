import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, CheckCircle2, Loader2, ArrowRight, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({ mode: s.mode === "signup" ? "signup" : s.mode === "forgot" ? "forgot" : "login" }) as { mode: "login" | "signup" | "forgot" },
  head: () => ({
    meta: [
      { title: "Connexion & Inscription — MarketNet" },
      { name: "description", content: "Connectez-vous ou créez votre compte commerçant MarketNet." },
      { property: "og:title", content: "Connexion & Inscription — MarketNet" },
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

  const setMode = (m: "login" | "signup" | "forgot") => {
    setSent(null);
    navigate({ to: "/auth", search: { mode: m } });
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "forgot") {
        const r = z.string().email("Email invalide").safeParse(email.trim());
        if (!r.success) throw new Error(r.error.issues[0].message);
        const { error } = await supabase.auth.resetPasswordForEmail(r.data, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setSent("Si un compte existe avec cet email, un lien de réinitialisation vient de vous être envoyé.");
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
    <div className="relative min-h-screen flex items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-primary/5 via-background to-primary/10 overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute top-1/4 -left-32 h-96 w-96 rounded-full bg-primary/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 h-96 w-96 rounded-full bg-primary/15 blur-[140px] pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-[430px] relative z-10 py-6">
        {/* Brand Header */}
        <div className="mb-6 flex items-center justify-center">
          <Link to="/" className="inline-flex items-center gap-2.5 transition-transform hover:scale-105 active:scale-95">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-black text-xl shadow-lg shadow-primary/30">
              M
            </span>
            <span className="text-2xl font-black tracking-tight text-foreground">
              Market<span className="text-primary">Net</span>
            </span>
          </Link>
        </div>

        {/* Card */}
        <div className="rounded-[2rem] border bg-card/95 backdrop-blur-xl p-7 sm:p-9 shadow-2xl shadow-primary/5">
          {/* Segmented Switcher (Connexion / Inscription) */}
          {mode !== "forgot" && (
            <div className="mb-8 flex rounded-2xl bg-muted/60 p-1.5 border border-border/50">
              <button
                type="button"
                onClick={() => setMode("login")}
                className={cn(
                  "flex-1 py-2.5 text-sm font-bold rounded-xl transition-all duration-200",
                  mode === "login"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Connexion
              </button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className={cn(
                  "flex-1 py-2.5 text-sm font-bold rounded-xl transition-all duration-200",
                  mode === "signup"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Inscription
              </button>
            </div>
          )}

          {/* Titles & Headers */}
          {mode === "forgot" ? (
            <div className="mb-6">
              <button
                type="button"
                onClick={() => setMode("login")}
                className="mb-4 inline-flex items-center text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Retour
              </button>
              <h1 className="text-2xl sm:text-[26px] font-black tracking-tight text-foreground">
                Mot de passe oublié
              </h1>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                On t'envoie un lien par e-mail pour réinitialiser ton mot de passe.
              </p>
            </div>
          ) : mode === "signup" ? (
            <div className="mb-6">
              <h1 className="text-2xl sm:text-[26px] font-black tracking-tight text-foreground">
                Crée ton compte
              </h1>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Commence à vendre avec MarketNet en quelques minutes.
              </p>
            </div>
          ) : (
            <div className="mb-6">
              <h1 className="text-2xl sm:text-[26px] font-black tracking-tight text-foreground">
                Content de te revoir
              </h1>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Connecte-toi pour accéder à ton tableau de bord MarketNet.
              </p>
            </div>
          )}

          {/* Divider */}
          <div className="relative mb-6 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/60" />
            </div>
            <span className="relative bg-card px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              MarketNet
            </span>
          </div>

          {/* Success message view */}
          {sent ? (
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/20 text-primary">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-base font-bold text-foreground">Vérifie ta boîte e-mail</h3>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{sent}</p>
              <Button
                type="button"
                variant="outline"
                onClick={() => setMode("login")}
                className="mt-6 w-full rounded-2xl font-bold"
              >
                Retour à la connexion
              </Button>
            </div>
          ) : (
            /* Form view */
            <form onSubmit={submit} className="space-y-4">
              {/* Name field (signup only) */}
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs font-semibold text-foreground">
                    Nom complet
                  </Label>
                  <Input
                    id="name"
                    placeholder="Ton nom et prénom"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    className="h-12 rounded-2xl bg-muted/40 border-border/80 px-4 text-sm focus:bg-background transition-all"
                  />
                </div>
              )}

              {/* Email field */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold text-foreground">
                  Adresse e-mail
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="toi@exemple.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  className="h-12 rounded-2xl bg-muted/40 border-border/80 px-4 text-sm focus:bg-background transition-all"
                />
              </div>

              {/* Password field */}
              {mode !== "forgot" && (
                <div className="space-y-1.5">
                  <Label htmlFor="pw" className="text-xs font-semibold text-foreground">
                    Mot de passe
                  </Label>
                  <div className="relative">
                    <Input
                      id="pw"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      required
                      className="h-12 rounded-2xl bg-muted/40 border-border/80 pl-4 pr-11 text-sm focus:bg-background transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {mode === "signup" && (
                    <p className="text-[11px] text-muted-foreground/80 mt-1 pl-1">
                      8 caractères minimum — une phrase simple suffit.
                    </p>
                  )}
                  {mode === "login" && (
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => setMode("forgot")}
                        className="text-xs font-semibold text-primary hover:underline transition-colors"
                      >
                        Mot de passe oublié ?
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Submit button */}
              <div className="pt-2">
                <Button
                  type="submit"
                  size="lg"
                  className="h-12 w-full rounded-2xl text-sm font-bold shadow-lg shadow-primary/20 transition-all hover:scale-[1.01] active:scale-95"
                  disabled={busy}
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      {mode === "signup"
                        ? "Créer mon compte"
                        : mode === "forgot"
                        ? "Envoyer le code"
                        : "Se connecter"}
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  )}
                </Button>
              </div>

              {/* Conditions on signup */}
              {mode === "signup" && (
                <p className="pt-3 text-center text-xs text-muted-foreground leading-relaxed">
                  En créant un compte, tu acceptes nos{" "}
                  <Link
                    to="/terms"
                    className="font-bold text-primary hover:underline transition-colors"
                  >
                    conditions d'utilisation
                  </Link>
                  .
                </p>
              )}
            </form>
          )}

          {/* Footer link for forgot mode */}
          {mode === "forgot" && !sent && (
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setMode("login")}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                Retour à la connexion
              </button>
            </div>
          )}
        </div>

        {/* Footer external switch */}
        {mode !== "forgot" && !sent && (
          <div className="mt-6 text-center text-xs text-muted-foreground">
            {mode === "login" ? (
              <>
                Pas encore de compte ?{" "}
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className="font-bold text-primary hover:underline transition-colors"
                >
                  S'inscrire
                </button>
              </>
            ) : (
              <>
                Déjà un compte ?{" "}
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="font-bold text-primary hover:underline transition-colors"
                >
                  Se connecter
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
