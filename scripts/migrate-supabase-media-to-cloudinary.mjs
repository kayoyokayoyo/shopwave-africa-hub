import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { v2 as cloudinary } from "cloudinary";

const LEGACY_MEDIA_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/i;
const APPLY = process.argv.includes("--apply");
const LIMIT_ARG = process.argv.find((arg) => arg.startsWith("--limit="));
const LIMIT = LIMIT_ARG ? Number(LIMIT_ARG.slice("--limit=".length)) : Number.POSITIVE_INFINITY;

function parseEnv(contents) {
  const values = {};
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || match[1].startsWith("#")) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, "").trim();
    }
    values[match[1]] = value;
  }
  return values;
}

async function loadEnv() {
  let fromFile = {};
  try {
    fromFile = parseEnv(await readFile(resolve(process.cwd(), ".env"), "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  return { ...fromFile, ...process.env };
}

function requireEnv(env, key) {
  const value = env[key]?.trim();
  if (!value) throw new Error(`Variable requise absente de .env : ${key}`);
  return value;
}

function legacyStoragePath(value) {
  if (typeof value !== "string" || !value || /^https:\/\/res\.cloudinary\.com\//i.test(value)) return null;
  let candidate = value;
  try {
    const url = new URL(value);
    const marker = "/api/public/media/";
    if (url.pathname.includes(marker)) candidate = url.pathname.split(marker).at(-1);
    else {
      const storageMarker = "/shop-media/";
      if (!url.pathname.includes(storageMarker)) return null;
      candidate = url.pathname.split(storageMarker).at(-1);
      candidate = candidate?.replace(/^(?:sign|public)\//, "") ?? "";
    }
  } catch {
    candidate = value.split("?")[0].replace(/^\/+/, "");
  }
  try { candidate = decodeURIComponent(candidate); } catch { return null; }
  return LEGACY_MEDIA_PATH.test(candidate) ? candidate : null;
}

async function getAll(makeQuery) {
  const rows = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await makeQuery().range(offset, offset + pageSize - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < pageSize) return rows;
  }
}

function uploadBuffer(buffer, options) {
  return new Promise((resolveUpload, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) reject(error);
      else if (!result?.secure_url) reject(new Error("Cloudinary n’a pas retourné d’URL sécurisée"));
      else resolveUpload(result);
    });
    stream.end(buffer);
  });
}

async function main() {
  if (LIMIT !== Number.POSITIVE_INFINITY && (!Number.isInteger(LIMIT) || LIMIT < 1)) {
    throw new Error("--limit doit être un entier positif");
  }
  const env = await loadEnv();
  const supabase = createClient(
    requireEnv(env, "SUPABASE_URL"),
    requireEnv(env, "SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  if (APPLY) {
    cloudinary.config({
      cloud_name: requireEnv(env, "CLOUDINARY_CLOUD_NAME"),
      api_key: requireEnv(env, "CLOUDINARY_API_KEY"),
      api_secret: requireEnv(env, "CLOUDINARY_API_SECRET"),
      secure: true,
    });
  }

  const shops = await getAll(() => supabase.from("shops").select("id,owner_id,logo_url,banner_url").order("id"));
  const products = await getAll(() => supabase.from("products").select("id,shop_id,images").order("id"));
  const shopsById = new Map(shops.map((shop) => [shop.id, shop]));
  const mediaReferences = [];

  for (const shop of shops) {
    for (const field of ["logo_url", "banner_url"]) {
      const path = legacyStoragePath(shop[field]);
      if (path) mediaReferences.push({ shopId: shop.id, ownerId: shop.owner_id, source: path, kind: "storefront", target: { table: "shops", id: shop.id, field } });
    }
  }
  for (const product of products) {
    const shop = shopsById.get(product.shop_id);
    if (!shop) continue;
    for (const [index, image] of (product.images ?? []).entries()) {
      const path = legacyStoragePath(image);
      if (path) mediaReferences.push({ shopId: shop.id, ownerId: shop.owner_id, source: path, kind: "products", target: { table: "products", id: product.id, index } });
    }
  }

  const selected = mediaReferences.slice(0, LIMIT);
  console.log(`Mode : ${APPLY ? "TRANSFERT ACTIF" : "SIMULATION"}`);
  console.log(`Boutiques : ${shops.length}; produits : ${products.length}; références Supabase à transférer : ${mediaReferences.length}; traitées : ${selected.length}`);
  if (!APPLY) {
    console.log("Aucun fichier ni enregistrement n’a été modifié. Ajoutez --apply pour lancer le transfert.");
    return;
  }

  const cache = new Map();
  let migrated = 0;
  let failures = 0;
  for (const reference of selected) {
    try {
      const cacheKey = `${reference.shopId}:${reference.kind}:${reference.source}`;
      let secureUrl = cache.get(cacheKey);
      if (!secureUrl) {
        const { data, error } = await supabase.storage.from("shop-media").download(reference.source);
        if (error || !data) throw new Error(error?.message ?? "Fichier Supabase introuvable");
        const buffer = Buffer.from(await data.arrayBuffer());
        const deterministicId = `legacy_${createHash("sha256").update(cacheKey).digest("hex").slice(0, 28)}`;
        const options = {
          asset_folder: `marketnet/shops/${reference.ownerId}/${reference.kind}`,
          public_id: deterministicId,
          overwrite: false,
          resource_type: "image",
          format: "webp",
          tags: ["marketnet", `shop_${reference.shopId}`, reference.kind],
        };
        try {
          const uploaded = await uploadBuffer(buffer, options);
          secureUrl = uploaded.secure_url;
        } catch (uploadError) {
          // If a previous run uploaded the file but failed before updating Supabase,
          // resolve its deterministic public ID and continue without duplicating it.
          if (uploadError.http_code !== 409) throw uploadError;
          const existing = await cloudinary.api.resource(deterministicId, { resource_type: "image", type: "upload" });
          secureUrl = existing.secure_url;
        }
        cache.set(cacheKey, secureUrl);
      }

      if (reference.target.table === "shops") {
        const { error } = await supabase.from("shops").update({ [reference.target.field]: secureUrl }).eq("id", reference.target.id);
        if (error) throw error;
      } else {
        const product = products.find((candidate) => candidate.id === reference.target.id);
        const images = [...(product?.images ?? [])];
        images[reference.target.index] = secureUrl;
        const { error } = await supabase.from("products").update({ images }).eq("id", reference.target.id);
        if (error) throw error;
        product.images = images;
      }
      migrated++;
      console.log(`Transféré ${reference.kind}: boutique ${reference.shopId}, ${reference.source}`);
    } catch (error) {
      failures++;
      console.error(`Échec (${reference.shopId}, ${reference.source}) : ${error.message}`);
    }
  }

  console.log(`Terminé : ${migrated} référence(s) transférée(s), ${failures} échec(s).`);
  if (failures) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`Migration interrompue : ${error.message}`);
  process.exitCode = 1;
});
