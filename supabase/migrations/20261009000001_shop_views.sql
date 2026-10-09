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
  if coalesce(current_setting('app.view_inc', true),'') <> '1' and not public.has_role(auth.uid(),'admin') then
    new.views := old.views;
  end if;
  new.updated_at := now();
  return new;
end $$;

create or replace function public.increment_shop_view(_slug text) returns void language plpgsql security definer set search_path = public
as $$ begin
  perform set_config('app.view_inc','1',true);
  update public.shops set views = views + 1 where slug = _slug and is_published and not is_suspended;
  perform set_config('app.view_inc','',true);
end $$;
