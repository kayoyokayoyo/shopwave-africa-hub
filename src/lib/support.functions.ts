import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin as rawSupabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendNewTicketAdminNotification, sendAdminReplyNotification } from "@/lib/support-email.server";

// Cast pour les tables de la migration support
const supabaseAdmin = rawSupabaseAdmin as any;

// ─── Types ─────────────────────────────────────────────────────────────────

export type SupportTicketCategorie =
  | "paiement_abonnement"
  | "connexion_facebook"
  | "boutique_produits"
  | "commandes"
  | "autre";

export type SupportTicketStatut = "ouvert" | "en_cours" | "résolu" | "fermé";

export interface SupportTicket {
  id: string;
  numero: string;
  shop_id: string;
  merchant_id: string;
  titre: string;
  categorie: SupportTicketCategorie;
  contact_email: string | null;
  contact_whatsapp: string | null;
  statut: SupportTicketStatut;
  cree_le: string;
  mis_a_jour_le: string;
  dernier_message_le: string | null;
  shops?: { name: string; slug: string; whatsapp: string | null } | null;
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  auteur: "merchant" | "admin";
  texte: string;
  note_interne: boolean;
  cree_le: string;
  lu_le: string | null;
  support_attachments?: { id: string; chemin: string; mime_type: string; taille: number }[];
}

// ─── 1. Créer un ticket ────────────────────────────────────────────────────

export const createSupportTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: {
    titre: string;
    categorie: SupportTicketCategorie;
    texte: string;
    contact_email?: string;
    contact_whatsapp?: string;
    attachment_paths?: { chemin: string; mime_type: string; taille: number }[];
  }) => d)
  .handler(async ({ data, context }) => {
    const sb = supabaseAdmin;
    const userId = (context as any).userId;

    // Récupérer la boutique du commerçant
    const { data: shop } = await sb
      .from("shops")
      .select("id, name, slug, whatsapp")
      .eq("owner_id", userId)
      .maybeSingle();

    if (!shop) throw new Error("Boutique introuvable. Créez d'abord votre boutique.");

    // Valider les pièces jointes (max 3, types acceptés, taille)
    const attachments = (data.attachment_paths ?? []).slice(0, 3);
    const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
    for (const att of attachments) {
      if (!ALLOWED.includes(att.mime_type)) throw new Error("Type de fichier non autorisé.");
      if (att.taille > 5 * 1024 * 1024) throw new Error("Fichier trop volumineux (max 5 Mo).");
    }

    // Créer le ticket
    const { data: ticket, error: tErr } = await sb
      .from("support_tickets")
      .insert({
        shop_id: shop.id,
        merchant_id: userId,
        titre: data.titre.trim(),
        categorie: data.categorie,
        contact_email: data.contact_email?.trim() || null,
        contact_whatsapp: data.contact_whatsapp?.trim() || null,
        statut: "ouvert",
      })
      .select()
      .single();

    if (tErr || !ticket) throw new Error(tErr?.message ?? "Erreur création ticket.");

    // Créer le message initial
    const { data: msg, error: mErr } = await sb
      .from("support_messages")
      .insert({
        ticket_id: ticket.id,
        auteur: "merchant",
        texte: data.texte.trim(),
        note_interne: false,
      })
      .select()
      .single();

    if (mErr || !msg) throw new Error(mErr?.message ?? "Erreur création message.");

    // Enregistrer les pièces jointes
    if (attachments.length > 0) {
      await sb.from("support_attachments").insert(
        attachments.map((a: any) => ({
          message_id: msg.id,
          chemin: a.chemin,
          mime_type: a.mime_type,
          taille: a.taille,
        }))
      );
    }

    // Récupérer email du commerçant pour notification — best-effort
    try {
      const { data: userRecord } = await sb.auth.admin.getUserById(userId);
      const merchantEmail = userRecord?.user?.email ?? "";
      // Notifier l'admin — ne bloque pas si ça échoue
      sendNewTicketAdminNotification({
        ticketId: ticket.id,
        numero: ticket.numero,
        titre: ticket.titre,
        categorie: ticket.categorie,
        boutique: shop.name,
        email: data.contact_email || merchantEmail,
        whatsapp: data.contact_whatsapp || shop.whatsapp || undefined,
        texteMessage: data.texte.trim(),
      }).catch((e) => console.warn("[Support] Erreur notif admin:", e));
    } catch (e) {
      console.warn("[Support] Impossible d'envoyer notif admin:", e);
    }

    return { success: true, ticket };
  });

// ─── 2. Lister les tickets (commerçant) ───────────────────────────────────

export const listMyTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("support_tickets")
      .select("*")
      .eq("merchant_id", (context as any).userId)
      .order("cree_le", { ascending: false });
    if (error) throw new Error(error.message);

    // Compter les réponses non lues (messages admin non lus depuis la dernière visite du commerçant)
    const ticketsWithUnread = await Promise.all(
      (data ?? []).map(async (t: any) => {
        const { count } = await supabaseAdmin
          .from("support_messages")
          .select("*", { count: "exact", head: true })
          .eq("ticket_id", t.id)
          .eq("auteur", "admin")
          .eq("note_interne", false)
          .is("lu_le", null);
        return { ...t, unread_count: count ?? 0 };
      })
    );

    return ticketsWithUnread as (SupportTicket & { unread_count: number })[];
  });

// ─── 3. Détail ticket + messages (commerçant) ─────────────────────────────

export const getTicketDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: { ticket_id: string }) => d)
  .handler(async ({ data, context }) => {
    const sb = supabaseAdmin;
    const userId = (context as any).userId;

    const { data: ticket, error } = await sb
      .from("support_tickets")
      .select("*, shops(name, slug, whatsapp)")
      .eq("id", data.ticket_id)
      .single();

    if (error || !ticket) throw new Error("Ticket introuvable.");

    // Vérifier accès
    const isOwner = ticket.merchant_id === userId;
    const { data: isAdminData } = await sb.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isOwner && !isAdminData) throw new Error("Accès interdit.");

    // Récupérer les vraies coordonnées du commerçant pour l'admin
    let merchant_email: string | null = ticket.contact_email || null;
    let merchant_whatsapp: string | null = ticket.contact_whatsapp || null;
    if (isAdminData) {
      const shop = (ticket as any).shops;
      // WhatsApp : priorité shop.whatsapp
      if (shop?.whatsapp) {
        merchant_whatsapp = shop.whatsapp;
      }
      // Email : depuis auth si pas déjà renseigné
      if (!merchant_email) {
        try {
          const { data: authUser } = await sb.auth.admin.getUserById(ticket.merchant_id);
          merchant_email = authUser?.user?.email ?? null;
        } catch {}
      }
    }

    // Messages (sans notes internes pour le commercant)
    const { data: messages } = await sb
      .from("support_messages")
      .select("*, support_attachments(id, chemin, mime_type, taille)")
      .eq("ticket_id", data.ticket_id)
      .order("cree_le", { ascending: true });

    const filteredMessages = (messages ?? []).filter(
      (m: any) => isAdminData || !m.note_interne
    );

    // Marquer les messages admin comme lus pour le commercant
    if (isOwner) {
      const unreadIds = (messages ?? [])
        .filter((m: any) => m.auteur === "admin" && !m.lu_le && !m.note_interne)
        .map((m: any) => m.id);
      if (unreadIds.length > 0) {
        await sb
          .from("support_messages")
          .update({ lu_le: new Date().toISOString() })
          .in("id", unreadIds);
      }
    }

    return {
      ticket: ticket as SupportTicket,
      messages: filteredMessages as SupportMessage[],
      merchant_email,
      merchant_whatsapp,
    };
  });

// ─── 4. Répondre à un ticket (commerçant ou admin) ────────────────────────

export const replyToTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: {
    ticket_id: string;
    texte: string;
    note_interne?: boolean;
    attachment_paths?: { chemin: string; mime_type: string; taille: number }[];
  }) => d)
  .handler(async ({ data, context }) => {
    const sb = supabaseAdmin;
    const userId = (context as any).userId;

    const { data: isAdminData } = await sb.rpc("has_role", { _user_id: userId, _role: "admin" });

    // Vérifier que le ticket appartient au commerçant si ce n'est pas l'admin
    const { data: ticket } = await sb
      .from("support_tickets")
      .select("*, shops(name), merchant_id, contact_email, numero, titre")
      .eq("id", data.ticket_id)
      .single();

    if (!ticket) throw new Error("Ticket introuvable.");
    if (!isAdminData && ticket.merchant_id !== userId) throw new Error("Accès interdit.");

    const auteur: "merchant" | "admin" = isAdminData ? "admin" : "merchant";
    const note_interne = isAdminData ? (data.note_interne ?? false) : false;

    // Pièces jointes
    const attachments = (data.attachment_paths ?? []).slice(0, 3);
    const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
    for (const att of attachments) {
      if (!ALLOWED.includes(att.mime_type)) throw new Error("Type de fichier non autorisé.");
      if (att.taille > 5 * 1024 * 1024) throw new Error("Fichier trop volumineux (max 5 Mo).");
    }

    const { data: msg, error: mErr } = await sb
      .from("support_messages")
      .insert({
        ticket_id: data.ticket_id,
        auteur,
        texte: data.texte.trim(),
        note_interne,
      })
      .select()
      .single();

    if (mErr || !msg) throw new Error(mErr?.message ?? "Erreur envoi réponse.");

    if (attachments.length > 0) {
      await sb.from("support_attachments").insert(
        attachments.map((a: any) => ({
          message_id: msg.id,
          chemin: a.chemin,
          mime_type: a.mime_type,
          taille: a.taille,
        }))
      );
    }

    // Notification par e-mail — best-effort
    if (isAdminData && !note_interne && ticket.contact_email) {
      try {
        const { data: merchantUser } = await sb.auth.admin.getUserById(ticket.merchant_id);
        const merchantName = merchantUser?.user?.user_metadata?.full_name || "Commerçant";
        sendAdminReplyNotification({
          ticketId: ticket.id,
          numero: (ticket as any).numero,
          titre: ticket.titre,
          texteReponse: data.texte.trim(),
          merchantName,
          merchantEmail: ticket.contact_email,
        }).catch((e) => console.warn("[Support] Erreur notif commerçant:", e));
      } catch (e) {
        console.warn("[Support] Impossible d'envoyer notif commerçant:", e);
      }
    } else if (isAdminData && !note_interne) {
      // Essayer avec l'email auth si contact_email absent
      try {
        const { data: merchantUser } = await sb.auth.admin.getUserById(ticket.merchant_id);
        if (merchantUser?.user?.email) {
          const merchantName = merchantUser.user.user_metadata?.full_name || "Commerçant";
          sendAdminReplyNotification({
            ticketId: ticket.id,
            numero: (ticket as any).numero,
            titre: ticket.titre,
            texteReponse: data.texte.trim(),
            merchantName,
            merchantEmail: merchantUser.user.email,
          }).catch((e) => console.warn("[Support] Erreur notif commerçant:", e));
        }
      } catch (e) {
        console.warn("[Support] Impossible d'envoyer notif commerçant:", e);
      }
    }

    return { success: true, message: msg };
  });

// ─── 5. Changer le statut d'un ticket (admin) ─────────────────────────────

export const updateTicketStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { ticket_id: string; statut: SupportTicketStatut }) => d)
  .handler(async ({ data, context }) => {
    const sb = supabaseAdmin;
    const { data: isAdminData } = await sb.rpc("has_role", { _user_id: (context as any).userId, _role: "admin" });
    if (!isAdminData) throw new Error("Accès réservé à l'administrateur.");

    const { error } = await sb
      .from("support_tickets")
      .update({ statut: data.statut })
      .eq("id", data.ticket_id);

    if (error) throw new Error(error.message);
    return { success: true };
  });

// ─── 6. Lister tous les tickets (admin) ───────────────────────────────────

export const adminListTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: {
    statut?: SupportTicketStatut | "tous";
    categorie?: SupportTicketCategorie | "tous";
    search?: string;
    page?: number;
  }) => d)
  .handler(async ({ data, context }) => {
    const sb = supabaseAdmin;
    const { data: isAdminData } = await sb.rpc("has_role", { _user_id: (context as any).userId, _role: "admin" });
    if (!isAdminData) throw new Error("Accès réservé à l'administrateur.");

    let query = sb
      .from("support_tickets")
      .select("*, shops(name, slug, whatsapp, plan_id)", { count: "exact" })
      .order("dernier_message_le", { ascending: true, nullsFirst: true });

    if (data.statut && data.statut !== "tous") query = query.eq("statut", data.statut);
    if (data.categorie && data.categorie !== "tous") query = query.eq("categorie", data.categorie);
    if (data.search?.trim()) {
      const s = data.search.trim();
      query = query.or(`numero.ilike.%${s}%,titre.ilike.%${s}%`);
    }

    const page = data.page ?? 1;
    const perPage = 30;
    query = query.range((page - 1) * perPage, page * perPage - 1);

    const { data: tickets, count, error } = await query;
    if (error) throw new Error(error.message);

    // Compter messages non lus pour chaque ticket
    const withUnread = await Promise.all(
      (tickets ?? []).map(async (t: any) => {
        const { count: c } = await sb
          .from("support_messages")
          .select("*", { count: "exact", head: true })
          .eq("ticket_id", t.id)
          .eq("auteur", "merchant")
          .is("lu_le", null);
        return { ...t, unread_count: c ?? 0 };
      })
    );

    return { tickets: withUnread as unknown as (SupportTicket & { unread_count: number })[], total: count ?? 0 };
  });

// ─── 7. Compteur de tickets en attente (admin, pour badge) ────────────────

export const adminPendingTicketsCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = supabaseAdmin;
    const { data: isAdminData } = await sb.rpc("has_role", { _user_id: (context as any).userId, _role: "admin" });
    if (!isAdminData) return { count: 0 };

    const { count } = await sb
      .from("support_tickets")
      .select("*", { count: "exact", head: true })
      .in("statut", ["ouvert", "en_cours"]);

    return { count: count ?? 0 };
  });

// ─── 8. Générer une URL signée pour une pièce jointe ──────────────────────

export const getAttachmentSignedUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: { chemin: string }) => d)
  .handler(async ({ data, context }) => {
    const sb = supabaseAdmin;
    const userId = (context as any).userId;

    // Vérifier accès : admin → toujours autorisé
    // Commerçant → autoriser si la pièce jointe est liée à un ticket qui lui appartient
    const { data: isAdminData } = await sb.rpc("has_role", { _user_id: userId, _role: "admin" });

    if (!isAdminData) {
      // Vérifier que cette pièce jointe appartient à un ticket du commerçant
      const { data: attachment } = await sb
        .from("support_attachments")
        .select("id, support_messages(ticket_id, support_tickets(merchant_id))")
        .eq("chemin", data.chemin)
        .maybeSingle();

      const merchantId = (attachment as any)
        ?.support_messages?.support_tickets?.merchant_id;

      if (!attachment || merchantId !== userId) {
        throw new Error("Accès interdit.");
      }
    }

    const { data: signed, error } = await sb.storage
      .from("support-attachments")
      .createSignedUrl(data.chemin, 3600); // expire après 1h

    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });

// ─── 9. Compteur tickets non lus pour le commerçant (badge menu) ──────────

export const myUnreadSupportCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = supabaseAdmin;
    const userId = (context as any).userId;

    // Tickets du commerçant ayant au moins un message admin non lu
    const { data: tickets } = await sb
      .from("support_tickets")
      .select("id")
      .eq("merchant_id", userId);

    if (!tickets?.length) return { count: 0 };

    const ids = tickets.map((t: any) => t.id);
    const { count } = await sb
      .from("support_messages")
      .select("*", { count: "exact", head: true })
      .in("ticket_id", ids)
      .eq("auteur", "admin")
      .eq("note_interne", false)
      .is("lu_le", null);

    return { count: count ?? 0 };
  });
