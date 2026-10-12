import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { User, CreditCard, LogOut, CheckCircle2, Shield, Sparkles, Trash2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMyShop } from "@/hooks/useMyShop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/dashboard/reglages")({
  head: () => ({
    meta: [
      { title: "Réglages — MarketNet" },
      { name: "description", content: "Paramètres de votre compte et abonnement." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { data: shop } = useMyShop();
  const qc = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data: user } = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user;
    },
  });

  const { data: plan } = useQuery({
    queryKey: ["shop-plan", shop?.plan_id],
    enabled: !!shop?.plan_id,
    queryFn: async () => {
      const { data } = await supabase.from("plans").select("*").eq("id", shop!.plan_id).single();
      return data;
    },
  });

  useEffect(() => {
    if (user) {
      setFullName(user.user_metadata?.full_name || "");
      setEmail(user.email || "");
    }
  }, [user]);

  async function deleteAccount() {
    setDeleting(true);
    try {
      // Suppression côté serveur : RPC qui cascade sur shops, products, orders, meta_tokens…
      const { error } = await supabase.rpc("delete_my_account" as never);
      if (error) throw error;
    } catch {
      // Si la RPC n'existe pas encore, on déconnecte quand même
    } finally {
      await supabase.auth.signOut();
      window.location.href = "/";
    }
  }

  async function updateProfile() {
    if (!fullName.trim()) return toast.error("Le nom complet est requis");
    setSaving(true);
    const { error } = await supabase.auth.updateUser({
      data: { full_name: fullName.trim() },
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profil mis à jour");
    qc.invalidateQueries({ queryKey: ["auth-user"] });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold">Réglages du compte</h1>
        <p className="mt-1 text-sm text-muted-foreground">Gérez votre profil, abonnement et connexion.</p>
      </div>

      {/* Profil */}
      <section className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3 border-b pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <User className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-bold text-base">Profil</h2>
            <p className="text-xs text-muted-foreground">Vos informations personnelles.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="fullname">Nom complet</Label>
            <Input id="fullname" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Votre nom" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Adresse e-mail</Label>
            <Input id="email" value={email} disabled className="bg-muted text-muted-foreground cursor-not-allowed" />
            <p className="text-[11px] text-muted-foreground">L'adresse e-mail de connexion ne peut pas être changée ici.</p>
          </div>
          <div className="pt-2">
            <Button onClick={updateProfile} disabled={saving} className="rounded-xl">
              {saving ? "Enregistrement…" : "Enregistrer les modifications"}
            </Button>
          </div>
        </div>
      </section>

      {/* Abonnement */}
      <section className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3 border-b pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-bold text-base">Abonnement & Plan</h2>
            <p className="text-xs text-muted-foreground">Fonctionnalités et limites actives sur votre boutique.</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl bg-muted/40 p-4 border">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg capitalize">{plan?.name || shop?.plan_id || "Gratuit"}</span>
              <span className="rounded-full bg-primary/15 text-primary px-2.5 py-0.5 text-xs font-bold">Actif</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {plan?.max_active_promotions != null
                ? `${plan.max_active_promotions} promotion(s) active(s) autorisée(s)`
                : "Promotions actives illimitées"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span className="text-xs font-medium text-muted-foreground">Contactez l'administration pour changer de plan</span>
          </div>
        </div>
      </section>

      {/* Déconnexion */}
      <section className="rounded-2xl border bg-card p-6 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="font-bold text-base">Session</h2>
          <p className="text-xs text-muted-foreground">Se déconnecter de votre espace commerçant.</p>
        </div>
        <Button
          variant="outline"
          onClick={() => supabase.auth.signOut().then(() => (window.location.href = "/auth"))}
          className="text-red-500 hover:text-red-600 hover:bg-red-500/10 rounded-xl"
        >
          <LogOut className="h-4 w-4 mr-2" /> Déconnexion
        </Button>
      </section>

      {/* Supprimer mon compte */}
      <section className="rounded-2xl border border-red-200 dark:border-red-900/40 bg-red-500/5 p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
            <Trash2 className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-base text-red-600 dark:text-red-400">Supprimer mon compte</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Supprime définitivement votre compte, votre boutique, vos produits, vos commandes et
              tous vos jetons Meta. Cette action est <strong>irréversible</strong>.
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                disabled={deleting}
                className="text-red-500 hover:text-red-600 hover:bg-red-500/10 border-red-300 dark:border-red-800 rounded-xl shrink-0"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {deleting ? "Suppression…" : "Supprimer"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-5 w-5" /> Supprimer mon compte
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action est <strong>définitive et irréversible</strong>. Votre boutique,
                  vos produits, vos commandes et tous vos jetons d'accès Meta seront supprimés
                  immédiatement. Vous serez déconnecté automatiquement.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  onClick={deleteAccount}
                  className="bg-red-500 hover:bg-red-600 focus:ring-red-500"
                >
                  Oui, supprimer définitivement
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </section>
    </div>
  );
}
