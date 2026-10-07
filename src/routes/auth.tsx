import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";

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

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

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

  const title = mode === "signup" ? "Créer ma boutique" : mode === "forgot" ? "Mot de passe oublié" : "Bon retour !";

  return (
    <div className="flex min-h-screen flex-col bg-background px-5 py-6">
      <Logo />
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
        <h1 className="text-3xl font-extrabold">{title}</h1>
        <p className="mt-2 text-muted-foreground">
          {mode === "signup" ? "Gratuit, sans carte bancaire. Prêt en 5 minutes." : mode === "forgot" ? "Recevez un lien pour choisir un nouveau mot de passe." : "Connectez-vous à votre espace commerçant."}
        </p>
        {sent ? (
          <div className="mt-8 rounded-2xl border bg-card p-5 text-sm">{sent}</div>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5"><Label htmlFor="name">Votre nom</Label><Input id="name" className="h-12" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></div>
            )}
            <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" className="h-12" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></div>
            {mode !== "forgot" && (
              <div className="space-y-1.5">
                <div className="flex justify-between"><Label htmlFor="pw">Mot de passe</Label>
                  {mode === "login" && <button type="button" onClick={() => setMode("forgot")} className="text-sm text-primary">Oublié ?</button>}
                </div>
                <Input id="pw" type="password" className="h-12" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} required />
              </div>
            )}
            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={busy}>
              {busy ? "Patientez…" : mode === "signup" ? "Créer mon compte" : mode === "forgot" ? "Envoyer le lien" : "Se connecter"}
            </Button>
          </form>
        )}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "login" ? (<>Pas encore de compte ? <button onClick={() => setMode("signup")} className="font-semibold text-primary">Créer ma boutique</button></>)
            : (<>Déjà inscrit ? <button onClick={() => setMode("login")} className="font-semibold text-primary">Se connecter</button></>)}
        </p>
      </div>
    </div>
  );
}
