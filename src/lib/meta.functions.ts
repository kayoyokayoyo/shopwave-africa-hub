import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GRAPH = "https://graph.facebook.com/v21.0";
const GRAPH_INSIGHTS = "https://graph.facebook.com/v26.0";
export const META_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "read_insights",
] as const;

const SCOPES = META_SCOPES.join(",");

function creds() {
  const id = process.env["META_APP_ID"];
  const secret = process.env["META_APP_SECRET"];
  if (!id || !secret) throw new Error("Configuration Meta manquante");
  return { id, secret };
}

async function hmac(secret: string, msg: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function buildMetaState(shopId: string, secret: string) {
  const nonce = crypto.randomUUID();
  const ts = Date.now().toString();
  const payload = `${shopId}.${ts}.${nonce}`;
  const sig = await hmac(secret, payload);
  return `${payload}.${sig}`;
}

export async function verifyMetaState(state: string, expectedShopId: string, secret: string, maxAgeMs = 15 * 60_000) {
  if (!state || typeof state !== "string") return false;

  const parts = state.split(".");
  if (parts.length !== 4) return false;

  const [shopId, ts, nonce, sig] = parts;
  if (!shopId || !ts || !nonce || !sig) return false;
  if (shopId !== expectedShopId) return false;

  const payload = `${shopId}.${ts}.${nonce}`;
  if (sig !== (await hmac(secret, payload))) return false;

  const createdAt = Number(ts);
  if (!Number.isFinite(createdAt)) return false;

  return Date.now() - createdAt <= maxAgeMs;
}

async function graph<T = Record<string, unknown>>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path.startsWith("http") ? path : `${GRAPH}${path}`, init);
  const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } } & T;
  if (!res.ok || body.error) {
    console.error(`Meta error [${res.status}]`, JSON.stringify(body));
    throw new Error(`Meta : ${body.error?.message ?? `erreur ${res.status}`}`);
  }
  return body;
}

type Ctx = { supabase: any; userId: string };

async function myShop(ctx: Ctx) {
  const { data: shop, error } = await ctx.supabase.from("shops").select("id, name, slug, plan_id").eq("owner_id", ctx.userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!shop) throw new Error("Aucune boutique");
  const { data: plan } = await ctx.supabase.from("plans").select("meta_access, name").eq("id", shop.plan_id).maybeSingle();
  return { shop, metaAccess: !!plan?.meta_access, planName: plan?.name as string | undefined };
}

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

const uri = z.string().url().max(300);

export const metaStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { shop, metaAccess, planName } = await myShop(context);
    const db = await admin();
    const { data: c } = await db.from("meta_connections").select("page_id, page_name, ig_account_id, token_expires_at, connected_at").eq("shop_id", shop.id).maybeSingle();
    const { data: posts } = await context.supabase.from("meta_posts").select("*").eq("shop_id", shop.id).order("created_at", { ascending: false }).limit(50);
    return {
      metaAccess, planName,
      connection: c ? {
        pageSelected: !!c.page_id, pageName: c.page_name, hasInstagram: !!c.ig_account_id,
        expiresAt: c.token_expires_at,
        expired: !!c.token_expires_at && new Date(c.token_expires_at) < new Date(),
      } : null,
      posts: posts ?? [],
    };
  });

export const metaAuthUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ redirectUri: uri }).parse(d))
  .handler(async ({ data, context }) => {
    const { shop, metaAccess } = await myShop(context);
    if (!metaAccess) throw new Error("La publication Meta est disponible à partir du plan Pro");
    const { id, secret } = creds();
    const state = await buildMetaState(shop.id, secret);
    const u = new URL("https://www.facebook.com/v21.0/dialog/oauth");
    u.searchParams.set("client_id", id);
    u.searchParams.set("redirect_uri", data.redirectUri);
    u.searchParams.set("state", state);
    u.searchParams.set("scope", SCOPES);
    u.searchParams.set("response_type", "code");
    return { url: u.toString() };
  });

type Page = { id: string; name: string; access_token: string; instagram_business_account?: { id: string } };

export const metaExchange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ code: z.string().min(5).max(2000), state: z.string().max(300), redirectUri: uri }).parse(d))
  .handler(async ({ data, context }) => {
    const { shop } = await myShop(context);
    const { id, secret } = creds();

    const validState = await verifyMetaState(data.state, shop.id, secret);
    if (!validState) {
      throw new Error("Lien de connexion invalide ou expiré, recommencez");
    }

    const short = await graph<{ access_token: string }>(`/oauth/access_token?client_id=${id}&client_secret=${secret}&redirect_uri=${encodeURIComponent(data.redirectUri)}&code=${encodeURIComponent(data.code)}`);
    const long = await graph<{ access_token: string; expires_in?: number }>(`/oauth/access_token?grant_type=fb_exchange_token&client_id=${id}&client_secret=${secret}&fb_exchange_token=${short.access_token}`);
    const expires = new Date(Date.now() + (long.expires_in ?? 60 * 86400) * 1000).toISOString();
    const db = await admin();
    const { error } = await db.from("meta_connections").upsert({
      shop_id: shop.id, access_token: long.access_token, token_expires_at: expires,
      page_id: null, page_name: null, ig_account_id: null, connected_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const metaListPages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { shop } = await myShop(context);
    const db = await admin();
    const { data: c } = await db.from("meta_connections").select("access_token, page_id").eq("shop_id", shop.id).maybeSingle();
    if (!c?.access_token || c.page_id) return { pages: [] };
    const r = await graph<{ data: Page[] }>(`/me/accounts?fields=id,name,instagram_business_account{id,username}&limit=50&access_token=${c.access_token}`);
    return { pages: r.data.map((p) => ({ id: p.id, name: p.name, instagram: !!p.instagram_business_account })) };
  });

export const metaSelectPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ pageId: z.string().regex(/^\d+$/).max(40) }).parse(d))
  .handler(async ({ data, context }) => {
    const { shop } = await myShop(context);
    const db = await admin();
    const { data: c } = await db.from("meta_connections").select("access_token").eq("shop_id", shop.id).maybeSingle();
    if (!c?.access_token) throw new Error("Reconnectez Facebook");
    const r = await graph<{ data: Page[] }>(`/me/accounts?fields=id,name,access_token,instagram_business_account&limit=50&access_token=${c.access_token}`);
    const page = r.data.find((p) => p.id === data.pageId);
    if (!page) throw new Error("Page introuvable");
    // Page tokens from a long-lived user token don't expire; keep the user-token expiry as reconnect hint.
    const { error } = await db.from("meta_connections").update({
      page_id: page.id, page_name: page.name, access_token: page.access_token,
      ig_account_id: page.instagram_business_account?.id ?? null,
    }).eq("shop_id", shop.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const metaDisconnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { shop } = await myShop(context);
    const db = await admin();
    const { data: c } = await db.from("meta_connections").select("access_token").eq("shop_id", shop.id).maybeSingle();
    if (c?.access_token) await fetch(`${GRAPH}/me/permissions?access_token=${c.access_token}`, { method: "DELETE" }).catch(() => null);
    await db.from("meta_connections").delete().eq("shop_id", shop.id);
    return { ok: true };
  });

export const metaPublish = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({
    productId: z.string().uuid(),
    platforms: z.array(z.enum(["facebook", "instagram"])).min(1),
    caption: z.string().max(2000),
    origin: z.string().url().max(200),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { shop, metaAccess } = await myShop(context);
    if (!metaAccess) throw new Error("La publication Meta est disponible à partir du plan Pro");
    const { data: product } = await context.supabase.from("products").select("id, name, images").eq("id", data.productId).eq("shop_id", shop.id).maybeSingle();
    if (!product) throw new Error("Produit introuvable");
    const db = await admin();
    const { data: c } = await db.from("meta_connections").select("*").eq("shop_id", shop.id).maybeSingle();
    if (!c?.page_id || !c.access_token) throw new Error("Connectez d'abord votre page Facebook");
    const img = product.images?.[0] as string | undefined;
    const imageUrl = img ? (img.startsWith("http") ? img : `${data.origin}/api/public/media/${img}`) : null;
    const link = `${data.origin}/b/${shop.slug}/p/${product.id}`;
    const caption = `${data.caption}\n\n🛒 ${link}`;
    const results: { platform: string; ok: boolean; error?: string }[] = [];

    for (const platform of data.platforms) {
      try {
        let externalId: string;
        if (platform === "facebook") {
          let r: { id?: string; post_id?: string };
          if (imageUrl) {
            const body = new FormData();
            body.set("access_token", c.access_token);
            body.set("caption", caption);

            if (img && !img.startsWith("http")) {
              if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/i.test(img)) {
                throw new Error("Chemin d’image produit invalide");
              }
              const { data: image, error } = await db.storage.from("shop-media").download(img);
              if (error || !image) throw new Error("Image du produit introuvable dans le stockage");
              body.set("source", image, img.split("/").at(-1) ?? "product.webp");
            } else {
              body.set("url", imageUrl);
            }

            r = await graph(`/${c.page_id}/photos`, { method: "POST", body });
          } else {
            const body = new URLSearchParams({ access_token: c.access_token });
            body.set("message", caption); body.set("link", link);
            r = await graph(`/${c.page_id}/feed`, { method: "POST", body });
          }
          externalId = r.post_id ?? r.id ?? "";
        } else {
          if (!c.ig_account_id) throw new Error("Aucun compte Instagram professionnel lié à cette page");
          if (!imageUrl) throw new Error("Instagram exige une photo");
          const m = await graph<{ id: string }>(`/${c.ig_account_id}/media`, { method: "POST", body: new URLSearchParams({ image_url: imageUrl, caption, access_token: c.access_token }) });
          const p = await graph<{ id: string }>(`/${c.ig_account_id}/media_publish`, { method: "POST", body: new URLSearchParams({ creation_id: m.id, access_token: c.access_token }) });
          externalId = p.id;
        }
        await db.from("meta_posts").insert({ shop_id: shop.id, product_id: product.id, platform, external_id: externalId });
        results.push({ platform, ok: true });
      } catch (e) {
        results.push({ platform, ok: false, error: (e as Error).message });
      }
    }
    return { results };
  });

export const metaRefreshStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { shop } = await myShop(context);
    const db = await admin();
    const { data: c } = await db.from("meta_connections").select("access_token").eq("shop_id", shop.id).maybeSingle();
    if (!c?.access_token) return { updated: 0 };
    const { data: posts } = await db.from("meta_posts").select("id, platform, external_id, reach, clicks").eq("shop_id", shop.id).order("created_at", { ascending: false }).limit(25);
    let updated = 0;
    const errors: string[] = [];
    for (const p of posts ?? []) {
      if (!p.external_id) continue;
      try {
        let reach: number | null = null, clicks: number | null = null;
        let hasMetrics = false;
        if (p.platform === "facebook") {
          const r = await graph<{ data: { name: string; values: { value: number }[] }[] }>(`${GRAPH_INSIGHTS}/${p.external_id}/insights?metric=post_total_media_view_unique,post_clicks&access_token=${encodeURIComponent(c.access_token)}`);
          for (const m of r.data) {
            const v = Number(m.values?.[0]?.value ?? 0);
            if (m.name === "post_total_media_view_unique") { reach = v; hasMetrics = true; }
            if (m.name === "post_clicks") { clicks = v; hasMetrics = true; }
          }
        } else {
          const r = await graph<{ data: { name: string; values: { value: number }[] }[] }>(`${GRAPH_INSIGHTS}/${p.external_id}/insights?metric=reach&access_token=${encodeURIComponent(c.access_token)}`);
          const metric = r.data.find((item) => item.name === "reach");
          if (metric) { reach = Number(metric.values?.[0]?.value ?? 0); hasMetrics = true; }
        }
        const values: { reach?: number | null; clicks?: number | null } = {};
        if (reach != null) values.reach = reach;
        else if (p.reach === 0) values.reach = null;
        if (clicks != null) values.clicks = clicks;
        else if (p.clicks === 0) values.clicks = null;
        if (Object.keys(values).length) {
          await db.from("meta_posts").update(values).eq("id", p.id);
          if (hasMetrics) updated++;
        }
      } catch (e) {
        errors.push((e as Error).message);
      }
    }
    if (!updated && !errors.length && (posts ?? []).some((post) => post.external_id)) {
      errors.push("Meta n’a pas encore fourni ces statistiques. Vérifiez l’accès read_insights et réessayez plus tard.");
    }
    return { updated, errors };
  });
