import { describe, it, expect } from "vitest";
import { generateInvoicePdf, buildInvoiceHtml, type InvoiceData } from "@/lib/invoices.server";

const mockInvoice: InvoiceData = {
  invoiceNumber: "MN-TEST1234",
  paymentId: "pay_test_uuid_12345",
  transactionId: "sas_txn_9876543210",
  shopName: "Boutique Congo Express",
  shopWhatsapp: "+243810000000",
  merchantEmail: "commercant@example.com",
  merchantName: "Jean Dupont",
  planName: "Plan BUSINESS",
  period: "Mensuel (30 jours)",
  amountCDF: 25000,
  paymentDate: "14 octobre 2026, 15:30",
  validUntil: "14 novembre 2026",
  paymentMethod: "SasPay (Airtel Money)",
  dashboardUrl: "https://marketnet-chi.vercel.app/dashboard/abonnement",
};

describe("Système de facturation & PDF", () => {
  it("génère le contenu HTML de la facture avec les bonnes données", () => {
    const html = buildInvoiceHtml(mockInvoice);
    expect(html).toContain("MN-TEST1234");
    expect(html).toContain("Boutique Congo Express");
    expect(html).toContain("25 000 FC");
    expect(html).toContain("ACQUITTÉE");
  });

  it("génère un fichier PDF binaire valide avec pdf-lib", async () => {
    const pdfBuffer = await generateInvoicePdf(mockInvoice);
    expect(pdfBuffer).toBeDefined();
    expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
    expect(pdfBuffer.length).toBeGreaterThan(1000);
    // Un fichier PDF commence toujours par les octets magiques %PDF-
    const header = pdfBuffer.slice(0, 5).toString("ascii");
    expect(header).toBe("%PDF-");
  });
});

