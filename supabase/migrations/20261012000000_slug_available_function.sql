-- Fonction RPC pour vérifier la disponibilité d'un slug de boutique
create or replace function public.slug_available(_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (select 1 from public.shops where slug = _slug)
$$;

revoke all on function public.slug_available(text) from public;
grant execute on function public.slug_available(text) to anon, authenticated;
