import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const deleteMerchant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Accès refusé");
    if (data.userId === context.userId) throw new Error("Impossible de supprimer votre propre compte");
    
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Récupérer les informations du profil et de la boutique avant suppression pour le mail
    let merchantEmail = "";
    let merchantName = "Commerçant";
    let shopName: string | undefined = undefined;

    try {
      const [{ data: profile }, { data: userRecord }, { data: shopRecord }] = await Promise.all([
        supabaseAdmin.from("profiles").select("*").eq("id", data.userId).maybeSingle(),
        supabaseAdmin.auth.admin.getUserById(data.userId),
        supabaseAdmin.from("shops").select("name").eq("owner_id", data.userId).maybeSingle(),
      ]);

      merchantEmail = userRecord?.user?.email || profile?.email || "";
      merchantName = profile?.full_name || userRecord?.user?.user_metadata?.full_name || "Cher commerçant";
      shopName = shopRecord?.name;
    } catch (lookupErr) {
      console.warn("[deleteMerchant] Erreur lookup info avant suppression:", lookupErr);
    }

    // 2. Envoyer l'email de confirmation au commerçant et alerte admin
    if (merchantEmail) {
      try {
        const { sendDeletionConfirmationEmail } = await import("./invoices.server");
        await sendDeletionConfirmationEmail({
          email: merchantEmail,
          fullName: merchantName,
          shopName,
          isSelfDeleted: false,
        });
      } catch (mailErr) {
        console.warn("[deleteMerchant] Erreur envoi email suppression:", mailErr);
      }
    }

    // 3. Suppression en cascade
    await supabaseAdmin.from("shops").delete().eq("owner_id", data.userId);
    await supabaseAdmin.from("profiles").delete().eq("id", data.userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    await context.supabase.from("audit_log").insert({ actor_id: context.userId, action: "merchant.delete", target: data.userId });
    return { ok: true };
  });

/**
 * Fonction serveur appelée par un commerçant lorsqu'il supprime son propre compte.
 * N'utilise PAS le middleware auth car le token peut être en cours d'expiration
 * lors de la suppression. L'email, le nom et la boutique sont passés explicitement.
 */
export const notifyMerchantAccountDeletion = createServerFn({ method: "POST" })
  .validator((d) =>
    z.object({
      email: z.string().email(),
      fullName: z.string().optional(),
      shopName: z.string().optional(),
    }).parse(d)
  )
  .handler(async ({ data }) => {
    console.log("[notifyMerchantAccountDeletion] Envoi email suppression pour:", data.email);
    try {
      const { sendDeletionConfirmationEmail } = await import("./invoices.server");
      const result = await sendDeletionConfirmationEmail({
        email: data.email,
        fullName: data.fullName || "Cher commerçant",
        shopName: data.shopName,
        isSelfDeleted: true,
      });
      console.log("[notifyMerchantAccountDeletion] Résultat envoi:", result);
    } catch (err) {
      console.error("[notifyMerchantAccountDeletion] Erreur envoi email:", err);
    }
    return { ok: true };
  });

/**
 * Alerte admin pour toute nouvelle inscription sur la plateforme
 */
export const notifyNewUserRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z.object({
      email: z.string().email(),
      fullName: z.string().optional(),
    }).parse(d)
  )
  .handler(async ({ data }) => {
    try {
      const { sendNewUserAdminNotification } = await import("./invoices.server");
      await sendNewUserAdminNotification({
        email: data.email,
        fullName: data.fullName,
      });
    } catch (err) {
      console.warn("[notifyNewUserRegistration] Erreur d'envoi non bloquante:", err);
    }
    return { ok: true };
  });

/**
 * Email de bienvenue envoyé au commerçant après création de sa boutique
 */
export const notifyMerchantWelcome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z.object({
      merchantEmail: z.string().email(),
      merchantName: z.string().optional(),
      shopName: z.string(),
      shopSlug: z.string(),
      whatsapp: z.string().optional(),
      planName: z.string().optional(),
    }).parse(d)
  )
  .handler(async ({ data }) => {
    try {
      const { sendMerchantWelcomeEmail } = await import("./invoices.server");
      await sendMerchantWelcomeEmail({
        merchantEmail: data.merchantEmail,
        merchantName: data.merchantName || "Cher commerçant",
        shopName: data.shopName,
        shopSlug: data.shopSlug,
        whatsapp: data.whatsapp,
        planName: data.planName,
      });
    } catch (err) {
      console.warn("[notifyMerchantWelcome] Erreur d'envoi non bloquante:", err);
    }
    return { ok: true };
  });
