-- HailandX — compléments au plan (§21 de HAILANDX.md) : certification prioritaire, favoris, modération des avis, messages de litige,
-- notifications (centre dans l'application), boutiques proches. Écritures uniquement par des fonctions fn_* (security definer).
begin;

-- ── A. Certification prioritaire : un vendeur demande à Hailand de certifier l'adresse de sa boutique ───────────────────────
-- Table séparée (le résident ne peut pas s'accorder lui-même la priorité) ; HailandMap la lit pour trier les demandes.
create table public.certification_priorities (
  declaration_id uuid primary key references public.declarations (id) on delete cascade,
  shop_id uuid not null references public.shops (id) on delete cascade,
  requested_by uuid not null references auth.users (id),
  requested_at timestamptz not null default now()
);
alter table public.certification_priorities enable row level security;
create policy priorities_read on public.certification_priorities for select to authenticated
  using (public.is_admin() or public.is_agent() or public.fn_is_shop_member(shop_id));
revoke insert, update, delete, truncate on public.certification_priorities from anon, authenticated;
revoke select on public.certification_priorities from anon;

create or replace function public.fn_request_priority_certification(p_shop uuid)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare s public.shops; d public.declarations;
begin
  select * into s from public.shops where id = p_shop;
  if not found then raise exception 'boutique introuvable'; end if;
  if not public.fn_is_shop_member(p_shop) then raise exception 'droits insuffisants'; end if;
  if s.declaration_id is null then raise exception 'rattachez d''abord une adresse à la boutique'; end if;
  select * into d from public.declarations where id = s.declaration_id;
  if d.user_id <> auth.uid() and not public.is_admin() then raise exception 'cette adresse n''appartient pas à votre compte'; end if;
  if public.fn_declaration_level(d.id) = 3 then raise exception 'cette adresse est déjà certifiée'; end if;
  update public.declarations set certification_status = 'demandee' where id = d.id and certification_status is distinct from 'demandee';
  insert into public.certification_priorities (declaration_id, shop_id, requested_by) values (d.id, p_shop, auth.uid())
  on conflict (declaration_id) do update set shop_id = excluded.shop_id, requested_by = excluded.requested_by, requested_at = now();
  return 'demandee';
end $$;

-- ── B. Favoris de produits ────────────────────────────────────────────────────────────────────────────────────────────────
create table public.product_favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.catalog_products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
alter table public.product_favorites enable row level security;
create policy favorites_read on public.product_favorites for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete, truncate on public.product_favorites from anon, authenticated;
revoke select on public.product_favorites from anon;
create or replace function public.fn_toggle_favorite(p_product uuid, p_on boolean) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'favoris : connexion requise'; end if;
  if p_on then
    if not exists (select 1 from public.catalog_products where id = p_product and status = 'actif') then raise exception 'favoris : produit introuvable'; end if;
    insert into public.product_favorites (user_id, product_id) values (auth.uid(), p_product) on conflict do nothing;
  else
    delete from public.product_favorites where user_id = auth.uid() and product_id = p_product;
  end if;
  return p_on;
end $$;

-- ── C. Modération des avis : le vendeur signale, l'équipe tranche ; un avis masqué ne compte plus dans l'indice ───────────────
alter table public.reviews add column hidden boolean not null default false;
alter table public.reviews add column hidden_reason text;
alter policy reviews_read on public.reviews using (not hidden);
create policy reviews_read_parties on public.reviews for select to authenticated
  using (buyer_id = auth.uid() or public.fn_is_shop_member(shop_id) or public.is_admin());

create table public.review_reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null unique references public.reviews (id) on delete cascade,
  shop_id uuid not null references public.shops (id) on delete cascade,
  reported_by uuid not null references auth.users (id),
  reason text not null check (reason in ('faux', 'injurieux', 'hors_sujet', 'autre')),
  details text check (details is null or length(details) <= 500),
  status text not null default 'ouvert' check (status in ('ouvert', 'maintenu', 'masque')),
  note text check (note is null or length(note) <= 500),
  decided_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index review_reports_status_idx on public.review_reports (status, created_at);
alter table public.review_reports enable row level security;
create policy reports_read on public.review_reports for select to authenticated using (public.is_admin() or public.fn_is_shop_member(shop_id));
revoke insert, update, delete, truncate on public.review_reports from anon, authenticated;
revoke select on public.review_reports from anon;

create or replace function public.fn_report_review(p_review uuid, p_reason text, p_details text default null) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.reviews; v_id uuid;
begin
  select * into r from public.reviews where id = p_review;
  if not found then raise exception 'avis introuvable'; end if;
  if not public.fn_is_shop_member(r.shop_id) then raise exception 'droits insuffisants'; end if;
  if exists (select 1 from public.review_reports where review_id = p_review) then raise exception 'cet avis a déjà été signalé'; end if;
  insert into public.review_reports (review_id, shop_id, reported_by, reason, details) values (p_review, r.shop_id, auth.uid(), p_reason, nullif(btrim(p_details), '')) returning id into v_id;
  return v_id;
end $$;

-- L'indice de confiance ignore les avis masqués (même fonction qu'avant, une seule condition ajoutée sur la lecture des avis).
create or replace function public.fn_refresh_shop_score(p_shop uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  s public.shops;
  v_rating numeric := 0; v_count int := 0;
  v_ok int := 0; v_bad int := 0; v_rel numeric;
  v_prep int; v_age numeric; v_quality numeric; v_price numeric;
  v_reviews numeric; v_exp numeric; v_trust int; v_offers int; v_photos int;
begin
  select * into s from public.shops where id = p_shop;
  if not found then return; end if;
  select coalesce(avg(rating), 0), count(*) into v_rating, v_count from public.reviews where shop_id = p_shop and not hidden;
  select count(*) filter (where status = 'remis'), count(*) filter (where status = 'litige') into v_ok, v_bad from public.parcels where shop_id = p_shop;
  v_bad := v_bad + (select count(*) from public.delivery_events e join public.parcels p on p.id = e.parcel_id
                    where p.shop_id = p_shop and e.kind = 'annule' and exists (select 1 from public.shop_members m where m.shop_id = p_shop and m.user_id = e.actor_id));
  v_bad := v_bad + (select count(*) from public.disputes dd join public.parcels p on p.id = dd.parcel_id where p.shop_id = p_shop and dd.resolution = 'acheteur');
  v_rel := (v_ok + 3.5) / (v_ok + v_bad + 5);
  select round(avg(extract(epoch from (ready_at - created_at)) / 60))::int into v_prep from (
    select ready_at, created_at from public.parcels where shop_id = p_shop and ready_at is not null order by created_at desc limit 50) t;
  v_age := greatest(0, extract(epoch from (now() - s.created_at)) / 86400);
  select count(*), count(*) filter (where cardinality(photo_paths) > 0) into v_offers, v_photos from public.offers where shop_id = p_shop and active;
  v_quality := (case when s.logo_path is not null then 0.2 else 0 end) + (case when s.cover_path is not null then 0.2 else 0 end)
             + (case when coalesce(btrim(s.tagline), '') <> '' then 0.2 else 0 end)
             + 0.4 * (case when v_offers = 0 then 0 else v_photos::numeric / v_offers end);
  select coalesce(avg(sc), 0.6) into v_price from (
    select case when o.price_gnf <= x.avg_other then 1 else greatest(0, 1 - (o.price_gnf / x.avg_other - 1)) end as sc
    from public.offers o
    join lateral (select avg(o2.price_gnf)::numeric as avg_other from public.offers o2 where o2.product_id = o.product_id and o2.shop_id <> o.shop_id and o2.active having count(*) > 0) x on true
    where o.shop_id = p_shop and o.active) t;
  v_reviews := greatest(0, least(1, (((v_rating * v_count + 3.5 * 20) / (v_count + 20)) - 1) / 4));
  v_exp := greatest(0, least(1, 0.6 * least(1, v_ok / 500.0) + 0.4 * least(1, v_age / 365.0)));
  v_trust := round(35 * v_reviews + 30 * v_rel + 15 * v_exp + 10 * v_quality + 10 * v_price)::int;
  insert into public.shop_scores (shop_id, trust, rating, review_count, reliability, sales, prep_minutes, updated_at)
  values (p_shop, v_trust, round(v_rating, 2), v_count, round(v_rel, 3), v_ok, v_prep, now())
  on conflict (shop_id) do update set trust = excluded.trust, rating = excluded.rating, review_count = excluded.review_count,
    reliability = excluded.reliability, sales = excluded.sales, prep_minutes = excluded.prep_minutes, updated_at = now();
end $$;

create or replace function public.fn_moderate_review(p_report uuid, p_hide boolean, p_note text default null) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare rp public.review_reports;
begin
  if not public.is_admin() then raise exception 'réservé à l''équipe Hailand'; end if;
  select * into rp from public.review_reports where id = p_report for update;
  if not found then raise exception 'signalement introuvable'; end if;
  if rp.status <> 'ouvert' then raise exception 'ce signalement est déjà traité'; end if;
  update public.review_reports set status = case when p_hide then 'masque' else 'maintenu' end, note = nullif(btrim(p_note), ''), decided_by = auth.uid(), decided_at = now() where id = p_report;
  update public.reviews set hidden = p_hide, hidden_reason = case when p_hide then coalesce(nullif(btrim(p_note), ''), rp.reason) else null end where id = rp.review_id;
  perform public.fn_refresh_shop_score(rp.shop_id);
  return case when p_hide then 'masque' else 'maintenu' end;
end $$;

-- ── D. Messages de litige : acheteur, vendeur, livreur et équipe échangent dans le litige ───────────────────────────────────
create table public.dispute_messages (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.disputes (id) on delete cascade,
  author_id uuid not null references auth.users (id),
  author_role text not null check (author_role in ('acheteur', 'vendeur', 'livreur', 'equipe')),
  body text not null check (length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index dispute_messages_idx on public.dispute_messages (dispute_id, created_at);
alter table public.dispute_messages enable row level security;
-- Qui lit le litige (règle disputes_read) lit ses messages.
create policy dispute_messages_read on public.dispute_messages for select to authenticated
  using (exists (select 1 from public.disputes d where d.id = dispute_id));
revoke insert, update, delete, truncate on public.dispute_messages from anon, authenticated;
revoke select on public.dispute_messages from anon;

create or replace function public.fn_dispute_post(p_dispute uuid, p_body text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare d public.disputes; p public.parcels; role text; v_id uuid;
begin
  select * into d from public.disputes where id = p_dispute;
  if not found then raise exception 'litige introuvable'; end if;
  select * into p from public.parcels where id = d.parcel_id;
  role := case when public.is_admin() then 'equipe' when d.opened_by = auth.uid() then 'acheteur' when public.fn_is_shop_member(p.shop_id) then 'vendeur'
               when p.courier_id = auth.uid() then 'livreur' end;
  if role is null then raise exception 'droits insuffisants'; end if;
  if d.status <> 'ouvert' and role <> 'equipe' then raise exception 'ce litige est tranché : les échanges sont fermés'; end if;
  if length(btrim(coalesce(p_body, ''))) = 0 then raise exception 'message vide'; end if;
  insert into public.dispute_messages (dispute_id, author_id, author_role, body) values (p_dispute, auth.uid(), role, btrim(p_body)) returning id into v_id;
  return v_id;
end $$;

-- ── E. Notifications : centre dans l'application (cloche), alimenté par la base ───────────────────────────────────────────────
create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
create policy notifications_read on public.notifications for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete, truncate on public.notifications from anon, authenticated;
revoke select on public.notifications from anon;

create or replace function private.notify(p_user uuid, p_kind text, p_title text, p_body text default null, p_link text default null) returns void
language sql security definer set search_path = public, pg_temp as $$
  insert into public.notifications (user_id, kind, title, body, link) select p_user, p_kind, p_title, p_body, p_link where p_user is not null
$$;
create or replace function private.notify_shop(p_shop uuid, p_kind text, p_title text, p_body text default null, p_link text default null) returns void
language sql security definer set search_path = public, pg_temp as $$
  insert into public.notifications (user_id, kind, title, body, link) select m.user_id, p_kind, p_title, p_body, p_link from public.shop_members m where m.shop_id = p_shop
$$;
create or replace function private.notify_admins(p_kind text, p_title text, p_body text default null, p_link text default null) returns void
language sql security definer set search_path = public, pg_temp as $$
  insert into public.notifications (user_id, kind, title, body, link) select a.id, p_kind, p_title, p_body, p_link from public.agents a where a.role = 'admin' and a.active
$$;
revoke all on function private.notify(uuid, text, text, text, text), private.notify_shop(uuid, text, text, text, text), private.notify_admins(text, text, text, text) from public, anon, authenticated;

create or replace function public.fn_notifications_read(p_ids bigint[] default null) returns integer
language sql security definer set search_path = public, pg_temp as $$
  with u as (update public.notifications set read_at = now() where user_id = auth.uid() and read_at is null and (p_ids is null or id = any(p_ids)) returning 1)
  select count(*)::integer from u
$$;

-- Déclencheurs : commandes, étapes du colis, avis, litiges, messages, décisions.
create or replace function public.notify_parcel_events() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare buyer uuid; shop_name text;
begin
  select o.buyer_id into buyer from public.orders o where o.id = new.order_id;
  select name into shop_name from public.shops where id = new.shop_id;
  if tg_op = 'INSERT' then
    perform private.notify_shop(new.shop_id, 'commande', 'Nouvelle commande', 'Un client attend que vous prépariez son colis.', '/vendeur/commandes');
    return new;
  end if;
  if new.status is not distinct from old.status then return new; end if;
  case new.status
    when 'accepte' then perform private.notify(buyer, 'suivi', 'Un livreur a accepté votre colis', shop_name, '/commandes/' || new.order_id);
    when 'retire' then perform private.notify(buyer, 'suivi', 'Votre colis est en route', 'Gardez votre code de remise à portée de main.', '/commandes/' || new.order_id);
    when 'remis' then perform private.notify(buyer, 'suivi', 'Colis remis', 'Donnez votre avis sur ' || shop_name || '.', '/commandes/' || new.order_id);
    when 'annule' then
      perform private.notify(buyer, 'suivi', 'Colis annulé', shop_name, '/commandes/' || new.order_id);
      perform private.notify_shop(new.shop_id, 'commande', 'Colis annulé', null, '/vendeur/commandes');
    when 'litige' then
      perform private.notify_shop(new.shop_id, 'litige', 'Un acheteur a signalé un problème', 'Répondez dans le litige.', '/commandes/' || new.order_id);
      perform private.notify_admins('litige', 'Litige à traiter', shop_name, '/admin');
    else null;
  end case;
  return new;
end $$;
create trigger parcels_notify after insert or update of status on public.parcels for each row execute function public.notify_parcel_events();

create or replace function public.notify_review_event() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform private.notify_shop(new.shop_id, 'avis', 'Nouvel avis : ' || new.rating || ' sur 5', left(coalesce(new.comment, ''), 120), '/vendeur');
  return new;
end $$;
create trigger reviews_notify after insert on public.reviews for each row execute function public.notify_review_event();

create or replace function public.notify_dispute_message() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare d public.disputes; p public.parcels;
begin
  select * into d from public.disputes where id = new.dispute_id;
  select * into p from public.parcels where id = d.parcel_id;
  if new.author_role <> 'acheteur' then perform private.notify(d.opened_by, 'litige', 'Nouveau message dans votre litige', left(new.body, 120), '/commandes/' || p.order_id); end if;
  if new.author_role <> 'vendeur' then perform private.notify_shop(p.shop_id, 'litige', 'Nouveau message dans un litige', left(new.body, 120), '/commandes/' || p.order_id); end if;
  if new.author_role <> 'equipe' then perform private.notify_admins('litige', 'Nouveau message dans un litige', left(new.body, 120), '/admin'); end if;
  return new;
end $$;
create trigger dispute_messages_notify after insert on public.dispute_messages for each row execute function public.notify_dispute_message();

create or replace function public.notify_dispute_resolved() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare p public.parcels;
begin
  if new.status = 'resolu' and old.status <> 'resolu' then
    select * into p from public.parcels where id = new.parcel_id;
    perform private.notify(new.opened_by, 'litige', 'Litige tranché', 'Décision en faveur de ' || new.resolution || '.', '/commandes/' || p.order_id);
    perform private.notify_shop(p.shop_id, 'litige', 'Litige tranché', 'Décision en faveur de ' || new.resolution || '.', '/commandes/' || p.order_id);
  end if;
  return new;
end $$;
create trigger disputes_notify after update on public.disputes for each row execute function public.notify_dispute_resolved();

create or replace function public.notify_review_report_decided() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status <> 'ouvert' and old.status = 'ouvert' then
    perform private.notify(new.reported_by, 'avis', case when new.status = 'masque' then 'Avis masqué' else 'Avis maintenu' end, coalesce(new.note, 'Décision de l''équipe Hailand.'), '/vendeur');
  end if;
  return new;
end $$;
create trigger review_reports_notify after update on public.review_reports for each row execute function public.notify_review_report_decided();
create or replace function public.notify_review_report_new() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform private.notify_admins('avis', 'Avis signalé par un vendeur', new.reason, '/admin');
  return new;
end $$;
create trigger review_reports_notify_new after insert on public.review_reports for each row execute function public.notify_review_report_new();

revoke all on function public.notify_parcel_events(), public.notify_review_event(), public.notify_dispute_message(), public.notify_dispute_resolved(),
  public.notify_review_report_decided(), public.notify_review_report_new() from public, anon, authenticated;

-- ── G. Boutiques proches : distance à vol d'oiseau depuis un point (jamais les coordonnées de la boutique) ──────────────────────
create or replace function public.fn_shops_nearby(p_lat double precision, p_lng double precision)
returns table (slug text, distance_km numeric)
language sql stable security definer set search_path = public, pg_temp as $$
  select s.slug, round((public.fn_haversine_m(p_lat, p_lng, st_y(coalesce(d.anchor_point, d.gps_point)), st_x(coalesce(d.anchor_point, d.gps_point))) / 1000.0)::numeric, 1)
  from public.shops s join public.declarations d on d.id = s.declaration_id
  where s.status = 'ouverte'
$$;

-- ── Droits d'exécution ───────────────────────────────────────────────────────────────────────────────────────────────────────
revoke all on function public.fn_request_priority_certification(uuid), public.fn_toggle_favorite(uuid, boolean), public.fn_report_review(uuid, text, text),
  public.fn_moderate_review(uuid, boolean, text), public.fn_dispute_post(uuid, text), public.fn_notifications_read(bigint[]), public.fn_shops_nearby(double precision, double precision)
  from public, anon, authenticated;
grant execute on function public.fn_request_priority_certification(uuid), public.fn_toggle_favorite(uuid, boolean), public.fn_report_review(uuid, text, text),
  public.fn_moderate_review(uuid, boolean, text), public.fn_dispute_post(uuid, text), public.fn_notifications_read(bigint[]) to authenticated;
grant execute on function public.fn_shops_nearby(double precision, double precision) to anon, authenticated;

commit;
