import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Store, MapPin, Eye, Globe, Mail, AlertTriangle, Ban, CheckCircle2, Trash2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { logAction } from "@/hooks/useIsAdmin";
import { mediaUrl } from "@/lib/marketnet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useServerFn } from "@tanstack/react-start";
import { deleteMerchant } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/boutiques_/$shopId")({
  component: ShopDetail,
});

function ShopDetail() {
  const { shopId } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [confirmName, setConfirmName] = useState("");
  const deleteMerchantFn = useServerFn(deleteMerchant);
  
  const { data: shop, isLoading, isError } = useQuery({
    queryKey: ["adminShopDetail", shopId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shops")
        .select(`
          *,
          products(count)
        `)
        .eq("id", shopId)
        .maybeSingle();
        
      if (error) throw error;
      if (!data) return null;

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("full_name, email, status")
        .eq("id", data.owner_id)
        .maybeSingle();

      if (profileError) throw profileError;
      return { ...data, profiles: profile };
    },
  });

  if (isLoading) return <div className="p-12 text-center text-muted-foreground">Chargement des details...</div>;
  if (isError) return <div className="p-12 text-center text-destructive">Impossible de charger les details de cette boutique.</div>;
  if (!shop) return <div className="p-12 text-center text-destructive">Boutique introuvable.</div>;

  const refresh = () => qc.invalidateQueries({ queryKey: ["adminShopDetail", shopId] });

  async function suspendShop(v: boolean) { 
    await supabase.from("shops").update({ is_suspended: v }).eq("id", shopId); 
    await logAction(v ? "shop.suspend" : "shop.unsuspend", shopId); 
    toast.success(v ? "Boutique suspendue" : "Boutique reactivee");
    refresh(); 
    setConfirmName("");
  }

  async function removeMerchant() {
    try {
      await deleteMerchantFn({ data: { userId: shop!.owner_id } });
      toast.success("Compte et boutique supprimes definitivement");
      navigate({ to: "/admin/boutiques" });
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Erreur lors de la suppression");
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="rounded-full hover:bg-muted/50 transition-colors">
          <Link to="/admin/boutiques"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <h1 className="text-xl font-bold">Details de la boutique</h1>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="border-b p-6 flex flex-col sm:flex-row sm:items-start justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-primary/20 shadow-inner">
              {shop.logo_url ? (
                <img src={mediaUrl(shop.logo_url)!} alt={`Logo de ${shop.name}`} className="h-full w-full rounded-2xl object-cover" />
              ) : (
                <Store className="h-8 w-8 text-primary" />
              )}
            </div>
            <div>
              <h2 className="text-2xl font-bold">{shop.name}</h2>
              <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1.5">
                <a href={`/b/${shop.slug}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-primary transition-colors">
                  <Globe className="h-3.5 w-3.5" /> /b/{shop.slug}
                </a>
                <span>&bull;</span>
                <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide border ${shop.is_suspended ? 'bg-destructive/10 text-destructive border-destructive/20' : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'}`}>
                  {shop.is_suspended ? "Suspendue" : "Active"}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" asChild className="rounded-xl h-9">
              <a href={`mailto:${shop.profiles?.email}`}>
                <Mail className="mr-2 h-4 w-4" /> Contacter
              </a>
            </Button>
            
            {shop.is_suspended ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" className="rounded-xl h-9 bg-emerald-500 hover:bg-emerald-600 text-white"><CheckCircle2 className="mr-2 h-4 w-4" /> Reactiver</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reactiver la boutique ?</AlertDialogTitle>
                    <AlertDialogDescription>La boutique <strong>{shop.name}</strong> redeviendra visible.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction className="bg-emerald-600 hover:bg-emerald-700" onClick={() => suspendShop(false)}>Confirmer</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" className="rounded-xl h-9 text-amber-600 border-amber-200 hover:bg-amber-50">
                    <Ban className="mr-2 h-4 w-4" /> Suspendre
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2 text-amber-600"><AlertTriangle className="h-5 w-5" /> Suspendre cette boutique ?</AlertDialogTitle>
                    <AlertDialogDescription>Veuillez taper <strong>{shop.name}</strong> ci-dessous pour confirmer la suspension.</AlertDialogDescription>
                    <Input placeholder={shop.name} value={confirmName} onChange={(e) => setConfirmName(e.target.value)} />
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setConfirmName("")}>Annuler</AlertDialogCancel>
                    <AlertDialogAction disabled={confirmName !== shop.name} className="bg-amber-600 hover:bg-amber-700" onClick={() => suspendShop(true)}>Oui, suspendre</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost" className="rounded-xl h-9 text-destructive hover:bg-destructive/10 hover:text-destructive px-3">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-destructive">Suppression definitive</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action supprimera le compte du proprietaire et cette boutique de maniere irremediable. Tapez <strong>{shop.name}</strong> pour confirmer.
                  </AlertDialogDescription>
                  <Input placeholder={shop.name} value={confirmName} onChange={(e) => setConfirmName(e.target.value)} />
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setConfirmName("")}>Annuler</AlertDialogCancel>
                  <AlertDialogAction disabled={confirmName !== shop.name} className="bg-destructive hover:bg-destructive/90" onClick={() => removeMerchant()}>
                    Supprimer definitivement
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="p-6 grid gap-6 sm:grid-cols-2">
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2"><Settings className="h-4 w-4 text-muted-foreground" /> Informations generales</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between border-b pb-3 items-center">
                <span className="text-muted-foreground">Proprietaire</span>
                <div className="text-right">
                  <span className="font-medium text-foreground">{shop.profiles?.full_name || "Inconnu"}</span>
                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center justify-end gap-1.5">
                    {shop.profiles?.email}
                  </div>
                </div>
              </div>
              <div className="flex justify-between border-b pb-3 pt-1 items-center">
                <span className="text-muted-foreground">Creation</span>
                <span className="font-medium">{new Date(shop.created_at).toLocaleDateString("fr-FR")}</span>
              </div>
              <div className="flex justify-between border-b pb-3 pt-1 items-center">
                <span className="text-muted-foreground">Plan actuel</span>
                <span className="px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide bg-primary/10 text-primary border border-primary/20 shadow-sm">
                  {shop.plan_id}
                </span>
              </div>
              <div className="flex justify-between border-b pb-3 pt-1 items-center">
                <span className="text-muted-foreground">Localisation</span>
                <span className="font-medium flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  {shop.city || "Non renseigne"}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2"><Eye className="h-4 w-4 text-muted-foreground" /> Statistiques</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border bg-gradient-to-br from-muted/30 to-muted/10 p-5 text-center shadow-sm">
                <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Vues totales</p>
                <p className="text-3xl font-extrabold text-foreground">{shop.views}</p>
              </div>
              <div className="rounded-2xl border bg-gradient-to-br from-muted/30 to-muted/10 p-5 text-center shadow-sm">
                <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Produits</p>
                <p className="text-3xl font-extrabold text-foreground">{shop.products?.[0]?.count ?? 0}</p>
              </div>
            </div>
            {shop.description && (
              <div className="mt-5">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description de la boutique</span>
                <p className="text-sm mt-2 bg-muted/20 p-4 rounded-xl border leading-relaxed text-muted-foreground">
                  {shop.description}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
