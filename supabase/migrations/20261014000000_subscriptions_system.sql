-- Migration: 20261014000000_subscriptions_system.sql
-- Description: Partie 1/3 - Système d'abonnements, tarifs CDF, historique des paiements et journal des événements

-- ============================================================================
-- 1. TABLE: plan_prices (Tarifs des plans en CDF, modifiables par l'admin)
-- ============================================================================
create table if not exists public.plan_prices (
  id uuid primary key default gen_random_uuid(),
  plan_id text not null references public.plans(id) on delete cascade,
  period text not null check (period in ('mensuel', 'annuel')),
  price_cdf numeric(12,2) not null check (price_cdf >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(plan_id, period)
);

grant select on public.plan_prices to anon, authenticated;
grant all on public.plan_prices to service_role;
grant insert, update, delete on public.plan_prices to authenticated;
alter table public.plan_prices enable row level security;

-- Politiques RLS pour plan_prices
drop policy if exists "plan_prices read" on public.plan_prices;
create policy "plan_prices read" on public.plan_prices
  for select to anon, authenticated
  using (is_active or public.has_role(auth.uid(), 'admin'));

drop policy if exists "plan_prices admin" on public.plan_prices;
create policy "plan_prices admin" on public.plan_prices
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Tarifs par défaut en CDF pour les plans existants
insert into public.plan_prices (plan_id, period, price_cdf, is_active)
values
  ('free', 'mensuel', 0, true),
  ('free', 'annuel', 0, true),
  ('pro', 'mensuel', 25000, true),
  ('pro', 'annuel', 250000, true),
  ('business', 'mensuel', 70000, true),
  ('business', 'annuel', 700000, true)
on conflict (plan_id, period) do update
set price_cdf = excluded.price_cdf, is_active = excluded.is_active;

-- ============================================================================
-- 2. TABLE: subscription_payments (Évolution / compatibilité complète)
-- ============================================================================
-- Création ou ajout des colonnes requises
create table if not exists public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

-- Colonnes requises par la spécification
alter table public.subscription_payments add column if not exists merchant_id uuid references auth.users(id);
alter table public.subscription_payments add column if not exists shop_id uuid references public.shops(id) on delete cascade;
alter table public.subscription_payments add column if not exists plan_id text references public.plans(id);
alter table public.subscription_payments add column if not exists period text default 'mensuel';
alter table public.subscription_payments add column if not exists montant_cdf numeric(12,2) default 0;
alter table public.subscription_payments add column if not exists statut text default 'en_attente';
alter table public.subscription_payments add column if not exists methode text default 'saspay';
alter table public.subscription_payments add column if not exists saspay_session_id text;
alter table public.subscription_payments add column if not exists checkout_url text;
alter table public.subscription_payments add column if not exists saspay_transaction_id text;
alter table public.subscription_payments add column if not exists montant_debite numeric(12,2);
alter table public.subscription_payments add column if not exists montant_net numeric(12,2);
alter table public.subscription_payments add column if not exists frais numeric(12,2);
alter table public.subscription_payments add column if not exists cree_le timestamptz not null default now();
alter table public.subscription_payments add column if not exists paye_le timestamptz;
alter table public.subscription_payments add column if not exists admin_note text;
alter table public.subscription_payments add column if not exists reviewed_at timestamptz;

-- Sécurisation RLS pour subscription_payments
grant select on public.subscription_payments to authenticated;
grant all on public.subscription_payments to service_role;
grant update on public.subscription_payments to authenticated;
alter table public.subscription_payments enable row level security;

drop policy if exists "pay read" on public.subscription_payments;
create policy "pay read" on public.subscription_payments
  for select to authenticated
  using (
    (merchant_id is not null and merchant_id = auth.uid())
    or (shop_id is not null and public.is_shop_owner(shop_id))
    or public.has_role(auth.uid(), 'admin')
  );

drop policy if exists "pay admin" on public.subscription_payments;
create policy "pay admin" on public.subscription_payments
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- 3. TABLE: merchant_subscriptions (Abonnements actifs des commerçants)
-- ============================================================================
create table if not exists public.merchant_subscriptions (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references auth.users(id),
  shop_id uuid not null references public.shops(id) on delete cascade,
  plan_id text not null references public.plans(id),
  debut timestamptz not null default now(),
  fin timestamptz not null,
  statut text not null check (statut in ('actif', 'grâce', 'expiré')),
  period text not null default 'mensuel' check (period in ('mensuel', 'annuel')),
  payment_id uuid references public.subscription_payments(id),
  cree_le timestamptz not null default now(),
  mis_a_jour_le timestamptz not null default now()
);

grant select on public.merchant_subscriptions to authenticated;
grant all on public.merchant_subscriptions to service_role;
alter table public.merchant_subscriptions enable row level security;

drop policy if exists "subscriptions read own" on public.merchant_subscriptions;
create policy "subscriptions read own" on public.merchant_subscriptions
  for select to authenticated
  using (
    merchant_id = auth.uid()
    or public.is_shop_owner(shop_id)
    or public.has_role(auth.uid(), 'admin')
  );

drop policy if exists "subscriptions admin all" on public.merchant_subscriptions;
create policy "subscriptions admin all" on public.merchant_subscriptions
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Index pour accélérer les requêtes de vérification d'abonnement
create index if not exists idx_merchant_subscriptions_shop on public.merchant_subscriptions(shop_id);
create index if not exists idx_merchant_subscriptions_merchant on public.merchant_subscriptions(merchant_id);
create index if not exists idx_merchant_subscriptions_fin on public.merchant_subscriptions(fin);
create index if not exists idx_merchant_subscriptions_statut on public.merchant_subscriptions(statut);

-- ============================================================================
-- 4. TABLE: payment_events (Journal brut des webhooks de paiement)
-- ============================================================================
create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  corps jsonb not null,
  signature_valide boolean not null default false,
  type_evenement text not null,
  recu_le timestamptz not null default now(),
  traite_le timestamptz,
  resultat text,
  session_id text,
  transaction_id text,
  created_at timestamptz not null default now()
);

grant select on public.payment_events to authenticated;
grant all on public.payment_events to service_role;
alter table public.payment_events enable row level security;

drop policy if exists "payment_events admin only" on public.payment_events;
create policy "payment_events admin only" on public.payment_events
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create index if not exists idx_payment_events_session on public.payment_events(session_id);
create index if not exists idx_payment_events_recu on public.payment_events(recu_le desc);
