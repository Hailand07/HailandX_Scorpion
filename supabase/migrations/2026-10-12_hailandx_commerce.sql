-- ============================================================================================================================
-- HailandX — tables de commerce et de Flotte (phase 1)                                         APPLIQUÉE le 2026-10-13
-- ----------------------------------------------------------------------------------------------------------------------------
-- APPLIQUÉE en production le 2026-10-13 avec l'accord explicite du fondateur (nouvelles tables seulement ; aucune table existante modifiée).
-- Testée sur un Postgres embarqué (supabase/tests/commerce.test.ts). Sur Supabase, pgcrypto vit dans le schéma `extensions` : il figure dans le
-- chemin de recherche des fonctions de signature (première tentative d'application annulée pour ce motif, sans effet sur la base).
--
-- Principes (HAILANDX.md §8, ECOSYSTEME_HAILAND.md §18) :
--  * HailandX est PROPRIÉTAIRE de ces tables ; il LIT `declarations` et `buildings` (jamais de modification).
--  * Aucune écriture directe sur les commandes, colis, événements, avis : tout passe par des fonctions `security definer`
--    qui vérifient les droits (acheteur, vendeur, livreur, administrateur) et le cycle de vie.
--  * Le vendeur ne peut VENDRE qu'avec un emplacement de niveau 3 (bâtiment certifié actif et validé) ; il peut préparer sa boutique avant.
--  * Codes QR de colis signés (HMAC) avec une clé générée dans la base, jamais dans le dépôt.
--  * `deliveries` (ancienne table, 1 ligne de test) n'est PAS modifiée : les missions de la Flotte vivent dans `parcels`.
-- ============================================================================================================================

begin;

create extension if not exists pgcrypto;

-- ── Schéma privé (non exposé par l'API) : clé de signature des QR ────────────────────────────────────────────────────────
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.secrets (name text primary key, value bytea not null);
insert into private.secrets (name, value) values ('parcel_qr_hmac', gen_random_bytes(32)) on conflict (name) do nothing;

-- ── Outils ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.fn_haversine_m(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable parallel safe set search_path = pg_catalog as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)))
$$;

create or replace function public.fn_touch_updated_at() returns trigger language plpgsql set search_path = pg_catalog as $$
begin new.updated_at := now(); return new; end $$;

-- ── Catalogue ───────────────────────────────────────────────────────────────────────────────────────────────────────────
create table public.categories (
  id text primary key,
  name text not null,
  parent_id text references public.categories (id),
  position integer not null default 0,
  active boolean not null default true
);

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 3 and 40),
  name text not null check (length(btrim(name)) between 2 and 60),
  tagline text,
  category_id text references public.categories (id),
  owner_id uuid not null references auth.users (id),
  declaration_id uuid references public.declarations (id),   -- emplacement du vendeur (Scorpion) ; niveau 3 requis pour vendre
  status text not null default 'preparation' check (status in ('preparation', 'bientot', 'ouverte', 'suspendue')),
  logo_path text,
  cover_path text,
  whatsapp text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shops_owner_idx on public.shops (owner_id);

create table public.shop_members (
  shop_id uuid not null references public.shops (id) on delete cascade,
  user_id uuid not null references auth.users (id),
  role text not null default 'employe' check (role in ('proprietaire', 'employe')),
  primary key (shop_id, user_id)
);

create table public.catalog_products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (length(btrim(name)) between 2 and 120),
  category_id text references public.categories (id),
  description text,
  attributes jsonb not null default '{}'::jsonb,
  photo_paths text[] not null default '{}',
  created_by uuid references auth.users (id),
  status text not null default 'actif' check (status in ('actif', 'a_fusionner', 'retire')),
  merged_into uuid references public.catalog_products (id),
  created_at timestamptz not null default now()
);

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  product_id uuid not null references public.catalog_products (id),
  price_gnf integer not null check (price_gnf > 0),
  condition text not null default 'neuf' check (condition in ('neuf', 'occasion')),
  description text,
  photo_paths text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, product_id)
);
create index offers_product_idx on public.offers (product_id) where active;

create table public.offer_variants (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers (id) on delete cascade,
  label text not null,
  stock integer not null default 0 check (stock >= 0),
  sku text
);

create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9-]{4,40}$'),
  shop_id uuid not null references public.shops (id) on delete cascade,
  kind text not null check (kind in ('produit', 'selection', 'boutique')),
  offer_ids uuid[] not null default '{}',
  source text check (source in ('tiktok', 'whatsapp', 'facebook', 'autre')),
  clicks integer not null default 0,
  orders_count integer not null default 0,
  created_at timestamptz not null default now()
);

-- ── Flotte ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
create table public.couriers (
  user_id uuid primary key references auth.users (id),
  full_name text not null,
  phone text,
  vehicle text not null default 'moto' check (vehicle in ('moto', 'velo', 'voiture', 'pied')),
  status text not null default 'candidat' check (status in ('candidat', 'valide', 'suspendu')),
  available boolean not null default false,
  cash_balance_gnf integer not null default 0 check (cash_balance_gnf >= 0),
  cash_limit_gnf integer not null default 500000 check (cash_limit_gnf >= 0),
  last_lat double precision,
  last_lng double precision,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

-- ── Commandes, colis ────────────────────────────────────────────────────────────────────────────────────────────────────
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users (id),
  delivery_declaration_id uuid not null references public.declarations (id),
  buyer_phone text not null,
  payment_method text not null check (payment_method in ('livraison', 'orange_money')),
  payment_status text not null default 'en_attente' check (payment_status in ('en_attente', 'bloque', 'libere', 'rembourse')),
  subtotal_gnf integer not null check (subtotal_gnf >= 0),
  delivery_fee_gnf integer not null check (delivery_fee_gnf >= 0),
  total_gnf integer not null check (total_gnf >= 0),
  source text check (source in ('application', 'tiktok', 'whatsapp', 'facebook', 'autre')),
  created_at timestamptz not null default now()
);
create index orders_buyer_idx on public.orders (buyer_id);

create table public.parcels (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  shop_id uuid not null references public.shops (id),
  status text not null default 'attente_vendeur'
    check (status in ('attente_vendeur', 'prepare', 'mission_proposee', 'accepte', 'retire', 'remis', 'annule', 'litige')),
  courier_id uuid references public.couriers (user_id),
  qr_nonce text not null default encode(gen_random_bytes(9), 'hex'),
  -- Code de remise à 4 chiffres : visible par l'acheteur seulement (via fn_my_handover_code), jamais lu par le vendeur.
  handover_code text not null default lpad(((get_byte(gen_random_bytes(2), 0) * 256 + get_byte(gen_random_bytes(2), 1)) % 10000)::text, 4, '0'),
  handover_failures smallint not null default 0,
  subtotal_gnf integer not null check (subtotal_gnf >= 0),
  delivery_fee_gnf integer not null check (delivery_fee_gnf >= 0),
  distance_km numeric(6, 2),
  cod_amount_gnf integer not null default 0 check (cod_amount_gnf >= 0),   -- espèces à encaisser (paiement à la livraison)
  created_at timestamptz not null default now(),
  ready_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz
);
create index parcels_order_idx on public.parcels (order_id);
create index parcels_shop_idx on public.parcels (shop_id, status);
create index parcels_courier_idx on public.parcels (courier_id) where courier_id is not null;
create index parcels_open_missions_idx on public.parcels (created_at) where status = 'mission_proposee';

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  parcel_id uuid not null references public.parcels (id) on delete cascade,
  offer_id uuid not null references public.offers (id),
  variant_id uuid references public.offer_variants (id),
  name_snapshot text not null,
  price_gnf_snapshot integer not null check (price_gnf_snapshot > 0),
  quantity integer not null check (quantity > 0)
);

create table public.delivery_events (
  id bigint generated always as identity primary key,
  parcel_id uuid not null references public.parcels (id) on delete cascade,
  kind text not null check (kind in ('cree', 'prepare', 'propose', 'accepte', 'desiste', 'retire', 'remis', 'code_faux', 'annule', 'litige')),
  actor_id uuid,
  lat double precision,
  lng double precision,
  photo_path text,
  created_at timestamptz not null default now()
);
create index delivery_events_parcel_idx on public.delivery_events (parcel_id, id);

-- ── Avis vérifiés et indice de confiance ────────────────────────────────────────────────────────────────────────────────
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  parcel_id uuid not null unique references public.parcels (id),
  shop_id uuid not null references public.shops (id),
  buyer_id uuid not null references auth.users (id),
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or length(comment) <= 1000),
  photo_paths text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.shop_scores (
  shop_id uuid primary key references public.shops (id) on delete cascade,
  trust integer not null default 0 check (trust between 0 and 100),
  rating numeric(3, 2) not null default 0,
  review_count integer not null default 0,
  reliability numeric(4, 3) not null default 0,
  sales integer not null default 0,
  prep_minutes integer,
  updated_at timestamptz not null default now()
);

create trigger shops_touch before update on public.shops for each row execute function public.fn_touch_updated_at();
create trigger offers_touch before update on public.offers for each row execute function public.fn_touch_updated_at();

-- ── Niveau d'adresse (même règle que la vue v_declarations_niveau) ──────────────────────────────────────────────────────
create or replace function public.fn_declaration_level(p_declaration uuid)
returns integer language sql stable security definer set search_path = public, pg_temp as $$
  select case when b.status = 'actif' and b.is_validated is true then 3 else d.detected_level::integer end
  from public.declarations d left join public.buildings b on b.id = d.certified_building_id
  where d.id = p_declaration
$$;

create or replace function public.fn_is_shop_member(p_shop uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.shop_members m where m.shop_id = p_shop and m.user_id = auth.uid())
$$;

-- Aides des règles de lecture : `security definer` pour ne pas se rappeler les règles l'une l'autre (commandes ↔ colis).
create or replace function public.fn_is_order_buyer(p_order uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.orders o where o.id = p_order and o.buyer_id = auth.uid())
$$;
create or replace function public.fn_is_order_party(p_order uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.parcels p where p.order_id = p_order and (p.courier_id = auth.uid() or public.fn_is_shop_member(p.shop_id)))
$$;

-- ── Boutiques : le propriétaire est membre ; le statut « ouverte » ne s'obtient que par certification ───────────────────
create or replace function public.shops_guard_before() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null and not public.is_admin() then
      if new.owner_id <> auth.uid() then raise exception 'boutique : le propriétaire doit être le compte connecté'; end if;
      if new.status not in ('preparation', 'bientot') then raise exception 'boutique : statut initial non autorisé'; end if;
      if new.declaration_id is not null and not exists (select 1 from public.declarations d where d.id = new.declaration_id and d.user_id = auth.uid()) then
        raise exception 'boutique : cette adresse n''appartient pas à votre compte';
      end if;
    end if;
    return new;
  end if;
  -- mise à jour
  if auth.uid() is not null and not public.is_admin() then
    if new.owner_id <> old.owner_id then raise exception 'boutique : le propriétaire ne change pas'; end if;
    if new.status is distinct from old.status then
      if old.status = 'suspendue' or new.status = 'suspendue' then raise exception 'boutique : suspension réservée à l''équipe Hailand'; end if;
      if new.status = 'ouverte' and coalesce(public.fn_declaration_level(new.declaration_id), 0) <> 3 then
        raise exception 'boutique : la vente s''ouvre au niveau 3 (adresse certifiée par Hailand)';
      end if;
    end if;
    if new.declaration_id is distinct from old.declaration_id then
      if new.declaration_id is not null and not exists (select 1 from public.declarations d where d.id = new.declaration_id and d.user_id = auth.uid()) then
        raise exception 'boutique : cette adresse n''appartient pas à votre compte';
      end if;
      if old.status = 'ouverte' then new.status := 'bientot'; end if;   -- changer d'adresse referme la vente jusqu'à nouvelle certification
    end if;
  end if;
  return new;
end $$;
create trigger shops_guard before insert or update on public.shops for each row execute function public.shops_guard_before();

create or replace function public.shops_owner_member_after() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.shop_members (shop_id, user_id, role) values (new.id, new.owner_id, 'proprietaire') on conflict do nothing;
  insert into public.shop_scores (shop_id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger shops_owner_member after insert on public.shops for each row execute function public.shops_owner_member_after();

-- ── Remises à niveau de l'état « ouverte » : à appeler quand l'adresse du vendeur vient d'être certifiée ──────────────────
create or replace function public.fn_shop_open(p_shop uuid)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare s public.shops;
begin
  select * into s from public.shops where id = p_shop;
  if not found then raise exception 'boutique introuvable'; end if;
  if not (public.is_admin() or public.fn_is_shop_member(p_shop)) then raise exception 'droits insuffisants'; end if;
  if s.status = 'suspendue' then raise exception 'boutique suspendue'; end if;
  if coalesce(public.fn_declaration_level(s.declaration_id), 0) <> 3 then raise exception 'la vente s''ouvre au niveau 3 (adresse certifiée par Hailand)'; end if;
  update public.shops set status = 'ouverte' where id = p_shop;
  return 'ouverte';
end $$;

-- ── Commande : un colis par boutique, frais selon la distance, stock décompté ───────────────────────────────────────────
-- p_items : [{"offer_id": "...", "variant_id": "..."|null, "qty": 1}, ...]
create or replace function public.fn_place_order(p_items jsonb, p_declaration uuid, p_phone text, p_payment text, p_source text default 'application')
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid uuid := auth.uid();
  v_order uuid;
  v_level integer;
  b_lat double precision; b_lng double precision;
  it record;
  o public.offers; sh public.shops; v public.offer_variants;
  v_parcel uuid;
  v_shop uuid;
  s_lat double precision; s_lng double precision;
  km numeric; fee integer; sub integer; total_sub integer := 0; total_fee integer := 0;
  v_ids uuid[] := '{}';
  v_pid uuid;
begin
  if uid is null then raise exception 'connexion requise'; end if;
  if p_payment not in ('livraison', 'orange_money') then raise exception 'paiement non reconnu'; end if;
  if p_phone is null or p_phone !~ '^\+?[0-9 ]{8,16}$' then raise exception 'téléphone invalide'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'panier vide'; end if;
  if jsonb_array_length(p_items) > 50 then raise exception 'panier trop grand'; end if;

  -- Adresse de livraison : celle de l'acheteur, niveau 1 au minimum (Scorpion).
  select coalesce(st_y(coalesce(d.anchor_point, d.gps_point)), 0), coalesce(st_x(coalesce(d.anchor_point, d.gps_point)), 0)
    into b_lat, b_lng from public.declarations d where d.id = p_declaration and d.user_id = uid;
  if not found then raise exception 'adresse de livraison introuvable pour ce compte'; end if;
  v_level := public.fn_declaration_level(p_declaration);
  if v_level is null or v_level < 1 then raise exception 'livraison impossible : adresse non enregistrée'; end if;

  insert into public.orders (buyer_id, delivery_declaration_id, buyer_phone, payment_method, subtotal_gnf, delivery_fee_gnf, total_gnf, source)
  values (uid, p_declaration, btrim(p_phone), p_payment, 0, 0, 0, p_source) returning id into v_order;

  -- Parcours des lignes : un colis par boutique.
  for it in select (e->>'offer_id')::uuid as offer_id, nullif(e->>'variant_id', '')::uuid as variant_id, greatest(1, least(99, coalesce((e->>'qty')::int, 1))) as qty
            from jsonb_array_elements(p_items) e order by 1
  loop
    select * into o from public.offers where id = it.offer_id and active;
    if not found then raise exception 'produit indisponible'; end if;
    select * into sh from public.shops where id = o.shop_id;
    if sh.status <> 'ouverte' then raise exception 'la boutique % n''est pas encore ouverte à la vente', sh.name; end if;
    -- Le niveau 3 est revérifié au moment de vendre (une adresse peut avoir perdu sa certification).
    if coalesce(public.fn_declaration_level(sh.declaration_id), 0) <> 3 then raise exception 'la boutique % n''a plus d''adresse certifiée', sh.name; end if;

    if it.variant_id is not null then
      select * into v from public.offer_variants where id = it.variant_id and offer_id = o.id for update;
      if not found then raise exception 'variante introuvable'; end if;
      if v.stock < it.qty then raise exception 'stock insuffisant pour % (%)', o.id, v.label; end if;
      update public.offer_variants set stock = stock - it.qty where id = v.id;
    end if;

    select p.id into v_parcel from public.parcels p where p.order_id = v_order and p.shop_id = o.shop_id;
    if v_parcel is null then
      select coalesce(st_y(coalesce(d.anchor_point, d.gps_point)), 0), coalesce(st_x(coalesce(d.anchor_point, d.gps_point)), 0)
        into s_lat, s_lng from public.declarations d where d.id = sh.declaration_id;
      km := round((public.fn_haversine_m(s_lat, s_lng, b_lat, b_lng) / 1000.0)::numeric, 2);
      -- Frais : base 6 000 + 2 100 GNF/km, arrondi à 500, minimum 8 000 (⚠️ valeurs provisoires, identiques à packages/commerce).
      fee := greatest(8000, (round((6000 + 2100 * km) / 500.0) * 500)::integer);
      insert into public.parcels (order_id, shop_id, subtotal_gnf, delivery_fee_gnf, distance_km) values (v_order, o.shop_id, 0, fee, km) returning id into v_parcel;
      total_fee := total_fee + fee;
    end if;

    insert into public.order_items (order_id, parcel_id, offer_id, variant_id, name_snapshot, price_gnf_snapshot, quantity)
    select v_order, v_parcel, o.id, it.variant_id, cp.name, o.price_gnf, it.qty from public.catalog_products cp where cp.id = o.product_id;
    sub := o.price_gnf * it.qty;
    update public.parcels set subtotal_gnf = subtotal_gnf + sub where id = v_parcel;
    total_sub := total_sub + sub;
  end loop;

  update public.parcels p set cod_amount_gnf = case when p_payment = 'livraison' then p.subtotal_gnf + p.delivery_fee_gnf else 0 end where p.order_id = v_order;
  update public.orders set subtotal_gnf = total_sub, delivery_fee_gnf = total_fee, total_gnf = total_sub + total_fee,
    payment_status = case when p_payment = 'orange_money' then 'en_attente' else 'en_attente' end where id = v_order;
  insert into public.delivery_events (parcel_id, kind, actor_id) select id, 'cree', uid from public.parcels where order_id = v_order;
  return v_order;
end $$;

-- ── Vendeur : colis prêt → proposé aux livreurs proches ─────────────────────────────────────────────────────────────────
create or replace function public.fn_parcel_ready(p_parcel uuid)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare p public.parcels;
begin
  select * into p from public.parcels where id = p_parcel for update;
  if not found then raise exception 'colis introuvable'; end if;
  if not (public.is_admin() or public.fn_is_shop_member(p.shop_id)) then raise exception 'droits insuffisants'; end if;
  if p.status <> 'attente_vendeur' then raise exception 'ce colis n''est plus à préparer (%)', p.status; end if;
  update public.parcels set status = 'mission_proposee', ready_at = now() where id = p_parcel;
  insert into public.delivery_events (parcel_id, kind, actor_id) values (p_parcel, 'prepare', auth.uid()), (p_parcel, 'propose', auth.uid());
  return 'mission_proposee';
end $$;

-- ── QR du colis : signé par le serveur, lisible par le vendeur (étiquette) ──────────────────────────────────────────────
create or replace function private.parcel_signature(p_payload text) returns text language sql stable set search_path = public, private, extensions, pg_temp as $$
  select rtrim(translate(encode(hmac(convert_to(p_payload, 'utf8'), (select value from private.secrets where name = 'parcel_qr_hmac'), 'sha256'), 'base64'), E'+/\n', '-_'), '=')
$$;

create or replace function public.fn_parcel_qr(p_parcel uuid)
returns text language plpgsql stable security definer set search_path = public, private, extensions, pg_temp as $$
declare p public.parcels; payload text;
begin
  select * into p from public.parcels where id = p_parcel;
  if not found then raise exception 'colis introuvable'; end if;
  if not (public.is_admin() or public.fn_is_shop_member(p.shop_id)) then raise exception 'droits insuffisants'; end if;
  payload := 'hx1.' || p.id::text || '.' || p.qr_nonce;
  return payload || '.' || private.parcel_signature(payload);
end $$;

create or replace function private.parse_qr(p_qr text) returns uuid language plpgsql stable set search_path = public, private, extensions, pg_temp as $$
declare m text[]; payload text;
begin
  m := regexp_match(btrim(p_qr), '^hx1\.([0-9a-fA-F-]{36})\.([0-9a-f]{18})\.([A-Za-z0-9_-]{43})$');
  if m is null then return null; end if;
  payload := 'hx1.' || m[1] || '.' || m[2];
  if private.parcel_signature(payload) <> m[3] then return null; end if;
  if not exists (select 1 from public.parcels p where p.id = m[1]::uuid and p.qr_nonce = m[2]) then return null; end if;
  return m[1]::uuid;
end $$;

-- ── Livreur ────────────────────────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.fn_courier_ping(p_lat double precision, p_lng double precision)
returns void language sql security definer set search_path = public, pg_temp as $$
  update public.couriers set last_lat = p_lat, last_lng = p_lng, last_seen_at = now() where user_id = auth.uid() and status = 'valide'
$$;

-- Missions proposées autour du livreur : zone approximative seulement (jamais le téléphone ni le point exact de l'acheteur).
create or replace function public.fn_missions_proches(p_lat double precision, p_lng double precision, p_radius_km numeric default 8)
returns table (parcel_id uuid, fee_gnf integer, distance_km numeric, from_label text, to_label text, to_level integer, cod_amount_gnf integer)
language sql stable security definer set search_path = public, pg_temp as $$
  select p.id, p.delivery_fee_gnf, p.distance_km, s.name, coalesce(q.nom, 'Zone de livraison'), public.fn_declaration_level(o.delivery_declaration_id), p.cod_amount_gnf
  from public.parcels p
  join public.shops s on s.id = p.shop_id
  join public.declarations sd on sd.id = s.declaration_id
  join public.orders o on o.id = p.order_id
  join public.declarations bd on bd.id = o.delivery_declaration_id
  left join public.quartiers q on q.id = bd.quartier_id
  where p.status = 'mission_proposee'
    and exists (select 1 from public.couriers c where c.user_id = auth.uid() and c.status = 'valide' and c.available)
    and public.fn_haversine_m(p_lat, p_lng, st_y(coalesce(sd.anchor_point, sd.gps_point)), st_x(coalesce(sd.anchor_point, sd.gps_point))) <= p_radius_km * 1000
  order by p.created_at
$$;

create or replace function public.fn_courier_accept(p_parcel uuid)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare c public.couriers; p public.parcels;
begin
  select * into c from public.couriers where user_id = auth.uid();
  if not found or c.status <> 'valide' then raise exception 'compte livreur non validé'; end if;
  if not c.available then raise exception 'vous êtes indisponible'; end if;
  -- Verrou : un seul livreur obtient la mission.
  update public.parcels set status = 'accepte', courier_id = c.user_id where id = p_parcel and status = 'mission_proposee' returning * into p;
  if not found then raise exception 'mission déjà prise ou indisponible'; end if;
  if c.cash_balance_gnf + p.cod_amount_gnf > c.cash_limit_gnf then
    update public.parcels set status = 'mission_proposee', courier_id = null where id = p_parcel;
    raise exception 'plafond d''espèces atteint : reversez vos espèces avant de prendre cette mission';
  end if;
  insert into public.delivery_events (parcel_id, kind, actor_id) values (p_parcel, 'accepte', c.user_id);
  return 'accepte';
end $$;

create or replace function public.fn_courier_release(p_parcel uuid)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.parcels set status = 'mission_proposee', courier_id = null where id = p_parcel and courier_id = auth.uid() and status = 'accepte';
  if not found then raise exception 'désistement impossible (colis déjà retiré ou non attribué)'; end if;
  insert into public.delivery_events (parcel_id, kind, actor_id) values (p_parcel, 'desiste', auth.uid());
  return 'mission_proposee';
end $$;

create or replace function public.fn_parcel_pickup(p_qr text, p_lat double precision default null, p_lng double precision default null, p_photo text default null)
returns text language plpgsql security definer set search_path = public, private, extensions, pg_temp as $$
declare pid uuid; p public.parcels;
begin
  pid := private.parse_qr(p_qr);
  if pid is null then raise exception 'QR illisible ou falsifié'; end if;
  update public.parcels set status = 'retire', picked_up_at = now() where id = pid and courier_id = auth.uid() and status = 'accepte' returning * into p;
  if not found then raise exception 'ce colis ne vous est pas attribué, ou n''est pas à retirer'; end if;
  insert into public.delivery_events (parcel_id, kind, actor_id, lat, lng, photo_path) values (pid, 'retire', auth.uid(), p_lat, p_lng, p_photo);
  return 'retire';
end $$;

-- ── Acheteur : code de remise (repli quand il ne peut pas scanner) ─────────────────────────────────────────────────────
create or replace function public.fn_my_handover_code(p_parcel uuid)
returns text language sql stable security definer set search_path = public, pg_temp as $$
  select p.handover_code from public.parcels p join public.orders o on o.id = p.order_id
  where p.id = p_parcel and o.buyer_id = auth.uid() and p.status not in ('annule', 'remis')
$$;

-- ── Remise : scan de l'acheteur (depuis son compte) OU code saisi par le livreur ───────────────────────────────────────
create or replace function public.fn_parcel_handover(p_parcel uuid, p_method text, p_value text)
returns text language plpgsql security definer set search_path = public, private, extensions, pg_temp as $$
declare
  p public.parcels; o public.orders; c public.couriers; d public.declarations;
  a_lat double precision; a_lng double precision; dist double precision; ok boolean := false;
begin
  select * into p from public.parcels where id = p_parcel for update;
  if not found then raise exception 'colis introuvable'; end if;
  select * into o from public.orders where id = p.order_id;
  if p.status <> 'retire' then raise exception 'le colis n''est pas en cours de livraison (%)', p.status; end if;
  if p.handover_failures >= 5 then raise exception 'colis verrouillé : contactez l''équipe Hailand'; end if;

  -- Contrôle de proximité : le livreur doit être près de l'adresse (150 m + précision de l'adresse), position vue dans les 10 dernières minutes.
  select * into c from public.couriers where user_id = p.courier_id;
  select * into d from public.declarations where id = o.delivery_declaration_id;
  a_lat := st_y(coalesce(d.anchor_point, d.gps_point)); a_lng := st_x(coalesce(d.anchor_point, d.gps_point));
  if c.last_lat is null or c.last_seen_at is null or c.last_seen_at < now() - interval '10 minutes' then
    raise exception 'position du livreur inconnue : il doit activer sa localisation';
  end if;
  dist := public.fn_haversine_m(c.last_lat, c.last_lng, a_lat, a_lng);
  if dist > 150 + coalesce(d.gps_accuracy_m, 0) then raise exception 'le livreur n''est pas à l''adresse (% m)', round(dist); end if;

  if p_method = 'scan' then
    if o.buyer_id <> auth.uid() then raise exception 'seul l''acheteur de cette commande peut confirmer par scan'; end if;
    ok := private.parse_qr(p_value) = p_parcel;
  elsif p_method = 'code' then
    if p.courier_id is distinct from auth.uid() then raise exception 'seul le livreur de ce colis peut saisir le code'; end if;
    ok := p_value ~ '^[0-9]{4}$' and p_value = p.handover_code;
  else
    raise exception 'méthode inconnue';
  end if;

  if not ok then
    update public.parcels set handover_failures = handover_failures + 1 where id = p_parcel;
    insert into public.delivery_events (parcel_id, kind, actor_id) values (p_parcel, 'code_faux', auth.uid());
    return 'refuse';   -- ne lève pas d'erreur : le compteur d'essais doit rester enregistré
  end if;

  update public.parcels set status = 'remis', delivered_at = now() where id = p_parcel;
  insert into public.delivery_events (parcel_id, kind, actor_id, lat, lng) values (p_parcel, 'remis', auth.uid(), c.last_lat, c.last_lng);
  -- Espèces encaissées : s'ajoutent au solde que le livreur doit reverser.
  if p.cod_amount_gnf > 0 then update public.couriers set cash_balance_gnf = cash_balance_gnf + p.cod_amount_gnf where user_id = p.courier_id; end if;
  return 'remis';
end $$;

-- ── Annulation (vendeur avant retrait, acheteur avant préparation, équipe à tout moment) ────────────────────────────────
create or replace function public.fn_parcel_cancel(p_parcel uuid)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare p public.parcels; o public.orders; allowed boolean;
begin
  select * into p from public.parcels where id = p_parcel for update;
  if not found then raise exception 'colis introuvable'; end if;
  select * into o from public.orders where id = p.order_id;
  allowed := public.is_admin()
    or (public.fn_is_shop_member(p.shop_id) and p.status in ('attente_vendeur', 'prepare', 'mission_proposee', 'accepte'))
    or (o.buyer_id = auth.uid() and p.status = 'attente_vendeur');
  if not allowed then raise exception 'annulation impossible à ce stade'; end if;
  if p.status in ('retire', 'remis', 'annule') and not public.is_admin() then raise exception 'annulation impossible à ce stade'; end if;
  update public.parcels set status = 'annule', courier_id = null where id = p_parcel;
  -- Le stock des variantes est remis en rayon.
  update public.offer_variants v set stock = v.stock + i.quantity from public.order_items i where i.parcel_id = p_parcel and i.variant_id = v.id;
  insert into public.delivery_events (parcel_id, kind, actor_id) values (p_parcel, 'annule', auth.uid());
  return 'annule';
end $$;

-- ── Avis : seulement après une remise confirmée ───────────────────────────────────────────────────────────────────────
create or replace function public.fn_submit_review(p_parcel uuid, p_rating integer, p_comment text default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare p public.parcels; o public.orders; rid uuid;
begin
  select * into p from public.parcels where id = p_parcel;
  if not found then raise exception 'colis introuvable'; end if;
  select * into o from public.orders where id = p.order_id;
  if o.buyer_id <> auth.uid() then raise exception 'seul l''acheteur peut noter'; end if;
  if p.status <> 'remis' then raise exception 'on ne peut noter qu''après la remise du colis'; end if;
  insert into public.reviews (parcel_id, shop_id, buyer_id, rating, comment) values (p_parcel, p.shop_id, auth.uid(), p_rating, nullif(btrim(p_comment), '')) returning id into rid;
  return rid;
end $$;

-- ── Lien partagé : résolution publique, avec comptage des clics ───────────────────────────────────────────────────────
create or replace function public.fn_resolve_share_link(p_code text)
returns table (kind text, shop_slug text, offer_ids uuid[]) language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.share_links set clicks = clicks + 1 where code = lower(p_code);
  return query select l.kind, s.slug, l.offer_ids from public.share_links l join public.shops s on s.id = l.shop_id where l.code = lower(p_code) and s.status <> 'suspendue';
end $$;

-- ── Droits d'exécution : jamais ouverts à tous par défaut ───────────────────────────────────────────────────────────────
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace)
           and p.proname in ('fn_shop_open', 'fn_place_order', 'fn_parcel_ready', 'fn_parcel_qr', 'fn_courier_ping', 'fn_missions_proches', 'fn_courier_accept',
                             'fn_courier_release', 'fn_parcel_pickup', 'fn_my_handover_code', 'fn_parcel_handover', 'fn_parcel_cancel', 'fn_submit_review',
                             'fn_resolve_share_link', 'fn_declaration_level', 'fn_is_shop_member', 'couriers_guard_before', 'shops_guard_before', 'shops_owner_member_after',
                             'parcel_signature', 'parse_qr', 'fn_is_order_buyer', 'fn_is_order_party')
  loop
    execute format('revoke all on function %s from public, anon', f.sig);
  end loop;
  for f in select p.oid::regprocedure as sig from pg_proc p where p.pronamespace = 'public'::regnamespace
           and p.proname in ('fn_shop_open', 'fn_place_order', 'fn_parcel_ready', 'fn_parcel_qr', 'fn_courier_ping', 'fn_missions_proches', 'fn_courier_accept',
                             'fn_courier_release', 'fn_parcel_pickup', 'fn_my_handover_code', 'fn_parcel_handover', 'fn_parcel_cancel', 'fn_submit_review', 'fn_declaration_level',
                             'fn_is_order_buyer', 'fn_is_order_party')
  loop
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
  -- Les liens partagés se résolvent sans compte (visiteur venu de TikTok ou de WhatsApp).
  -- Les règles de lecture de la vitrine s'évaluent aussi pour un visiteur : il doit pouvoir appeler fn_is_shop_member (qui répond « non »).
  for f in select p.oid::regprocedure as sig from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('fn_resolve_share_link', 'fn_is_shop_member')
  loop
    execute format('grant execute on function %s to anon, authenticated', f.sig);
  end loop;
end $$;

-- ── Sécurité par ligne (RLS) ──────────────────────────────────────────────────────────────────────────────────────────
alter table public.categories enable row level security;
alter table public.shops enable row level security;
alter table public.shop_members enable row level security;
alter table public.catalog_products enable row level security;
alter table public.offers enable row level security;
alter table public.offer_variants enable row level security;
alter table public.share_links enable row level security;
alter table public.couriers enable row level security;
alter table public.orders enable row level security;
alter table public.parcels enable row level security;
alter table public.order_items enable row level security;
alter table public.delivery_events enable row level security;
alter table public.reviews enable row level security;
alter table public.shop_scores enable row level security;

-- Lecture publique : vitrine.
create policy categories_read on public.categories for select using (active);
create policy shops_read on public.shops for select using (status <> 'suspendue' or public.fn_is_shop_member(id) or public.is_admin());
create policy products_read on public.catalog_products for select using (status = 'actif' or public.is_admin());
create policy offers_read on public.offers for select using (active or public.fn_is_shop_member(shop_id) or public.is_admin());
create policy variants_read on public.offer_variants for select using (exists (select 1 from public.offers o where o.id = offer_id and (o.active or public.fn_is_shop_member(o.shop_id) or public.is_admin())));
create policy reviews_read on public.reviews for select using (true);
create policy scores_read on public.shop_scores for select using (true);

-- Boutiques : création par tout compte connecté (garde dans le déclencheur) ; modification par les membres.
create policy shops_insert on public.shops for insert to authenticated with check (owner_id = auth.uid() or public.is_admin());
create policy shops_update on public.shops for update to authenticated using (public.fn_is_shop_member(id) or public.is_admin()) with check (public.fn_is_shop_member(id) or public.is_admin());
create policy members_read on public.shop_members for select to authenticated using (user_id = auth.uid() or public.fn_is_shop_member(shop_id) or public.is_admin());

-- Catalogue : tout vendeur peut proposer une fiche ; l'équipe fusionne et retire.
create policy products_insert on public.catalog_products for insert to authenticated
  with check (created_by = auth.uid() and exists (select 1 from public.shop_members m where m.user_id = auth.uid()));
create policy products_admin on public.catalog_products for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Offres et variantes : les membres de la boutique.
create policy offers_write on public.offers for all to authenticated using (public.fn_is_shop_member(shop_id) or public.is_admin()) with check (public.fn_is_shop_member(shop_id) or public.is_admin());
create policy variants_write on public.offer_variants for all to authenticated
  using (exists (select 1 from public.offers o where o.id = offer_id and (public.fn_is_shop_member(o.shop_id) or public.is_admin())))
  with check (exists (select 1 from public.offers o where o.id = offer_id and (public.fn_is_shop_member(o.shop_id) or public.is_admin())));

-- Liens partagés : gérés par la boutique ; les visiteurs passent par fn_resolve_share_link.
create policy links_members on public.share_links for all to authenticated using (public.fn_is_shop_member(shop_id) or public.is_admin()) with check (public.fn_is_shop_member(shop_id) or public.is_admin());

-- Livreurs : chacun voit et propose son propre dossier (statut « candidat ») ; l'équipe valide.
create policy couriers_self_read on public.couriers for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy couriers_apply on public.couriers for insert to authenticated with check (user_id = auth.uid() and status = 'candidat' and not available and cash_balance_gnf = 0);
create policy couriers_self_update on public.couriers for update to authenticated using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
-- La disponibilité est le seul champ qu'un livreur règle lui-même ; le reste est protégé par ce déclencheur.
-- Non `security definer` : `current_user` vaut alors le rôle du client (authenticated) pour une modification directe,
-- et le propriétaire pour une modification faite par une fonction du serveur (remise : solde d'espèces).
create or replace function public.couriers_guard_before() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if current_user in ('authenticated', 'anon') and not public.is_admin() then
    if new.status is distinct from old.status or new.cash_balance_gnf is distinct from old.cash_balance_gnf or new.cash_limit_gnf is distinct from old.cash_limit_gnf
       or new.user_id is distinct from old.user_id then
      raise exception 'livreur : statut, plafond et solde d''espèces sont réservés à l''équipe Hailand';
    end if;
    if new.available and new.status <> 'valide' then raise exception 'livreur : compte non validé'; end if;
  end if;
  return new;
end $$;
create trigger couriers_guard before update on public.couriers for each row execute function public.couriers_guard_before();

-- Commandes, colis, lignes, événements : lecture seule, par les personnes concernées ; écriture uniquement par les fonctions.
create policy orders_read on public.orders for select to authenticated using (buyer_id = auth.uid() or public.is_admin() or public.fn_is_order_party(id));
create policy parcels_read on public.parcels for select to authenticated using (public.is_admin() or public.fn_is_shop_member(shop_id) or courier_id = auth.uid() or public.fn_is_order_buyer(order_id));
create policy items_read on public.order_items for select to authenticated using (exists (select 1 from public.parcels p where p.id = parcel_id));
create policy events_read on public.delivery_events for select to authenticated using (exists (select 1 from public.parcels p where p.id = parcel_id));

-- Défense en profondeur : les écritures sensibles ne passent QUE par les fonctions (les droits par défaut de Supabase donnent tout à `authenticated`).
revoke insert, update, delete, truncate on public.orders, public.parcels, public.order_items, public.delivery_events, public.reviews, public.shop_scores, public.categories
  from anon, authenticated;
revoke insert, update, delete, truncate on public.categories, public.shops, public.shop_members, public.catalog_products, public.offers, public.offer_variants,
  public.share_links, public.couriers, public.orders, public.parcels, public.order_items, public.delivery_events, public.reviews, public.shop_scores from anon;
revoke truncate on public.shops, public.shop_members, public.catalog_products, public.offers, public.offer_variants, public.share_links, public.couriers from authenticated;

-- Le code de remise n'est lisible que par l'acheteur (fn_my_handover_code) : on retire la colonne de la lecture directe.
revoke select on public.parcels from anon, authenticated;
grant select (id, order_id, shop_id, status, courier_id, subtotal_gnf, delivery_fee_gnf, distance_km, cod_amount_gnf, created_at, ready_at, picked_up_at, delivered_at, handover_failures)
  on public.parcels to authenticated;

-- Fonctions de déclencheur : jamais appelables depuis l'API (suivi 2026-10-13).
revoke all on function public.shops_guard_before(), public.shops_owner_member_after(), public.couriers_guard_before() from public, anon, authenticated;

commit;
