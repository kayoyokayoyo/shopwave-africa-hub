import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Users, ShieldCheck, Clock3, Store, Search, X, RefreshCw, AlertTriangle,
  Trash2, Mail, ExternalLink, MoreVertical, Eye, Copy, Check, Phone,
  Calendar, Ban, CheckCircle2, UserCheck, UserX, Sparkles, MapPin, Lock, EyeOff
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logAction } from "@/hooks/useIsAdmin";
import { supabase } from "@/integrations/supabase/client";
import { deleteMerchant } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/commercants")({
  component: Merchants,
});

type MerchantFilter = "all" | "active" | "pending" | "suspended" | "withoutShop";

interface ShopData {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  plan_id?: string | null;
  city?: string | null;
  created_at?: string | null;
  views?: number | null;
  is_suspended?: boolean | null;
}

interface PlanData {
  id: string;
  name: string;
}

interface ProfileData {
  id: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: "active" | "pending" | "suspended" | string | null;
  role?: string | null;
  created_at?: string | null;
  avatar_url?: string | null;
  shop?: ShopData | null;
  plan?: PlanData | null;
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "Non renseignée";
  try {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(dateStr);
  }
}

function initials(name?: string | null, email?: string | null) {
  return (name?.trim() || email?.trim() || "?")
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function Merchants() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MerchantFilter>("all");
  const [selectedMerchant, setSelectedMerchant] = useState<ProfileData | null>(null);
  const [merchantToToggle, setMerchantToToggle] = useState<{ merchant: ProfileData; newStatus: "active" | "suspended" } | null>(null);
  const [merchantToDelete, setMerchantToDelete] = useState<ProfileData | null>(null);
  const [confirmInput, setConfirmInput] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminPasswordError, setAdminPasswordError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const queryClient = useQueryClient();
  const deleteMerchantFn = useServerFn(deleteMerchant);

  const { data, isFetching, isLoading, refetch } = useQuery({
    queryKey: ["adminMerchants"],
    queryFn: async () => {
      const [
        { data: profiles, error: profilesError },
        { data: shops, error: shopsError },
        { data: plans, error: plansError },
        { data: authData, error: authError },
      ] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("shops").select("id,owner_id,name,slug,plan_id,city,created_at,views,is_suspended"),
        supabase.from("plans").select("id,name"),
        supabase.auth.getUser(),
      ]);

      if (profilesError) throw profilesError;
      if (shopsError) throw shopsError;
      if (authError) throw authError;

      const plansMap = new Map<string, PlanData>(
        (plans ?? []).map((p: any) => [p.id, { id: p.id, name: p.name }])
      );

      const enrichedMerchants: ProfileData[] = (profiles ?? []).map((profile) => {
        const shop = shops?.find((s) => s.owner_id === profile.id) || null;
        const plan = shop?.plan_id ? plansMap.get(shop.plan_id) || null : null;
        return {
          ...profile,
          shop,
          plan,
        };
      });

      return {
        currentUserId: authData.user?.id ?? null,
        merchants: enrichedMerchants,
      };
    },
  });

  const merchants = data?.merchants ?? [];
  const currentUserId = data?.currentUserId;

  const counts = useMemo(() => {
    return {
      all: merchants.length,
      active: merchants.filter((m) => m.status === "active").length,
      pending: merchants.filter((m) => m.status === "pending").length,
      suspended: merchants.filter((m) => m.status === "suspended").length,
      withoutShop: merchants.filter((m) => !m.shop).length,
      withShop: merchants.filter((m) => !!m.shop).length,
    };
  }, [merchants]);

  const filteredMerchants = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return merchants.filter((merchant) => {
      const matchesSearch =
        !normalized ||
        [
          merchant.email ?? "",
          merchant.full_name ?? "",
          merchant.phone ?? "",
          merchant.shop?.name ?? "",
          merchant.shop?.city ?? "",
          merchant.plan?.name ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalized);

      const matchesFilter =
        filter === "all" ||
        (filter === "withoutShop" ? !merchant.shop : merchant.status === filter);

      return matchesSearch && matchesFilter;
    });
  }, [merchants, query, filter]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copié dans le presse-papier");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleUpdateStatus = async (merchant: ProfileData, newStatus: "active" | "suspended") => {
    setIsProcessing(true);
    try {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ status: newStatus })
        .eq("id", merchant.id);

      if (updateError) throw updateError;

      await logAction(`merchant.${newStatus}`, merchant.id);
      toast.success(newStatus === "active" ? "Compte réactivé avec succès" : "Compte suspendu");
      setMerchantToToggle(null);
      setConfirmInput("");
      if (selectedMerchant?.id === merchant.id) {
        setSelectedMerchant((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
      await queryClient.invalidateQueries({ queryKey: ["adminMerchants"] });
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de la mise à jour du statut");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteMerchant = async (merchant: ProfileData) => {
    setAdminPasswordError("");
    if (!adminPassword.trim()) {
      setAdminPasswordError("Veuillez saisir votre mot de passe administrateur.");
      return;
    }
    setIsProcessing(true);
    try {
      // 1. Vérifier le mot de passe admin avant toute suppression
      const { data: { user: adminUser } } = await supabase.auth.getUser();
      if (!adminUser?.email) throw new Error("Session admin introuvable");
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: adminUser.email,
        password: adminPassword,
      });
      if (authError) {
        setAdminPasswordError("Mot de passe incorrect. Veuillez réessayer.");
        setIsProcessing(false);
        return;
      }
      // 2. Suppression effective (avec email de notification inclus côté serveur)
      await deleteMerchantFn({ data: { userId: merchant.id } });
      toast.success("Commerçant supprimé définitivement. Un e-mail de confirmation a été envoyé.");
      setMerchantToDelete(null);
      setConfirmInput("");
      setAdminPassword("");
      setAdminPasswordError("");
      if (selectedMerchant?.id === merchant.id) {
        setSelectedMerchant(null);
      }
      await queryClient.invalidateQueries({ queryKey: ["adminMerchants"] });
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de la suppression");
    } finally {
      setIsProcessing(false);
    }
  };

  const FILTERS: { id: MerchantFilter; label: string; count: number; dotColor?: string }[] = [
    { id: "all", label: "Tous", count: counts.all },
    { id: "active", label: "Actifs", count: counts.active, dotColor: "bg-emerald-500" },
    { id: "pending", label: "En attente", count: counts.pending, dotColor: "bg-amber-500" },
    { id: "suspended", label: "Suspendus", count: counts.suspended, dotColor: "bg-rose-500" },
    { id: "withoutShop", label: "Sans boutique", count: counts.withoutShop, dotColor: "bg-slate-400" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-2">
            <Users className="h-3.5 w-3.5" />
            Administration Marchands
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Commerçants & Utilisateurs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gérez l'ensemble des comptes de la plateforme, leurs boutiques et leurs accès.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="h-10 rounded-xl px-4 font-semibold shadow-xs hover:bg-muted"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin text-primary" : ""}`} />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-3.5 sm:gap-4 lg:grid-cols-4">
        <MetricCard
          label="Total Marchands"
          value={counts.all}
          subtext={`${counts.withShop} avec boutique`}
          icon={Users}
          accent="blue"
        />
        <MetricCard
          label="Comptes Actifs"
          value={counts.active}
          subtext={`${counts.all ? Math.round((counts.active / counts.all) * 100) : 0}% du total`}
          icon={ShieldCheck}
          accent="green"
        />
        <MetricCard
          label="En Attente"
          value={counts.pending}
          subtext={counts.pending > 0 ? "Validation requise" : "Aucun dossier en attente"}
          icon={Clock3}
          accent="amber"
        />
        <MetricCard
          label="Suspendus"
          value={counts.suspended}
          subtext={counts.suspended > 0 ? "Accès révoqué" : "Aucun compte suspendu"}
          icon={Ban}
          accent="rose"
        />
      </div>

      {/* Main Table / List Card */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        {/* Controls Bar */}
        <div className="p-4 sm:p-5 border-b space-y-4 bg-muted/5">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-10 pl-9 pr-9 rounded-xl border-muted-foreground/20 bg-background"
                placeholder="Rechercher par nom, email, téléphone, boutique..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="text-xs text-muted-foreground font-medium sm:text-right">
              {filteredMerchants.length} {filteredMerchants.length > 1 ? "marchands trouvés" : "marchand trouvé"}
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {FILTERS.map((item) => {
              const active = filter === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setFilter(item.id)}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 ${
                    active
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {item.dotColor && !active && (
                    <span className={`h-2 w-2 rounded-full ${item.dotColor}`} />
                  )}
                  <span>{item.label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                      active ? "bg-primary-foreground/25 text-primary-foreground" : "bg-background/80 text-foreground"
                    }`}
                  >
                    {item.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Merchants List */}
        <div className="divide-y divide-border/60">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-4 animate-pulse">
                  <div className="h-12 w-12 rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/4 rounded bg-muted" />
                    <div className="h-3 w-1/3 rounded bg-muted" />
                  </div>
                  <div className="h-8 w-24 rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : filteredMerchants.length === 0 ? (
            <div className="py-16 px-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground mb-3">
                <Users className="h-7 w-7" />
              </div>
              <p className="text-base font-semibold">Aucun commerçant trouvé</p>
              <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
                {query
                  ? "Aucun profil ne correspond à vos critères de recherche. Essayez d'ajuster le filtre ou les mots-clés."
                  : "Aucun marchand enregistré dans cette catégorie pour le moment."}
              </p>
              {query && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setQuery("")}
                  className="mt-4 rounded-xl text-xs"
                >
                  Effacer la recherche
                </Button>
              )}
            </div>
          ) : (
            filteredMerchants.map((m) => {
              const isSelf = m.id === currentUserId;
              const hasShop = !!m.shop;

              return (
                <div
                  key={m.id}
                  className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 hover:bg-muted/30 transition-colors"
                >
                  {/* Left: Avatar & Profile Info */}
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                    <div className="relative shrink-0">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary text-sm font-bold border border-primary/20 shadow-2xs">
                        {initials(m.full_name, m.email)}
                      </div>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-card ${
                          m.status === "active"
                            ? "bg-emerald-500"
                            : m.status === "pending"
                            ? "bg-amber-500"
                            : "bg-rose-500"
                        }`}
                        title={m.status ?? "inconnu"}
                      />
                    </div>

                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-sm text-foreground truncate">
                          {m.full_name || "Commerçant sans nom"}
                        </span>
                        {m.role === "admin" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                            <ShieldCheck className="h-3 w-3" /> Admin
                          </span>
                        )}
                        {isSelf && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                            Vous
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="truncate max-w-[220px]">{m.email}</span>
                        {m.phone && (
                          <span className="inline-flex items-center gap-1 text-muted-foreground/80">
                            <Phone className="h-3 w-3" /> {m.phone}
                          </span>
                        )}
                        <span className="text-[11px] text-muted-foreground/60 hidden md:inline">
                          Inscrit le {formatDate(m.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Middle / Right: Shop Badge & Actions */}
                  <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 sm:pl-0 pl-14">
                    {/* Shop information */}
                    {hasShop ? (
                      <div className="flex items-center gap-2">
                        <Link
                          to="/admin/boutiques/$shopId"
                          params={{ shopId: m.shop!.id }}
                          className="group/shop inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border bg-background/80 hover:bg-accent text-xs font-semibold text-foreground transition-all duration-150 shadow-2xs hover:border-primary/40"
                        >
                          <Store className="h-3.5 w-3.5 text-primary group-hover/shop:scale-110 transition-transform" />
                          <span className="max-w-[140px] truncate">{m.shop!.name}</span>
                          {m.plan && (
                            <span className="ml-1 px-1.5 py-0.2 rounded-md bg-primary/10 text-primary text-[10px] font-bold">
                              {m.plan.name}
                            </span>
                          )}
                          <ExternalLink className="h-3 w-3 text-muted-foreground/60" />
                        </Link>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs text-muted-foreground bg-muted/50 border border-dashed border-border/80">
                        <Store className="h-3 w-3 opacity-60" />
                        Pas de boutique
                      </span>
                    )}

                    {/* Status Pill */}
                    <div className="shrink-0">
                      {m.status === "active" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Actif
                        </span>
                      ) : m.status === "pending" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                          En attente
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                          Suspendu
                        </span>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedMerchant(m)}
                        className="h-8 rounded-xl px-2.5 text-xs font-semibold hover:bg-muted text-foreground"
                      >
                        <Eye className="h-3.5 w-3.5 sm:mr-1.5" />
                        <span className="hidden sm:inline">Détails</span>
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 rounded-xl hover:bg-muted"
                          >
                            <MoreVertical className="h-4 w-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 rounded-xl p-1.5 shadow-lg">
                          <DropdownMenuItem
                            onClick={() => setSelectedMerchant(m)}
                            className="rounded-lg text-xs font-medium cursor-pointer"
                          >
                            <Eye className="mr-2 h-4 w-4 text-muted-foreground" />
                            Voir la fiche
                          </DropdownMenuItem>

                          {m.email && (
                            <DropdownMenuItem asChild className="rounded-lg text-xs font-medium cursor-pointer">
                              <a href={`mailto:${m.email}?subject=Support ShopWave`}>
                                <Mail className="mr-2 h-4 w-4 text-muted-foreground" />
                                Envoyer un e-mail
                              </a>
                            </DropdownMenuItem>
                          )}

                          {hasShop && (
                            <DropdownMenuItem asChild className="rounded-lg text-xs font-medium cursor-pointer">
                              <Link to="/admin/boutiques/$shopId" params={{ shopId: m.shop!.id }}>
                                <Store className="mr-2 h-4 w-4 text-muted-foreground" />
                                Gérer la boutique
                              </Link>
                            </DropdownMenuItem>
                          )}

                          <DropdownMenuSeparator className="my-1" />

                          {m.status !== "active" && (
                            <DropdownMenuItem
                              onClick={() => setMerchantToToggle({ merchant: m, newStatus: "active" })}
                              className="rounded-lg text-xs font-semibold text-emerald-600 focus:text-emerald-700 cursor-pointer"
                            >
                              <UserCheck className="mr-2 h-4 w-4" />
                              Activer le compte
                            </DropdownMenuItem>
                          )}

                          {m.status !== "suspended" && !isSelf && (
                            <DropdownMenuItem
                              onClick={() => setMerchantToToggle({ merchant: m, newStatus: "suspended" })}
                              className="rounded-lg text-xs font-semibold text-amber-600 focus:text-amber-700 cursor-pointer"
                            >
                              <UserX className="mr-2 h-4 w-4" />
                              Suspendre le compte
                            </DropdownMenuItem>
                          )}

                          {!isSelf && (
                            <DropdownMenuItem
                              onClick={() => setMerchantToDelete(m)}
                              className="rounded-lg text-xs font-semibold text-rose-600 focus:text-rose-700 cursor-pointer"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Supprimer le compte
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal: Merchant Quick Details */}
      <Dialog open={!!selectedMerchant} onOpenChange={(open) => !open && setSelectedMerchant(null)}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-xl p-0 overflow-hidden rounded-2xl border shadow-xl">
          {selectedMerchant && (
            <div>
              {/* Header Banner */}
              <div className="relative bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 border-b">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-card border text-lg font-black text-primary shadow-xs">
                    {initials(selectedMerchant.full_name, selectedMerchant.email)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-bold truncate">
                        {selectedMerchant.full_name || "Commerçant"}
                      </h3>
                      {selectedMerchant.role === "admin" && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200">
                          Administrateur
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{selectedMerchant.email}</p>
                    <div className="mt-2 flex items-center gap-2">
                      {selectedMerchant.status === "active" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Compte actif
                        </span>
                      ) : selectedMerchant.status === "pending" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                          <Clock3 className="h-3 w-3 text-amber-600" /> En attente de validation
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                          <Ban className="h-3 w-3 text-rose-600" /> Compte suspendu
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Body Content */}
              <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
                {/* Profile Information Block */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                    Informations Utilisateur
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="p-3 rounded-xl border bg-muted/10">
                      <div className="text-xs text-muted-foreground font-medium mb-1">Identifiant (UUID)</div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs truncate">{selectedMerchant.id}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 shrink-0"
                          onClick={() => copyToClipboard(selectedMerchant.id, "id")}
                        >
                          {copiedId === "id" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                        </Button>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl border bg-muted/10">
                      <div className="text-xs text-muted-foreground font-medium mb-1">Date d'inscription</div>
                      <div className="font-semibold text-xs flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        {formatDate(selectedMerchant.created_at)}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl border bg-muted/10">
                      <div className="text-xs text-muted-foreground font-medium mb-1">Téléphone</div>
                      <div className="font-semibold text-xs flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                        {selectedMerchant.phone || "Non renseigné"}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl border bg-muted/10">
                      <div className="text-xs text-muted-foreground font-medium mb-1">E-mail</div>
                      <div className="font-semibold text-xs truncate flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                        {selectedMerchant.email}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Boutique Block */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                    Boutique Rattachée
                  </h4>
                  {selectedMerchant.shop ? (
                    <div className="rounded-xl border p-4 bg-muted/10 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
                            <Store className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-bold text-sm">{selectedMerchant.shop.name}</div>
                            <div className="text-xs text-muted-foreground font-mono">
                              /{selectedMerchant.shop.slug}
                            </div>
                          </div>
                        </div>

                        {selectedMerchant.plan && (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-primary text-primary-foreground shadow-2xs">
                            {selectedMerchant.plan.name}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border/50">
                        <div>
                          <span className="text-muted-foreground">Ville: </span>
                          <span className="font-semibold">{selectedMerchant.shop.city || "Non spécifiée"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Vues: </span>
                          <span className="font-semibold">{selectedMerchant.shop.views ?? 0}</span>
                        </div>
                      </div>

                      <div className="pt-2 flex flex-wrap gap-2">
                        <Button asChild size="sm" className="rounded-xl h-8 text-xs font-bold">
                          <Link to="/admin/boutiques/$shopId" params={{ shopId: selectedMerchant.shop.id }}>
                            <Store className="mr-1.5 h-3.5 w-3.5" />
                            Gérer cette boutique
                          </Link>
                        </Button>
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="rounded-xl h-8 text-xs font-semibold"
                        >
                          <a
                            href={`https://${selectedMerchant.shop.slug}.marketnet.cd`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                            Voir en ligne
                          </a>
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground bg-muted/5">
                      <Store className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                      Ce marchand n'a pas encore configuré de boutique.
                    </div>
                  )}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="p-4 bg-muted/20 border-t flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedMerchant(null)}
                  className="rounded-xl h-9"
                >
                  Fermer
                </Button>

                <div className="flex flex-wrap items-center gap-2">
                  {selectedMerchant.email && (
                    <Button asChild variant="outline" size="sm" className="rounded-xl h-9">
                      <a href={`mailto:${selectedMerchant.email}`}>
                        <Mail className="mr-1.5 h-3.5 w-3.5" /> Contacter
                      </a>
                    </Button>
                  )}

                  {selectedMerchant.id !== currentUserId && (
                    <>
                      {selectedMerchant.status === "active" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setMerchantToToggle({ merchant: selectedMerchant, newStatus: "suspended" });
                          }}
                          className="rounded-xl h-9 text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                        >
                          <Ban className="mr-1.5 h-3.5 w-3.5" /> Suspendre
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => {
                            setMerchantToToggle({ merchant: selectedMerchant, newStatus: "active" });
                          }}
                          className="rounded-xl h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                        >
                          <Check className="mr-1.5 h-3.5 w-3.5" /> Réactiver
                        </Button>
                      )}

                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setMerchantToDelete(selectedMerchant)}
                        className="rounded-xl h-9 font-bold"
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Supprimer
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog: Status Change (Activate / Suspend) */}
      <AlertDialog
        open={!!merchantToToggle}
        onOpenChange={(open) => {
          if (!open) {
            setMerchantToToggle(null);
            setConfirmInput("");
          }
        }}
      >
        <AlertDialogContent className="w-[calc(100%-2rem)] max-w-md rounded-2xl">
          {merchantToToggle && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-lg">
                  {merchantToToggle.newStatus === "active" ? (
                    <>
                      <UserCheck className="h-5 w-5 text-emerald-600" />
                      Activer le compte commerçant
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                      Suspendre le compte commerçant
                    </>
                  )}
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm">
                  {merchantToToggle.newStatus === "active" ? (
                    <>
                      Le compte de <strong>{merchantToToggle.merchant.full_name || merchantToToggle.merchant.email}</strong> sera réactivé immédiatement. Il pourra à nouveau se connecter et administrer ses ventes.
                    </>
                  ) : (
                    <>
                      Le compte de <strong>{merchantToToggle.merchant.full_name || merchantToToggle.merchant.email}</strong> sera suspendu. Ses accès seront révoqués jusqu'à nouvel ordre.
                    </>
                  )}
                </AlertDialogDescription>

                {merchantToToggle.newStatus === "suspended" && (
                  <div className="pt-2 text-left">
                    <p className="text-xs text-muted-foreground mb-1">
                      Tapez <strong>{merchantToToggle.merchant.email}</strong> pour confirmer :
                    </p>
                    <Input
                      placeholder={merchantToToggle.merchant.email ?? ""}
                      value={confirmInput}
                      onChange={(e) => setConfirmInput(e.target.value)}
                      className="rounded-xl text-xs"
                    />
                  </div>
                )}
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2 mt-4">
                <AlertDialogCancel className="rounded-xl">Annuler</AlertDialogCancel>
                <AlertDialogAction
                  disabled={
                    isProcessing ||
                    (merchantToToggle.newStatus === "suspended" &&
                      confirmInput !== merchantToToggle.merchant.email)
                  }
                  onClick={() => handleUpdateStatus(merchantToToggle.merchant, merchantToToggle.newStatus)}
                  className={`rounded-xl font-bold ${
                    merchantToToggle.newStatus === "active"
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "bg-amber-600 hover:bg-amber-700 text-white"
                  }`}
                >
                  {isProcessing ? "Traitement..." : merchantToToggle.newStatus === "active" ? "Confirmer l'activation" : "Confirmer la suspension"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation Dialog: Delete Merchant (avec mot de passe admin) */}
      <AlertDialog
        open={!!merchantToDelete}
        onOpenChange={(open) => {
          if (!open) {
            setMerchantToDelete(null);
            setConfirmInput("");
            setAdminPassword("");
            setAdminPasswordError("");
            setShowAdminPassword(false);
          }
        }}
      >
        <AlertDialogContent className="w-[calc(100%-2rem)] max-w-md rounded-2xl">
          {merchantToDelete && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-lg text-rose-600">
                  <Trash2 className="h-5 w-5" />
                  Suppression irréversible
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm text-muted-foreground">
                  Vous êtes sur le point de supprimer définitivement le compte de{" "}
                  <strong className="text-foreground">{merchantToDelete.full_name || merchantToDelete.email}</strong>,
                  sa boutique et toutes ses données. Cette action est <strong className="text-rose-600">irréversible</strong>.
                  Un e-mail de confirmation sera envoyé automatiquement au commerçant.
                </AlertDialogDescription>

                {/* Récapitulatif commerçant */}
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-left space-y-1 mt-1">
                  <p className="text-xs font-semibold text-rose-700 uppercase tracking-wide">Compte ciblé</p>
                  <p className="text-sm font-bold text-rose-900">{merchantToDelete.full_name || "Sans nom"}</p>
                  <p className="text-xs text-rose-700">{merchantToDelete.email}</p>
                  {merchantToDelete.shop && (
                    <p className="text-xs text-rose-600">Boutique : <strong>{merchantToDelete.shop.name}</strong></p>
                  )}
                </div>

                {/* Champ mot de passe admin */}
                <div className="pt-2 text-left space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Lock className="h-3.5 w-3.5 text-rose-600" />
                    Confirmez avec votre mot de passe administrateur
                  </label>
                  <div className="relative">
                    <Input
                      type={showAdminPassword ? "text" : "password"}
                      placeholder="Votre mot de passe admin..."
                      value={adminPassword}
                      onChange={(e) => { setAdminPassword(e.target.value); setAdminPasswordError(""); }}
                      className="rounded-xl pr-10 text-sm border-rose-200 focus:border-rose-400"
                      onKeyDown={(e) => { if (e.key === "Enter") handleDeleteMerchant(merchantToDelete); }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminPassword(!showAdminPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showAdminPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {adminPasswordError && (
                    <p className="text-xs text-rose-600 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {adminPasswordError}
                    </p>
                  )}
                </div>
              </AlertDialogHeader>

              <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2 mt-4">
                <AlertDialogCancel className="rounded-xl">Annuler</AlertDialogCancel>
                <AlertDialogAction
                  disabled={isProcessing || !adminPassword.trim()}
                  onClick={(e) => { e.preventDefault(); handleDeleteMerchant(merchantToDelete); }}
                  className="rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold"
                >
                  {isProcessing ? (
                    <span className="flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Suppression...</span>
                  ) : "Supprimer définitivement"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
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
  accent?: "green" | "amber" | "blue" | "primary" | "rose";
}) {
  const accentClasses = {
    primary: "from-primary/20 to-transparent text-primary bg-primary/10 border-primary/20",
    green: "from-emerald-500/20 to-transparent text-emerald-600 bg-emerald-500/10 border-emerald-500/20",
    amber: "from-amber-500/20 to-transparent text-amber-600 bg-amber-500/10 border-amber-500/20",
    blue: "from-blue-500/20 to-transparent text-blue-600 bg-blue-500/10 border-blue-500/20",
    rose: "from-rose-500/20 to-transparent text-rose-600 bg-rose-500/10 border-rose-500/20",
  }[accent];

  const barClasses = {
    primary: "bg-primary",
    green: "bg-emerald-500",
    amber: "bg-amber-500",
    blue: "bg-blue-500",
    rose: "bg-rose-500",
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
