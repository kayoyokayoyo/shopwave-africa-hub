-- Migration: 20261014000001_usd_subscription_currency.sql
-- Description: Bascule vers le Dollar ($ USD) comme devise de référence des abonnements avec support CDF indicatif

-- 1. Évolution de subscription_payments
alter table public.subscription_payments add column if not exists currency text not null default 'USD';
alter table public.subscription_payments add column if not exists montant_usd numeric(12,2) default 0;

-- 2. Évolution de plan_prices
alter table public.plan_prices add column if not exists price_usd numeric(12,2);
alter table public.plan_prices add column if not exists currency text not null default 'USD';

-- 3. Mise à jour de la fonction trigger pour synchroniser prix USD et équivalent CDF indicatif
create or replace function public.sync_plan_prices_from_plans()
returns trigger as $$
begin
  insert into public.plan_prices (plan_id, period, price_usd, price_cdf, is_active, currency)
  values
    (new.id, 'mensuel', coalesce(new.price_usd, 0), coalesce(new.price_usd * 2850, 0), coalesce(new.active, true), 'USD'),
    (new.id, 'annuel', coalesce(new.price_usd * 10, 0), coalesce(new.price_usd * 10 * 2850, 0), coalesce(new.active, true), 'USD')
  on conflict (plan_id, period) do update
  set price_usd = excluded.price_usd,
      price_cdf = excluded.price_cdf,
      is_active = excluded.is_active,
      currency = excluded.currency,
      updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_sync_plan_prices on public.plans;
create trigger trg_sync_plan_prices
after insert or update of price_usd, active on public.plans
for each row execute function public.sync_plan_prices_from_plans();

-- 4. Synchroniser immédiatement les tarifs actuels
update public.plan_prices pp
set price_usd = case when pp.period = 'mensuel' then coalesce(p.price_usd, 0) else coalesce(p.price_usd * 10, 0) end,
    price_cdf = case when pp.period = 'mensuel' then coalesce(p.price_usd * 2850, 0) else coalesce(p.price_usd * 10 * 2850, 0) end,
    currency = 'USD'
from public.plans p
where pp.plan_id = p.id;
