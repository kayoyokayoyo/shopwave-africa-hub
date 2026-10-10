import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { logAction } from "@/hooks/useIsAdmin";
import { Package, Facebook, Palette, BarChart, CheckCircle2, Box, Image as ImageIcon, Save, Plus, Zap, Edit2, X, Trash2 } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/admin/plans")({ component: Plans });
type Plan = Tables<"plans">;

function Plans() {
  const { data } = useQuery({ queryKey: ["plans"], queryFn: async () => (await supabase.from("plans").select("*").order("position")).data ?? [] });
  const [newId, setNewId] = useState("");
  const qc = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);

  async function create() {
    const id = newId.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!id) return;
    setIsCreating(true);
    try {
      const { error } = await supabase.from("plans").insert({ id, name: newId, position: (data?.length ?? 0) });
      if (error) throw error;
      await logAction("plan.create", id); 
      setNewId(""); 
      toast.success("Nouveau plan cree avec succes !");
      qc.invalidateQueries({ queryKey: ["plans"] });
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Erreur de creation");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Plans & Abonnements</h1>
          <p className="mt-1 text-sm text-muted-foreground">Configurez les offres et limites pour vos commercants.</p>
        </div>
        
        <div className="flex items-center gap-2 bg-muted/30 p-1.5 rounded-2xl border">
          <Input 
            placeholder="Nom du nouveau plan..." 
            value={newId} 
            onChange={(e) => setNewId(e.target.value)} 
            className="h-9 border-none bg-transparent shadow-none focus-visible:ring-0 min-w-[200px]"
          />
          <Button onClick={create} disabled={!newId || isCreating} size="sm" className="rounded-xl h-9">
            {isCreating ? "Creation..." : <><Plus className="h-4 w-4 mr-1" /> Creer</>}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 items-start">
        {data?.map((p) => <PlanEditor key={p.id} plan={p} />)}
        
        {!data?.length && (
          <div className="col-span-full p-12 text-center border-2 border-dashed rounded-2xl text-muted-foreground bg-muted/10">
            <Package className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p>Aucun plan configure pour le moment.</p>
            <p className="text-xs mt-1">Creez votre premier plan ci-dessus.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function PlanEditor({ plan }: { plan: Plan }) {
  const [p, setP] = useState(plan);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState("");
  const qc = useQueryClient();
  
  async function save() {
    setIsSaving(true);
    try {
      const { error } = await supabase.from("plans").update({ name: p.name, price_usd: p.price_usd, max_products: p.max_products, max_photos: p.max_photos, meta_access: p.meta_access, advanced_themes: p.advanced_themes, advanced_stats: p.advanced_stats, active: p.active }).eq("id", p.id);
      if (error) throw error;
      await logAction("plan.update", p.id, { price: p.price_usd, max_products: p.max_products });
      toast.success("Plan '" + p.name + "' mis a jour"); 
      qc.invalidateQueries({ queryKey: ["plans"] });
      setIsEditing(false);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Erreur de sauvegarde");
    } finally {
      setIsSaving(false);
    }
  }

  async function removePlan() {
    try {
      const { error } = await supabase.from("plans").delete().eq("id", p.id);
      if (error) throw error;
      await logAction("plan.delete", p.id);
      toast.success("Plan supprime definitivement");
      qc.invalidateQueries({ queryKey: ["plans"] });
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Erreur lors de la suppression");
    }
  }

  function cancel() {
    setP(plan); // Reset to original prop
    setIsEditing(false);
    setConfirmDelete("");
  }

  const sw = (k: "meta_access" | "advanced_themes" | "advanced_stats" | "active", l: string, Icon: any, colorClass: string) => (
    <div className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${isEditing ? 'bg-muted/10 hover:bg-muted/30' : 'bg-transparent border-transparent'}`}>
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded-lg ${colorClass}`}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-sm font-medium">{l}</span>
      </div>
      <Switch checked={p[k]} onCheckedChange={(v) => setP({ ...p, [k]: v })} disabled={!isEditing} />
    </div>
  );

  return (
    <div className={`relative flex flex-col space-y-5 rounded-2xl border bg-card p-6 shadow-sm overflow-hidden transition-all ${p.active ? 'ring-1 ring-primary/20 shadow-md' : 'opacity-80 grayscale-[20%]'}`}>
      {!p.active && (
        <div className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-widest bg-muted text-muted-foreground px-2 py-0.5 rounded-md">
          Inactif
        </div>
      )}
      
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 p-2 rounded-xl text-primary">
              <Zap className="h-5 w-5" />
            </div>
            <p className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-wider">{p.id}</p>
          </div>
        </div>
        
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Nom d'affichage</Label>
          <Input 
            className={`text-lg font-bold h-11 ${!isEditing ? 'bg-transparent border-transparent px-0 focus-visible:ring-0 shadow-none' : 'bg-background'}`} 
            value={p.name} 
            onChange={(e) => setP({ ...p, name: e.target.value })} 
            readOnly={!isEditing} 
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-[11px] text-muted-foreground uppercase flex items-center gap-1"><span className="text-emerald-500 font-bold">$</span> Prix</Label>
          <Input 
            className={`font-mono text-center h-10 ${!isEditing ? 'bg-transparent border-transparent px-0 focus-visible:ring-0 shadow-none' : 'bg-background'}`} 
            inputMode="decimal" 
            value={p.price_usd} 
            onChange={(e) => setP({ ...p, price_usd: Number(e.target.value) || 0 })} 
            readOnly={!isEditing} 
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] text-muted-foreground uppercase flex items-center gap-1"><Box className="h-3 w-3" /> Produits</Label>
          <Input 
            className={`font-mono text-center h-10 ${!isEditing ? 'bg-transparent border-transparent px-0 focus-visible:ring-0 shadow-none' : 'bg-background'}`} 
            placeholder="Illimite" 
            value={p.max_products ?? ""} 
            onChange={(e) => setP({ ...p, max_products: e.target.value ? Number(e.target.value) : null })} 
            readOnly={!isEditing} 
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] text-muted-foreground uppercase flex items-center gap-1"><ImageIcon className="h-3 w-3" /> Photos</Label>
          <Input 
            className={`font-mono text-center h-10 ${!isEditing ? 'bg-transparent border-transparent px-0 focus-visible:ring-0 shadow-none' : 'bg-background'}`} 
            value={p.max_photos} 
            onChange={(e) => setP({ ...p, max_photos: Number(e.target.value) || 1 })} 
            readOnly={!isEditing} 
          />
        </div>
      </div>
      
      <div className="space-y-1 pt-2 border-t border-dashed">
        {sw("meta_access", "Acces API Meta", Facebook, "bg-blue-500/10 text-blue-500")}
        {sw("advanced_themes", "Themes Avances", Palette, "bg-purple-500/10 text-purple-500")}
        {sw("advanced_stats", "Statistiques Pro", BarChart, "bg-amber-500/10 text-amber-500")}
        {sw("active", "Proposer ce plan", CheckCircle2, p.active ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground")}
      </div>

      <div className="pt-3 flex gap-2">
        {!isEditing ? (
          <Button className="w-full rounded-xl shadow-sm h-11 bg-secondary text-secondary-foreground hover:bg-secondary/80" onClick={() => setIsEditing(true)}>
            <Edit2 className="h-4 w-4 mr-2" /> Modifier
          </Button>
        ) : (
          <>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="rounded-xl h-11 px-3 text-destructive border-destructive/30 hover:bg-destructive/10" disabled={isSaving}>
                  <Trash2 className="h-5 w-5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-destructive flex items-center gap-2"><Trash2 className="h-5 w-5" /> Supprimer ce plan ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action est irreversible. Pour confirmer, veuillez taper exactement : 
                    <br/><strong className="select-all block mt-2 text-foreground font-mono bg-muted p-2 rounded text-center">je supprime le plan {p.name}</strong>
                  </AlertDialogDescription>
                  <Input 
                    placeholder={`je supprime le plan ${p.name}`} 
                    value={confirmDelete} 
                    onChange={(e) => setConfirmDelete(e.target.value)} 
                    className="mt-4"
                  />
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setConfirmDelete("")}>Annuler</AlertDialogCancel>
                  <AlertDialogAction 
                    disabled={confirmDelete !== `je supprime le plan ${p.name}`} 
                    className="bg-destructive hover:bg-destructive/90" 
                    onClick={removePlan}
                  >
                    Supprimer definitivement
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            
            <Button variant="outline" className="rounded-xl h-11 px-3 text-muted-foreground hover:bg-muted" onClick={cancel} disabled={isSaving}>
              <X className="h-5 w-5" />
            </Button>
            <Button className="flex-1 rounded-xl shadow-sm h-11 bg-primary text-primary-foreground hover:bg-primary/90" onClick={save} disabled={isSaving}>
              {isSaving ? "Enregistrement..." : <><Save className="h-4 w-4 mr-2" /> Enregistrer</>}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
