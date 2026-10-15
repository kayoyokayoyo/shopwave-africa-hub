import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  getTicketDetail, replyToTicket, getAttachmentSignedUrl,
} from "@/lib/support.functions";
import type { SupportMessage } from "@/lib/support.functions";
import {
  LifeBuoy, ArrowLeft, Send, Image, X, Loader2, AlertCircle,
  ExternalLink, ShieldOff, Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/dashboard/support_/$ticketId")({
  head: () => ({
    meta: [{ title: "Ticket — Support MarketNet" }],
  }),
  component: TicketDetailPage,
});

const STATUT_COLOR: Record<string, string> = {
  ouvert: "bg-orange-100 text-orange-700",
  en_cours: "bg-blue-100 text-blue-700",
  résolu: "bg-green-100 text-green-700",
  fermé: "bg-slate-100 text-slate-600",
};
const STATUT_LABELS: Record<string, string> = {
  ouvert: "Ouvert", en_cours: "En cours", résolu: "Résolu", fermé: "Fermé",
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
    <a href={data.url} target="_blank" rel="noreferrer" className="block h-24 w-24 rounded-xl overflow-hidden border hover:opacity-90 transition-opacity">
      <img src={data.url} alt="Capture jointe" className="h-full w-full object-cover" />
    </a>
  );
}

function MessageBubble({ msg }: { msg: SupportMessage }) {
  const isAdmin = msg.auteur === "admin";
  return (
    <div className={cn("flex", isAdmin ? "justify-start" : "justify-end")}>
      <div className={cn("max-w-[85%] space-y-2")}>
        <div className={cn(
          "rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isAdmin
            ? "bg-muted text-foreground rounded-tl-sm"
            : "bg-primary text-primary-foreground rounded-tr-sm"
        )}>
          <p className="whitespace-pre-wrap break-words">{msg.texte}</p>
        </div>
        {/* Pièces jointes */}
        {(msg.support_attachments ?? []).length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {msg.support_attachments!.map((att) => (
              <AttachmentImage key={att.id} chemin={att.chemin} />
            ))}
          </div>
        )}
        <p className={cn("text-[10px] text-muted-foreground", isAdmin ? "text-left" : "text-right")}>
          {isAdmin ? "Équipe MarketNet" : "Vous"} ·{" "}
          {new Date(msg.cree_le).toLocaleString("fr-FR", {
            day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}

function TicketDetailPage() {
  const { ticketId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const [replyText, setReplyText] = useState("");
  const [attachments, setAttachments] = useState<AttachmentPreview[]>([]);

  const getDetailFn = useServerFn(getTicketDetail);
  const replyFn = useServerFn(replyToTicket);

  const { data, isLoading, error } = useQuery({
    queryKey: ["ticketDetail", ticketId],
    queryFn: () => getDetailFn({ data: { ticket_id: ticketId } }),
    refetchInterval: 15000,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.messages]);

  const replyMutation = useMutation({
    mutationFn: async () => {
      if (!replyText.trim()) throw new Error("Le message ne peut pas être vide.");
      const notUploaded = attachments.filter((a) => !a.uploadedPath);
      if (notUploaded.length > 0) throw new Error("Attendez la fin du téléversement.");

      return replyFn({
        data: {
          ticket_id: ticketId,
          texte: replyText.trim(),
          attachment_paths: attachments
            .filter((a) => !!a.uploadedPath)
            .map((a) => ({ chemin: a.uploadedPath!, mime_type: a.file.type, taille: a.file.size })),
        },
      });
    },
    onSuccess: () => {
      setReplyText("");
      setAttachments([]);
      qc.invalidateQueries({ queryKey: ["ticketDetail", ticketId] });
      qc.invalidateQueries({ queryKey: ["myTickets"] });
      qc.invalidateQueries({ queryKey: ["mySupportUnread"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleFileAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const remaining = 3 - attachments.length;
    for (const file of files.slice(0, remaining)) {
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
      <AlertCircle className="mx-auto mb-2 h-6 w-6" />
      Ticket introuvable ou accès refusé.
    </div>
  );

  const { ticket, messages } = data;
  const isClosed = ticket.statut === "fermé" || ticket.statut === "résolu";

  return (
    <div className="mx-auto max-w-2xl flex flex-col gap-4">
      {/* Retour */}
      <Link to="/dashboard/support" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-fit">
        <ArrowLeft className="h-4 w-4" /> Retour au support
      </Link>

      {/* En-tête ticket */}
      <div className="rounded-2xl border bg-card p-5 space-y-3 shadow-sm">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono font-bold text-primary">{ticket.numero}</span>
            <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", STATUT_COLOR[ticket.statut])}>
              {STATUT_LABELS[ticket.statut]}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            {new Date(ticket.cree_le).toLocaleDateString("fr-FR", {
              day: "numeric", month: "long", year: "numeric",
            })}
          </span>
        </div>
        <h1 className="font-bold text-lg leading-snug">{ticket.titre}</h1>
        {isClosed && (
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <Lock className="h-3 w-3" />
            Ce ticket est {STATUT_LABELS[ticket.statut].toLowerCase()}. Vous pouvez envoyer un nouveau message pour le rouvrir.
          </div>
        )}
      </div>

      {/* Fil de messages */}
      <div className="rounded-2xl border bg-card p-4 space-y-4 min-h-[300px] shadow-sm">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-sm">
            <LifeBuoy className="h-8 w-8 opacity-30 mb-2" />
            Aucun message pour l'instant.
          </div>
        ) : (
          messages.map((msg: any) => <MessageBubble key={msg.id} msg={msg} />)
        )}
        <div ref={bottomRef} />
      </div>

      {/* Zone de réponse */}
      <div className="rounded-2xl border bg-card p-4 space-y-3 shadow-sm">
        <Textarea
          id="reply-textarea"
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          placeholder="Écrivez votre réponse…"
          rows={4}
          maxLength={10000}
          disabled={replyMutation.isPending}
          aria-label="Réponse"
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
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
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
            id="btn-send-reply"
            onClick={() => replyMutation.mutate()}
            disabled={replyMutation.isPending || !replyText.trim() || attachments.some((a) => a.uploading)}
            className="rounded-xl gap-2"
          >
            {replyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Envoyer
          </Button>
        </div>
      </div>
    </div>
  );
}
