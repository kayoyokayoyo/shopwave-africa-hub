import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMyShop, useShopProducts } from "@/hooks/useMyShop";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IdentityFields, ContactFields, AppearanceFields, type ShopDraft } from "@/components/dashboard/ShopFields";
import { ShopPreview } from "@/components/dashboard/ShopPreview";
import { draftFromShop, draftToRow, validateDraft, friendlyDbError } from "@/lib/shopDraft";

export const Route = createFileRoute("/_authenticated/dashboard/boutique")({
  head: () => ({ meta: [{ title: "Ma boutique — MarketNet" }, { name: "description", content: "Personnalisez votre boutique." }, { property: "og:title", content: "Ma boutique — MarketNet" }, { property: "og:description", content: "Personnalisation de la boutique." }] }),
  component: ShopSettings,
});

function ShopSettings() {
  const { data: shop } = useMyShop();
  const { data: products } = useShopProducts(shop?.id);
  const qc = useQueryClient();
  const [draft, setDraft] = useState<ShopDraft | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (shop) setDraft(draftFromShop(shop)); }, [shop]);
  if (!shop || !draft) return null;
  const set = (p: Partial<ShopDraft>) => setDraft((d) => (d ? { ...d, ...p } : d));

  async function save() {
    const err = validateDraft(draft!);
    if (err) return toast.error(err);
    if (draft!.slug !== shop!.slug && !confirm("Le lien ne pourra plus être modifié ensuite. Continuer ?")) return;
    setBusy(true);
    const { error } = await supabase.from("shops").update(draftToRow(draft!)).eq("id", shop!.id);
    setBusy(false);
    if (error) return toast.error(friendlyDbError(error.message));
    qc.invalidateQueries({ queryKey: ["myShop"] });
    toast.success("Modifications enregistrées");
  }

  async function togglePublished(v: boolean) {
    await supabase.from("shops").update({ is_published: v }).eq("id", shop!.id);
    qc.invalidateQueries({ queryKey: ["myShop"] });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <div>
        <h1 className="text-2xl font-extrabold">Ma boutique</h1>
        <div className="mt-4 flex items-center justify-between rounded-2xl border bg-card p-4">
          <div><p className="font-semibold">Boutique visible</p><p className="text-sm text-muted-foreground">{shop.is_suspended ? "Suspendue par MarketNet" : "Les clients peuvent la consulter"}</p></div>
          <Switch checked={shop.is_published} onCheckedChange={togglePublished} />
        </div>
        <Tabs defaultValue="look" className="mt-6">
          <TabsList className="grid h-11 w-full grid-cols-3">
            <TabsTrigger value="look">Apparence</TabsTrigger>
            <TabsTrigger value="info">Infos</TabsTrigger>
            <TabsTrigger value="contact">Contact</TabsTrigger>
          </TabsList>
          <TabsContent value="look" className="mt-5"><AppearanceFields draft={draft} set={set} /></TabsContent>
          <TabsContent value="info" className="mt-5"><IdentityFields draft={draft} set={set} slugLocked={shop.slug_changed} /></TabsContent>
          <TabsContent value="contact" className="mt-5"><ContactFields draft={draft} set={set} /></TabsContent>
        </Tabs>
        <div className="sticky bottom-20 mt-6 lg:bottom-4"><Button variant="hero" size="lg" className="w-full" onClick={save} disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer"}</Button></div>
        <div className="mt-8 lg:hidden"><ShopPreview draft={draft} products={products} /></div>
      </div>
      <div className="hidden lg:sticky lg:top-20 lg:block lg:self-start"><ShopPreview draft={draft} products={products} /></div>
    </div>
  );
}
