create table public.plans (
  id text primary key,
  name text not null,
  price_usd numeric(10,2) not null default 0,
  max_products int,
  max_photos int not null default 3,
  meta_access boolean not null default false,
  advanced_themes boolean not null default false,
  advanced_stats boolean not null default false,
  position int not null default 0,
  active boolean not null default true
);
grant select on public.plans to anon, authenticated;
grant all on public.plans to service_role;
grant insert, update, delete on public.plans to authenticated;
alter table public.plans enable row level security;
create policy "plans public" on public.plans for select to anon, authenticated using (true);
create policy "plans admin" on public.plans for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
insert into public.plans(id,name,price_usd,max_products,max_photos,meta_access,advanced_themes,advanced_stats,position) values
 ('free','Gratuit',0,10,3,false,false,false,0),
 ('pro','Pro',9,200,6,true,true,false,1),
 ('business','Business',25,null,6,true,true,true,2);

alter table public.shops add column plan_id text not null default 'free' references public.plans(id);
alter table public.shops add column plan_expires_at timestamptz;
alter table public.shops add column reported_count int not null default 0;

create or replace function public.shop_plan_guard() returns trigger language plpgsql set search_path = public as $$
begin
  if (new.plan_id <> old.plan_id or new.plan_expires_at is distinct from old.plan_expires_at) and not public.has_role(auth.uid(),'admin') and coalesce(current_setting('app.sys',true),'')<>'1' then
    new.plan_id := old.plan_id; new.plan_expires_at := old.plan_expires_at;
  end if;
  if new.reported_count <> old.reported_count and coalesce(current_setting('app.sys',true),'')<>'1' and not public.has_role(auth.uid(),'admin') then
    new.reported_count := old.reported_count;
  end if;
  return new;
end $$;
create trigger shops_plan_guard before update on public.shops for each row execute function public.shop_plan_guard();

create or replace function public.product_limit_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare p public.plans; n int;
begin
  select pl.* into p from public.shops s join public.plans pl on pl.id = s.plan_id where s.id = new.shop_id;
  if p.max_products is not null and tg_op = 'INSERT' then
    select count(*) into n from public.products where shop_id = new.shop_id;
    if n >= p.max_products then raise exception 'Limite de % produits atteinte pour le plan %. Passez à un plan supérieur.', p.max_products, p.name; end if;
  end if;
  if array_length(new.images,1) > p.max_photos then raise exception 'Maximum % photos par produit sur votre plan', p.max_photos; end if;
  return new;
end $$;
create trigger products_limit before insert or update on public.products for each row execute function public.product_limit_guard();

create type public.payment_status as enum ('pending','approved','rejected');
create table public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  plan_id text not null references public.plans(id),
  months int not null default 1 check (months between 1 and 12),
  amount numeric(10,2) not null,
  method text not null check (method in ('mpesa','airtel','orange','card','cash')),
  reference text not null check (char_length(reference) between 3 and 80),
  status payment_status not null default 'pending',
  admin_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
grant select, insert on public.subscription_payments to authenticated;
grant update on public.subscription_payments to authenticated;
grant all on public.subscription_payments to service_role;
alter table public.subscription_payments enable row level security;
create policy "pay read" on public.subscription_payments for select to authenticated using (public.is_shop_owner(shop_id) or public.has_role(auth.uid(),'admin'));
create policy "pay insert" on public.subscription_payments for insert to authenticated with check (public.is_shop_owner(shop_id) and status='pending');
create policy "pay admin" on public.subscription_payments for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create or replace function public.apply_payment() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'approved' and old.status <> 'approved' then
    perform set_config('app.sys','1',true);
    update public.shops set plan_id = new.plan_id,
      plan_expires_at = greatest(coalesce(plan_expires_at, now()), now()) + make_interval(months => new.months)
      where id = new.shop_id;
    perform set_config('app.sys','',true);
    new.reviewed_at := now();
  elsif new.status = 'rejected' then new.reviewed_at := now();
  end if;
  return new;
end $$;
create trigger payments_apply before update on public.subscription_payments for each row execute function public.apply_payment();

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  target text,
  details jsonb,
  created_at timestamptz not null default now()
);
grant select, insert on public.audit_log to authenticated;
grant all on public.audit_log to service_role;
alter table public.audit_log enable row level security;
create policy "audit admin read" on public.audit_log for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "audit admin insert" on public.audit_log for insert to authenticated with check (public.has_role(auth.uid(),'admin') and actor_id = auth.uid());

create table public.app_settings (
  key text primary key,
  value jsonb not null
);
grant select on public.app_settings to anon, authenticated;
grant insert, update on public.app_settings to authenticated;
grant all on public.app_settings to service_role;
alter table public.app_settings enable row level security;
create policy "settings read" on public.app_settings for select to anon, authenticated using (true);
create policy "settings admin" on public.app_settings for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
insert into public.app_settings values
 ('legal_terms','"Conditions générales d''utilisation de MarketNet."'::jsonb),
 ('payment_instructions','"Envoyez le montant au +243 000 000 000 (M-Pesa / Airtel / Orange) puis saisissez la référence de la transaction."'::jsonb);

create table public.shop_reports (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  reason text not null check (char_length(reason) between 3 and 500),
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
grant insert on public.shop_reports to anon, authenticated;
grant select, update on public.shop_reports to authenticated;
grant all on public.shop_reports to service_role;
alter table public.shop_reports enable row level security;
create policy "report anyone" on public.shop_reports for insert to anon, authenticated with check (public.is_shop_public(shop_id) and resolved = false);
create policy "report admin" on public.shop_reports for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "report admin upd" on public.shop_reports for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- profile status: pending when approval required
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, full_name, email, status) values (new.id, new.raw_user_meta_data->>'full_name', new.email, 'active');
  insert into public.user_roles(user_id, role) values (new.id, 'merchant');
  return new;
end $$;
create policy "profile admin update" on public.profiles for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create or replace function public.profile_guard() returns trigger language plpgsql set search_path = public as $$
begin
  if new.status <> old.status and not public.has_role(auth.uid(),'admin') then new.status := old.status; end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles for each row execute function public.profile_guard();

-- only active merchants can create shops; suspended owners' shops hidden
create or replace function public.is_active_user(_uid uuid) returns boolean language sql stable security definer set search_path = public
as $$ select coalesce((select status='active' from public.profiles where id=_uid), false) $$;
drop policy "owner insert" on public.shops;
create policy "owner insert" on public.shops for insert to authenticated with check (owner_id = auth.uid() and public.is_active_user(auth.uid()));
create or replace function public.is_shop_public(_shop_id uuid) returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.shops s where s.id=_shop_id and s.is_published and not s.is_suspended and public.is_active_user(s.owner_id)) $$;
drop policy "public shops" on public.shops;
create policy "public shops" on public.shops for select to anon, authenticated using (is_published and not is_suspended and public.is_active_user(owner_id));

-- order rate limit: max 20 orders/shop/minute
create or replace function public.order_rate_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.orders where shop_id=new.shop_id and created_at > now() - interval '1 minute') >= 20 then
    raise exception 'Trop de commandes, réessayez dans une minute';
  end if;
  return new;
end $$;
create trigger orders_rate before insert on public.orders for each row execute function public.order_rate_guard();

-- Meta integration (phase scaffolding)
create table public.meta_connections (
  shop_id uuid primary key references public.shops(id) on delete cascade,
  page_id text, page_name text, ig_account_id text,
  access_token text, token_expires_at timestamptz,
  connected_at timestamptz not null default now()
);
grant all on public.meta_connections to service_role;
alter table public.meta_connections enable row level security;
create table public.meta_posts (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  platform text not null, external_id text, reach int default 0, clicks int default 0,
  created_at timestamptz not null default now()
);
grant select on public.meta_posts to authenticated;
grant all on public.meta_posts to service_role;
alter table public.meta_posts enable row level security;
create policy "meta posts owner" on public.meta_posts for select to authenticated using (public.is_shop_owner(shop_id));
