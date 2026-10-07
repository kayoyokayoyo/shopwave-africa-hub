create type public.app_role as enum ('admin','merchant');
create type public.product_status as enum ('active','hidden','out_of_stock');
create type public.order_status as enum ('new','confirmed','delivered','cancelled');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role app_role not null,
  unique(user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.user_roles where user_id=_user_id and role=_role) $$;

create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create table public.profiles (
  id uuid primary key,
  full_name text,
  email text,
  status text not null default 'active',
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, full_name, email) values (new.id, new.raw_user_meta_data->>'full_name', new.email);
  insert into public.user_roles(user_id, role) values (new.id, 'merchant');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique,
  name text not null check (char_length(name) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,40}[a-z0-9]$'),
  slug_changed boolean not null default false,
  description text check (char_length(description) <= 1000),
  category text,
  logo_url text,
  banner_url text,
  city text,
  address text,
  whatsapp text not null check (whatsapp ~ '^\+[1-9][0-9]{7,14}$'),
  hours text,
  facebook text, instagram text, tiktok text,
  theme text not null default 'savane',
  primary_color text not null default '#E8590C',
  currency text not null default 'USD',
  is_published boolean not null default true,
  is_suspended boolean not null default false,
  views integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.shops to anon;
grant select, insert, update, delete on public.shops to authenticated;
grant all on public.shops to service_role;
alter table public.shops enable row level security;
create policy "public shops" on public.shops for select to anon, authenticated using (is_published and not is_suspended);
create policy "owner read" on public.shops for select to authenticated using (owner_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "owner insert" on public.shops for insert to authenticated with check (owner_id = auth.uid());
create policy "owner update" on public.shops for update to authenticated using (owner_id = auth.uid() or public.has_role(auth.uid(),'admin')) with check (owner_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "owner delete" on public.shops for delete to authenticated using (owner_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create or replace function public.shop_slug_guard() returns trigger language plpgsql set search_path = public as $$
begin
  if new.slug <> old.slug then
    if old.slug_changed and not public.has_role(auth.uid(),'admin') then
      raise exception 'Le lien de la boutique ne peut être modifié qu''une seule fois';
    end if;
    new.slug_changed := true;
  end if;
  if new.is_suspended <> old.is_suspended and not public.has_role(auth.uid(),'admin') then
    new.is_suspended := old.is_suspended;
  end if;
  new.views := case when public.has_role(auth.uid(),'admin') then new.views else old.views end;
  new.updated_at := now();
  return new;
end $$;
create trigger shops_guard before update on public.shops for each row execute function public.shop_slug_guard();

create or replace function public.is_shop_owner(_shop_id uuid) returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.shops where id=_shop_id and owner_id=auth.uid()) $$;
create or replace function public.is_shop_public(_shop_id uuid) returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.shops where id=_shop_id and is_published and not is_suspended) $$;

create table public.product_categories (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 50),
  position int not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.product_categories to anon;
grant select, insert, update, delete on public.product_categories to authenticated;
grant all on public.product_categories to service_role;
alter table public.product_categories enable row level security;
create policy "public read" on public.product_categories for select to anon, authenticated using (public.is_shop_public(shop_id));
create policy "owner all" on public.product_categories for all to authenticated using (public.is_shop_owner(shop_id)) with check (public.is_shop_owner(shop_id));

create table public.products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  category_id uuid references public.product_categories(id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  description text check (char_length(description) <= 3000),
  price numeric(12,2) not null check (price >= 0),
  currency text not null default 'USD' check (currency in ('USD','CDF')),
  images text[] not null default '{}',
  stock int,
  status product_status not null default 'active',
  featured boolean not null default false,
  variants jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.products(shop_id);
grant select on public.products to anon;
grant select, insert, update, delete on public.products to authenticated;
grant all on public.products to service_role;
alter table public.products enable row level security;
create policy "public read" on public.products for select to anon, authenticated using (status <> 'hidden' and public.is_shop_public(shop_id));
create policy "owner all" on public.products for all to authenticated using (public.is_shop_owner(shop_id)) with check (public.is_shop_owner(shop_id));

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  customer_name text not null check (char_length(customer_name) between 1 and 80),
  items jsonb not null,
  total numeric(12,2) not null,
  currency text not null,
  status order_status not null default 'new',
  notes text,
  created_at timestamptz not null default now()
);
create index on public.orders(shop_id);
grant insert on public.orders to anon;
grant select, insert, update, delete on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;
create policy "anyone can order" on public.orders for insert to anon, authenticated with check (public.is_shop_public(shop_id) and status = 'new' and notes is null);
create policy "owner read" on public.orders for select to authenticated using (public.is_shop_owner(shop_id) or public.has_role(auth.uid(),'admin'));
create policy "owner update" on public.orders for update to authenticated using (public.is_shop_owner(shop_id)) with check (public.is_shop_owner(shop_id));

create or replace function public.increment_shop_view(_slug text) returns void language sql security definer set search_path = public
as $$ update public.shops set views = views + 1 where slug = _slug and is_published and not is_suspended $$;
grant execute on function public.increment_shop_view(text) to anon, authenticated;

create policy "owner media read" on storage.objects for select to authenticated using (bucket_id='shop-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owner media insert" on storage.objects for insert to authenticated with check (bucket_id='shop-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owner media update" on storage.objects for update to authenticated using (bucket_id='shop-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owner media delete" on storage.objects for delete to authenticated using (bucket_id='shop-media' and (storage.foldername(name))[1] = auth.uid()::text);