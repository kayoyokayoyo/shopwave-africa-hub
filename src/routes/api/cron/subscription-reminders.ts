import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendSubscriptionReminderEmail } from "@/lib/support-email.server";
import { determineSubscriptionStatus } from "@/lib/subscriptions";

/**
 * Route cron quotidienne : /api/cron/subscription-reminders
 * Authentification via Bearer CRON_SECRET.
 * Envoie les rappels d'abonnement (J-7, J-3, début grâce, expiration)
 * une SEULE fois par abonnement par type (déduplication via subscription_reminder_log).
 * Ne boucle pas : une passe, un envoi maximum par type, sans retry infini.
 */

async function handleCron({ request }: { request: Request }) {
  // 1. Authentifier la requête cron
  const authError = await authenticateCronRequest(request);
  if (authError) return authError;

        const sb = supabaseAdmin;
        const now = new Date();

        // 2. Récupérer tous les abonnements actifs ou en grâce de plans PAYANTS
        const { data: subs, error } = await sb
          .from("merchant_subscriptions")
          .select("id, merchant_id, shop_id, plan_id, fin, statut, debut")
          .in("statut", ["actif", "grâce"]);

        if (error) {
          console.error("[CronReminders] Erreur lecture abonnements:", error.message);
          return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }

        if (!subs?.length) {
          return new Response(JSON.stringify({ sent: 0, skipped: 0 }), { status: 200 });
        }

        let sent = 0;
        let skipped = 0;

        for (const sub of subs) {
          // Ignorer le plan gratuit
          if (sub.plan_id === "free" || !sub.plan_id) { skipped++; continue; }

          // Calculer le statut réel et les jours restants
          const finDate = new Date(sub.fin);
          const daysLeft = Math.ceil((finDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          const status = determineSubscriptionStatus({ endDate: sub.fin, now });

          // Déterminer quel rappel envoyer
          let typeRappel: "j_moins_7" | "j_moins_3" | "debut_grace" | "expiration" | null = null;

          if (status === "actif") {
            if (daysLeft === 7 || daysLeft === 6) typeRappel = "j_moins_7";
            else if (daysLeft === 3 || daysLeft === 2) typeRappel = "j_moins_3";
          } else if (status === "grâce") {
            // Début de la période de grâce : date de fin dépassée (entre 0 et 2 jours)
            const graceDays = Math.floor((now.getTime() - finDate.getTime()) / (1000 * 60 * 60 * 24));
            if (graceDays <= 2) typeRappel = "debut_grace";
          } else if (status === "expiré") {
            // Expiration réelle (au-delà des 7 jours de grâce)
            typeRappel = "expiration";
          }

          if (!typeRappel) { skipped++; continue; }

          // Vérifier la déduplication (a-t-on déjà envoyé ce rappel pour cet abonnement?)
          const { data: existing } = await (sb as any)
            .from("subscription_reminder_log")
            .select("id")
            .eq("subscription_id", sub.id)
            .eq("type_rappel", typeRappel)
            .maybeSingle();

          if (existing) { skipped++; continue; }

          // Récupérer email et nom du commerçant
          let merchantEmail = "";
          let merchantName = "Commerçant";
          try {
            const { data: userRecord } = await sb.auth.admin.getUserById(sub.merchant_id);
            merchantEmail = userRecord?.user?.email ?? "";
            merchantName = userRecord?.user?.user_metadata?.full_name || "Commerçant";
          } catch {
            skipped++; continue;
          }

          if (!merchantEmail || !merchantEmail.includes("@")) { skipped++; continue; }

          // Récupérer le nom du plan
          let planName = sub.plan_id.toUpperCase();
          const { data: plan } = await sb.from("plans").select("name").eq("id", sub.plan_id).maybeSingle();
          if (plan?.name) planName = `Plan ${plan.name}`;

          const finDateStr = finDate.toLocaleDateString("fr-FR", {
            day: "numeric", month: "long", year: "numeric",
          });

          // Envoyer l'e-mail (best-effort)
          const result = await sendSubscriptionReminderEmail({
            subscriptionId: sub.id,
            merchantEmail,
            merchantName,
            planName,
            finDate: finDateStr,
            typeRappel,
          });

          if (result.success) {
            // Enregistrer dans le log de déduplication
            await (sb as any).from("subscription_reminder_log").insert({
              subscription_id: sub.id,
              type_rappel: typeRappel,
            });
            sent++;
          } else {
            skipped++;
          }
        }

        console.log(`[CronReminders] Terminé : ${sent} envoyé(s), ${skipped} ignoré(s).`);
  return new Response(
    JSON.stringify({ success: true, sent, skipped, processedAt: now.toISOString() }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

export const Route = createFileRoute("/api/cron/subscription-reminders")({
  server: {
    handlers: {
      GET: handleCron,
      POST: handleCron,
    },
  },
});
