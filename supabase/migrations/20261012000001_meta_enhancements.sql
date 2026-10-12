-- Ajout des colonnes pour les pages disponibles, les permissions manquantes, les clics facebook et la date de dernière mise à jour
alter table public.meta_connections
  add column if not exists pages_cache jsonb,
  add column if not exists missing_permissions text[],
  add column if not exists stats_last_updated_at timestamptz;

-- Ajout de la colonne fb_visits sur meta_posts pour compter les visites issues de ?src=facebook
alter table public.meta_posts
  add column if not exists fb_visits int default 0;

-- Fonction RPC pour incrémenter les clics / visites venant de facebook
create or replace function public.record_facebook_visit(_shop_slug text, _product_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop_id uuid;
begin
  select id into v_shop_id from public.shops where slug = _shop_slug and is_published and not is_suspended;
  if v_shop_id is null then
    return;
  end if;

  if _product_id is not null then
    update public.meta_posts
    set fb_visits = coalesce(fb_visits, 0) + 1
    where shop_id = v_shop_id and product_id = _product_id and platform = 'facebook';
  else
    -- Si pas de produit spécifié, incrémente le dernier post facebook de la boutique
    update public.meta_posts
    set fb_visits = coalesce(fb_visits, 0) + 1
    where id = (
      select id from public.meta_posts
      where shop_id = v_shop_id and platform = 'facebook'
      order by created_at desc
      limit 1
    );
  end if;
end $$;

grant execute on function public.record_facebook_visit(text, uuid) to anon, authenticated;
