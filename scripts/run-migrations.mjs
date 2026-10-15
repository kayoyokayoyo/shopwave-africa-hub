import { readFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import dns from "node:dns";
import postgres from "postgres";

dns.setDefaultResultOrder("ipv4first");

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

export async function runMigrations() {
  const env = await loadProjectEnv();
  const dbUrl = env.SUPABASE_DB_MIGRATION_URL || env.LOVABLE_DB_MIGRATION_URL || env.DATABASE_URL;

  if (!dbUrl) {
    console.warn("⚠️ Aucune variable SUPABASE_DB_MIGRATION_URL ou LOVABLE_DB_MIGRATION_URL trouvée. Étape migration ignorée.");
    return;
  }

  console.log("🚀 Exécution des migrations Supabase...");

  const sql = postgres(dbUrl, {
    max: 1,
    idle_timeout: 10,
    connect_timeout: 30,
    ssl: { rejectUnauthorized: false },
  });

  try {
    // Récupérer les migrations déjà appliquées par Supabase CLI
    const appliedRows = await sql`
      select version from supabase_migrations.schema_migrations
    `.catch(() => []);

    const appliedSet = new Set(appliedRows.map((r) => String(r.version)));

    const migrationsDir = resolve(process.cwd(), "supabase/migrations");
    const files = (await readdir(migrationsDir))
      .filter((f) => f.endsWith(".sql"))
      .sort();

    let appliedCount = 0;

    for (const file of files) {
      // Le préfixe version est composé des chiffres avant le premier underscore
      const versionMatch = file.match(/^(\d+)_/);
      const version = versionMatch ? versionMatch[1] : file.replace(/\.sql$/, "");
      const name = file.replace(/^\d+_/, "").replace(/\.sql$/, "");

      if (appliedSet.has(version)) {
        continue;
      }

      console.log(`⏳ Application de la migration : ${file}...`);
      const filePath = join(migrationsDir, file);
      const sqlContent = await readFile(filePath, "utf8");

      // Appliquer le SQL
      await sql.unsafe(sqlContent);

      // Enregistrer dans supabase_migrations.schema_migrations
      await sql`
        insert into supabase_migrations.schema_migrations (version, name)
        values (${version}, ${name})
        on conflict (version) do nothing
      `.catch((e) => {
        console.warn(`Note: enregistrement dans schema_migrations: ${e.message}`);
      });

      console.log(`✅ Migration appliquée avec succès : ${file}`);
      appliedCount++;
    }

    if (appliedCount === 0) {
      console.log("✨ Toutes les migrations sont déjà à jour.");
    } else {
      console.log(`🎉 ${appliedCount} migration(s) appliquée(s) avec succès.`);
    }
  } catch (err) {
    console.error("❌ Erreur pendant l'application des migrations :", err);
    throw err;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

// Exécuter si appelé directement en CLI
if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/run-migrations.mjs")) {
  runMigrations().catch((err) => {
    console.error("Échec des migrations :", err);
    process.exit(1);
  });
}
