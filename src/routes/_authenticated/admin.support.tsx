import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { adminListTickets } from "@/lib/support.functions";
import type { SupportTicketCategorie, SupportTicketStatut } from "@/lib/support.functions";
import {
  LifeBuoy, Search, ChevronRight, MessageCircle, Clock, Filter,
  Loader2, Inbox, AlertCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/support")({
  head: () => ({
    meta: [
      { title: "Support — Administration MarketNet" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminSupportPage,
});

const STATUTS: { value: string; label: string }[] = [
  { value: "tous", label: "Tous les statuts" },
  { value: "ouvert", label: "Ouvert" },
  { value: "en_cours", label: "En cours" },
  { value: "résolu", label: "Résolu" },
  { value: "fermé", label: "Fermé" },
];

const CATEGORIES: { value: string; label: string }[] = [
  { value: "tous", label: "Toutes catégories" },
  { value: "paiement_abonnement", label: "Paiement & abonnement" },
  { value: "connexion_facebook", label: "Connexion Facebook" },
  { value: "boutique_produits", label: "Boutique & produits" },
  { value: "commandes", label: "Commandes" },
  { value: "autre", label: "Autre" },
];

const STATUT_COLOR: Record<string, string> = {
  ouvert: "bg-orange-100 text-orange-700 border-orange-200",
  en_cours: "bg-blue-100 text-blue-700 border-blue-200",
  résolu: "bg-green-100 text-green-700 border-green-200",
  fermé: "bg-slate-100 text-slate-600 border-slate-200",
};

function AdminSupportPage() {
  const [statut, setStatut] = useState<string>("tous");
  const [categorie, setCategorie] = useState<string>("tous");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const qc = useQueryClient();
  const listTicketsFn = useServerFn(adminListTickets);

  const { data, isLoading, error } = useQuery({
    queryKey: ["adminTickets", statut, categorie, search, page],
    queryFn: () =>
      listTicketsFn({
        data: {
          statut: statut as any,
          categorie: categorie as any,
          search: search || undefined,
          page,
        },
      }),
    refetchInterval: 30000,
  });

  const pending = (data?.tickets ?? []).filter((t: any) => t.statut === "ouvert" || t.statut === "en_cours").length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <LifeBuoy className="h-6 w-6 text-primary" />
            Support
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestion de tous les tickets de support commerçants.
          </p>
        </div>
        {pending > 0 && (
          <div className="flex items-center gap-2 rounded-full bg-orange-100 px-4 py-2 text-sm font-semibold text-orange-700 border border-orange-200">
            <AlertCircle className="h-4 w-4" />
            {pending} ticket{pending > 1 ? "s" : ""} en attente
          </div>
        )}
      </div>

      {/* Filtres */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="search-tickets"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Rechercher par numéro, titre, boutique…"
            className="pl-9 h-11"
          />
        </div>
        <Select value={statut} onValueChange={(v) => { setStatut(v); setPage(1); }}>
          <SelectTrigger className="h-11 w-[180px]">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={categorie} onValueChange={(v) => { setCategorie(v); setPage(1); }}>
          <SelectTrigger className="h-11 w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Liste */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
          <AlertCircle className="mx-auto mb-2 h-6 w-6" /> Erreur lors du chargement des tickets.
        </div>
      ) : !data?.tickets.length ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 gap-4 text-muted-foreground">
          <Inbox className="h-12 w-12 opacity-30" />
          <div className="text-center">
            <p className="font-semibold">Aucun ticket</p>
            <p className="text-sm mt-1">Aucun résultat pour ces filtres.</p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
          <div className="divide-y">
            {data.tickets.map((ticket: any) => {
              const hasUnread = (ticket.unread_count ?? 0) > 0;
              const shop = ticket.shops as any;
              return (
                <Link
                  key={ticket.id}
                  to="/admin/support/$ticketId"
                  params={{ ticketId: ticket.id }}
                  className={cn(
                    "flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors",
                    hasUnread && "bg-blue-50/50"
                  )}
                >
                  {/* Pastille non lu */}
                  <div className="shrink-0">
                    {hasUnread ? (
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                        <MessageCircle className="h-4 w-4" />
                      </span>
                    ) : (
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                        <LifeBuoy className="h-4 w-4" />
                      </span>
                    )}
                  </div>

                  {/* Infos */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold text-primary">{ticket.numero}</span>
                      <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", STATUT_COLOR[ticket.statut])}>
                        {ticket.statut}
                      </span>
                      {hasUnread && (
                        <span className="rounded-full bg-blue-500 px-2 py-0.5 text-[10px] font-bold text-white">
                          {ticket.unread_count} nouveau{(ticket.unread_count ?? 0) > 1 ? "x" : ""}
                        </span>
                      )}
                    </div>
                    <p className="font-semibold text-sm truncate mt-0.5">{ticket.titre}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {shop?.name ?? "—"} · {ticket.contact_email || "—"}
                    </p>
                  </div>

                  {/* Date */}
                  <div className="shrink-0 text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(ticket.cree_le).toLocaleDateString("fr-FR", {
                      day: "numeric", month: "short",
                    })}
                  </div>

                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Pagination */}
      {(data?.total ?? 0) > 30 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-xl border px-4 py-2 text-sm font-medium disabled:opacity-40 hover:bg-muted transition-colors"
          >
            Précédent
          </button>
          <span className="text-sm text-muted-foreground">Page {page}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page * 30 >= (data?.total ?? 0)}
            className="rounded-xl border px-4 py-2 text-sm font-medium disabled:opacity-40 hover:bg-muted transition-colors"
          >
            Suivant
          </button>
        </div>
      )}
    </div>
  );
}
