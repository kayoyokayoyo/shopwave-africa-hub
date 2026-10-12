import { runMigrations } from "./run-migrations.mjs";
import { execSync } from "node:child_process";

async function main() {
  console.log("==> [Déploiement] Étape 1/2 : Exécution des migrations SQL...");
  try {
    await runMigrations();
  } catch (err) {
    console.error("Échec des migrations lors du déploiement :", err);
    process.exit(1);
  }

  console.log("==> [Déploiement] Étape 2/2 : Configuration/Création du compte administrateur...");
  try {
    execSync("node scripts/create-admin.mjs", { stdio: "inherit" });
  } catch (err) {
    console.warn("⚠️ Attention : create-admin.mjs a retourné un code non nul (variables peut-être non renseignées en déploiement). Le build se poursuit.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
