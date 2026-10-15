import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { logAction } from "@/hooks/useIsAdmin";
import { formatCDF } from "@/lib/subscriptions";
import {
  Package, Facebook, Palette, BarChart3, CheckCircle2, Box,
  Image as ImageIcon, Save, Plus, Zap, Edit2, X, Trash2, Tag,
  Sparkles, Check, Minus, RefreshCw, ShieldCheck
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

export const Route = createFileRoute("/_authenticated/admin/plans")({
  component: PlansPage,
});

type Plan = Tables<"plans">;

function PlansPage() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newPlanName, setNewPlanName] = useState("");
  const [newPlanPrice, setNewPlanPrice] = useState("0");
  const [isCreating, setIsCreating] = useState(false);

  const { data: plans, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plans").select("*").order("position");
      if (error) throw error;
      return (data ?? []) as Plan[];
    },
  });

  const generatedId = useMemo(() => {
    return newPlanName.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
  }, [newPlanName]);

  const stats = useMemo(() => {
    const list = plans ?? [];
    return {
      total: list.length,
      active: list.filter((p) => p.active).length,
      free: list.filter((p) => ((p as any).price_cdf ?? p.price_usd ?? 0) === 0).length,
      paid: list.filter((p) => ((p as any).price_cdf ?? p.price_usd ?? 0) > 0).length,
    };
  }, [plans]);

  async function handleCreate() {
    if (!generatedId) {
      toast.error("Veuillez saisir un nom valide pour le plan");
      return;
    }
    setIsCreating(true);
    try {
      const priceNum = Math.max(0, parseFloat(newPlanPrice) || 0);
      const { error } = await supabase.from("plans").insert({
        id: generatedId,
        name: newPlanName.trim(),
        price_cdf: priceNum,
        price_usd: 0,
        max_products: 20,
        max_photos: 5,
        active: true,
        position: plans?.length ?? 0,
      } as any);

      if (error) throw error;

      await logAction("plan.create", generatedId);
      toast.success(`Le plan "${newPlanName}" a été créé avec succès !`);
      setNewPlanName("");
      setNewPlanPrice("0");
      setIsCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      queryClient.invalidateQueries({ queryKey: ["plans-active"] });
    } catch (cause: any) {
      toast.error(cause?.message || "Erreur lors de la création du plan");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      {/* ── En-tête de la page ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-2">
            <Zap className="h-3.5 w-3.5" />
            Gestion des Offres Marchands
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Plans & Abonnements</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configurez les formules tarifaires, limites de produits et options exclusives pour vos boutiques.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="h-10 rounded-xl px-3.5 font-semibold"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin text-primary" : ""}`} />
            <span className="hidden sm:inline ml-2">Actualiser</span>
          </Button>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-10 rounded-xl px-4 font-bold shadow-xs">
                <Plus className="mr-1.5 h-4 w-4" /> Nouveau Plan
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Créer un nouveau plan
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Définissez le nom public et le tarif de base pour votre nouvelle formule d'abonnement.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Nom d'affichage</Label>
                  <Input
                    placeholder="Ex: Formule Starter, Plan Pro, Business..."
                    value={newPlanName}
                    onChange={(e) => setNewPlanName(e.target.value)}
                    className="rounded-xl h-10"
                    autoFocus
                  />
                  {generatedId && (
                    <p className="text-[11px] text-muted-foreground font-mono">
                      Identifiant technique : <span className="font-bold text-foreground">{generatedId}</span>
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Prix mensuel (FC / CDF)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-xs">FC</span>
                    <Input
                      type="number"
                      step="1000"
                      min="0"
                      placeholder="25000"
                      value={newPlanPrice}
                      onChange={(e) => setNewPlanPrice(e.target.value)}
                      className="rounded-xl h-10 pl-10 font-mono font-bold"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Indiquez le montant en Francs Congolais (laissez 0 pour gratuit).
                  </p>
                </div>
              </div>

              <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-xl"
                  disabled={isCreating}
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={!generatedId || isCreating}
                  className="rounded-xl font-bold"
                >
                  {isCreating ? "Création en cours..." : "Créer le plan"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ── Métriques Bar ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3.5 sm:gap-4 lg:grid-cols-4">
        <MetricCard
          label="Total Formules"
          value={stats.total}
          subtext="Configurées sur la plateforme"
          icon={Package}
          accent="blue"
        />
        <MetricCard
          label="Plans Actifs"
          value={stats.active}
          subtext="Visibles par les marchands"
          icon={CheckCircle2}
          accent="green"
        />
        <MetricCard
          label="Formules Gratuites"
          value={stats.free}
          subtext="Sans paiement requis"
          icon={Sparkles}
          accent="amber"
        />
        <MetricCard
          label="Plans Payants"
          value={stats.paid}
          subtext="Abonnements premium FC"
          icon={Zap}
          accent="primary"
        />
      </div>

      {/* ── Grille des Plans ──────────────────────────────────────────────── */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 items-start">
        {isLoading ? (
          [1, 2, 3].map((i) => (
            <div key={i} className="h-96 rounded-2xl border bg-card/60 p-6 animate-pulse space-y-4">
              <div className="h-6 w-1/3 bg-muted rounded-md" />
              <div className="h-10 w-2/3 bg-muted rounded-lg" />
              <div className="grid grid-cols-3 gap-2 py-4">
                <div className="h-14 bg-muted rounded-xl" />
                <div className="h-14 bg-muted rounded-xl" />
                <div className="h-14 bg-muted rounded-xl" />
              </div>
            </div>
          ))
        ) : plans && plans.length > 0 ? (
          plans.map((p) => <PlanCard key={p.id} plan={p} />)
        ) : (
          <div className="col-span-full p-12 text-center border-2 border-dashed rounded-2xl text-muted-foreground bg-muted/10">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-25" />
            <p className="font-semibold text-base text-foreground">Aucun plan configuré pour le moment</p>
            <p className="text-xs mt-1 text-muted-foreground">
              Créez votre première formule d'abonnement en cliquant sur le bouton ci-dessus.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  const [p, setP] = useState(plan);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState("");
  const queryClient = useQueryClient();

  const isFree = ((p as any).price_cdf ?? p.price_usd ?? 0) === 0;

  // Détermination de la couleur d'accent selon l'ID ou le prix
  const accentScheme = useMemo(() => {
    if (p.id === "free" || isFree) {
      return {
        bar: "bg-slate-400",
        badge: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
        icon: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
      };
    }
    if (p.id === "pro") {
      return {
        bar: "bg-emerald-500",
        badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
        icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
      };
    }
    return {
      bar: "bg-primary",
      badge: "bg-primary/10 text-primary",
      icon: "bg-primary/10 text-primary",
    };
  }, [p.id, isFree]);

  async function handleSave() {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("plans")
        .update({
          name: p.name,
          price_cdf: (p as any).price_cdf,
          price_usd: 0,
          max_products: p.max_products,
          max_photos: p.max_photos,
          max_active_promotions: (p as any).max_active_promotions,
          promo_templates: (p as any).promo_templates,
          meta_access: p.meta_access,
          advanced_themes: p.advanced_themes,
          advanced_stats: p.advanced_stats,
          active: p.active,
        } as any)
        .eq("id", p.id);

      if (error) throw error;

      await logAction("plan.update", p.id, { price_cdf: (p as any).price_cdf, max_products: p.max_products });
      toast.success(`Plan "${p.name}" mis à jour avec succès !`);
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      queryClient.invalidateQueries({ queryKey: ["plans-active"] });
      queryClient.invalidateQueries({ queryKey: ["plan-prices"] });
      setIsEditing(false);
    } catch (cause: any) {
      toast.error(cause?.message || "Erreur de sauvegarde");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRemovePlan() {
    try {
      const { error } = await supabase.from("plans").delete().eq("id", p.id);
      if (error) throw error;
      await logAction("plan.delete", p.id);
      toast.success("Plan supprimé définitivement");
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      queryClient.invalidateQueries({ queryKey: ["plans-active"] });
    } catch (cause: any) {
      toast.error(cause?.message || "Erreur lors de la suppression");
    }
  }

  function handleCancel() {
    setP(plan);
    setIsEditing(false);
    setConfirmDelete("");
  }

  return (
    <div
      className={`group relative flex flex-col justify-between rounded-2xl border bg-card p-5 sm:p-6 shadow-xs transition-all duration-200 hover:shadow-md ${
        p.active
          ? "border-border/80 hover:border-primary/40"
          : "opacity-75 bg-muted/10 border-dashed"
      }`}
    >
      {/* Top accent bar */}
      <div className={`absolute inset-x-0 top-0 h-1 rounded-t-2xl ${p.active ? accentScheme.bar : "bg-muted"}`} />

      <div className="space-y-4">
        {/* Header row: ID & Status */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md">
            <Zap className="h-3 w-3 text-primary" />
            {p.id}
          </div>

          <div className="flex items-center gap-1.5">
            {p.active ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Actif
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground border">
                Inactif
              </span>
            )}
          </div>
        </div>

        {/* Plan Name & Pricing */}
        <div>
          {isEditing ? (
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase">Nom d'affichage</Label>
              <Input
                value={p.name ?? ""}
                onChange={(e) => setP({ ...p, name: e.target.value })}
                className="font-bold text-base h-10 rounded-xl"
              />
            </div>
          ) : (
            <h3 className="text-xl font-black text-foreground tracking-tight">{p.name}</h3>
          )}

          <div className="mt-2 flex items-baseline gap-1.5">
            {isEditing ? (
              <div className="w-full space-y-1 mt-2">
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase">Prix mensuel (FC / CDF)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-xs">FC</span>
                  <Input
                    type="number"
                    step="1000"
                    min="0"
                    value={(p as any).price_cdf ?? 0}
                    onChange={(e) => setP({ ...p, price_cdf: Number(e.target.value) || 0 } as any)}
                    className="font-mono font-bold text-base h-10 rounded-xl pl-10"
                  />
                </div>
              </div>
            ) : isFree ? (
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-foreground">Gratuit</span>
                <span className="text-xs text-muted-foreground font-medium">· Sans engagement</span>
              </div>
            ) : (
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-foreground tracking-tight">
                  {formatCDF((p as any).price_cdf ?? 0)}
                </span>
                <span className="text-xs text-muted-foreground font-medium">/ mois</span>
              </div>
            )}
          </div>
        </div>

        {/* Quotas Grid */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          {/* Produits */}
          <div className="p-2.5 rounded-xl border bg-muted/20 text-center space-y-1">
            <div className="flex items-center justify-center gap-1 text-[10px] uppercase font-bold text-muted-foreground">
              <Box className="h-3 w-3 text-primary" />
              <span>Produits</span>
            </div>
            {isEditing ? (
              <Input
                type="number"
                min="0"
                placeholder="Illimité"
                value={p.max_products ?? ""}
                onChange={(e) =>
                  setP({ ...p, max_products: e.target.value ? Number(e.target.value) : null })
                }
                className="h-8 font-mono text-center text-xs p-1 rounded-lg"
              />
            ) : (
              <p className="font-extrabold text-sm text-foreground">
                {p.max_products != null ? p.max_products : "Illimité"}
              </p>
            )}
          </div>

          {/* Photos */}
          <div className="p-2.5 rounded-xl border bg-muted/20 text-center space-y-1">
            <div className="flex items-center justify-center gap-1 text-[10px] uppercase font-bold text-muted-foreground">
              <ImageIcon className="h-3 w-3 text-emerald-500" />
              <span>Photos</span>
            </div>
            {isEditing ? (
              <Input
                type="number"
                min="1"
                value={p.max_photos ?? 1}
                onChange={(e) => setP({ ...p, max_photos: Number(e.target.value) || 1 })}
                className="h-8 font-mono text-center text-xs p-1 rounded-lg"
              />
            ) : (
              <p className="font-extrabold text-sm text-foreground">
                {p.max_photos ?? 1} <span className="text-[10px] font-normal text-muted-foreground">/ prod.</span>
              </p>
            )}
          </div>

          {/* Promotions */}
          <div className="p-2.5 rounded-xl border bg-muted/20 text-center space-y-1">
            <div className="flex items-center justify-center gap-1 text-[10px] uppercase font-bold text-muted-foreground">
              <Tag className="h-3 w-3 text-amber-500" />
              <span>Promos</span>
            </div>
            {isEditing ? (
              <Input
                type="number"
                min="0"
                placeholder="Illimité"
                value={(p as any).max_active_promotions ?? ""}
                onChange={(e) =>
                  setP({
                    ...p,
                    max_active_promotions: e.target.value ? Number(e.target.value) : null,
                  } as any)
                }
                className="h-8 font-mono text-center text-xs p-1 rounded-lg"
              />
            ) : (
              <p className="font-extrabold text-sm text-foreground">
                {(p as any).max_active_promotions != null ? (p as any).max_active_promotions : "Illimité"}
              </p>
            )}
          </div>
        </div>

        {/* Features List */}
        <div className="space-y-1.5 pt-2 border-t border-border/60">
          <FeatureRow
            icon={Facebook}
            iconColor="text-blue-500"
            label="Accès API Meta (Facebook & IG)"
            active={p.meta_access}
            isEditing={isEditing}
            onChange={(v) => setP({ ...p, meta_access: v })}
          />
          <FeatureRow
            icon={Palette}
            iconColor="text-purple-500"
            label="Thèmes & Styles Avancés"
            active={p.advanced_themes}
            isEditing={isEditing}
            onChange={(v) => setP({ ...p, advanced_themes: v })}
          />
          <FeatureRow
            icon={BarChart3}
            iconColor="text-amber-500"
            label="Statistiques & Rapports Pro"
            active={p.advanced_stats}
            isEditing={isEditing}
            onChange={(v) => setP({ ...p, advanced_stats: v })}
          />
          <FeatureRow
            icon={CheckCircle2}
            iconColor="text-emerald-500"
            label="Proposer ce plan aux marchands"
            active={p.active}
            isEditing={isEditing}
            onChange={(v) => setP({ ...p, active: v })}
          />
        </div>
      </div>

      {/* Card Footer Actions */}
      <div className="pt-5 border-t border-border/60 flex items-center gap-2 mt-4">
        {!isEditing ? (
          <Button
            variant="outline"
            className="w-full rounded-xl h-10 font-bold text-xs hover:bg-muted"
            onClick={() => setIsEditing(true)}
          >
            <Edit2 className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" /> Modifier la formule
          </Button>
        ) : (
          <div className="flex items-center gap-2 w-full">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl h-10 px-3 text-destructive border-destructive/30 hover:bg-destructive/10 shrink-0"
                  disabled={isSaving}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="w-[calc(100%-2rem)] max-w-md rounded-2xl">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-destructive flex items-center gap-2">
                    <Trash2 className="h-5 w-5" /> Supprimer ce plan ?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-xs">
                    Cette action est irréversible. Pour confirmer la suppression, veuillez taper exactement :
                    <br />
                    <strong className="select-all block mt-2 text-foreground font-mono bg-muted p-2 rounded text-center">
                      je supprime le plan {p.name}
                    </strong>
                  </AlertDialogDescription>
                  <Input
                    placeholder={`je supprime le plan ${p.name}`}
                    value={confirmDelete}
                    onChange={(e) => setConfirmDelete(e.target.value)}
                    className="mt-3 rounded-xl text-xs"
                  />
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2 mt-2">
                  <AlertDialogCancel onClick={() => setConfirmDelete("")} className="rounded-xl">
                    Annuler
                  </AlertDialogCancel>
                  <AlertDialogAction
                    disabled={confirmDelete !== `je supprime le plan ${p.name}`}
                    className="rounded-xl bg-destructive hover:bg-destructive/90 font-bold"
                    onClick={handleRemovePlan}
                  >
                    Supprimer définitivement
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={isSaving}
              className="rounded-xl h-10 px-3"
            >
              <X className="h-4 w-4" />
            </Button>

            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 rounded-xl h-10 font-bold shadow-xs"
            >
              {isSaving ? "Enregistrement..." : <><Save className="mr-1.5 h-4 w-4" /> Enregistrer</>}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function FeatureRow({
  icon: Icon,
  iconColor,
  label,
  active,
  isEditing,
  onChange,
}: {
  icon: any;
  iconColor: string;
  label: string;
  active: boolean;
  isEditing: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between p-2 rounded-xl text-xs transition-colors hover:bg-muted/30">
      <div className="flex items-center gap-2.5 min-w-0 pr-2">
        <Icon className={`h-4 w-4 shrink-0 ${iconColor}`} />
        <span className="font-medium text-foreground truncate">{label}</span>
      </div>

      {isEditing ? (
        <Switch checked={active} onCheckedChange={onChange} />
      ) : active ? (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
          <Check className="h-3.5 w-3.5" /> Inclus
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground/60 shrink-0">
          <Minus className="h-3.5 w-3.5" /> Non
        </span>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  subtext,
  icon: Icon,
  accent = "primary",
}: {
  label: string;
  value: string | number;
  subtext?: string;
  icon: any;
  accent?: "green" | "amber" | "blue" | "primary";
}) {
  const accentClasses = {
    primary: "from-primary/20 to-transparent text-primary bg-primary/10 border-primary/20",
    green: "from-emerald-500/20 to-transparent text-emerald-600 bg-emerald-500/10 border-emerald-500/20",
    amber: "from-amber-500/20 to-transparent text-amber-600 bg-amber-500/10 border-amber-500/20",
    blue: "from-blue-500/20 to-transparent text-blue-600 bg-blue-500/10 border-blue-500/20",
  }[accent];

  const barClasses = {
    primary: "bg-primary",
    green: "bg-emerald-500",
    amber: "bg-amber-500",
    blue: "bg-blue-500",
  }[accent];

  return (
    <div className="group relative overflow-hidden rounded-2xl border bg-card p-4 sm:p-5 shadow-xs transition-all duration-200 hover:shadow-md hover:border-primary/30">
      <div className={`absolute inset-x-0 top-0 h-0.5 ${barClasses}`} />
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
        <div className={`rounded-xl p-2.5 border transition-transform duration-200 group-hover:scale-110 ${accentClasses}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3">
        <div className="text-2xl sm:text-3xl font-black tracking-tight">{value}</div>
        {subtext && <p className="mt-1 text-xs text-muted-foreground">{subtext}</p>}
      </div>
    </div>
  );
}
