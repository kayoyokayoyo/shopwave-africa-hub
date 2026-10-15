-- Migration: 20261015000000_pure_cdf_subscription_currency.sql
-- Description: Retour exclusif au Franc Congolais (FC / CDF) pour les abonnements et paiements SasPay

-- 1. Ajout et synchronisation de price_cdf sur la table public.plans
alter table public.plans add column if not exists price_cdf numeric(12,2) not null default 0;

update public.plans
set price_cdf = case 
  when id = 'free' then 0
  when id = 'pro' then case when price_cdf > 0 then price_cdf else 25000 end
  when id = 'business' then case when price_cdf > 0 then price_cdf else 70000 end
  else case when price_cdf > 0 then price_cdf else round(coalesce(price_usd, 0) * 2850, -3) end
end;

-- 2. Configuration stricte de plan_prices en CDF
alter table public.plan_prices alter column currency set default 'CDF';

update public.plan_prices pp
set price_cdf = case 
      when pp.period = 'mensuel' then coalesce(p.price_cdf, 0)
      else coalesce(p.price_cdf * 10, 0)
    end,
    currency = 'CDF'
from public.plans p
where pp.plan_id = p.id;

-- 3. Mise à jour de la fonction trigger pour synchroniser prix CDF
create or replace function public.sync_plan_prices_from_plans()
returns trigger as $$
begin
  insert into public.plan_prices (plan_id, period, price_cdf, is_active, currency)
  values
    (new.id, 'mensuel', coalesce(new.price_cdf, 0), coalesce(new.active, true), 'CDF'),
    (new.id, 'annuel', coalesce(new.price_cdf * 10, 0), coalesce(new.active, true), 'CDF')
  on conflict (plan_id, period) do update
  set price_cdf = excluded.price_cdf,
      currency = 'CDF',
      is_active = excluded.is_active,
      updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_sync_plan_prices on public.plans;
create trigger trg_sync_plan_prices
after insert or update of price_cdf, active on public.plans
for each row execute function public.sync_plan_prices_from_plans();

-- 4. Table subscription_payments : Devise CDF par défaut
alter table public.subscription_payments alter column currency set default 'CDF';

update public.subscription_payments
set currency = 'CDF',
    montant_cdf = coalesce(nullif(montant_cdf, 0), round(coalesce(montant_usd, 0) * 2850, -3), coalesce(amount, 0))
where currency is null or currency = 'USD';
