import { describe, expect, it } from "vitest";
import { META_SCOPES, buildMetaState, verifyMetaState } from "./meta.functions";

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
    expect(META_SCOPES).not.toContain("instagram_content_publish");
    expect(META_SCOPES).not.toContain("business_management");
  });
});
