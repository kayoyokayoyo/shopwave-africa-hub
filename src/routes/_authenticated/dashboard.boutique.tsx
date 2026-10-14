import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMyShop, useShopProducts, useShopPromotions } from "@/hooks/useMyShop";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IdentityFields, ContactFields, AppearanceFields, type ShopDraft } from "@/components/dashboard/ShopFields";
import { ShopPreview } from "@/components/dashboard/ShopPreview";
import { draftFromShop, draftToRow, validateDraft, friendlyDbError } from "@/lib/shopDraft";
import { Palette, Info, Phone, Eye, Check, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/dashboard/boutique")({
  head: () => ({ meta: [{ title: "Ma boutique — MarketNet" }, { name: "description", content: "Personnalisez votre boutique." }, { property: "og:title", content: "Ma boutique — MarketNet" }, { property: "og:description", content: "Personnalisation de la boutique." }] }),
  component: ShopSettings,
});

function ShopSettings() {
  const { data: shop } = useMyShop();
  const { data: products } = useShopProducts(shop?.id);
  const { data: promotions } = useShopPromotions(shop?.id);
  const qc = useQueryClient();
  const [draft, setDraft] = useState<ShopDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmSlugChange, setConfirmSlugChange] = useState(false);
  useEffect(() => { if (shop) setDraft(draftFromShop(shop)); }, [shop]);
  if (!shop || !draft) return null;
  const set = (p: Partial<ShopDraft>) => setDraft((d) => (d ? { ...d, ...p } : d));

  async function performSave() {
    setConfirmSlugChange(false);
    setBusy(true);
    const { error } = await supabase.from("shops").update(draftToRow(draft!)).eq("id", shop!.id);
    setBusy(false);
    if (error) return toast.error(friendlyDbError(error.message));
    qc.invalidateQueries({ queryKey: ["myShop"] });
    toast.success("Modifications enregistrées");
  }

  async function save() {
    const err = validateDraft(draft!);
    if (err) return toast.error(err);
    if (draft!.slug !== shop!.slug) {
      setConfirmSlugChange(true);
      return;
    }
    await performSave();
  }

  async function togglePublished(v: boolean) {
    await supabase.from("shops").update({ is_published: v }).eq("id", shop!.id);
    qc.invalidateQueries({ queryKey: ["myShop"] });
  }

  return (
    <div className="grid gap-6 sm:gap-8 lg:grid-cols-[1fr_390px] pb-12">
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">Ma boutique</h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">Personnalisez votre vitrine, votre identité et vos coordonnées.</p>
        </div>

        {/* Visibilité de la boutique */}
        <div className="flex items-center justify-between rounded-2xl border bg-card p-4 sm:p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Eye className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-sm sm:text-base">Boutique en ligne</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {shop.is_suspended
                  ? "Suspendue par l'administration"
                  : shop.is_published
                  ? "Votre boutique est visible et accessible au public"
                  : "Votre boutique est masquée (mode privé)"}
              </p>
            </div>
          </div>
          <Switch checked={shop.is_published} onCheckedChange={togglePublished} disabled={shop.is_suspended} />
        </div>

        {/* Onglets d'édition */}
        <Tabs defaultValue="info" className="w-full">
          <TabsList className="grid h-11 w-full grid-cols-3 rounded-xl bg-muted/70 p-1">
            <TabsTrigger value="info" className="flex items-center gap-1.5 text-xs sm:text-sm rounded-lg">
              <Info className="h-3.5 w-3.5" />
              <span>Infos</span>
            </TabsTrigger>
            <TabsTrigger value="look" className="flex items-center gap-1.5 text-xs sm:text-sm rounded-lg">
              <Palette className="h-3.5 w-3.5" />
              <span>Apparence</span>
            </TabsTrigger>
            <TabsTrigger value="contact" className="flex items-center gap-1.5 text-xs sm:text-sm rounded-lg">
              <Phone className="h-3.5 w-3.5" />
              <span>Contact</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="mt-5 rounded-2xl border bg-card p-4 sm:p-6 shadow-sm">
            <IdentityFields draft={draft} set={set} slugLocked={shop.slug_changed} currentSlug={shop.slug} />
          </TabsContent>

          <TabsContent value="look" className="mt-5 rounded-2xl border bg-card p-4 sm:p-6 shadow-sm">
            <AppearanceFields draft={draft} set={set} />
          </TabsContent>

          <TabsContent value="contact" className="mt-5 rounded-2xl border bg-card p-4 sm:p-6 shadow-sm">
            <ContactFields draft={draft} set={set} />
          </TabsContent>
        </Tabs>

        {/* Bouton Enregistrer */}
        <div className="sticky bottom-20 z-10 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0">
          <Button
            variant="hero"
            size="lg"
            className="w-full h-11 rounded-xl shadow-md font-bold"
            onClick={save}
            disabled={busy}
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enregistrement…
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Enregistrer les modifications
              </>
            )}
          </Button>
        </div>

        {/* Aperçu mobile tout en bas sur petit écran */}
        <div className="mt-8 pt-6 border-t lg:hidden">
          <ShopPreview draft={draft} products={products} promotions={promotions} />
        </div>
      </div>

      {/* Aperçu latéral sur grand écran */}
      <div className="hidden lg:sticky lg:top-20 lg:block lg:self-start">
        <ShopPreview draft={draft} products={products} promotions={promotions} />
      </div>

      <AlertDialog open={confirmSlugChange} onOpenChange={setConfirmSlugChange}>
        <AlertDialogContent className="rounded-3xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold">Modifier le lien de votre boutique ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le lien personnalisé ne pourra plus être modifié ensuite. Vos clients devront utiliser cette nouvelle adresse pour accéder à votre boutique.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="rounded-xl">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={performSave}
              className="rounded-xl"
            >
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
