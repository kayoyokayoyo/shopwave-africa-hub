import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { Lock, Eye, EyeOff, Loader2, CheckCircle2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nouveau mot de passe — MarketNet" },
      { name: "description", content: "Choisissez un nouveau mot de passe pour votre compte MarketNet." },
      { property: "og:title", content: "Nouveau mot de passe — MarketNet" },
      { property: "og:description", content: "Réinitialisation du mot de passe MarketNet." },
    ],
  }),
  component: ResetPage,
});

function FadeIn({ children, className, delay = 0 }: { children: React.ReactNode, className?: string, delay?: number }) {
  return (
    <div className={cn("animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both", className)} style={{ animationDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

function StrengthBar({ password }: { password: string }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const score = checks.filter(Boolean).length;
  const colors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-green-500"];
  const labels = ["Trop faible", "Faible", "Moyen", "Fort"];

  if (!password) return null;
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={cn("h-1.5 flex-1 rounded-full transition-colors duration-300", i < score ? colors[score - 1] : "bg-muted")} />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{labels[score - 1] || ""}</p>
    </div>
  );
}

function ResetPage() {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return toast.error("8 caractères minimum");
    if (pw !== confirm) return toast.error("Les mots de passe ne correspondent pas");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast.error("Lien expiré ou invalide. Recommencez la procédure.");
    setDone(true);
    setTimeout(() => navigate({ to: "/dashboard" }), 3000);
  }

  return (
    <div className="flex min-h-screen bg-background">
      <div className="flex w-full flex-col px-6 py-8 sm:items-center sm:justify-center lg:w-[500px] lg:shrink-0 lg:bg-background lg:px-12 lg:shadow-2xl">
        
        <FadeIn className="w-full max-w-sm mx-auto sm:mx-0">
          <Link to="/" className="inline-block">
            <Logo />
          </Link>
        </FadeIn>

        <div className="mt-10 w-full max-w-sm mx-auto sm:mx-0">
          {done ? (
            <FadeIn className="rounded-2xl border border-primary/20 bg-primary/5 p-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/20 text-primary">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h2 className="mt-4 text-xl font-extrabold">Mot de passe mis à jour !</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Votre mot de passe a été changé avec succès. Vous allez être redirigé vers votre tableau de bord...
              </p>
            </FadeIn>
          ) : (
            <>
              <FadeIn delay={100}>
                <h1 className="text-3xl font-extrabold tracking-tight">Nouveau mot de passe</h1>
                <p className="mt-2 text-muted-foreground">Choisissez un mot de passe sécurisé pour protéger votre boutique.</p>
              </FadeIn>

              <FadeIn delay={200}>
                <form onSubmit={submit} className="mt-8 space-y-5">
                  {/* Nouveau mot de passe */}
                  <div className="space-y-2">
                    <Label htmlFor="pw">Nouveau mot de passe</Label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="pw"
                        type={showPw ? "text" : "password"}
                        className="h-12 pl-11 pr-11 rounded-xl bg-muted/50 focus:bg-background transition-colors"
                        placeholder="••••••••"
                        value={pw}
                        onChange={(e) => setPw(e.target.value)}
                        autoComplete="new-password"
                        required
                      />
                      <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                        {showPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    <StrengthBar password={pw} />
                  </div>

                  {/* Confirmation */}
                  <div className="space-y-2">
                    <Label htmlFor="confirm">Confirmer le mot de passe</Label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="confirm"
                        type={showConfirm ? "text" : "password"}
                        className={cn(
                          "h-12 pl-11 pr-11 rounded-xl bg-muted/50 focus:bg-background transition-colors",
                          confirm && pw !== confirm && "border-red-500 focus-visible:ring-red-500"
                        )}
                        placeholder="••••••••"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        autoComplete="new-password"
                        required
                      />
                      <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                        {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    {confirm && pw !== confirm && (
                      <p className="text-xs text-red-500">Les mots de passe ne correspondent pas</p>
                    )}
                    {confirm && pw === confirm && pw.length >= 8 && (
                      <p className="text-xs text-green-500 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Les mots de passe correspondent</p>
                    )}
                  </div>

                  <Button type="submit" size="lg" className="h-12 w-full rounded-xl text-base font-bold shadow-lg transition-transform hover:scale-[1.02] active:scale-95" disabled={busy}>
                    {busy && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                    {!busy && "Enregistrer le nouveau mot de passe"}
                  </Button>

                  <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground pt-1">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Connexion sécurisée — vos données sont protégées
                  </div>
                </form>
              </FadeIn>
            </>
          )}
        </div>
      </div>

      {/* Panel de droite décoratif */}
      <div className="hidden flex-1 items-center justify-center bg-zinc-900 p-12 lg:flex relative overflow-hidden">
        <div className="absolute -left-20 top-20 h-96 w-96 rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute bottom-20 right-20 h-[500px] w-[500px] rounded-full bg-orange-500/10 blur-[150px]" />
        <div className="relative z-10 max-w-md text-center">
          <div className="mx-auto mb-8 grid h-20 w-20 place-items-center rounded-3xl bg-white/10 text-white backdrop-blur-xl shadow-2xl border border-white/10">
            <ShieldCheck className="h-10 w-10" />
          </div>
          <h2 className="text-4xl font-extrabold text-white">Sécurité avant tout.</h2>
          <p className="mt-6 text-lg text-zinc-400">
            Un mot de passe fort protège votre boutique, vos produits et vos commandes. Choisissez-en un unique et difficile à deviner.
          </p>
          <ul className="mt-8 space-y-3 text-left text-sm text-zinc-400">
            <li className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 shrink-0 text-primary" /> Au moins 8 caractères</li>
            <li className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 shrink-0 text-primary" /> Une majuscule et un chiffre</li>
            <li className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 shrink-0 text-primary" /> Un caractère spécial (!, @, #…)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
