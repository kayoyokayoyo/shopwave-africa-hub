import { createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  LifeBuoy, Plus, ChevronRight, MessageCircle, Clock, CheckCircle2,
  XCircle, AlertCircle, Loader2, Inbox, Upload, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { listMyTickets, createSupportTicket } from "@/lib/support.functions";
import type { SupportTicketStatut, SupportTicketCategorie } from "@/lib/support.functions";

export const Route = createFileRoute("/_authenticated/dashboard/support")({
  head: () => ({
    meta: [
      { title: "Support — MarketNet" },
      { name: "description", content: "Contactez notre équipe de support." },
    ],
  }),
  component: SupportPage,
});

const STATUT_LABELS: Record<SupportTicketStatut, string> = {
  ouvert: "Ouvert",
  en_cours: "En cours",
  résolu: "Résolu",
  fermé: "Fermé",
};

const STATUT_COLOR: Record<SupportTicketStatut, string> = {
  ouvert: "bg-orange-100 text-orange-700 border-orange-200",
  en_cours: "bg-blue-100 text-blue-700 border-blue-200",
  résolu: "bg-green-100 text-green-700 border-green-200",
  fermé: "bg-slate-100 text-slate-600 border-slate-200",
};

const STATUT_ICON: Record<SupportTicketStatut, React.FC<{ className?: string }>> = {
  ouvert: AlertCircle,
  en_cours: Loader2,
  résolu: CheckCircle2,
  fermé: XCircle,
};

const CATEGORIES: { value: SupportTicketCategorie; label: string }[] = [
  { value: "paiement_abonnement", label: "Paiement & abonnement" },
  { value: "connexion_facebook", label: "Connexion Facebook" },
  { value: "boutique_produits", label: "Boutique & produits" },
  { value: "commandes", label: "Commandes" },
  { value: "autre", label: "Autre" },
];

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024; // 5 Mo

interface AttachmentPreview {
  file: File;
  previewUrl: string;
  uploading: boolean;
  uploadedPath?: string;
  error?: string;
}

function StatutBadge({ statut }: { statut: SupportTicketStatut }) {
  const Icon = STATUT_ICON[statut];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
        STATUT_COLOR[statut]
      )}
    >
      <Icon className="h-3 w-3" />
      {STATUT_LABELS[statut]}
    </span>
  );
}

function SupportPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const routerState = useRouterState();
  const listMyTicketsFn = useServerFn(listMyTickets);
  const createTicketFn = useServerFn(createSupportTicket);

  // État du modal de création de ticket
  const [modalOpen, setModalOpen] = useState(() => {
    return typeof window !== "undefined" && window.location.pathname.includes("/nouveau");
  });

  // Formulaire nouveau ticket
  const [form, setForm] = useState({
    titre: "",
    categorie: "autre" as SupportTicketCategorie,
    texte: "",
  });
  const [attachments, setAttachments] = useState<AttachmentPreview[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Charger les tickets
  const { data: tickets, isLoading, error } = useQuery({
    queryKey: ["myTickets"],
    queryFn: () => listMyTicketsFn(),
    refetchInterval: 30000,
  });

  // Synchroniser avec l'URL si on arrive sur /nouveau
  useEffect(() => {
    if (routerState.location.pathname.includes("/nouveau") && !modalOpen) {
      setModalOpen(true);
    }
  }, [routerState.location.pathname]);

  // Mutation création ticket
  const createMutation = useMutation({
    mutationFn: async () => {
      const e: Record<string, string> = {};
      if (!form.titre.trim() || form.titre.trim().length < 3) {
        e.titre = "Titre requis (3 caractères minimum).";
      }
      if (!form.texte.trim()) {
        e.texte = "Message requis.";
      }
      if (Object.keys(e).length > 0) {
        setErrors(e);
        throw new Error("Validation");
      }
      setErrors({});

      const notUploaded = attachments.filter((a) => !a.uploadedPath && !a.error);
      if (notUploaded.length > 0) {
        throw new Error("Attendez la fin du téléversement des captures d'écran.");
      }

      const attachment_paths = attachments
        .filter((a) => !!a.uploadedPath)
        .map((a) => ({
          chemin: a.uploadedPath!,
          mime_type: a.file.type,
          taille: a.file.size,
        }));

      return createTicketFn({
        data: {
          titre: form.titre.trim(),
          categorie: form.categorie,
          texte: form.texte.trim(),
          attachment_paths,
        },
      });
    },
    onSuccess: (result) => {
      toast.success(`Ticket ${result.ticket.numero} créé avec succès.`);
      qc.invalidateQueries({ queryKey: ["myTickets"] });
      setModalOpen(false);
      setForm({
        titre: "",
        categorie: "autre",
        texte: "",
      });
      setAttachments([]);
      navigate({
        to: "/dashboard/support/$ticketId",
        params: { ticketId: result.ticket.id },
      });
    },
    onError: (err: Error) => {
      if (err.message !== "Validation") {
        toast.error(err.message || "Erreur lors de la création du ticket.");
      }
    },
  });

  async function handleFileAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const remaining = 3 - attachments.length;
    if (remaining <= 0) {
      toast.error("Maximum 3 captures d'écran par message.");
      return;
    }

    for (const file of files.slice(0, remaining)) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error(`Format non supporté pour "${file.name}". Utilisez JPG, PNG ou WebP.`);
        continue;
      }
      if (file.size > MAX_SIZE) {
        toast.error(`"${file.name}" dépasse la limite de 5 Mo.`);
        continue;
      }

      const previewUrl = URL.createObjectURL(file);
      const previewItem: AttachmentPreview = { file, previewUrl, uploading: true };
      setAttachments((prev) => [...prev, previewItem]);

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Non authentifié");

        const ext = file.name.split(".").pop();
        const path = `${user.id}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from("support-attachments")
          .upload(path, file, { cacheControl: "3600", upsert: false });

        if (uploadErr) throw uploadErr;

        setAttachments((prev) =>
          prev.map((a) => (a.previewUrl === previewUrl ? { ...a, uploading: false, uploadedPath: path } : a))
        );
      } catch (err: any) {
        setAttachments((prev) =>
          prev.map((a) => (a.previewUrl === previewUrl ? { ...a, uploading: false, error: err.message } : a))
        );
        toast.error(`Échec du téléversement de "${file.name}".`);
      }
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFileRemove(previewUrl: string) {
    setAttachments((prev) => {
      const item = prev.find((a) => a.previewUrl === previewUrl);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((a) => a.previewUrl !== previewUrl);
    });
  }

  const totalUnread = (tickets ?? []).reduce((acc: number, t: any) => acc + (t.unread_count ?? 0), 0);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <LifeBuoy className="h-6 w-6 text-primary" />
            Support
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Posez vos questions, nous vous répondrons au plus vite.
          </p>
        </div>
        <Button
          id="btn-nouveau-ticket"
          onClick={() => setModalOpen(true)}
          className="rounded-xl gap-2 shadow-xs"
        >
          <Plus className="h-4 w-4" /> Nouveau ticket
        </Button>
      </div>

      {/* Compteur de réponses non lues */}
      {totalUnread > 0 && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 flex items-center gap-3 text-sm text-blue-800">
          <MessageCircle className="h-4 w-4 shrink-0" />
          <span>
            Vous avez <strong>{totalUnread}</strong> réponse{totalUnread > 1 ? "s" : ""} non lue{totalUnread > 1 ? "s" : ""}.
          </span>
        </div>
      )}

      {/* Chargement */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm">Chargement de vos tickets…</p>
        </div>
      )}

      {/* Erreur */}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
          <AlertCircle className="mx-auto mb-2 h-6 w-6" />
          Une erreur est survenue lors du chargement de vos tickets.
        </div>
      )}

      {/* Liste des tickets */}
      {!isLoading && !error && (!tickets?.length ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 gap-4 text-muted-foreground">
          <Inbox className="h-12 w-12 opacity-30" />
          <div className="text-center">
            <p className="font-semibold text-foreground">Aucun ticket pour le moment</p>
            <p className="text-sm mt-1">Créez un ticket pour contacter notre équipe.</p>
          </div>
          <Button
            variant="outline"
            onClick={() => setModalOpen(true)}
            className="rounded-xl gap-2"
          >
            <Plus className="h-4 w-4" /> Créer un ticket
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket: any) => {
            const hasUnread = (ticket.unread_count ?? 0) > 0;
            return (
              <Link
                key={ticket.id}
                to="/dashboard/support/$ticketId"
                params={{ ticketId: ticket.id }}
                className="block"
              >
                <div
                  className={cn(
                    "flex items-center justify-between rounded-2xl border bg-card p-4 transition-all hover:shadow-sm hover:border-primary/40",
                    hasUnread && "border-blue-300 bg-blue-50/50"
                  )}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="mt-0.5">
                      {hasUnread ? (
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-blue-600 shrink-0">
                          <MessageCircle className="h-4 w-4" />
                        </span>
                      ) : (
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted text-muted-foreground shrink-0">
                          <LifeBuoy className="h-4 w-4" />
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-bold text-primary">{ticket.numero}</span>
                        <StatutBadge statut={ticket.statut} />
                        {hasUnread && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500 px-2 py-0.5 text-[10px] font-bold text-white">
                            {ticket.unread_count} nouveau{ticket.unread_count! > 1 ? "x" : ""}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 font-semibold text-sm truncate">{ticket.titre}</p>
                      <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(ticket.cree_le).toLocaleDateString("fr-FR", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 ml-2" />
                </div>
              </Link>
            );
          })}
        </div>
      ))}

      {/* ─── MODAL : NOUVEAU TICKET DE SUPPORT ─── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl p-4 sm:p-5 max-w-[calc(100vw-2rem)]">
          <DialogHeader className="pb-1 text-left">
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <LifeBuoy className="h-4 w-4 text-primary" />
              Nouveau ticket de support
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground text-left">
              Décrivez votre question ou problème. Notre équipe vous répondra rapidement.
            </DialogDescription>
          </DialogHeader>


          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
            className="space-y-3 pt-0"
          >
            {/* Catégorie */}
            <div className="space-y-1">
              <Label htmlFor="ticket-categorie" className="text-xs font-semibold">
                Catégorie <span className="text-red-500">*</span>
              </Label>
              <Select
                value={form.categorie}
                onValueChange={(val) => setForm((f) => ({ ...f, categorie: val as SupportTicketCategorie }))}
              >
                <SelectTrigger id="ticket-categorie" className="h-9 rounded-xl text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value} className="rounded-lg">
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Titre */}
            <div className="space-y-1">
              <Label htmlFor="ticket-titre" className="text-xs font-semibold">
                Titre ou résumé <span className="text-red-500">*</span>
              </Label>
              <Input
                id="ticket-titre"
                placeholder="Ex. Problème de synchronisation des produits Facebook"
                value={form.titre}
                onChange={(e) => setForm((f) => ({ ...f, titre: e.target.value }))}
                maxLength={200}
                className={cn("h-9 rounded-xl text-sm", errors.titre && "border-red-500 focus-visible:ring-red-500")}
              />
              {errors.titre && <p className="text-xs text-red-600">{errors.titre}</p>}
            </div>

            {/* Message */}
            <div className="space-y-1">
              <Label htmlFor="ticket-texte" className="text-xs font-semibold">
                Description <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="ticket-texte"
                placeholder="Expliquez ce qui se passe, les étapes pour reproduire le problème…"
                rows={3}
                value={form.texte}
                onChange={(e) => setForm((f) => ({ ...f, texte: e.target.value }))}
                maxLength={10000}
                className={cn("rounded-xl resize-none text-sm", errors.texte && "border-red-500 focus-visible:ring-red-500")}
              />
              {errors.texte && <p className="text-xs text-red-600">{errors.texte}</p>}
            </div>


            {/* Pièces jointes (captures d'écran) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">Captures d'écran ({attachments.length}/3)</span>
                <span className="text-[10px] text-muted-foreground">Max 5 Mo · JPG, PNG, WebP</span>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={handleFileAdd}
              />

              {attachments.length < 3 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed py-2.5 text-xs font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Ajouter une capture d'écran
                </button>
              )}

              {attachments.length > 0 && (
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {attachments.map((att) => (
                    <div key={att.previewUrl} className="relative group rounded-xl overflow-hidden border aspect-square bg-muted">
                      <img src={att.previewUrl} alt="Aperçu" className="h-full w-full object-cover" />
                      {att.uploading && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <Loader2 className="h-5 w-5 animate-spin text-white" />
                        </div>
                      )}
                      {att.error && (
                        <div className="absolute inset-0 bg-red-900/60 flex items-center justify-center p-1 text-[10px] text-white text-center">
                          Échec
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => handleFileRemove(att.previewUrl)}
                        className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/90 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Boutons d'action */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                disabled={createMutation.isPending}
                className="rounded-xl"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="rounded-xl gap-2 font-bold px-5"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Envoi…
                  </>
                ) : (
                  "Créer le ticket"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
