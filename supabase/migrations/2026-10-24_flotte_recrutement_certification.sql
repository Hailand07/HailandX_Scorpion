-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- PHASE 5 du plan « Compte Hailand unique et passerelles » (HAILANDX.md §31, ECOSYSTEME §14).
--
-- 1. FLOTTE N'EST PROPOSÉE À PERSONNE : les livreurs sont recrutés par l'équipe et ajoutés dans Hailand Console par leur numéro.
--    - Numéro déjà connu (Compte Hailand existant) : le livreur est créé « validé » tout de suite.
--    - Numéro inconnu : invitation en attente (`courier_invitations`), transformée en livreur validé à sa première connexion à
--      Flotte (`fn_flotte_rejoindre`).
--    - La candidature publique est fermée (règle `couriers_apply` : plus aucune insertion directe).
-- 2. NOTIFICATION « ADRESSE CERTIFIÉE » : quand HailandMap certifie le bâtiment d'une adresse (la base rattache la déclaration :
--    `certified_building_id` renseigné), le vendeur dont la boutique en préparation est à cette adresse est prévenu dans
--    HailandX Vendeur : « vous pouvez ouvrir la vente ».
-- Ajouts seulement ; aucune donnée existante n'est modifiée.
-- APPLIQUÉE EN PRODUCTION le 2026-10-14 (accord du fondateur), en deux migrations : flotte_recrutement_table, flotte_recrutement_fonctions.
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

-- ── 1. Invitations de livreurs ───────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.courier_invitations (
  phone text primary key check (phone ~ '^2246[0-9]{8}$'),
  full_name text not null check (length(trim(full_name)) between 2 and 80),
  vehicle text not null default 'moto' check (vehicle in ('moto', 'velo', 'voiture', 'pied')),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  user_id uuid references auth.users (id) on delete set null
);
alter table public.courier_invitations enable row level security;
revoke all on table public.courier_invitations from anon, authenticated;
grant select on table public.courier_invitations to authenticated;
create policy courier_invitations_team_read on public.courier_invitations for select to authenticated using (public.is_admin());

/** Numéro guinéen normalisé comme dans auth.users.phone : « 2246XXXXXXXX » (sans « + »), sinon NULL. */
create or replace function public.fn_gn_phone_digits(p text)
returns text language sql immutable set search_path = public, pg_temp as $$
  select case
    when d ~ '^2246[0-9]{8}$' then d
    when d ~ '^6[0-9]{8}$' then '224' || d
    else null end
  from (select regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g') as d) x
$$;

/**
 * Hailand Console : ajouter un livreur par son numéro (équipe seulement). Renvoie 'valide' (compte existant : livreur validé)
 * ou 'invitation' (pas encore de compte : il sera validé à sa première connexion à Flotte). Inscrit au journal de la console.
 */
create or replace function public.fn_console_courier_add(p_phone text, p_name text, p_vehicle text default 'moto')
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_phone text := public.fn_gn_phone_digits(p_phone);
  v_name text := trim(coalesce(p_name, ''));
  v_vehicle text := coalesce(nullif(p_vehicle, ''), 'moto');
  v_uid uuid;
begin
  if public.fn_console_role() is null then raise exception 'Réservé à l''équipe Hailand.'; end if;
  if v_phone is null then raise exception 'Numéro guinéen invalide (ex. 6XX XX XX XX).'; end if;
  if length(v_name) < 2 then raise exception 'Indiquez le nom du livreur.'; end if;
  if v_vehicle not in ('moto', 'velo', 'voiture', 'pied') then raise exception 'Moyen de transport inconnu.'; end if;
  select u.id into v_uid from auth.users u where u.phone = v_phone limit 1;
  if v_uid is not null then
    insert into public.couriers (user_id, full_name, phone, vehicle, status, available)
    values (v_uid, v_name, '+' || v_phone, v_vehicle, 'valide', false)
    on conflict (user_id) do update set full_name = excluded.full_name, phone = excluded.phone, vehicle = excluded.vehicle, status = 'valide';
    insert into public.courier_invitations (phone, full_name, vehicle, invited_by, accepted_at, user_id)
    values (v_phone, v_name, v_vehicle, auth.uid(), now(), v_uid)
    on conflict (phone) do update set full_name = excluded.full_name, vehicle = excluded.vehicle, invited_by = excluded.invited_by, accepted_at = now(), user_id = v_uid;
    perform private.journal('livreur_ajoute', 'livreur', v_uid::text, jsonb_build_object('nom', v_name, 'vehicule', v_vehicle, 'compte', 'existant'));
    return 'valide';
  end if;
  insert into public.courier_invitations (phone, full_name, vehicle, invited_by)
  values (v_phone, v_name, v_vehicle, auth.uid())
  on conflict (phone) do update set full_name = excluded.full_name, vehicle = excluded.vehicle, invited_by = excluded.invited_by, accepted_at = null, user_id = null;
  perform private.journal('livreur_invite', 'livreur', v_phone, jsonb_build_object('nom', v_name, 'vehicule', v_vehicle));
  return 'invitation';
end $$;
revoke execute on function public.fn_console_courier_add(text, text, text) from public, anon;
grant execute on function public.fn_console_courier_add(text, text, text) to authenticated;

/**
 * Flotte, à la connexion : renvoie le statut du livreur ('valide', 'suspendu', 'candidat') ou NULL si ce numéro n'est pas
 * enregistré comme livreur Hailand. Une invitation en attente pour ce numéro devient un livreur validé.
 */
create or replace function public.fn_flotte_rejoindre()
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_phone text;
  v_status text;
  v_inv public.courier_invitations%rowtype;
begin
  if v_uid is null then return null; end if;
  select c.status into v_status from public.couriers c where c.user_id = v_uid;
  if v_status is not null then return v_status; end if;
  select public.fn_gn_phone_digits(u.phone) into v_phone from auth.users u where u.id = v_uid;
  if v_phone is null then return null; end if;
  select * into v_inv from public.courier_invitations i where i.phone = v_phone and i.accepted_at is null;
  if not found then return null; end if;
  insert into public.couriers (user_id, full_name, phone, vehicle, status, available)
  values (v_uid, v_inv.full_name, '+' || v_phone, v_inv.vehicle, 'valide', false);
  update public.courier_invitations set accepted_at = now(), user_id = v_uid where phone = v_phone;
  return 'valide';
end $$;
revoke execute on function public.fn_flotte_rejoindre() from public, anon;
grant execute on function public.fn_flotte_rejoindre() to authenticated;

-- Candidature publique fermée : plus aucune création directe de dossier livreur depuis une application.
alter policy couriers_apply on public.couriers with check (false);

-- ── 2. Notification « adresse certifiée » ─────────────────────────────────────────────────────────────────────────────────
create or replace function public.notify_declaration_certified()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.certified_building_id is not null and old.certified_building_id is null then
    insert into public.notifications (user_id, kind, title, body, link)
    select s.owner_id, 'certification', 'Adresse certifiée : vous pouvez ouvrir la vente',
           'Hailand a certifié l''adresse de « ' || s.name || ' ». Ouvrez la vente depuis HailandX Vendeur.', '/vendeur/ouvrir'
      from public.shops s
     where s.declaration_id = new.id and s.status in ('preparation', 'bientot');
  end if;
  return new;
end $$;
revoke all on function public.notify_declaration_certified() from public, anon, authenticated;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'declarations_certified_notify') then
    create trigger declarations_certified_notify after update of certified_building_id on public.declarations
      for each row execute function public.notify_declaration_certified();
  end if;
end $$;
