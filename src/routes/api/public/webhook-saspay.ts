import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifySasPayWebhookSignature, getSasPayCheckoutSession } from "@/lib/saspay";
import { internalActivateSubscription } from "@/lib/subscriptions.functions";
import { sendSubscriptionInvoiceEmail } from "@/lib/invoices.server";
import type { SubscriptionPeriod } from "@/lib/subscriptions";

export const Route = createFileRoute("/api/public/webhook-saspay")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // 1. Lire le corps BRUT de la requête, sans le reformater
        let rawBody = "";
        try {
          rawBody = await request.text();
        } catch (_err) {
          return new Response(JSON.stringify({ error: "Corps de requête illisible" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        // 2. Récupération des en-têtes SasPay
        const signatureHeader =
          request.headers.get("x-webhook-signature") ||
          request.headers.get("X-Webhook-Signature") ||
          request.headers.get("x-saspay-signature") ||
          request.headers.get("X-SasPay-Signature") ||
          "";

        const timestampHeader =
          request.headers.get("x-webhook-timestamp") ||
          request.headers.get("X-Webhook-Timestamp") ||
          null;

        const eventHeader =
          request.headers.get("x-webhook-event") ||
          request.headers.get("X-Webhook-Event") ||
          "";

        let parsedBody: Record<string, unknown> = {};
        try {
          parsedBody = JSON.parse(rawBody);
        } catch {
          parsedBody = { raw: rawBody };
        }

        const eventType =
          eventHeader ||
          (parsedBody["event"] as string) ||
          (parsedBody["type"] as string) ||
          "unknown";

        // Extraction de l'objet de données (peut être à la racine ou sous data)
        const eventData = (parsedBody["data"] as Record<string, unknown>) || parsedBody;

        const transactionId =
          (eventData["transaction_id"] as string) ||
          (eventData["id"] as string) ||
          (parsedBody["id"] as string) ||
          null;

        const sessionId =
          (eventData["session_id"] as string) ||
          (parsedBody["session_id"] as string) ||
          null;

        // 3. Vérification de la signature et de l'horodatage (5 minutes de tolérance)
        const verification = await verifySasPayWebhookSignature(
          rawBody,
          signatureHeader,
          timestampHeader
        );

        // 4. Enregistrement systématique de l'événement dans payment_events
        const { data: eventRecord, error: eventErr } = await supabaseAdmin
          .from("payment_events")
          .insert({
            corps: parsedBody as any,
            signature_valide: verification.isValid,
            type_evenement: eventType,
            session_id: sessionId,
            transaction_id: transactionId,
            recu_le: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (eventErr) {
          console.error("[Webhook SasPay] Erreur journalisation payment_events:", eventErr);
        }

        // Si signature invalide ou horodatage hors tolérance (> 5 min) -> 401
        if (!verification.isValid) {
          console.warn(`[Webhook SasPay] Rejet 401: raison=${verification.reason}`);
          if (eventRecord?.id) {
            await supabaseAdmin
              .from("payment_events")
              .update({
                resultat: `Rejeté 401 : ${verification.reason || "signature invalide"}`,
                traite_le: new Date().toISOString(),
              })
              .eq("id", eventRecord.id);
          }
          return new Response(JSON.stringify({ error: "Signature ou horodatage invalide" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        // 5. Événements informatifs ou de test : journaliser uniquement et répondre 200 vite
        const isInformationalEvent =
          eventType === "webhook.test" ||
          eventType.startsWith("settlement.") ||
          eventType.startsWith("wallet_transfer.");

        if (isInformationalEvent) {
          if (eventRecord?.id) {
            await supabaseAdmin
              .from("payment_events")
              .update({
                resultat: `Événement ${eventType} journalisé uniquement`,
                traite_le: new Date().toISOString(),
              })
              .eq("id", eventRecord.id);
          }
          return new Response(JSON.stringify({ received: true, ignored: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        // 6. Idempotence : déduplication par type_evenement et identifiant de transaction
        if (transactionId) {
          const { data: duplicateEvents } = await supabaseAdmin
            .from("payment_events")
            .select("id, resultat, traite_le")
            .eq("transaction_id", transactionId)
            .eq("type_evenement", eventType)
            .eq("signature_valide", true)
            .not("traite_le", "is", null)
            .neq("id", eventRecord?.id ?? "");

          if (duplicateEvents && duplicateEvents.length > 0) {
            if (eventRecord?.id) {
              await supabaseAdmin
                .from("payment_events")
                .update({
                  resultat: `Ignoré : événement déjà traité (idempotence transaction_id=${transactionId})`,
                  traite_le: new Date().toISOString(),
                })
                .eq("id", eventRecord.id);
            }
            return new Response(JSON.stringify({ received: true, idempotent: true }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }
        }

        // 7. Rapprochement avec notre demande de paiement
        try {
          const metadata =
            (eventData["metadata"] as Record<string, string>) ||
            (parsedBody["metadata"] as Record<string, string>) ||
            {};

          let paymentId = metadata["payment_id"];
          const reference =
            (eventData["reference"] as string) || (parsedBody["reference"] as string) || null;

          // Si pas de paymentId dans metadata, tester si la reference est un UUID de paiement
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (!paymentId && reference && uuidRegex.test(reference)) {
            paymentId = reference;
          }

          let paymentRecord: any = null;

          // Recherche directe par ID de paiement
          if (paymentId) {
            const { data } = await supabaseAdmin
              .from("subscription_payments")
              .select("*")
              .eq("id", paymentId)
              .maybeSingle();
            paymentRecord = data;
          }

          // Recherche par session_id si non trouvé
          if (!paymentRecord && sessionId) {
            const { data } = await supabaseAdmin
              .from("subscription_payments")
              .select("*")
              .eq("saspay_session_id", sessionId)
              .maybeSingle();
            paymentRecord = data;
          }

          // Si toujours non trouvé mais qu'on a un sessionId, relire la session via l'API SasPay
          if (!paymentRecord && sessionId) {
            const remoteSession = await getSasPayCheckoutSession(sessionId);
            if (remoteSession) {
              const remoteMeta = (remoteSession as any).metadata || {};
              if (remoteMeta.payment_id) {
                const { data } = await supabaseAdmin
                  .from("subscription_payments")
                  .select("*")
                  .eq("id", remoteMeta.payment_id)
                  .maybeSingle();
                paymentRecord = data;
              }
            }
          }

          // Si aucun paiement trouvé : journaliser et ne jamais deviner
          if (!paymentRecord) {
            if (eventRecord?.id) {
              await supabaseAdmin
                .from("payment_events")
                .update({
                  resultat: `Paiement introuvable pour payment_id=${paymentId} sessionId=${sessionId} reference=${reference}`,
                  traite_le: new Date().toISOString(),
                })
                .eq("id", eventRecord.id);
            }
            return new Response(JSON.stringify({ received: true, error: "Paiement introuvable" }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }

          // ── TRAITEMENT SELON LE TYPE D'ÉVÉNEMENT ──────────────────────────────

          // A. ÉCHEC / ANNULATION
          if (eventType === "transaction.failed" || eventType === "payment.failed") {
            await supabaseAdmin
              .from("subscription_payments")
              .update({
                statut: "échoué",
                saspay_transaction_id: transactionId || paymentRecord.saspay_transaction_id,
              })
              .eq("id", paymentRecord.id);

            if (eventRecord?.id) {
              await supabaseAdmin
                .from("payment_events")
                .update({
                  resultat: `Paiement ${paymentRecord.id} marqué comme échoué`,
                  traite_le: new Date().toISOString(),
                })
                .eq("id", eventRecord.id);
            }

            return new Response(JSON.stringify({ received: true, status: "échoué" }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }

          if (eventType === "transaction.cancelled" || eventType === "payment.cancelled") {
            await supabaseAdmin
              .from("subscription_payments")
              .update({
                statut: "annulé",
                saspay_transaction_id: transactionId || paymentRecord.saspay_transaction_id,
              })
              .eq("id", paymentRecord.id);

            if (eventRecord?.id) {
              await supabaseAdmin
                .from("payment_events")
                .update({
                  resultat: `Paiement ${paymentRecord.id} marqué comme annulé`,
                  traite_le: new Date().toISOString(),
                })
                .eq("id", eventRecord.id);
            }

            return new Response(JSON.stringify({ received: true, status: "annulé" }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }

          // B. SUCCÈS DU PAIEMENT
          const isSuccessEvent =
            eventType === "transaction.success" ||
            eventType === "payment.completed" ||
            eventType === "checkout.session.completed";

          if (isSuccessEvent) {
            // Idempotence : si déjà payé, ne rien ré-activer
            if (paymentRecord.statut === "payé") {
              if (eventRecord?.id) {
                await supabaseAdmin
                  .from("payment_events")
                  .update({
                    resultat: `Paiement ${paymentRecord.id} déjà payé (idempotence)`,
                    traite_le: new Date().toISOString(),
                  })
                  .eq("id", eventRecord.id);
              }
              return new Response(JSON.stringify({ received: true, idempotent: true }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
              });
            }

            // Extraction des montants et devise (strictement Franc Congolais - CDF)
            const rawCurrency =
              (eventData["currency"] as string) || (parsedBody["currency"] as string) || "CDF";
            const currency = rawCurrency.toUpperCase().trim();
            const rawAmount =
              eventData["amount"] ?? parsedBody["amount"] ?? null;
            const rawNetAmount =
              eventData["net_amount"] ?? parsedBody["net_amount"] ?? null;
            const rawCharged =
              eventData["charged"] ?? parsedBody["charged"] ?? null;
            const rawFee =
              eventData["fee"] ?? parsedBody["fee"] ?? null;

            const amountNum = rawAmount !== null ? Number(rawAmount) : null;
            const netAmountNum = rawNetAmount !== null ? Number(rawNetAmount) : null;
            const chargedNum = rawCharged !== null ? Number(rawCharged) : null;
            const feeNum = rawFee !== null ? Number(rawFee) : null;

            // Contrôle 1 : Devise doit être CDF (ou FC)
            if (currency !== "CDF" && currency !== "FC") {
              const note = `Devise inattendue : ${currency} au lieu de CDF.`;
              await supabaseAdmin
                .from("subscription_payments")
                .update({
                  statut: "à_vérifier",
                  admin_note: note,
                  montant_debite: chargedNum,
                  montant_net: netAmountNum,
                  frais: feeNum,
                  saspay_transaction_id: transactionId,
                })
                .eq("id", paymentRecord.id);

              if (eventRecord?.id) {
                await supabaseAdmin
                  .from("payment_events")
                  .update({
                    resultat: `Paiement mis en à_vérifier: ${note}`,
                    traite_le: new Date().toISOString(),
                  })
                  .eq("id", eventRecord.id);
              }

              return new Response(JSON.stringify({ received: true, status: "à_vérifier" }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
              });
            }

            // Contrôle 2 : Montant cohérent avec le prix attendu du plan (Franc Congolais - CDF)
            // Compare amount ou net_amount au prix attendu, JAMAIS charged seul (car il contient les frais)
            const expectedPrice = Number(paymentRecord.montant_cdf ?? paymentRecord.amount ?? 0);
            const candidateAmount = amountNum !== null ? amountNum : netAmountNum;

            const isAmountValid =
              candidateAmount !== null &&
              Math.abs(candidateAmount - expectedPrice) <= 100; // tolérance 100 FC

            if (!isAmountValid) {
              const note = `Montant incohérent : attendu ${expectedPrice} FC, reçu amount=${amountNum}, net_amount=${netAmountNum}, charged=${chargedNum}.`;
              await supabaseAdmin
                .from("subscription_payments")
                .update({
                  statut: "à_vérifier",
                  admin_note: note,
                  montant_debite: chargedNum,
                  montant_net: netAmountNum,
                  frais: feeNum,
                  saspay_transaction_id: transactionId,
                })
                .eq("id", paymentRecord.id);

              if (eventRecord?.id) {
                await supabaseAdmin
                  .from("payment_events")
                  .update({
                    resultat: `Paiement mis en à_vérifier: ${note}`,
                    traite_le: new Date().toISOString(),
                  })
                  .eq("id", eventRecord.id);
              }

              return new Response(JSON.stringify({ received: true, status: "à_vérifier" }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
              });
            }

            // Contrôle 3 : Le paiement doit être en attente
            if (paymentRecord.statut !== "en_attente") {
              const note = `Statut préalable anormal : ${paymentRecord.statut} au lieu de 'en_attente'.`;
              await supabaseAdmin
                .from("subscription_payments")
                .update({
                  statut: "à_vérifier",
                  admin_note: note,
                  montant_debite: chargedNum,
                  montant_net: netAmountNum,
                  frais: feeNum,
                  saspay_transaction_id: transactionId,
                })
                .eq("id", paymentRecord.id);

              if (eventRecord?.id) {
                await supabaseAdmin
                  .from("payment_events")
                  .update({
                    resultat: `Paiement mis en à_vérifier: ${note}`,
                    traite_le: new Date().toISOString(),
                  })
                  .eq("id", eventRecord.id);
              }

              return new Response(JSON.stringify({ received: true, status: "à_vérifier" }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
              });
            }

            // Tout est valide ! Mise à jour du paiement et activation
            await supabaseAdmin
              .from("subscription_payments")
              .update({
                statut: "payé",
                paye_le: new Date().toISOString(),
                saspay_transaction_id: transactionId,
                montant_debite: chargedNum,
                montant_net: netAmountNum,
                frais: feeNum,
              })
              .eq("id", paymentRecord.id);

            // Activation ou renouvellement de l'abonnement
            await internalActivateSubscription({
              shopId: paymentRecord.shop_id,
              merchantId: paymentRecord.merchant_id,
              planId: paymentRecord.plan_id,
              period: (paymentRecord.period as SubscriptionPeriod) || "mensuel",
              paymentId: paymentRecord.id,
            });

            // Envoi de la facture par email (best-effort — ne bloque pas le webhook)
            sendSubscriptionInvoiceEmail({ paymentId: paymentRecord.id }).then((emailResult) => {
              if (emailResult.success) {
                console.log(`[Webhook] ✅ Facture envoyée (msgId=${emailResult.messageId})`);
              } else {
                console.warn(`[Webhook] ⚠️ Échec envoi facture: ${emailResult.error}`);
              }
            }).catch((err) => {
              console.error("[Webhook] Erreur inattendue envoi facture:", err);
            });

            if (eventRecord?.id) {
              await supabaseAdmin
                .from("payment_events")
                .update({
                  resultat: `Succès : abonnement ${paymentRecord.plan_id} activé pour la boutique ${paymentRecord.shop_id}`,
                  traite_le: new Date().toISOString(),
                })
                .eq("id", eventRecord.id);
            }

            return new Response(JSON.stringify({ received: true, status: "payé" }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }

          // Autre événement inconnu
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
          const errMsg = procErr instanceof Error ? procErr.message : "Erreur interne";
          console.error("[Webhook SasPay] Erreur:", procErr);

          if (eventRecord?.id) {
            await supabaseAdmin
              .from("payment_events")
              .update({
                resultat: `Erreur interne : ${errMsg}`,
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
