import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

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

async function loadProjectEnv() {
  let fileValues = {};
  try {
    fileValues = parseEnv(await readFile(resolve(process.cwd(), ".env"), "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  return { ...fileValues, ...process.env };
}

function requireValue(env, name) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Variable requise absente de .env : ${name}`);
  return value;
}

async function findAuthUserByEmail(supabase, email) {
  const perPage = 1000;
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email.toLowerCase());
    if (user) return user;
    if (data.users.length < perPage) return null;
  }
}

async function setSingleRole(supabase, userId, role) {
  const { error: deleteRoleError } = await supabase
    .from("user_roles")
    .delete()
    .eq("user_id", userId)
    .neq("role", role);
  if (deleteRoleError) throw deleteRoleError;

  const { error } = await supabase
    .from("user_roles")
    .upsert({ user_id: userId, role }, { onConflict: "user_id,role", ignoreDuplicates: true });
  if (error) throw error;
}

async function main() {
  const env = await loadProjectEnv();
  const supabaseUrl = requireValue(env, "SUPABASE_URL");
  const serviceRoleKey = requireValue(env, "SUPABASE_SERVICE_ROLE_KEY");
  const email = requireValue(env, "MARKETNET_ADMIN_EMAIL").toLowerCase();
  const password = env.MARKETNET_ADMIN_PASSWORD?.trim();
  const fullName = env.MARKETNET_ADMIN_NAME?.trim() || "Administrateur MarketNet";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("MARKETNET_ADMIN_EMAIL n’est pas une adresse email valide.");
  if (!supabaseUrl.startsWith("https://")) throw new Error("SUPABASE_URL doit utiliser HTTPS.");
  if (!password || password.length < 8 || new Set(password).size < 6) {
    throw new Error("MARKETNET_ADMIN_PASSWORD doit contenir au moins 8 caractères dont 6 distincts.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let user = await findAuthUserByEmail(supabase, email);
  if (user) {
    const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
      email_confirm: true,
      password,
      user_metadata: { ...user.user_metadata, full_name: fullName },
    });
    if (error) throw error;
    user = data.user;
    console.log(`Compte existant activé pour ${email}; son UUID et ses données sont préservés.`);
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error) throw error;
    user = data.user;
    console.log(`Compte Auth créé et activé immédiatement pour ${email}.`);
  }

  await setSingleRole(supabase, user.id, "admin");
  console.log("Rôle administrateur configuré; les autres rôles de cet utilisateur ont été retirés.");

  const previousMerchantEmail = env.MARKETNET_RESTORE_MERCHANT_EMAIL?.trim().toLowerCase();
  if (previousMerchantEmail && previousMerchantEmail !== email) {
    const previousMerchant = await findAuthUserByEmail(supabase, previousMerchantEmail);
    if (!previousMerchant) throw new Error("L’ancien compte commerçant configuré est introuvable.");
    await setSingleRole(supabase, previousMerchant.id, "merchant");
    console.log(`Le compte ${previousMerchantEmail} a retrouvé le rôle commerçant.`);
  }

  console.log("Compte activé sans email de confirmation; aucun courriel n’est envoyé.");
}

main().catch((error) => {
  console.error(`Échec de création/configuration de l’administrateur : ${error.message}`);
  process.exitCode = 1;
});
