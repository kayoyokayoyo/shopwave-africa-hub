-- ============================================================
-- Migration : fonction RPC delete_my_account
-- Supprime en cascade toutes les données du compte appelant :
--   meta_connections, meta_posts, products, product_categories,
--   orders, promotions, subscription_payments, shop_reports,
--   shops, user_roles, profiles
-- puis appelle auth.admin pour supprimer l'utilisateur auth.
-- ============================================================

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_shop_id uuid;
begin
  if v_uid is null then
    raise exception 'Non authentifié';
  end if;

  -- Récupérer l'ID de la boutique (peut être null si pas encore créé)
  select id into v_shop_id from public.shops where owner_id = v_uid;

  if v_shop_id is not null then
    -- Les tables enfants de shops ont ON DELETE CASCADE, donc supprimer
    -- la boutique suffit pour nettoyer : meta_connections, meta_posts,
    -- products, product_categories, orders, subscription_payments,
    -- shop_reports, promotions (si FK cascade est défini)
    delete from public.shops where id = v_shop_id;
  end if;

  -- Supprimer les rôles et le profil (pas de cascade depuis shops)
  delete from public.user_roles where user_id = v_uid;
  delete from public.profiles   where id      = v_uid;

  -- Supprimer le compte auth (nécessite service_role — SECURITY DEFINER permet cela)
  delete from auth.users where id = v_uid;
end $$;

-- Seul l'utilisateur authentifié peut s'appeler lui-même
revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
