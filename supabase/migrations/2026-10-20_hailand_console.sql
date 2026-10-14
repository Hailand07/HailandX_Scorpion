-- Hailand Console (étape 2 du plan, HAILANDX.md §27 et §29) : rôles de l'équipe, journal des actions, paramètres réservés
-- au fondateur, circuit des certifications (vendeur → console → HailandMap), lectures de la console.
-- Ajouts seulement : aucune table ni colonne supprimée. Idempotent. APPLIQUÉE en production le 2026-10-14 (connecteur Supabase).
begin;

-- ── 1. Rôles de l'équipe ──────────────────────────────────────────────────────────────────────────────────────────────
-- `agents.role = 'admin'` donne l'accès à la console (inchangé : is_admin()). `console_role` précise : fondateur (tout,
-- y compris commission et frais, et l'équipe) ou opérateur (le quotidien).
alter table public.agents add column if not exists console_role text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'agents_console_role_check') then
    alter table public.agents add constraint agents_console_role_check check (console_role is null or console_role in ('fondateur', 'operateur'));
  end if;
end $$;
-- Les deux comptes du fondateur ; les autres administrateurs deviennent opérateurs.
update public.agents set console_role = case when id in ('044f67d2-6f7e-43bf-9298-1bc6f96ae813', 'be0ebb07-6161-4dcd-b38f-cb83495bcdac') then 'fondateur' else 'operateur' end
where role = 'admin' and console_role is null;

create or replace function public.fn_is_fondateur() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.agents a where a.id = auth.uid() and a.active and a.role = 'admin' and a.console_role = 'fondateur')
$$;
create or replace function public.fn_console_role() returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select case when a.console_role = 'fondateur' then 'fondateur' else 'operateur' end from public.agents a where a.id = auth.uid() and a.active and a.role = 'admin'
$$;
revoke all on function public.fn_is_fondateur(), public.fn_console_role() from public, anon;
grant execute on function public.fn_is_fondateur(), public.fn_console_role() to authenticated;

-- ── 2. Journal des actions (ni modifiable ni effaçable depuis les applications) ─────────────────────────────────────────
create table if not exists public.console_journal (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  target_type text not null,
  target_id text,
  detail jsonb not null default '{}'::jsonb,
  motif text,
  created_at timestamptz not null default now()
);
create index if not exists console_journal_created_idx on public.console_journal (created_at desc);
alter table public.console_journal enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'console_journal' and policyname = 'journal_read') then
    create policy journal_read on public.console_journal for select to authenticated using (public.is_admin());
  end if;
end $$;
revoke insert, update, delete, truncate on public.console_journal from anon, authenticated;
revoke select on public.console_journal from anon;

create schema if not exists private;
create or replace function private.journal(p_action text, p_target_type text, p_target_id text, p_detail jsonb default '{}'::jsonb, p_motif text default null)
returns void language sql security definer set search_path = public, pg_temp as $$
  insert into public.console_journal (actor_id, action, target_type, target_id, detail, motif) values (auth.uid(), p_action, p_target_type, p_target_id, coalesce(p_detail, '{}'::jsonb), nullif(btrim(p_motif), ''))
$$;
revoke all on function private.journal(text, text, text, jsonb, text) from public, anon, authenticated;

-- Les actions de l'équipe sont inscrites par la base elle-même (déclencheurs), quel que soit le chemin emprunté.
create or replace function private.trg_journal() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or not public.is_admin() then return new; end if;
  -- Conditions imbriquées : PL/pgSQL évalue toute l'expression d'un IF ; « new.status » sur une table sans cette colonne échouerait.
  if tg_table_name = 'shops' then
    if new.status is distinct from old.status then
      perform private.journal('boutique_statut', 'boutique', new.id::text, jsonb_build_object('nom', new.name, 'avant', old.status, 'apres', new.status));
    end if;
  elsif tg_table_name = 'couriers' then
    if new.status is distinct from old.status then
      perform private.journal('livreur_statut', 'livreur', new.user_id::text, jsonb_build_object('nom', new.full_name, 'avant', old.status, 'apres', new.status));
    end if;
    if new.cash_balance_gnf < old.cash_balance_gnf then
      perform private.journal('especes_recues', 'livreur', new.user_id::text, jsonb_build_object('nom', new.full_name, 'montant', old.cash_balance_gnf - new.cash_balance_gnf));
    end if;
  elsif tg_table_name = 'disputes' then
    if new.status is distinct from old.status then
      perform private.journal('litige_tranche', 'litige', new.id::text, jsonb_build_object('colis', new.parcel_id, 'resolution', new.resolution), new.note);
    end if;
  elsif tg_table_name = 'review_reports' then
    if new.status is distinct from old.status then
      perform private.journal('avis_modere', 'avis', new.review_id::text, jsonb_build_object('decision', new.status), new.note);
    end if;
  elsif tg_table_name = 'ledger_entries' then
    if new.kind in ('reversement_vendeur', 'remboursement_verse') then
      perform private.journal(case when new.kind = 'reversement_vendeur' then 'versement_vendeur' else 'remboursement' end, case when new.account = 'shop' then 'boutique' else 'acheteur' end,
        new.account_id::text, jsonb_build_object('montant', abs(new.amount_gnf)));
    end if;
  end if;
  return new;
end $$;
revoke all on function private.trg_journal() from public, anon, authenticated;
do $$ begin if not exists (select 1 from pg_trigger where tgname = 'journal_shops') then create trigger journal_shops after update on public.shops for each row execute function private.trg_journal(); end if; end $$;
do $$ begin if not exists (select 1 from pg_trigger where tgname = 'journal_couriers') then create trigger journal_couriers after update on public.couriers for each row execute function private.trg_journal(); end if; end $$;
do $$ begin if not exists (select 1 from pg_trigger where tgname = 'journal_disputes') then create trigger journal_disputes after update on public.disputes for each row execute function private.trg_journal(); end if; end $$;
do $$ begin if not exists (select 1 from pg_trigger where tgname = 'journal_review_reports') then create trigger journal_review_reports after update on public.review_reports for each row execute function private.trg_journal(); end if; end $$;
do $$ begin if not exists (select 1 from pg_trigger where tgname = 'journal_ledger') then create trigger journal_ledger after insert on public.ledger_entries for each row execute function private.trg_journal(); end if; end $$;

-- ── 3. Paramètres sensibles : réservés au fondateur, avec motif, inscrits au journal ──────────────────────────────────────
-- Une modification directe de la table (sans passer par fn_console_setting_update) est refusée : pas de motif.
create or replace function private.trg_settings_guard() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_motif text := nullif(btrim(current_setting('hailand.motif', true)), '');
begin
  if auth.uid() is null then return new; end if;   -- maintenance par l'équipe technique (éditeur SQL)
  if not public.fn_is_fondateur() then raise exception 'paramètres : réservé au fondateur'; end if;
  if v_motif is null then raise exception 'paramètres : passez par la console (motif obligatoire)'; end if;
  new.updated_at := now();
  perform private.journal('parametre_modifie', 'parametre', new.key, jsonb_build_object('avant', old.value, 'apres', new.value), v_motif);
  return new;
end $$;
revoke all on function private.trg_settings_guard() from public, anon, authenticated;
do $$ begin if not exists (select 1 from pg_trigger where tgname = 'settings_guard') then create trigger settings_guard before update on public.settings for each row execute function private.trg_settings_guard(); end if; end $$;

create or replace function public.fn_console_setting_update(p_key text, p_value text, p_motif text) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_old text; v_new text := btrim(coalesce(p_value, ''));
begin
  if not public.fn_is_fondateur() then raise exception 'paramètres : réservé au fondateur'; end if;
  if length(btrim(coalesce(p_motif, ''))) < 3 then raise exception 'paramètres : indiquez un motif'; end if;
  if p_key in ('commission_bps', 'courier_share_bps') then
    if v_new !~ '^\d{1,5}$' or v_new::int > 10000 then raise exception 'paramètres : valeur hors limites (0 à 100 %%)'; end if;
  elsif p_key = 'payment_mode' then
    if v_new not in ('simulation', 'orange_money') then raise exception 'paramètres : mode de paiement inconnu'; end if;
  else
    raise exception 'paramètres : clé inconnue';
  end if;
  select value into v_old from public.settings where key = p_key;
  if not found then raise exception 'paramètres : clé absente de la base'; end if;
  if v_old = v_new then return v_new; end if;
  perform set_config('hailand.motif', p_motif, true);
  update public.settings set value = v_new where key = p_key;
  perform set_config('hailand.motif', '', true);
  return v_new;
end $$;
revoke all on function public.fn_console_setting_update(text, text, text) from public, anon;
grant execute on function public.fn_console_setting_update(text, text, text) to authenticated;

-- ── 4. Circuit des certifications : vendeur → console (vérifier) → HailandMap (terrain) ──────────────────────────────────
-- Une demande venant de HailandX Vendeur attend la console ; HailandMap ne la voit qu'une fois confirmée
-- (déclaration passée à certification_status = 'demandee', ce que HailandMap lit déjà).
alter table public.certification_priorities add column if not exists status text not null default 'transmise';
alter table public.certification_priorities alter column status set default 'a_verifier';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'certification_priorities_status_check') then
    alter table public.certification_priorities add constraint certification_priorities_status_check check (status in ('a_verifier', 'transmise', 'refusee'));
  end if;
end $$;
alter table public.certification_priorities add column if not exists console_note text;
alter table public.certification_priorities add column if not exists decided_by uuid references auth.users (id) on delete set null;
alter table public.certification_priorities add column if not exists decided_at timestamptz;

create or replace function public.fn_request_priority_certification(p_shop uuid)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare s public.shops; d public.declarations; v_status text;
begin
  select * into s from public.shops where id = p_shop;
  if not found then raise exception 'boutique introuvable'; end if;
  if not public.fn_is_shop_member(p_shop) then raise exception 'droits insuffisants'; end if;
  if s.declaration_id is null then raise exception 'rattachez d''abord une adresse à la boutique'; end if;
  select * into d from public.declarations where id = s.declaration_id;
  if d.user_id <> auth.uid() and not public.is_admin() then raise exception 'cette adresse n''appartient pas à votre compte'; end if;
  if public.fn_declaration_level(d.id) = 3 then raise exception 'cette adresse est déjà certifiée'; end if;
  -- Déjà demandée par le résident (NavigationX) : elle est chez HailandMap, la boutique la rend seulement prioritaire.
  v_status := case when d.certification_status = 'demandee' then 'transmise' else 'a_verifier' end;
  insert into public.certification_priorities (declaration_id, shop_id, requested_by, status) values (d.id, p_shop, auth.uid(), v_status)
  on conflict (declaration_id) do update set shop_id = excluded.shop_id, requested_by = excluded.requested_by, requested_at = now(),
    status = excluded.status, console_note = null, decided_by = null, decided_at = null;
  if v_status = 'a_verifier' then
    perform private.notify_admins('certification', 'Nouvelle demande de certification', s.name, null);
  end if;
  return v_status;
end $$;
revoke all on function public.fn_request_priority_certification(uuid) from public, anon;
grant execute on function public.fn_request_priority_certification(uuid) to authenticated;

create or replace function public.fn_console_certification_decide(p_declaration uuid, p_accept boolean, p_note text default null)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare c public.certification_priorities; v_shop text;
begin
  if not public.is_admin() then raise exception 'certification : réservé à l''équipe Hailand'; end if;
  select * into c from public.certification_priorities where declaration_id = p_declaration for update;
  if not found then raise exception 'certification : demande introuvable'; end if;
  if c.status <> 'a_verifier' then raise exception 'certification : demande déjà traitée'; end if;
  if not p_accept and length(btrim(coalesce(p_note, ''))) < 3 then raise exception 'certification : indiquez le motif du refus'; end if;
  select name into v_shop from public.shops where id = c.shop_id;
  update public.certification_priorities set status = case when p_accept then 'transmise' else 'refusee' end,
    console_note = nullif(btrim(p_note), ''), decided_by = auth.uid(), decided_at = now() where declaration_id = p_declaration;
  if p_accept then
    update public.declarations set certification_status = 'demandee', certification_requested_at = coalesce(certification_requested_at, now()) where id = p_declaration;
    perform private.notify_shop(c.shop_id, 'certification', 'Demande transmise à l''agent de terrain', 'Un agent Hailand va vérifier votre emplacement. Il vous appelle avant de passer.', '/vendeur');
  else
    perform private.notify_shop(c.shop_id, 'certification', 'Demande de certification refusée', btrim(p_note), '/vendeur');
  end if;
  perform private.journal(case when p_accept then 'certification_transmise' else 'certification_refusee' end, 'certification', p_declaration::text,
    jsonb_build_object('boutique', v_shop), p_note);
  return case when p_accept then 'transmise' else 'refusee' end;
end $$;
revoke all on function public.fn_console_certification_decide(uuid, boolean, text) from public, anon;
grant execute on function public.fn_console_certification_decide(uuid, boolean, text) to authenticated;

-- ── 5. Lectures de la console ──────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.fn_console_certifications()
returns table (declaration_id uuid, shop_id uuid, shop_name text, shop_slug text, owner_phone text, declared_label text, hailand_code text,
  quartier text, commune text, level integer, landmark text, lat double precision, lng double precision, status text, console_note text,
  requested_at timestamptz, decided_at timestamptz, map_status text)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'console : réservé à l''équipe Hailand'; end if;
  return query
    select c.declaration_id, c.shop_id, s.name, s.slug, u.phone::text, d.declared_label, d.hailand_code, q.nom, cm.nom,
      public.fn_declaration_level(d.id), d.declared_landmark, public.st_y(coalesce(d.anchor_point, d.gps_point)), public.st_x(coalesce(d.anchor_point, d.gps_point)),
      c.status, c.console_note, c.requested_at, c.decided_at, d.certification_status
    from public.certification_priorities c
    join public.declarations d on d.id = c.declaration_id
    left join public.shops s on s.id = c.shop_id
    left join auth.users u on u.id = s.owner_id
    left join public.quartiers q on q.id = d.quartier_id
    left join public.communes cm on cm.id = d.commune_id
    order by (c.status = 'a_verifier') desc, c.requested_at;
end $$;

create or replace function public.fn_console_journal(p_limit integer default 100)
returns table (id bigint, created_at timestamptz, actor_name text, actor_role text, action text, target_type text, target_id text, detail jsonb, motif text)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'console : réservé à l''équipe Hailand'; end if;
  return query
    select j.id, j.created_at, coalesce(a.full_name, 'Système'), a.console_role, j.action, j.target_type, j.target_id, j.detail, j.motif
    from public.console_journal j left join public.agents a on a.id = j.actor_id
    order by j.id desc limit greatest(1, least(p_limit, 500));
end $$;

create or replace function public.fn_console_team()
returns table (user_id uuid, full_name text, phone text, console_role text, active boolean, created_at timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'console : réservé à l''équipe Hailand'; end if;
  return query select a.id, a.full_name, u.phone::text, coalesce(a.console_role, 'operateur'), a.active, a.created_at
    from public.agents a left join auth.users u on u.id = a.id where a.role = 'admin' order by a.created_at;
end $$;

-- Équipe : seul le fondateur ajoute un membre (par son numéro, compte déjà créé), change un rôle ou désactive.
create or replace function public.fn_console_team_set(p_phone text, p_full_name text, p_console_role text, p_active boolean default true)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_user uuid; v_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
begin
  if not public.fn_is_fondateur() then raise exception 'équipe : réservé au fondateur'; end if;
  if p_console_role not in ('fondateur', 'operateur') then raise exception 'équipe : rôle inconnu'; end if;
  if length(v_digits) = 9 then v_digits := '224' || v_digits; end if;
  if v_digits !~ '^224\d{9}$' then raise exception 'équipe : numéro guinéen invalide'; end if;
  select id into v_user from auth.users where regexp_replace(coalesce(phone, ''), '\D', '', 'g') = v_digits limit 1;
  if v_user is null then raise exception 'équipe : aucun compte avec ce numéro (la personne doit d''abord se connecter une fois)'; end if;
  if v_user = auth.uid() and (p_console_role <> 'fondateur' or not p_active) then raise exception 'équipe : vous ne pouvez pas retirer vos propres droits'; end if;
  insert into public.agents (id, full_name, role, active, console_role) values (v_user, nullif(btrim(p_full_name), ''), 'admin', p_active, p_console_role)
  on conflict (id) do update set full_name = coalesce(nullif(btrim(excluded.full_name), ''), public.agents.full_name), role = 'admin', active = excluded.active, console_role = excluded.console_role;
  perform private.journal('equipe_modifiee', 'compte', v_user::text, jsonb_build_object('nom', p_full_name, 'role', p_console_role, 'actif', p_active));
  return v_user;
end $$;

create or replace function public.fn_console_overview()
returns table (orders_today integer, sales_today bigint, commission_today bigint, couriers_valid integer, couriers_online integer, couriers_pending integer,
  parcels_stuck integer, certifs_pending integer, disputes_open integer, reports_open integer, cash_over_limit integer, shops_open integer)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_bps integer := coalesce((select value::int from public.settings where key = 'commission_bps'), 0);
begin
  if not public.is_admin() then raise exception 'console : réservé à l''équipe Hailand'; end if;
  return query select
    (select count(*)::int from public.orders o where o.created_at >= current_date),
    (select coalesce(sum(p.subtotal_gnf), 0)::bigint from public.parcels p where p.created_at >= current_date and p.status <> 'annule'),
    (select coalesce(sum(p.subtotal_gnf), 0)::bigint * v_bps / 10000 from public.parcels p where p.created_at >= current_date and p.status <> 'annule'),
    (select count(*)::int from public.couriers c where c.status = 'valide'),
    (select count(*)::int from public.couriers c where c.status = 'valide' and c.available and c.last_seen_at > now() - interval '15 minutes'),
    (select count(*)::int from public.couriers c where c.status = 'candidat'),
    (select count(*)::int from public.parcels p where p.status in ('prepare', 'mission_proposee') and coalesce(p.ready_at, p.created_at) < now() - interval '45 minutes'),
    (select count(*)::int from public.certification_priorities c where c.status = 'a_verifier'),
    (select count(*)::int from public.disputes d where d.status = 'ouvert'),
    (select count(*)::int from public.review_reports r where r.status = 'ouvert'),
    (select count(*)::int from public.couriers c where c.cash_balance_gnf > c.cash_limit_gnf),
    (select count(*)::int from public.shops s where s.status = 'ouverte');
end $$;

revoke all on function public.fn_console_certifications(), public.fn_console_journal(integer), public.fn_console_team(),
  public.fn_console_team_set(text, text, text, boolean), public.fn_console_overview() from public, anon;
grant execute on function public.fn_console_certifications(), public.fn_console_journal(integer), public.fn_console_team(),
  public.fn_console_team_set(text, text, text, boolean), public.fn_console_overview() to authenticated;

commit;
