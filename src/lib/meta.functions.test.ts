import { describe, expect, it } from "vitest";
import { META_SCOPES, buildMetaState, verifyMetaState, formatMetaError, MetaGraphError } from "./meta.functions";
import { encryptSecret, decryptSecret } from "./meta.crypto";

describe("Meta OAuth state", () => {
  it("creates a state that validates for the same shop and secret", async () => {
    const state = await buildMetaState("shop_123", "top-secret");
    await expect(verifyMetaState(state, "shop_123", "top-secret", 15 * 60_000)).resolves.toBe(true);
  });

  it("rejects a state signed for another shop or secret", async () => {
    const state = await buildMetaState("shop_123", "top-secret");
    await expect(verifyMetaState(state, "shop_999", "top-secret", 15 * 60_000)).resolves.toBe(false);
    await expect(verifyMetaState(state, "shop_123", "other-secret", 15 * 60_000)).resolves.toBe(false);
  });

  it("requests permissions needed to list, read, publish to, and inspect Facebook Pages", () => {
    expect(META_SCOPES).toEqual([
      "pages_show_list",
      "pages_read_engagement",
      "pages_manage_posts",
      "read_insights",
    ]);
    expect(META_SCOPES).toContain("pages_manage_posts");
    expect(META_SCOPES).toContain("pages_read_engagement");
    expect(META_SCOPES).toContain("read_insights");
    expect(META_SCOPES).not.toContain("instagram_basic");
  });
});

describe("Meta token encryption", () => {
  it("encrypts and decrypts page access tokens accurately", () => {
    process.env.META_APP_SECRET = "test_meta_secret_for_tests_12345";
    const sampleToken = "EAAGm0PX4ZCpsBAO8ZAtestingTokenValue";
    const enc = encryptSecret(sampleToken);

    expect(enc).toMatch(/^enc:v1:/);
    expect(enc).not.toContain(sampleToken);

    const dec = decryptSecret(enc);
    expect(dec).toBe(sampleToken);
  });

  it("handles legacy plaintext tokens gracefully", () => {
    const plainToken = "EAAGlegacyPlainToken";
    expect(decryptSecret(plainToken)).toBe(plainToken);
    expect(decryptSecret(null)).toBeNull();
  });
});

describe("Meta error translation and sanitization", () => {
  it("translates code 190 into expired session in French", () => {
    const err = new MetaGraphError("Error validating access token: Session has expired", 190);
    const msg = formatMetaError(err);
    expect(msg).toContain("expiré");
    expect(msg).not.toContain("EAAG");
    expect(msg).not.toContain("Error validating");
  });

  it("translates code 10 and missing permissions into clear instructions", () => {
    const err = new MetaGraphError("Requires pages_read_engagement", 10);
    const msg = formatMetaError(err);
    expect(msg).toContain("Autorisations insuffisantes");
    expect(msg).not.toContain("pages_read_engagement");
  });

  it("translates code 100 subcode 33 into post not existing/accessible", () => {
    const err = new MetaGraphError("Unsupported get request. Object with ID does not exist", 100, 33);
    const msg = formatMetaError(err);
    expect(msg).toContain("n'existe plus ou n'est pas accessible");
  });
});
