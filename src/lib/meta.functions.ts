import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { encryptSecret, decryptSecret } from "@/lib/meta.crypto";

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

export type MetaErrorPayload = {
  error?: {
    message?: string;
    code?: number;
    error_subcode?: number;
    type?: string;
  };
};

export class MetaGraphError extends Error {
  code?: number;
  subcode?: number;
  constructor(message: string, code?: number, subcode?: number) {
    super(message);
    this.name = "MetaGraphError";
    this.code = code;
    this.subcode = subcode;
  }
}

/**
 * Traduit une erreur Meta en message convivial en français,
 * sans jamais exposer de token, d'identifiants bruts ni de message technique brut.
 */
export function formatMetaError(err: unknown): string {
  if (err instanceof MetaGraphError) {
    if (err.code === 190) {
      return "Votre session Facebook a expiré. Reconnectez-vous pour actualiser l'accès.";
    }
    if (err.code === 10 || err.code === 200) {
      return "Autorisations insuffisantes sur la page Facebook. Reconnectez-vous en accordant toutes les autorisations demandées.";
    }
    if (err.code === 100 && err.subcode === 33) {
      return "La publication demandée n'existe plus ou n'est pas accessible.";
    }
  }
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("190") || msg.toLowerCase().includes("session") || msg.toLowerCase().includes("expired")) {
    return "Votre session Facebook a expiré. Reconnectez-vous pour continuer.";
  }
  if (msg.includes("10") || msg.includes("200") || msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("pages_read_engagement")) {
    return "Autorisations insuffisantes sur la page Facebook. Reconnectez-vous et acceptez toutes les autorisations.";
  }
  return "Une erreur est survenue lors de la communication avec Meta. Veuillez réessayer plus tard.";
}

async function graph<T = Record<string, unknown>>(path: string, init?: RequestInit): Promise<T> {
  const url = path.startsWith("http") ? path : `${GRAPH}${path}`;
  const res = await fetch(url, init);
  const body = (await res.json().catch(() => ({}))) as MetaErrorPayload & T;

  if (!res.ok || body.error) {
    // Journaliser l'erreur côté serveur SANS le jeton
    const sanitizedUrl = url.replace(/access_token=[^&]+/g, "access_token=[MASQUÉ]");
    console.error(`[Meta Graph Error] status=${res.status} endpoint=${sanitizedUrl} code=${body.error?.code} subcode=${body.error?.error_subcode} message=${body.error?.message}`);

    throw new MetaGraphError(
      body.error?.message ?? `Erreur HTTP ${res.status}`,
      body.error?.code,
      body.error?.error_subcode
    );
  }
  return body as T;
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

export type PageAccount = {
  id: string;
  name: string;
  access_token: string;
  tasks?: string[];
  instagram_business_account?: { id: string; username?: string };
};

export const metaStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { shop, metaAccess, planName } = await myShop(context);
    const db = await admin();
    const { data: c } = await db
      .from("meta_connections")
      .select("page_id, page_name, ig_account_id, token_expires_at, connected_at, missing_permissions, stats_last_updated_at")
      .eq("shop_id", shop.id)
      .maybeSingle();

    const { data: posts } = await context.supabase
      .from("meta_posts")
      .select("*")
      .eq("shop_id", shop.id)
      .order("created_at", { ascending: false })
      .limit(50);

    const missingPerms = (c?.missing_permissions as string[] | null) ?? [];
    const hasPermissionIssues = missingPerms.length > 0;

    return {
      metaAccess,
      planName,
      connection: c ? {
        pageSelected: !!c.page_id,
        pageName: c.page_name,
        hasInstagram: !!c.ig_account_id,
        expiresAt: c.token_expires_at,
        expired: !!c.token_expires_at && new Date(c.token_expires_at) < new Date(),
        missingPermissions: missingPerms,
        hasPermissionIssues,
        statsLastUpdatedAt: c.stats_last_updated_at,
      } : null,
      posts: (posts ?? []).map((p: any) => ({
        ...p,
        // Si post_media_view est null mais qu'on a des visites FB, on conserve la valeur
        fb_visits: p.fb_visits ?? 0,
      })),
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

/**
 * Vérifie les permissions effectives et les tâches des pages d'un utilisateur
 */
async function auditPermissionsAndTasks(userAccessToken: string) {
  const missing: string[] = [];

  try {
    // 1. Vérification des permissions globales de l'utilisateur
    const permRes = await graph<{ data: { permission: string; status: string }[] }>(
      `/me/permissions?access_token=${encodeURIComponent(userAccessToken)}`
    );

    const granted = new Set(
      (permRes.data ?? [])
        .filter((p) => p.status === "granted")
        .map((p) => p.permission)
    );

    for (const req of META_SCOPES) {
      if (!granted.has(req)) {
        missing.push(req);
      }
    }
  } catch (err) {
    console.warn("Impossible d'auditer /me/permissions:", err instanceof Error ? err.message : err);
  }

  return missing;
}

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

    // 1. Échange du code temporaire contre un token utilisateur court
    const short = await graph<{ access_token: string }>(
      `/oauth/access_token?client_id=${id}&client_secret=${secret}&redirect_uri=${encodeURIComponent(data.redirectUri)}&code=${encodeURIComponent(data.code)}`
    );

    // 2. Échange contre un token utilisateur longue durée (60 jours)
    const long = await graph<{ access_token: string; expires_in?: number }>(
      `/oauth/access_token?grant_type=fb_exchange_token&client_id=${id}&client_secret=${secret}&fb_exchange_token=${short.access_token}`
    );

    const expires = new Date(Date.now() + (long.expires_in ?? 60 * 86400) * 1000).toISOString();

    // 3. Récupération des permissions accordées
    const missingPermissions = await auditPermissionsAndTasks(long.access_token);

    // 4. Appel immédiat de /me/accounts pour obtenir et chiffrer le token de chaque page
    const r = await graph<{ data: PageAccount[] }>(
      `/me/accounts?fields=id,name,access_token,tasks,instagram_business_account{id,username}&limit=50&access_token=${encodeURIComponent(long.access_token)}`
    );

    // Chiffrer le token de chaque page côté serveur
    const pagesCache = (r.data ?? []).map((page) => ({
      id: page.id,
      name: page.name,
      access_token_enc: encryptSecret(page.access_token),
      tasks: page.tasks ?? [],
      has_analyze: (page.tasks ?? []).includes("ANALYZE"),
      instagram_business_account: page.instagram_business_account ?? null,
    }));

    const db = await admin();
    const { error } = await db.from("meta_connections").upsert({
      shop_id: shop.id,
      access_token: encryptSecret(long.access_token),
      token_expires_at: expires,
      page_id: null,
      page_name: null,
      ig_account_id: null,
      pages_cache: pagesCache,
      missing_permissions: missingPermissions,
      connected_at: new Date().toISOString(),
    });

    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const metaListPages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { shop } = await myShop(context);
    const db = await admin();
    const { data: c } = await db
      .from("meta_connections")
      .select("access_token, page_id, pages_cache")
      .eq("shop_id", shop.id)
      .maybeSingle();

    if (!c?.access_token || c.page_id) return { pages: [] };

    // Si on a le cache des pages, on le renvoie directement (sans les tokens bien sûr !)
    if (Array.isArray(c.pages_cache) && c.pages_cache.length > 0) {
      return {
        pages: c.pages_cache.map((p: any) => ({
          id: p.id,
          name: p.name,
          instagram: !!p.instagram_business_account,
          hasAnalyze: p.has_analyze ?? (p.tasks ?? []).includes("ANALYZE"),
        })),
      };
    }

    // Sinon, fallback sur un appel /me/accounts avec déchiffrement du token utilisateur
    const userToken = decryptSecret(c.access_token);
    if (!userToken) return { pages: [] };

    const r = await graph<{ data: PageAccount[] }>(
      `/me/accounts?fields=id,name,access_token,tasks,instagram_business_account{id,username}&limit=50&access_token=${encodeURIComponent(userToken)}`
    );

    const pagesCache = (r.data ?? []).map((page) => ({
      id: page.id,
      name: page.name,
      access_token_enc: encryptSecret(page.access_token),
      tasks: page.tasks ?? [],
      has_analyze: (page.tasks ?? []).includes("ANALYZE"),
      instagram_business_account: page.instagram_business_account ?? null,
    }));

    await db.from("meta_connections").update({ pages_cache: pagesCache }).eq("shop_id", shop.id);

    return {
      pages: pagesCache.map((p) => ({
        id: p.id,
        name: p.name,
        instagram: !!p.instagram_business_account,
        hasAnalyze: p.has_analyze,
      })),
    };
  });

export const metaSelectPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ pageId: z.string().regex(/^\d+$/).max(40) }).parse(d))
  .handler(async ({ data, context }) => {
    const { shop } = await myShop(context);
    const db = await admin();
    const { data: c } = await db
      .from("meta_connections")
      .select("access_token, pages_cache, missing_permissions")
      .eq("shop_id", shop.id)
      .maybeSingle();

    if (!c?.access_token) throw new Error("Reconnectez Facebook");

    let pageTokenEnc: string | null = null;
    let pageName = "";
    let igAccountId: string | null = null;
    let tasks: string[] = [];

    // Recherche dans le pages_cache
    const cachedPages = Array.isArray(c.pages_cache) ? (c.pages_cache as any[]) : [];
    const foundCached = cachedPages.find((p: any) => p.id === data.pageId);

    if (foundCached) {
      pageTokenEnc = foundCached.access_token_enc;
      pageName = foundCached.name;
      igAccountId = foundCached.instagram_business_account?.id ?? null;
      tasks = foundCached.tasks ?? [];
    } else {
      // Appel direct si non trouvé
      const userToken = decryptSecret(c.access_token);
      if (!userToken) throw new Error("Jeton expiré ou invalide. Reconnectez-vous à Facebook.");
      const r = await graph<{ data: PageAccount[] }>(
        `/me/accounts?fields=id,name,access_token,tasks,instagram_business_account&limit=50&access_token=${encodeURIComponent(userToken)}`
      );
      const page = r.data.find((p) => p.id === data.pageId);
      if (!page) throw new Error("Page introuvable");
      pageTokenEnc = encryptSecret(page.access_token);
      pageName = page.name;
      igAccountId = page.instagram_business_account?.id ?? null;
      tasks = page.tasks ?? [];
    }

    const missingPerms = Array.isArray(c.missing_permissions) ? [...c.missing_permissions] : [];
    if (!tasks.includes("ANALYZE") && !missingPerms.includes("task:ANALYZE")) {
      missingPerms.push("task:ANALYZE");
    }

    // Le jeton stocké dans access_token devient le JETON DE LA PAGE CHIFFRÉ !
    const { error } = await db.from("meta_connections").update({
      page_id: data.pageId,
      page_name: pageName,
      access_token: pageTokenEnc,
      ig_account_id: igAccountId,
      missing_permissions: missingPerms,
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

    if (c?.access_token) {
      const rawToken = decryptSecret(c.access_token);
      if (rawToken) {
        await fetch(`${GRAPH}/me/permissions?access_token=${encodeURIComponent(rawToken)}`, { method: "DELETE" }).catch(() => null);
      }
    }
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

    const { data: product } = await context.supabase
      .from("products")
      .select("id, name, images")
      .eq("id", data.productId)
      .eq("shop_id", shop.id)
      .maybeSingle();

    if (!product) throw new Error("Produit introuvable");

    const db = await admin();
    const { data: c } = await db.from("meta_connections").select("*").eq("shop_id", shop.id).maybeSingle();
    if (!c?.page_id || !c.access_token) throw new Error("Connectez d'abord votre page Facebook");

    const pageToken = decryptSecret(c.access_token);
    if (!pageToken) throw new Error("Jeton de page manquant ou corrompu. Reconnectez votre page Facebook.");

    const img = product.images?.[0] as string | undefined;
    const imageUrl = img ? (img.startsWith("http") ? img : `${data.origin}/api/public/media/${img}`) : null;

    // Ajout de ?src=facebook au lien publié pour traquer les vraies visites
    const link = `${data.origin}/b/${shop.slug}/p/${product.id}?src=facebook`;
    const caption = `${data.caption}\n\n🛒 ${link}`;
    const results: { platform: string; ok: boolean; error?: string }[] = [];

    for (const platform of data.platforms) {
      try {
        let externalId: string;
        if (platform === "facebook") {
          let r: { id?: string; post_id?: string };
          if (imageUrl) {
            const body = new FormData();
            body.set("access_token", pageToken);
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
            const body = new URLSearchParams({ access_token: pageToken });
            body.set("message", caption);
            body.set("link", link);
            r = await graph(`/${c.page_id}/feed`, { method: "POST", body });
          }

          // Enregistre le post_id complet formaté ({page_id}_{post_id}) et pas l'id de la photo
          const rawPostId = r.post_id ?? r.id ?? "";
          if (rawPostId.includes("_")) {
            externalId = rawPostId;
          } else if (c.page_id && rawPostId) {
            externalId = `${c.page_id}_${rawPostId}`;
          } else {
            externalId = rawPostId;
          }
        } else {
          if (!c.ig_account_id) throw new Error("Aucun compte Instagram professionnel lié à cette page");
          if (!imageUrl) throw new Error("Instagram exige une photo");
          const m = await graph<{ id: string }>(
            `/${c.ig_account_id}/media`,
            { method: "POST", body: new URLSearchParams({ image_url: imageUrl, caption, access_token: pageToken }) }
          );
          const p = await graph<{ id: string }>(
            `/${c.ig_account_id}/media_publish`,
            { method: "POST", body: new URLSearchParams({ creation_id: m.id, access_token: pageToken }) }
          );
          externalId = p.id;
        }

        await db.from("meta_posts").insert({
          shop_id: shop.id,
          product_id: product.id,
          platform,
          external_id: externalId,
        });

        results.push({ platform, ok: true });
      } catch (e) {
        results.push({ platform, ok: false, error: formatMetaError(e) });
      }
    }
    return { results };
  });

export const metaRefreshStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { shop } = await myShop(context);
    const db = await admin();
    const { data: c } = await db
      .from("meta_connections")
      .select("access_token, page_id, missing_permissions")
      .eq("shop_id", shop.id)
      .maybeSingle();

    if (!c?.access_token) return { updated: 0, errors: [] };

    const missingPerms = (c.missing_permissions as string[] | null) ?? [];
    if (missingPerms.includes("pages_read_engagement") || missingPerms.includes("read_insights") || missingPerms.includes("task:ANALYZE")) {
      return {
        updated: 0,
        errors: ["Reconnectez-vous et acceptez toutes les autorisations pour voir vos statistiques"],
        requiresReconnect: true,
      };
    }

    const pageToken = decryptSecret(c.access_token);
    if (!pageToken) {
      return {
        updated: 0,
        errors: ["Votre session a expiré. Reconnectez-vous à Facebook."],
        requiresReconnect: true,
      };
    }

    const { data: posts } = await db
      .from("meta_posts")
      .select("id, platform, external_id, reach, clicks, fb_visits")
      .eq("shop_id", shop.id)
      .order("created_at", { ascending: false })
      .limit(25);

    let updated = 0;
    const errors: string[] = [];
    const seenErrors = new Set<string>();

    for (const p of posts ?? []) {
      if (!p.external_id) continue;

      // Si le post Facebook appartient à une autre page (préfixe différent de c.page_id), on l'ignore silencieusement
      if (p.platform === "facebook" && p.external_id.includes("_") && c.page_id) {
        const [postPageId] = p.external_id.split("_");
        if (postPageId !== c.page_id) {
          // Ce post a été publié sur une ancienne page différente, ne pas lever d'erreur bloquante
          continue;
        }
      }

      try {
        let mediaViews: number | null = null;
        let hasMetrics = false;

        if (p.platform === "facebook") {
          // Utiliser post_media_view conformément aux dernières versions de l'API Meta
          const targetId = p.external_id.includes("_") ? p.external_id : `${c.page_id}_${p.external_id}`;

          const r = await graph<{ data: { name: string; values: { value: number }[] }[] }>(
            `${GRAPH_INSIGHTS}/${targetId}/insights?metric=post_media_view&access_token=${encodeURIComponent(pageToken)}`
          );

          for (const m of r.data ?? []) {
            const v = Number(m.values?.[0]?.value ?? 0);
            if (m.name === "post_media_view") {
              mediaViews = v;
              hasMetrics = true;
            }
          }
        } else {
          // Instagram metrics
          const r = await graph<{ data: { name: string; values: { value: number }[] }[] }>(
            `${GRAPH_INSIGHTS}/${p.external_id}/insights?metric=reach&access_token=${encodeURIComponent(pageToken)}`
          );
          const metric = (r.data ?? []).find((item) => item.name === "reach");
          if (metric) {
            mediaViews = Number(metric.values?.[0]?.value ?? 0);
            hasMetrics = true;
          }
        }

        const values: { reach?: number | null; clicks?: number | null } = {};
        if (mediaViews != null) {
          values.reach = mediaViews;
        }

        // Clics basés sur les visites réelles tracées (?src=facebook)
        if (p.fb_visits != null && p.fb_visits > 0) {
          values.clicks = p.fb_visits;
        }

        if (Object.keys(values).length > 0) {
          await db.from("meta_posts").update(values).eq("id", p.id);
          if (hasMetrics) updated++;
        }
      } catch (e) {
        // L'échec d'un post (ex: supprimé sur Facebook ou permissions restreintes) ne doit pas bloquer les autres
        const friendly = formatMetaError(e);
        // Si c'est un post supprimé ou introuvable (code 100 subcode 33), on ne pollue pas le toast utilisateur
        if (e instanceof MetaGraphError && e.code === 100 && e.subcode === 33) {
          console.warn(`[Meta Insights] Le post ${p.external_id} n'existe plus ou n'appartient pas à la page courante.`);
          continue;
        }
        if (!seenErrors.has(friendly)) {
          seenErrors.add(friendly);
          errors.push(friendly);
        }
      }
    }

    // Mettre à jour la date de dernière actualisation des stats
    await db
      .from("meta_connections")
      .update({ stats_last_updated_at: new Date().toISOString() })
      .eq("shop_id", shop.id);

    return {
      updated,
      errors,
      requiresReconnect: errors.some((e) => e.includes("expiré") || e.includes("session")),
    };
  });
