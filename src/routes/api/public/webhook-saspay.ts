import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifySasPayWebhookSignature } from "@/lib/saspay";
import { internalActivateSubscription } from "@/lib/subscriptions.functions";
import type { SubscriptionPeriod } from "@/lib/subscriptions";

export const Route = createFileRoute("/api/public/webhook-saspay")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let rawBody = "";
        try {
          rawBody = await request.text();
        } catch (_err) {
          return new Response(JSON.stringify({ error: "Corps de requête illisible" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        // 1. Récupération de l'en-tête de signature
        const signatureHeader =
          request.headers.get("x-saspay-signature") ||
          request.headers.get("X-SasPay-Signature") ||
          request.headers.get("webhook-signature") ||
          request.headers.get("Webhook-Signature") ||
          "";

        // 2. Vérification HMAC
        const isValid = await verifySasPayWebhookSignature(rawBody, signatureHeader);

        let parsedBody: Record<string, unknown> = {};
        try {
          parsedBody = JSON.parse(rawBody);
        } catch {
          parsedBody = { raw: rawBody };
        }

        const eventType = (parsedBody["event"] as string) || (parsedBody["type"] as string) || "unknown";
        const eventData = (parsedBody["data"] as Record<string, unknown>) || {};
        const sessionId = (eventData["session_id"] as string) || (eventData["id"] as string) || null;
        const transactionId = (eventData["transaction_id"] as string) || null;

        // 3. Enregistrement brut dans payment_events
        const { data: eventRecord, error: eventErr } = await supabaseAdmin
          .from("payment_events")
          .insert({
            corps: parsedBody,
            signature_valide: isValid,
            type_evenement: eventType,
            session_id: sessionId,
            transaction_id: transactionId,
            recu_le: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (eventErr) {
          console.error("[Webhook SasPay] Erreur insertion payment_events:", eventErr);
        }

        // Si signature invalide : rejet immédiat
        if (!isValid) {
          console.warn("[Webhook SasPay] Signature invalide reçue.");
          if (eventRecord?.id) {
            await supabaseAdmin
              .from("payment_events")
              .update({
                resultat: "Rejeté : signature invalide",
                traite_le: new Date().toISOString(),
              })
              .eq("id", eventRecord.id);
          }
          return new Response(JSON.stringify({ error: "Signature invalide" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        // 4. Traitement des événements
        try {
          const metadata = (eventData["metadata"] as Record<string, string>) || {};
          const paymentId = metadata["payment_id"];

          // Recherche du paiement
          let query = supabaseAdmin.from("subscription_payments").select("*");
          if (paymentId) {
            query = query.eq("id", paymentId);
          } else if (sessionId) {
            query = query.eq("saspay_session_id", sessionId);
          } else {
            // Ni paymentId ni sessionId trouvés
            if (eventRecord?.id) {
              await supabaseAdmin
                .from("payment_events")
                .update({
                  resultat: "Ignoré : aucun identifiant de paiement ou de session",
                  traite_le: new Date().toISOString(),
                })
                .eq("id", eventRecord.id);
            }
            return new Response(JSON.stringify({ received: true, note: "aucun identifiant trouvé" }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }

          const { data: payment } = await query.maybeSingle();

          if (!payment) {
            if (eventRecord?.id) {
              await supabaseAdmin
                .from("payment_events")
                .update({
                  resultat: `Paiement introuvable pour payment_id=${paymentId} sessionId=${sessionId}`,
                  traite_le: new Date().toISOString(),
                })
                .eq("id", eventRecord.id);
            }
            return new Response(JSON.stringify({ received: true, note: "paiement introuvable" }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }

          // Événement : Succès du paiement
          const isCompleted =
            eventType === "payment.completed" ||
            eventType === "checkout.session.completed" ||
            eventType === "charge.completed" ||
            eventType === "payment.succeeded";

          if (isCompleted) {
            // Idempotence : si déjà payé, ne pas re-créditer
            if (payment.statut === "payé") {
              if (eventRecord?.id) {
                await supabaseAdmin
                  .from("payment_events")
                  .update({
                    resultat: "Ignoré : paiement déjà marqué comme payé (idempotence)",
                    traite_le: new Date().toISOString(),
                  })
                  .eq("id", eventRecord.id);
              }
              return new Response(JSON.stringify({ received: true, idempotent: true }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
              });
            }

            // Récupérer montants
            const amountCharged = eventData["amount_charged"] ? Number(eventData["amount_charged"]) : null;
            const amountNet = eventData["amount_net"] ? Number(eventData["amount_net"]) : null;
            const fees = eventData["fees"] ? Number(eventData["fees"]) : null;

            // Mettre à jour subscription_payments
            await supabaseAdmin
              .from("subscription_payments")
              .update({
                statut: "payé",
                paye_le: new Date().toISOString(),
                saspay_transaction_id: transactionId || payment.saspay_transaction_id,
                montant_debite: amountCharged,
                montant_net: amountNet,
                frais: fees,
              })
              .eq("id", payment.id);

            // Activer ou prolonger l'abonnement
            await internalActivateSubscription({
              shopId: payment.shop_id,
              merchantId: payment.merchant_id,
              planId: payment.plan_id,
              period: (payment.period as SubscriptionPeriod) || "mensuel",
              paymentId: payment.id,
            });

            if (eventRecord?.id) {
              await supabaseAdmin
                .from("payment_events")
                .update({
                  resultat: `Succès : abonnement ${payment.plan_id} activé pour la boutique ${payment.shop_id}`,
                  traite_le: new Date().toISOString(),
                })
                .eq("id", eventRecord.id);
            }

            return new Response(JSON.stringify({ received: true, status: "payé" }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }

          // Événement : Échec du paiement
          const isFailed = eventType === "payment.failed" || eventType === "charge.failed";
          if (isFailed) {
            await supabaseAdmin
              .from("subscription_payments")
              .update({ statut: "échoué" })
              .eq("id", payment.id);

            if (eventRecord?.id) {
              await supabaseAdmin
                .from("payment_events")
                .update({
                  resultat: `Échec enregistré pour le paiement ${payment.id}`,
                  traite_le: new Date().toISOString(),
                })
                .eq("id", eventRecord.id);
            }

            return new Response(JSON.stringify({ received: true, status: "échoué" }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }

          // Événement : Session expirée
          const isExpired = eventType === "checkout.session.expired";
          if (isExpired) {
            await supabaseAdmin
              .from("subscription_payments")
              .update({ statut: "expiré" })
              .eq("id", payment.id);

            if (eventRecord?.id) {
              await supabaseAdmin
                .from("payment_events")
                .update({
                  resultat: `Expiration enregistrée pour le paiement ${payment.id}`,
                  traite_le: new Date().toISOString(),
                })
                .eq("id", eventRecord.id);
            }

            return new Response(JSON.stringify({ received: true, status: "expiré" }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }

          // Autre type d'événement
          if (eventRecord?.id) {
            await supabaseAdmin
              .from("payment_events")
              .update({
                resultat: `Événement ${eventType} non traité`,
                traite_le: new Date().toISOString(),
              })
              .eq("id", eventRecord.id);
          }

          return new Response(JSON.stringify({ received: true, unhandled: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (procErr) {
          const errMsg = procErr instanceof Error ? procErr.message : "Erreur traitement";
          console.error("[Webhook SasPay] Erreur de traitement:", procErr);

          if (eventRecord?.id) {
            await supabaseAdmin
              .from("payment_events")
              .update({
                resultat: `Erreur interne: ${errMsg}`,
                traite_le: new Date().toISOString(),
              })
              .eq("id", eventRecord.id);
          }

          return new Response(JSON.stringify({ error: "Erreur interne", detail: errMsg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
