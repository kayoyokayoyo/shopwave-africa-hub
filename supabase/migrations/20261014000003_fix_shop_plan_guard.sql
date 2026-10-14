-- Correction de la fonction shop_plan_guard pour autoriser service_role et postgres
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

-- Synchroniser les boutiques avec leur abonnement actif le plus récent
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
