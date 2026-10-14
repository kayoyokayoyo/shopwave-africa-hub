import { createFileRoute } from "@tanstack/react-router";
import { getInvoiceData, generateInvoicePdf } from "@/lib/invoices.server";

export const Route = createFileRoute("/api/public/invoice-pdf")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const paymentId = url.searchParams.get("paymentId");

          if (!paymentId) {
            return new Response(JSON.stringify({ error: "Paramètre paymentId manquant" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const inv = await getInvoiceData(paymentId);
          if (!inv) {
            return new Response(JSON.stringify({ error: "Facture introuvable pour ce paiement" }), {
              status: 404,
              headers: { "Content-Type": "application/json" },
            });
          }

          const pdfBuffer = await generateInvoicePdf(inv);

          return new Response(pdfBuffer, {
            status: 200,
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": `attachment; filename="facture-${inv.invoiceNumber}.pdf"`,
              "Cache-Control": "private, max-age=3600",
            },
          });
        } catch (error) {
          console.error("[Invoice-PDF] Erreur lors de la génération du PDF:", error);
          return new Response(JSON.stringify({ error: "Erreur serveur lors de la génération du PDF" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
