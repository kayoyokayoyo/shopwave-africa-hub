import { Client } from "pg";

async function main() {
  const dbUrl = process.env.LOVABLE_DB_MIGRATION_URL;
  if (!dbUrl) throw new Error("LOVABLE_DB_MIGRATION_URL non défini dans .env");

  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log("Connecté à PostgreSQL !");

  // 1. Mettre à jour la fonction shop_plan_guard pour autoriser service_role et postgres
  await client.query(`
    create or replace function public.shop_plan_guard() returns trigger language plpgsql set search_path = public as $$
    begin
      if (new.plan_id <> old.plan_id or new.plan_expires_at is distinct from old.plan_expires_at)
         and not (
           public.has_role(auth.uid(), 'admin')
           or auth.role() = 'service_role'
           or coalesce(current_setting('app.sys', true), '') = '1'
           or current_user in ('postgres', 'service_role')
         ) then
        new.plan_id := old.plan_id;
        new.plan_expires_at := old.plan_expires_at;
      end if;
      if new.reported_count <> old.reported_count
         and not (
           public.has_role(auth.uid(), 'admin')
           or auth.role() = 'service_role'
           or coalesce(current_setting('app.sys', true), '') = '1'
           or current_user in ('postgres', 'service_role')
         ) then
        new.reported_count := old.reported_count;
      end if;
      return new;
    end $$;
  `);
  console.log("✅ Trigger shop_plan_guard mis à jour avec succès !");

  // 2. Synchroniser les boutiques ayant un abonnement actif dans merchant_subscriptions
  const syncQuery = `
    update public.shops s
    set
      plan_id = sub.plan_id,
      plan_expires_at = sub.fin
    from (
      select distinct on (shop_id) shop_id, plan_id, fin
      from public.merchant_subscriptions
      where statut = 'actif'
      order by shop_id, fin desc
    ) sub
    where s.id = sub.shop_id;
  `;
  const res = await client.query(syncQuery);
  console.log(`✅ Boutiques synchronisées : ${res.rowCount} ligne(s) mise(s) à jour.`);

  // 3. Vérifier KYUMA STORE
  const checkRes = await client.query(`
    select id, name, plan_id, plan_expires_at
    from public.shops
    where name ilike '%KYUMA%'
  `);
  console.log("KYUMA STORE dans la DB:", checkRes.rows);

  await client.end();
}

main().catch(console.error);
