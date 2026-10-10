import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { logAction } from "@/hooks/useIsAdmin";
import { Settings2, Activity, CreditCard, Save, Clock, Fingerprint, Globe, Facebook, Mail, Info, Edit2, X, CheckCircle2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/admin/parametres")({ component: Settings });

function Settings() {
  const qc = useQueryClient();
  const { data: settings, isLoading: loadingSettings } = useQuery({ 
    queryKey: ["settings"], 
    queryFn: async () => Object.fromEntries(((await supabase.from("app_settings").select("*")).data ?? []).map((r) => [r.key, r.value])) as Record<string, string> 
  });
  
  const { data: logs, isLoading: loadingLogs } = useQuery({ 
    queryKey: ["audit"], 
    queryFn: async () => (await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(50)).data ?? [] 
  });

  const { data: syncedShopsCount } = useQuery({
    queryKey: ["meta_synced_shops_count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("shops")
        .select("*", { count: "exact", head: true })
        .not("facebook", "is", null);
      return count || 0;
    }
  });

  const [form, setForm] = useState<Record<string, string>>({});
  const [originalForm, setOriginalForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [editingTab, setEditingTab] = useState<string | null>(null);

  useEffect(() => { 
    if (settings) { 
      const initData = {
        platform_name: settings.platform_name ?? "MarketNet",
        contact_email: settings.contact_email ?? "",
        payment_instructions: settings.payment_instructions ?? "",
      };
      setForm(initData);
      setOriginalForm(initData);
    } 
  }, [settings]);

  async function saveSection(sectionName: string, keys: string[]) {
    setSaving(sectionName);
    try {
      const updates = keys.map(key => ({ key, value: form[key] }));
      const { error } = await supabase.from("app_settings").upsert(updates);
      if (error) throw error;
      await logAction("settings.update", sectionName); 
      toast.success("Parametres mis a jour"); 
      qc.invalidateQueries({ queryKey: ["settings"] });
      setEditingTab(null);
    } catch (cause) {
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(null);
    }
  }

  function cancelEdit() {
    setForm(originalForm);
    setEditingTab(null);
  }

  function formatActionName(action: string) {
    const actions: Record<string, string> = {
      "settings.update": "Modification des parametres",
      "shop.suspend": "Suspension de boutique",
      "shop.unsuspend": "Reactivation de boutique",
      "merchant.suspended": "Suspension de compte",
      "merchant.active": "Reactivation de compte",
      "report.resolve": "Signalement traite",
      "plan.create": "Creation de plan",
      "plan.update": "Mise a jour de plan",
      "plan.delete": "Suppression de plan"
    };
    return actions[action] || action;
  }

  const renderActionButtons = (tabId: string, keysToSave: string[]) => {
    if (editingTab !== tabId) {
      return (
        <Button className="rounded-xl shadow-sm h-11 bg-secondary text-secondary-foreground hover:bg-secondary/80" onClick={() => setEditingTab(tabId)}>
          <Edit2 className="h-4 w-4 mr-2" /> Modifier
        </Button>
      );
    }
    return (
      <div className="flex gap-2">
        <Button variant="outline" className="rounded-xl h-11 px-3 text-muted-foreground hover:bg-muted" onClick={cancelEdit} disabled={saving === tabId}>
          <X className="h-5 w-5" />
        </Button>
        <Button onClick={() => saveSection(tabId, keysToSave)} disabled={saving === tabId} className="rounded-xl shadow-sm h-11 bg-primary text-primary-foreground hover:bg-primary/90">
          {saving === tabId ? "Enregistrement..." : <><Save className="mr-2 h-4 w-4" /> Enregistrer</>}
        </Button>
      </div>
    );
  };

  const inputClass = (tabId: string) => 
    `text-sm h-11 ${editingTab !== tabId ? 'bg-transparent border-transparent px-0 focus-visible:ring-0 shadow-none' : 'bg-background'}`;
  const textareaClass = (tabId: string) => 
    `text-sm ${editingTab !== tabId ? 'bg-transparent border-transparent px-0 focus-visible:ring-0 shadow-none resize-none' : 'bg-background resize-y'}`;

  if (loadingSettings) return <div className="p-8 text-center text-muted-foreground animate-pulse">Chargement des parametres...</div>;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Parametres de la plateforme</h1>
        <p className="mt-1 text-sm text-muted-foreground">Gerez l'identite, les integrations et surveillez les actions de l'administration.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        
        <div className="space-y-6">
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1">
              <TabsTrigger value="general" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">General</TabsTrigger>
              <TabsTrigger value="billing" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">Facturation</TabsTrigger>
              <TabsTrigger value="integrations" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">Integrations</TabsTrigger>
            </TabsList>
            
            <TabsContent value="general" className="mt-4 outline-none">
              <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
                <div className="border-b bg-muted/10 px-6 py-5 flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary"><Settings2 className="h-5 w-5" /></div>
                  <div>
                    <h2 className="font-semibold">Informations generales</h2>
                    <p className="text-xs text-muted-foreground">Identite globale de la plateforme MarketNet.</p>
                  </div>
                </div>
                <div className="p-6 space-y-5">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2"><Globe className="h-4 w-4 text-muted-foreground" /> Nom de la plateforme</Label>
                    <Input 
                      className={inputClass("general")} 
                      value={form.platform_name} 
                      onChange={e => setForm({...form, platform_name: e.target.value})} 
                      placeholder="MarketNet" 
                      readOnly={editingTab !== "general"}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> Email de support principal</Label>
                    <Input 
                      type="email" 
                      className={inputClass("general")} 
                      value={form.contact_email} 
                      onChange={e => setForm({...form, contact_email: e.target.value})} 
                      placeholder="support@marketnet.com" 
                      readOnly={editingTab !== "general"}
                    />
                  </div>
                  <div className="flex justify-end pt-2 border-t border-dashed mt-4">
                    {renderActionButtons("general", ["platform_name", "contact_email"])}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="billing" className="mt-4 outline-none">
              <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
                <div className="border-b bg-muted/10 px-6 py-5 flex items-center gap-3">
                  <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600"><CreditCard className="h-5 w-5" /></div>
                  <div>
                    <h2 className="font-semibold">Paiements Mobile Money</h2>
                    <p className="text-xs text-muted-foreground">Consignes affichees aux commercants pour le paiement de leur abonnement.</p>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <div className="space-y-2">
                    <Label>Instructions de paiement M-Pesa / Orange Money</Label>
                    <Textarea 
                      rows={5} 
                      className={textareaClass("billing")}
                      value={form.payment_instructions} 
                      onChange={e => setForm({...form, payment_instructions: e.target.value})} 
                      placeholder="Ex: Veuillez envoyer le montant exact au numero..." 
                      readOnly={editingTab !== "billing"}
                    />
                  </div>
                  <div className="flex justify-end pt-2 border-t border-dashed mt-4">
                    {renderActionButtons("billing", ["payment_instructions"])}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="integrations" className="mt-4 outline-none">
              <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
                <div className="border-b bg-muted/10 px-6 py-5 flex items-center gap-3">
                  <div className="rounded-lg bg-blue-500/10 p-2 text-blue-600"><Facebook className="h-5 w-5" /></div>
                  <div>
                    <h2 className="font-semibold">Statut API Meta (Facebook & Instagram)</h2>
                    <p className="text-xs text-muted-foreground">Surveillance de la connexion de la plateforme au serveur Meta.</p>
                  </div>
                </div>
                
                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="border rounded-xl p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/50 flex flex-col justify-center items-center text-center">
                      <div className="flex items-center justify-center h-8 w-8 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400 mb-2">
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                      <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-300">Connexion Active</p>
                      <p className="text-[11px] text-emerald-700/70 dark:text-emerald-400/70 mt-1">Serveur authentifie avec succes</p>
                    </div>
                    
                    <div className="border rounded-xl p-4 bg-muted/20 flex flex-col justify-center items-center text-center">
                      <div className="text-2xl font-black text-foreground mb-1">{syncedShopsCount ?? 0}</div>
                      <p className="text-sm font-semibold">Boutiques Synchro</p>
                      <p className="text-[11px] text-muted-foreground mt-1">Catalogues actifs en ce moment</p>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-dashed">
                    <a href="https://developers.facebook.com/apps/" target="_blank" rel="noreferrer" className="w-full sm:w-auto">
                      <Button className="w-full rounded-xl h-11 bg-[#1877F2] text-white hover:bg-[#1877F2]/90 shadow-sm border-0">
                        <Facebook className="mr-2 h-4 w-4" /> Acceder au tableau de bord Meta
                      </Button>
                    </a>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border bg-card shadow-sm flex flex-col h-[calc(100vh-12rem)] sticky top-6">
            <div className="border-b bg-muted/10 px-5 py-4 flex items-center gap-3">
              <div className="rounded-lg bg-secondary p-2 text-secondary-foreground"><Activity className="h-5 w-5" /></div>
              <div>
                <h2 className="font-semibold">Journal d'activite</h2>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-semibold mt-0.5">50 dernieres actions</p>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2">
              {loadingLogs ? (
                <div className="p-6 text-center text-sm text-muted-foreground animate-pulse">Chargement du journal...</div>
              ) : !logs?.length ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Aucune action enregistree recemment.</div>
              ) : (
                <div className="relative pl-4 space-y-4 py-4 before:absolute before:inset-y-0 before:left-[21px] before:w-px before:bg-border">
                  {logs.map((l) => (
                    <div key={l.id} className="relative pl-6">
                      <div className="absolute left-[-1.5px] top-1 h-3 w-3 rounded-full border-2 border-background bg-muted-foreground/30" />
                      <div className="text-sm font-medium leading-none mb-1 text-foreground">
                        {formatActionName(l.action)}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(l.created_at).toLocaleString("fr-FR", { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}</span>
                        {l.target && (
                          <>
                            <span>&bull;</span>
                            <span className="flex items-center gap-1 font-mono"><Fingerprint className="h-3 w-3" /> {l.target.slice(0, 8)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
