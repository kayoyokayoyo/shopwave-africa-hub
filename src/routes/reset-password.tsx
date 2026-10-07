import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";

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

function ResetPage() {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return toast.error("8 caractères minimum");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast.error("Lien expiré ou invalide. Recommencez la procédure.");
    toast.success("Mot de passe mis à jour");
    navigate({ to: "/dashboard" });
  }
  return (
    <div className="flex min-h-screen flex-col px-5 py-6">
      <Logo />
      <form onSubmit={submit} className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4">
        <h1 className="text-3xl font-extrabold">Nouveau mot de passe</h1>
        <div className="space-y-1.5"><Label htmlFor="pw">Mot de passe</Label><Input id="pw" type="password" className="h-12" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></div>
        <Button variant="hero" size="lg" disabled={busy}>Enregistrer</Button>
      </form>
    </div>
  );
}
