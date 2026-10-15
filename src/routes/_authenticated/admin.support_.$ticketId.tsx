import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  getTicketDetail, replyToTicket, updateTicketStatus, getAttachmentSignedUrl,
} from "@/lib/support.functions";
import type { SupportMessage, SupportTicketStatut } from "@/lib/support.functions";
import {
  ArrowLeft, Send, Image, X, Loader2, AlertCircle, ExternalLink,
  LifeBuoy, Eye, EyeOff, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/support_/$ticketId")({
  head: () => ({
    meta: [
      { title: "Ticket Support — Admin MarketNet" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminTicketDetailPage,
});

const STATUTS: { value: SupportTicketStatut; label: string }[] = [
  { value: "ouvert", label: "Ouvert" },
  { value: "en_cours", label: "En cours" },
  { value: "résolu", label: "Résolu" },
  { value: "fermé", label: "Fermé" },
];

const STATUT_COLOR: Record<string, string> = {
  ouvert: "text-orange-600", en_cours: "text-blue-600",
  résolu: "text-green-600", fermé: "text-slate-500",
};

const CATEGORIE_LABELS: Record<string, string> = {
  paiement_abonnement: "Paiement & abonnement",
  connexion_facebook: "Connexion Facebook",
  boutique_produits: "Boutique & produits",
  commandes: "Commandes",
  autre: "Autre",
};

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024;

interface AttachmentPreview {
  file: File; previewUrl: string; uploading: boolean; uploadedPath?: string;
}

function AttachmentImage({ chemin }: { chemin: string }) {
  const getSignedUrlFn = useServerFn(getAttachmentSignedUrl);
  const { data, isLoading } = useQuery({
    queryKey: ["signedUrl", chemin],
    queryFn: () => getSignedUrlFn({ data: { chemin } }),
    staleTime: 50 * 60 * 1000,
  });
  if (isLoading) return <div className="h-24 w-24 animate-pulse rounded-xl bg-muted" />;
  if (!data?.url) return null;
  return (
    <a href={data.url} target="_blank" rel="noreferrer"
      className="block h-24 w-24 rounded-xl overflow-hidden border hover:opacity-90">
      <img src={data.url} alt="Capture" className="h-full w-full object-cover" />
    </a>
  );
}

function MessageBubble({ msg }: { msg: SupportMessage }) {
  const isAdmin = msg.auteur === "admin";
  return (
    <div className={cn("flex", isAdmin ? "justify-start" : "justify-end")}>
      <div className="max-w-[85%] space-y-2">
        {msg.note_interne && (
          <div className="flex items-center gap-1 text-[10px] text-amber-600 font-semibold">
            <EyeOff className="h-3 w-3" /> Note interne (visible admin seulement)
          </div>
        )}
        <div className={cn(
          "rounded-2xl px-4 py-3 text-sm leading-relaxed",
          msg.note_interne
            ? "bg-amber-50 border border-amber-200 text-amber-900 rounded-tl-sm"
            : isAdmin
            ? "bg-muted text-foreground rounded-tl-sm"
            : "bg-primary text-primary-foreground rounded-tr-sm"
        )}>
          <p className="whitespace-pre-wrap break-words">{msg.texte}</p>
        </div>
        {(msg.support_attachments ?? []).length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {msg.support_attachments!.map((att) => (
              <AttachmentImage key={att.id} chemin={att.chemin} />
            ))}
          </div>
        )}
        <p className={cn("text-[10px] text-muted-foreground", isAdmin ? "text-left" : "text-right")}>
          {isAdmin ? (msg.note_interne ? "Note interne" : "Équipe MarketNet") : "Commerçant"} ·{" "}
          {new Date(msg.cree_le).toLocaleString("fr-FR", {
            day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}

function AdminTicketDetailPage() {
  const { ticketId } = Route.useParams();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const [replyText, setReplyText] = useState("");
  const [noteInterne, setNoteInterne] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentPreview[]>([]);

  const getDetailFn = useServerFn(getTicketDetail);
  const updateStatusFn = useServerFn(updateTicketStatus);
  const replyFn = useServerFn(replyToTicket);

  const { data, isLoading, error } = useQuery({
    queryKey: ["ticketDetail", ticketId],
    queryFn: () => getDetailFn({ data: { ticket_id: ticketId } }),
    refetchInterval: 15000,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.messages]);

  const statusMutation = useMutation({
    mutationFn: (s: SupportTicketStatut) => updateStatusFn({ data: { ticket_id: ticketId, statut: s } }),
    onSuccess: () => {
      toast.success("Statut mis à jour.");
      qc.invalidateQueries({ queryKey: ["ticketDetail", ticketId] });
      qc.invalidateQueries({ queryKey: ["adminTickets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const replyMutation = useMutation({
    mutationFn: async () => {
      if (!replyText.trim()) throw new Error("Le message ne peut pas être vide.");
      const notUploaded = attachments.filter((a) => !a.uploadedPath);
      if (notUploaded.length > 0) throw new Error("Attendez la fin du téléversement.");
      return replyFn({
        data: {
          ticket_id: ticketId,
          texte: replyText.trim(),
          note_interne: noteInterne,
          attachment_paths: attachments
            .filter((a) => !!a.uploadedPath)
            .map((a) => ({ chemin: a.uploadedPath!, mime_type: a.file.type, taille: a.file.size })),
        },
      });
    },
    onSuccess: () => {
      setReplyText("");
      setAttachments([]);
      setNoteInterne(false);
      qc.invalidateQueries({ queryKey: ["ticketDetail", ticketId] });
      qc.invalidateQueries({ queryKey: ["adminTickets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleFileAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    for (const file of files.slice(0, 3 - attachments.length)) {
      if (!ALLOWED_TYPES.includes(file.type)) { toast.error("Format non accepté."); continue; }
      if (file.size > MAX_SIZE) { toast.error("Fichier trop volumineux (max 5 Mo)."); continue; }
      const previewUrl = URL.createObjectURL(file);
      setAttachments((prev) => [...prev, { file, previewUrl, uploading: true }]);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Non authentifié");
        const ext = file.name.split(".").pop();
        const path = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("support-attachments").upload(path, file);
        if (upErr) throw upErr;
        setAttachments((prev) =>
          prev.map((a) => a.previewUrl === previewUrl ? { ...a, uploading: false, uploadedPath: path } : a)
        );
      } catch {
        setAttachments((prev) => prev.filter((a) => a.previewUrl !== previewUrl));
        URL.revokeObjectURL(previewUrl);
        toast.error("Erreur lors de l'envoi de la capture.");
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  if (isLoading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  if (error || !data) return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
      <AlertCircle className="mx-auto mb-2 h-6 w-6" /> Ticket introuvable.
    </div>
  );

  const { ticket, messages } = data;
  const shop = (ticket as any).shops as { name: string; slug: string; whatsapp: string | null } | null;
  const siteUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="mx-auto max-w-4xl grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">
      {/* Colonne principale */}
      <div className="space-y-4">
        <Link to="/admin/support" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-fit">
          <ArrowLeft className="h-4 w-4" /> Tous les tickets
        </Link>

        {/* En-tête ticket */}
        <div className="rounded-2xl border bg-card p-5 space-y-2 shadow-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-mono font-bold text-primary">{ticket.numero}</span>
            <span className={cn("text-sm font-semibold", STATUT_COLOR[ticket.statut])}>
              • {ticket.statut}
            </span>
          </div>
          <h1 className="font-bold text-xl leading-snug">{ticket.titre}</h1>
          <p className="text-xs text-muted-foreground">
            Catégorie : {CATEGORIE_LABELS[ticket.categorie] ?? ticket.categorie} ·{" "}
            {new Date(ticket.cree_le).toLocaleString("fr-FR", {
              day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
            })}
          </p>
        </div>

        {/* Fil de messages */}
        <div className="rounded-2xl border bg-card p-4 space-y-4 min-h-[300px] shadow-sm">
          {messages.map((msg: any) => <MessageBubble key={msg.id} msg={msg} />)}
          <div ref={bottomRef} />
        </div>

        {/* Zone de réponse */}
        <div className="rounded-2xl border bg-card p-4 space-y-3 shadow-sm">
          {/* Toggle note interne */}
          <div className="flex items-center justify-between">
            <Label htmlFor="note-interne-switch" className="text-sm font-semibold cursor-pointer">
              Note interne
            </Label>
            <Switch
              id="note-interne-switch"
              checked={noteInterne}
              onCheckedChange={setNoteInterne}
              aria-label="Note interne (non visible par le commerçant)"
            />
          </div>
          {noteInterne && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              <EyeOff className="h-3 w-3" /> Ce message ne sera pas visible par le commerçant.
            </div>
          )}

          <Textarea
            id="admin-reply-textarea"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder={noteInterne ? "Note interne…" : "Réponse au commerçant…"}
            rows={4}
            maxLength={10000}
            disabled={replyMutation.isPending}
          />

          {/* Aperçu pièces jointes */}
          {attachments.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {attachments.map((att, idx) => (
                <div key={idx} className="relative h-20 w-20 rounded-xl border overflow-hidden bg-muted">
                  <img src={att.previewUrl} alt="Aperçu" className="h-full w-full object-cover" />
                  {att.uploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <Loader2 className="h-4 w-4 text-white animate-spin" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      URL.revokeObjectURL(att.previewUrl);
                      setAttachments((prev) => prev.filter((_, i) => i !== idx));
                    }}
                    className="absolute top-0.5 right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white"
                    aria-label="Supprimer"
                  ><X className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 justify-between">
            <div>
              {attachments.length < 3 && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple className="hidden"
                    onChange={handleFileAdd}
                    disabled={replyMutation.isPending}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={replyMutation.isPending}
                    className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                    aria-label="Ajouter une capture"
                  >
                    <Image className="h-3.5 w-3.5" /> Capture
                  </button>
                </>
              )}
            </div>
            <Button
              id="btn-admin-send-reply"
              onClick={() => replyMutation.mutate()}
              disabled={replyMutation.isPending || !replyText.trim() || attachments.some((a) => a.uploading)}
              className="rounded-xl gap-2"
              variant={noteInterne ? "outline" : "default"}
            >
              {replyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {noteInterne ? "Enregistrer note" : "Répondre"}
            </Button>
          </div>
        </div>
      </div>

      {/* Panneau latéral */}
      <div className="space-y-4">
        {/* Statut */}
        <div className="rounded-2xl border bg-card p-4 space-y-3 shadow-sm">
          <h3 className="font-semibold text-sm">Statut du ticket</h3>
          <Select
            value={ticket.statut}
            onValueChange={(v) => statusMutation.mutate(v as SupportTicketStatut)}
            disabled={statusMutation.isPending}
          >
            <SelectTrigger id="ticket-statut-select" className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUTS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Infos boutique */}
        <div className="rounded-2xl border bg-card p-4 space-y-3 shadow-sm">
          <h3 className="font-semibold text-sm">Boutique</h3>
          <div className="space-y-2 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Nom</p>
              <p className="font-medium">{shop?.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">E-mail contact</p>
              <p className="font-medium break-all">{ticket.contact_email || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">WhatsApp contact</p>
              <p className="font-medium">{ticket.contact_whatsapp || "—"}</p>
            </div>
            {shop?.slug && (
              <a
                href={`/b/${encodeURIComponent(shop.slug)}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" /> Voir la boutique
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
