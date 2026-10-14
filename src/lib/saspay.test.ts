import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSasPayCheckout } from "./saspay";

describe("client SasPay", () => {
  const originalKey = process.env["SASPAY_SECRET_KEY"];

  beforeEach(() => {
    process.env["SASPAY_SECRET_KEY"] = "sk_test_vitest_placeholder";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalKey === undefined) {
      delete process.env["SASPAY_SECRET_KEY"];
    } else {
      process.env["SASPAY_SECRET_KEY"] = originalKey;
    }
  });

  it("accepte la réponse SasPay enveloppée dans data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              id: "session_test_123",
              checkout_url: "https://checkout.example.test/session_test_123",
              status: "created",
              amount: "7.00",
              currency: "USD",
            },
            code: 201,
          }),
          { status: 201, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const session = await createSasPayCheckout({
      amount: "7.00",
      currency: "USD",
      description: "Abonnement MarketNet Pro mensuel",
      country: "CD",
      customer_email: "merchant@example.test",
      customer_name: "Merchant Test",
      return_url: "https://marketnet.example.test/abonnement/retour?ref=payment-id",
      metadata: { payment_id: "payment-id" },
      expires_at: "2026-10-15T00:00:00.000Z",
    });

    expect(session.id).toBe("session_test_123");
    expect(session.checkout_url).toBe("https://checkout.example.test/session_test_123");
  });
});
