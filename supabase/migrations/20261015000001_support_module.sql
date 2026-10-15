-- Migration: 20261015000001_support_module.sql
-- Description: Module Support (tickets, messages, pièces jointes), outbox notifications,
--              déduplication des rappels d'abonnement.
-- Réversible : instructions DROP commentées en bas.

-- ============================================================================
-- 0. SÉQUENCE NUMÉRO LISIBLE DES TICKETS (T-0001, T-0002 …)
-- ============================================================================
create sequence if not exists public.support_ticket_number_seq;

-- ============================================================================
-- 1. TABLES DU MODULE SUPPORT
-- ============================================================================

-- Table: support_tickets
create table if not exists public.support_tickets (
  id            uuid        primary key default gen_random_uuid(),
  numero        text        not null unique default 'T-' || lpad(nextval('public.support_ticket_number_seq')::text, 4, '0'),
  shop_id       uuid        not null references public.shops(id) on delete cascade,
  merchant_id   uuid        not null references auth.users(id) on delete cascade,
  titre         text        not null check (char_length(titre) between 3 and 200),
  categorie     text        not null default 'autre'
    check (categorie in ('paiement_abonnement','connexion_facebook','boutique_produits','commandes','autre')),
  contact_email text,
  contact_whatsapp text,
  statut        text        not null default 'ouvert'
    check (statut in ('ouvert','en_cours','résolu','fermé')),
  cree_le       timestamptz not null default now(),
  mis_a_jour_le timestamptz not null default now(),
  dernier_message_le timestamptz
);

create index if not exists idx_support_tickets_shop     on public.support_tickets(shop_id);
create index if not exists idx_support_tickets_merchant on public.support_tickets(merchant_id);
create index if not exists idx_support_tickets_statut   on public.support_tickets(statut);
create index if not exists idx_support_tickets_cree     on public.support_tickets(cree_le desc);

-- Table: support_messages
create table if not exists public.support_messages (
  id           uuid        primary key default gen_random_uuid(),
  ticket_id    uuid        not null references public.support_tickets(id) on delete cascade,
  auteur       text        not null check (auteur in ('merchant','admin')),
  texte        text        not null check (char_length(texte) between 1 and 10000),
  note_interne boolean     not null default false,
  cree_le      timestamptz not null default now(),
  lu_le        timestamptz
);

create index if not exists idx_support_messages_ticket on public.support_messages(ticket_id);
create index if not exists idx_support_messages_cree   on public.support_messages(cree_le);

-- Table: support_attachments
create table if not exists public.support_attachments (
  id          uuid        primary key default gen_random_uuid(),
  message_id  uuid        not null references public.support_messages(id) on delete cascade,
  chemin      text        not null,
  mime_type   text        not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  taille      integer     not null check (taille > 0 and taille <= 5242880),
  cree_le     timestamptz not null default now()
);

create index if not exists idx_support_attachments_message on public.support_attachments(message_id);

-- Table: notification_outbox
create table if not exists public.notification_outbox (
  id           uuid        primary key default gen_random_uuid(),
  destinataire text        not null,
  type         text        not null,
  reference    uuid,
  sujet        text        not null,
  statut       text        not null default 'en_attente'
    check (statut in ('en_attente','envoyé','échoué')),
  tentatives   integer     not null default 0,
  erreur       text,
  cree_le      timestamptz not null default now(),
  envoye_le    timestamptz
);

create index if not exists idx_notif_outbox_statut    on public.notification_outbox(statut);
create index if not exists idx_notif_outbox_type_ref  on public.notification_outbox(type, reference);

-- Table: subscription_reminder_log (déduplication par période)
create table if not exists public.subscription_reminder_log (
  id              uuid        primary key default gen_random_uuid(),
  subscription_id uuid        not null references public.merchant_subscriptions(id) on delete cascade,
  type_rappel     text        not null
    check (type_rappel in ('j_moins_7','j_moins_3','debut_grace','expiration')),
  envoye_le       timestamptz not null default now(),
  unique (subscription_id, type_rappel)
);

create index if not exists idx_reminder_log_sub on public.subscription_reminder_log(subscription_id);

-- ============================================================================
-- 2. TRIGGERS
-- ============================================================================

-- Trigger mise à jour automatique mis_a_jour_le
create or replace function public.trg_support_tickets_updated()
returns trigger language plpgsql as $$
begin
  new.mis_a_jour_le := now();
  return new;
end $$;

drop trigger if exists trg_support_tickets_updated on public.support_tickets;
create trigger trg_support_tickets_updated
  before update on public.support_tickets
  for each row execute function public.trg_support_tickets_updated();

-- Trigger mise à jour dernier_message_le et réouverture ticket
create or replace function public.trg_support_messages_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.support_tickets
  set dernier_message_le = new.cree_le,
      mis_a_jour_le      = now(),
      statut = case
        when new.auteur = 'merchant' and statut = 'résolu' then 'ouvert'
        else statut
      end
  where id = new.ticket_id;
  return new;
end $$;

drop trigger if exists trg_support_messages_after_insert on public.support_messages;
create trigger trg_support_messages_after_insert
  after insert on public.support_messages
  for each row execute function public.trg_support_messages_after_insert();

-- ============================================================================
-- 3. LIMITE DE DÉBIT (Fonction PL/pgSQL créée AVANT les politiques RLS)
-- ============================================================================
create or replace function public.support_rate_limit_ok(
  _merchant_id uuid,
  _type        text
) returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  _cnt integer;
begin
  if _type = 'ticket' then
    select count(*) into _cnt
    from public.support_tickets
    where merchant_id = _merchant_id
      and cree_le > now() - interval '1 hour';
    return _cnt < 5;
  elsif _type = 'message' then
    select count(*) into _cnt
    from public.support_messages sm
    join public.support_tickets st on st.id = sm.ticket_id
    where st.merchant_id = _merchant_id
      and sm.cree_le > now() - interval '1 hour'
      and sm.auteur = 'merchant';
    return _cnt < 30;
  else
    return false;
  end if;
end;
$$;

-- ============================================================================
-- 4. POLITIQUES RLS
-- ============================================================================

-- RLS: support_tickets
grant select, insert, update on public.support_tickets to authenticated;
grant all on public.support_tickets to service_role;
alter table public.support_tickets enable row level security;

drop policy if exists "tickets merchant read" on public.support_tickets;
create policy "tickets merchant read" on public.support_tickets
  for select to authenticated
  using (merchant_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

drop policy if exists "tickets merchant insert" on public.support_tickets;
create policy "tickets merchant insert" on public.support_tickets
  for insert to authenticated
  with check (merchant_id = auth.uid() and public.support_rate_limit_ok(auth.uid(), 'ticket'::text));

drop policy if exists "tickets update" on public.support_tickets;
create policy "tickets update" on public.support_tickets
  for update to authenticated
  using (merchant_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
  with check (merchant_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- RLS: support_messages
grant select, insert, update on public.support_messages to authenticated;
grant all on public.support_messages to service_role;
alter table public.support_messages enable row level security;

drop policy if exists "messages read" on public.support_messages;
create policy "messages read" on public.support_messages
  for select to authenticated
  using (
    (
      exists(
        select 1 from public.support_tickets t
        where t.id = ticket_id and t.merchant_id = auth.uid()
      ) and note_interne = false
    )
    or public.has_role(auth.uid(), 'admin')
  );

drop policy if exists "messages insert" on public.support_messages;
create policy "messages insert" on public.support_messages
  for insert to authenticated
  with check (
    (
      auteur = 'merchant' and note_interne = false and
      exists(
        select 1 from public.support_tickets t
        where t.id = ticket_id and t.merchant_id = auth.uid()
          and public.support_rate_limit_ok(auth.uid(), 'message'::text)
      )
    )
    or public.has_role(auth.uid(), 'admin')
  );

drop policy if exists "messages update" on public.support_messages;
create policy "messages update" on public.support_messages
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- RLS: support_attachments
grant select, insert on public.support_attachments to authenticated;
grant all on public.support_attachments to service_role;
alter table public.support_attachments enable row level security;

drop policy if exists "attachments read" on public.support_attachments;
create policy "attachments read" on public.support_attachments
  for select to authenticated
  using (
    exists(
      select 1 from public.support_messages sm
      join public.support_tickets st on st.id = sm.ticket_id
      where sm.id = message_id
        and (st.merchant_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
    )
  );

drop policy if exists "attachments insert" on public.support_attachments;
create policy "attachments insert" on public.support_attachments
  for insert to authenticated
  with check (
    exists(
      select 1 from public.support_messages sm
      join public.support_tickets st on st.id = sm.ticket_id
      where sm.id = message_id
        and (st.merchant_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
    )
  );

-- RLS: notification_outbox
grant select on public.notification_outbox to authenticated;
grant all on public.notification_outbox to service_role;
alter table public.notification_outbox enable row level security;

drop policy if exists "outbox admin read" on public.notification_outbox;
create policy "outbox admin read" on public.notification_outbox
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- RLS: subscription_reminder_log
grant select on public.subscription_reminder_log to authenticated;
grant all on public.subscription_reminder_log to service_role;
alter table public.subscription_reminder_log enable row level security;

drop policy if exists "reminder_log admin" on public.subscription_reminder_log;
create policy "reminder_log admin" on public.subscription_reminder_log
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- 5. BUCKET STORAGE PRIVÉ: support-attachments
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'support-attachments',
  'support-attachments',
  false,
  5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public             = false,
  file_size_limit    = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "support upload" on storage.objects;
create policy "support upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'support-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "support read" on storage.objects;
create policy "support read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'support-attachments'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.has_role(auth.uid(), 'admin')
    )
  );

-- ============================================================================
-- 6. PARAMÈTRE ADMIN : adresse e-mail de support
-- ============================================================================
insert into public.app_settings (key, value)
values ('support_email', '"support@marketnet.cd"'::jsonb)
on conflict (key) do nothing;

-- ============================================================================
-- DOWN (rollback manuel) :
-- drop table if exists public.subscription_reminder_log cascade;
-- drop table if exists public.notification_outbox cascade;
-- drop table if exists public.support_attachments cascade;
-- drop table if exists public.support_messages cascade;
-- drop table if exists public.support_tickets cascade;
-- drop sequence if exists public.support_ticket_number_seq;
-- drop function if exists public.support_rate_limit_ok(uuid, text);
-- drop function if exists public.trg_support_messages_after_insert();
-- drop function if exists public.trg_support_tickets_updated();
-- delete from storage.buckets where id = 'support-attachments';
-- delete from public.app_settings where key = 'support_email';
-- ============================================================================
