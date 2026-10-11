-- Promotions module (additive). DOWN: drop table promotion_events, promotion_products, promotions cascade; drop function promotion_guard, is_promotion_public, is_promotion_owner; alter table plans drop column max_active_promotions, drop column promo_templates;
alter table public.plans add column if not exists max_active_promotions integer default 1;
alter table public.plans add column if not exists promo_templates text[] not null default '{fullscreen,split,badge,minimal,countdown}';
update public.plans set max_active_promotions = 1, promo_templates = '{fullscreen,split,minimal}' where id = 'free';
update public.plans set max_active_promotions = 5 where id = 'pro';
update public.plans set max_active_promotions = null where id = 'business';

create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  description text check (char_length(description) <= 300),
  image_url text,
  template text not null default 'fullscreen' check (template in ('fullscreen','split','badge','minimal','countdown')),
  discount_type text check (discount_type in ('percent','amount')),
  discount_value numeric check (discount_value is null or discount_value > 0),
  button_label text not null default 'Voir l''offre' check (char_length(button_label) between 1 and 30),
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'draft' check (status in ('draft','published','paused')),
  position integer not null default 0,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (template = 'minimal' or image_url is not null),
  check (discount_type <> 'percent' or discount_value <= 95),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create index promotions_shop_idx on public.promotions(shop_id, position);

create table public.promotion_products (
  promotion_id uuid not null references public.promotions(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  position integer not null default 0,
  discount_type text check (discount_type in ('percent','amount')),
  discount_value numeric check (discount_value is null or discount_value > 0),
  primary key (promotion_id, product_id)
);
create index promotion_products_product_idx on public.promotion_products(product_id);

create table public.promotion_events (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references public.promotions(id) on delete cascade,
  kind text not null check (kind in ('view','click','share','whatsapp','order')),
  created_at timestamptz not null default now()
);
create index promotion_events_promo_idx on public.promotion_events(promotion_id, kind);

create or replace function public.is_promotion_owner(_promo_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.promotions p join public.shops s on s.id = p.shop_id where p.id = _promo_id and s.owner_id = auth.uid())
$$;

create or replace function public.is_promotion_public(_promo_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.promotions p where p.id = _promo_id and p.status = 'published' and not p.is_hidden
    and (p.starts_at is null or p.starts_at <= now()) and (p.ends_at is null or p.ends_at > now())
    and public.is_shop_public(p.shop_id))
$$;

create or replace function public.promotion_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare pl public.plans; n int;
begin
  select p.* into pl from public.shops s join public.plans p on p.id = s.plan_id where s.id = new.shop_id;
  if not (new.template = any(pl.promo_templates)) then
    raise exception 'Ce modèle n''est pas inclus dans votre plan %. Passez à un plan supérieur.', pl.name;
  end if;
  if new.status = 'published' and pl.max_active_promotions is not null
     and (tg_op = 'INSERT' or old.status <> 'published') then
    select count(*) into n from public.promotions where shop_id = new.shop_id and status = 'published' and id <> new.id and (ends_at is null or ends_at > now());
    if n >= pl.max_active_promotions then
      raise exception 'Limite de % promotion(s) active(s) atteinte pour le plan %.', pl.max_active_promotions, pl.name;
    end if;
  end if;
  if tg_op = 'UPDATE' and new.is_hidden <> old.is_hidden and not public.has_role(auth.uid(),'admin') then
    new.is_hidden := old.is_hidden;
  end if;
  if tg_op = 'UPDATE' and new.shop_id <> old.shop_id then raise exception 'Interdit'; end if;
  new.updated_at := now();
  return new;
end $$;
create trigger promotions_guard before insert or update on public.promotions for each row execute function public.promotion_guard();

create or replace function public.promotion_products_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists(select 1 from public.promotions pr join public.products p on p.shop_id = pr.shop_id where pr.id = new.promotion_id and p.id = new.product_id) then
    raise exception 'Produit invalide';
  end if;
  if tg_op = 'INSERT' and (select count(*) from public.promotion_products where promotion_id = new.promotion_id) >= 24 then
    raise exception 'Maximum 24 produits par promotion';
  end if;
  return new;
end $$;
create trigger promotion_products_guard before insert or update on public.promotion_products for each row execute function public.promotion_products_guard();

grant select, insert, update, delete on public.promotions to authenticated;
grant select on public.promotions to anon;
grant all on public.promotions to service_role;
grant select, insert, update, delete on public.promotion_products to authenticated;
grant select on public.promotion_products to anon;
grant all on public.promotion_products to service_role;
grant select, insert on public.promotion_events to authenticated;
grant insert on public.promotion_events to anon;
grant all on public.promotion_events to service_role;

alter table public.promotions enable row level security;
alter table public.promotion_products enable row level security;
alter table public.promotion_events enable row level security;

create policy "promo owner all" on public.promotions for all to authenticated using (public.is_shop_owner(shop_id)) with check (public.is_shop_owner(shop_id));
create policy "promo admin all" on public.promotions for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "promo public read" on public.promotions for select to anon, authenticated using (public.is_promotion_public(id));

create policy "pp owner all" on public.promotion_products for all to authenticated using (public.is_promotion_owner(promotion_id)) with check (public.is_promotion_owner(promotion_id));
create policy "pp admin all" on public.promotion_products for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "pp public read" on public.promotion_products for select to anon, authenticated using (public.is_promotion_public(promotion_id));

create policy "pe anyone insert" on public.promotion_events for insert to anon, authenticated with check (public.is_promotion_public(promotion_id));
create policy "pe owner read" on public.promotion_events for select to authenticated using (public.is_promotion_owner(promotion_id) or public.has_role(auth.uid(),'admin'));