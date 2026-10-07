import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { IdentityFields, ContactFields, AppearanceFields, emptyDraft, type ShopDraft } from "@/components/dashboard/ShopFields";
import { ShopPreview } from "@/components/dashboard/ShopPreview";
import { draftToRow, validateDraft, friendlyDbError } from "@/lib/shopDraft";
import { SLUG_RE, WHATSAPP_RE } from "@/lib/marketnet";
import { useMyShop } from "@/hooks/useMyShop";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Créer ma boutique — MarketNet" }, { name: "description", content: "Assistant de création de boutique." }, { property: "og:title", content: "Créer ma boutique — MarketNet" }, { property: "og:description", content: "Assistant de création de boutique MarketNet." }] }),
  component: Onboarding,
});

const STEPS = ["Votre boutique", "Contact", "Apparence"];

function Onboarding() {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<ShopDraft>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: shop } = useMyShop();
  const set = (p: Partial<ShopDraft>) => setDraft((d) => ({ ...d, ...p }));

  useEffect(() => { if (shop) navigate({ to: "/dashboard" }); }, [shop, navigate]);

  function next() {
    if (step === 0) {
      if (draft.name.trim().length < 2) return toast.error("Donnez un nom à votre boutique");
      if (!SLUG_RE.test(draft.slug)) return toast.error("Lien invalide (3 caractères minimum)");
    }
    if (step === 1 && !WHATSAPP_RE.test(draft.whatsapp)) return toast.error("Numéro WhatsApp invalide (ex. +243812345678)");
    setStep((s) => s + 1);
  }

  async function finish() {
    const err = validateDraft(draft);
    if (err) return toast.error(err);
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("shops").insert({ ...draftToRow(draft), owner_id: u.user!.id });
    setBusy(false);
    if (error) return toast.error(friendlyDbError(error.message));
    await qc.invalidateQueries({ queryKey: ["myShop"] });
    toast.success("Votre boutique est en ligne 🎉");
    navigate({ to: "/dashboard/produits" });
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-5">
        <Logo />
        <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_380px]">
          <div className="max-w-xl">
            <div className="flex gap-2">{STEPS.map((s, i) => <div key={s} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`} />)}</div>
            <p className="mt-4 text-sm font-semibold text-primary">Étape {step + 1} sur 3</p>
            <h1 className="mt-1 text-3xl font-extrabold">{STEPS[step]}</h1>
            <div className="mt-6">
              {step === 0 && <IdentityFields draft={draft} set={set} />}
              {step === 1 && <ContactFields draft={draft} set={set} />}
              {step === 2 && <AppearanceFields draft={draft} set={set} />}
            </div>
            <div className="sticky bottom-0 -mx-4 mt-8 flex gap-3 border-t bg-background/95 px-4 py-4 backdrop-blur lg:static lg:mx-0 lg:border-0 lg:px-0">
              {step > 0 && <Button variant="outline" size="lg" onClick={() => setStep((s) => s - 1)}><ArrowLeft />Retour</Button>}
              {step < 2 ? <Button variant="hero" size="lg" className="flex-1" onClick={next}>Continuer</Button>
                : <Button variant="hero" size="lg" className="flex-1" onClick={finish} disabled={busy}>{busy ? "Création…" : "Publier ma boutique"}</Button>}
            </div>
          </div>
          <div className="hidden lg:block"><ShopPreview draft={draft} /></div>
        </div>
      </div>
    </div>
  );
}
