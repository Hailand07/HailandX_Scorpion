-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- HAILANDX VENDEUR « NIVEAU SHOPIFY » — COMMANDES ET MARKETING (plan HAILANDX.md §37, maquettes v6 validées le 2026-10-23).
--
-- A. Commandes : motif d'annulation obligatoire pour le vendeur (`parcels.cancel_reason`, `cancelled_by`), transmis au client ;
--    fiche détaillée d'un colis pour le vendeur (`fn_seller_parcel`) : articles, réduction, commission, client pseudonyme
--    (« Client 7F3A », quartier, niveau d'adresse, nombre de commandes chez vous), étapes. Jamais le numéro ni l'adresse exacte.
-- B. Marketing :
--    - prix barré : `offers.compare_at_gnf` (ancien prix, toujours supérieur au prix de vente) ;
--    - codes promo : `promo_codes` (écrits par la boutique) et `promo_uses` (une ligne par colis réduit, écrite par la base) ;
--      `fn_place_order` accepte un code (`p_promo`) : la réduction est prise sur la part du vendeur, la commission se calcule
--      après réduction (le sous-total du colis est déjà réduit) ; `fn_promo_check` permet d'afficher la réduction avant de commander.
-- Ajouts seulement, sauf `fn_place_order` et `fn_parcel_cancel` remplacées (même comportement + nouveau paramètre facultatif).
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

begin;

-- ── A. Commandes ────────────────────────────────────────────────────────────────────────────────────────────────────────
alter table public.parcels add column if not exists cancel_reason text check (cancel_reason is null or length(btrim(cancel_reason)) between 3 and 300);
alter table public.parcels add column if not exists cancelled_by text check (cancelled_by is null or cancelled_by in ('vendeur', 'acheteur', 'equipe'));
alter table public.parcels add column if not exists discount_gnf integer not null default 0 check (discount_gnf >= 0);
alter table public.parcels add column if not exists promo_code text;
grant select (cancel_reason, cancelled_by, discount_gnf, promo_code) on public.parcels to authenticated;

/** Annulation : vendeur avant retrait (motif obligatoire), acheteur avant préparation, équipe à tout moment. */
drop function if exists public.fn_parcel_cancel(uuid);
create or replace function public.fn_parcel_cancel(p_parcel uuid, p_reason text default null)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare p public.parcels; o public.orders; v_by text; v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  select * into p from public.parcels where id = p_parcel for update;
  if not found then raise exception 'colis introuvable'; end if;
  select * into o from public.orders where id = p.order_id;
  if public.is_admin() then v_by := 'equipe';
  elsif public.fn_is_shop_member(p.shop_id) and p.status in ('attente_vendeur', 'prepare', 'mission_proposee', 'accepte') then v_by := 'vendeur';
  elsif o.buyer_id = auth.uid() and p.status = 'attente_vendeur' then v_by := 'acheteur';
  else raise exception 'annulation impossible à ce stade';
  end if;
  if p.status in ('retire', 'remis', 'annule') and v_by <> 'equipe' then raise exception 'annulation impossible à ce stade'; end if;
  if v_by = 'vendeur' and (v_reason is null or length(v_reason) < 3) then raise exception 'indiquez le motif de l''annulation : le client le verra'; end if;
  update public.parcels set status = 'annule', courier_id = null, cancel_reason = left(v_reason, 300), cancelled_by = v_by where id = p_parcel;
  -- Le stock des variantes est remis en rayon.
  update public.offer_variants v set stock = v.stock + i.quantity from public.order_items i where i.parcel_id = p_parcel and i.variant_id = v.id;
  insert into public.delivery_events (parcel_id, kind, actor_id) values (p_parcel, 'annule', auth.uid());
  return 'annule';
end $$;

-- Le client reçoit le motif dans sa notification d'annulation.
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
      perform private.notify(buyer, 'suivi', 'Colis annulé', shop_name || coalesce(' : ' || new.cancel_reason, ''), '/commandes/' || new.order_id);
      perform private.notify_shop(new.shop_id, 'commande', 'Colis annulé', new.cancel_reason, '/vendeur/commandes');
    when 'litige' then
      perform private.notify_shop(new.shop_id, 'litige', 'Un acheteur a signalé un problème', 'Répondez dans le litige.', '/commandes/' || new.order_id);
      perform private.notify_admins('litige', 'Litige à traiter', shop_name, '/admin');
    else null;
  end case;
  return new;
end $$;

/** Fiche d'un colis pour le vendeur : tout ce qu'il faut pour préparer, sans données personnelles du client. */
create or replace function public.fn_seller_parcel(p_parcel uuid) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare p public.parcels; o public.orders; v jsonb;
begin
  select * into p from public.parcels where id = p_parcel;
  if not found or not (public.fn_is_shop_member(p.shop_id) or public.is_admin()) then raise exception 'colis introuvable'; end if;
  select * into o from public.orders where id = p.order_id;
  select jsonb_build_object(
    'id', p.id, 'order_id', p.order_id, 'status', p.status, 'created_at', p.created_at, 'ready_at', p.ready_at,
    'picked_up_at', p.picked_up_at, 'delivered_at', p.delivered_at,
    'subtotal_gnf', p.subtotal_gnf, 'discount_gnf', p.discount_gnf, 'promo_code', p.promo_code, 'delivery_fee_gnf', p.delivery_fee_gnf,
    'commission_bps', coalesce((select value::int from public.settings where key = 'commission_bps'), 800),
    'payment_method', o.payment_method, 'payment_status', o.payment_status, 'source', o.source,
    'cancel_reason', p.cancel_reason, 'cancelled_by', p.cancelled_by,
    'client', jsonb_build_object(
      'label', 'Client ' || upper(substr(md5(o.buyer_id::text || p.shop_id::text), 1, 4)),
      'quartier', coalesce(q.nom, c.nom),
      'level', public.fn_declaration_level(o.delivery_declaration_id),
      'orders_here', (select count(distinct p2.order_id) from public.parcels p2 join public.orders o2 on o2.id = p2.order_id
                       where p2.shop_id = p.shop_id and o2.buyer_id = o.buyer_id and p2.status <> 'annule' and p2.created_at <= p.created_at)),
    'items', coalesce((select jsonb_agg(jsonb_build_object('name', i.name_snapshot, 'variant', i.variant_label, 'qty', i.quantity,
                       'price_gnf', i.price_gnf_snapshot, 'photo', coalesce(of.photo_paths[1], cp.photo_paths[1])) order by i.name_snapshot)
                       from public.order_items i join public.offers of on of.id = i.offer_id join public.catalog_products cp on cp.id = of.product_id
                       where i.parcel_id = p.id), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(jsonb_build_object('kind', e.kind, 'at', e.created_at) order by e.id)
                        from public.delivery_events e where e.parcel_id = p.id), '[]'::jsonb))
  into v
  from public.declarations d left join public.quartiers q on q.id = d.quartier_id left join public.communes c on c.id = d.commune_id
  where d.id = o.delivery_declaration_id;
  return v;
end $$;

-- ── B. Marketing : prix barré ───────────────────────────────────────────────────────────────────────────────────────────
alter table public.offers add column if not exists compare_at_gnf integer;
alter table public.offers drop constraint if exists offers_compare_at_check;
alter table public.offers add constraint offers_compare_at_check check (compare_at_gnf is null or compare_at_gnf > price_gnf);

-- ── B. Marketing : codes promo ──────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  code text not null check (code ~ '^[A-Z0-9]{3,20}$'),
  kind text not null check (kind in ('pourcentage', 'montant')),
  value integer not null check (value > 0),
  min_subtotal_gnf integer not null default 0 check (min_subtotal_gnf >= 0),
  max_uses integer check (max_uses is null or max_uses > 0),
  once_per_buyer boolean not null default true,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (shop_id, code),
  check (kind <> 'pourcentage' or value <= 90),
  check (ends_at is null or ends_at > starts_at)
);
alter table public.promo_codes enable row level security;
drop policy if exists promo_codes_shop on public.promo_codes;
create policy promo_codes_shop on public.promo_codes for all to authenticated
  using (public.fn_is_shop_member(shop_id) or public.is_admin()) with check (public.fn_is_shop_member(shop_id) or public.is_admin());
revoke all on public.promo_codes from anon, authenticated;
grant select, insert, update on public.promo_codes to authenticated;

create table if not exists public.promo_uses (
  id uuid primary key default gen_random_uuid(),
  promo_id uuid not null references public.promo_codes (id) on delete cascade,
  parcel_id uuid not null unique references public.parcels (id) on delete cascade,
  buyer_id uuid not null references auth.users (id) on delete cascade,
  discount_gnf integer not null check (discount_gnf > 0),
  created_at timestamptz not null default now()
);
create index if not exists promo_uses_promo_idx on public.promo_uses (promo_id);
alter table public.promo_uses enable row level security;
drop policy if exists promo_uses_shop on public.promo_uses;
create policy promo_uses_shop on public.promo_uses for select to authenticated
  using (exists (select 1 from public.promo_codes c where c.id = promo_id and (public.fn_is_shop_member(c.shop_id) or public.is_admin())));
revoke all on public.promo_uses from anon, authenticated;
grant select (id, promo_id, parcel_id, discount_gnf, created_at) on public.promo_uses to authenticated;

/**
 * Réduction d'un code pour une boutique, un sous-total et un acheteur (même règle que packages/commerce/src/promo.ts).
 * Renvoie le code trouvé (ou null) et la réduction ; `reason` explique un refus.
 */
create or replace function private.promo_for(p_shop uuid, p_code text, p_subtotal integer, p_buyer uuid,
  out promo_id uuid, out discount_gnf integer, out reason text)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare c public.promo_codes; used integer;
begin
  discount_gnf := 0;
  select * into c from public.promo_codes where shop_id = p_shop and code = upper(btrim(coalesce(p_code, '')));
  if not found then reason := 'code inconnu pour cette boutique'; return; end if;
  if not c.active then reason := 'code désactivé'; return; end if;
  if now() < c.starts_at then reason := 'code pas encore actif'; return; end if;
  if c.ends_at is not null and now() >= c.ends_at then reason := 'code expiré'; return; end if;
  if p_subtotal < c.min_subtotal_gnf then reason := 'achat minimum : ' || c.min_subtotal_gnf || ' GNF'; return; end if;
  if c.max_uses is not null then
    select count(*) into used from public.promo_uses u join public.parcels pa on pa.id = u.parcel_id where u.promo_id = c.id and pa.status <> 'annule';
    if used >= c.max_uses then reason := 'code épuisé'; return; end if;
  end if;
  if c.once_per_buyer and exists (select 1 from public.promo_uses u join public.parcels pa on pa.id = u.parcel_id
                                  where u.promo_id = c.id and u.buyer_id = p_buyer and pa.status <> 'annule') then
    reason := 'code déjà utilisé'; return;
  end if;
  promo_id := c.id;
  discount_gnf := least(p_subtotal, case when c.kind = 'pourcentage' then round(p_subtotal * c.value / 100.0)::integer else c.value end);
end $$;

/** Avant de commander : la réduction qu'un code donnerait sur ce panier, boutique par boutique. */
create or replace function public.fn_promo_check(p_code text, p_items jsonb)
returns table (shop_id uuid, shop_name text, subtotal_gnf integer, discount_gnf integer, reason text)
language sql stable security definer set search_path = public, pg_temp as $$
  with lines as (
    select o.shop_id, sum(o.price_gnf * greatest(1, least(99, coalesce((e->>'qty')::int, 1))))::integer as sub
      from jsonb_array_elements(case when jsonb_typeof(p_items) = 'array' then p_items else '[]'::jsonb end) e
      join public.offers o on o.id = (e->>'offer_id')::uuid and o.active
     group by o.shop_id
  )
  select l.shop_id, s.name, l.sub, r.discount_gnf, r.reason
    from lines l join public.shops s on s.id = l.shop_id
    cross join lateral private.promo_for(l.shop_id, p_code, l.sub, auth.uid()) r
   order by r.discount_gnf desc, s.name
$$;

-- ── Commande : la version précédente, plus le code promo facultatif ─────────────────────────────────────────────────────
drop function if exists public.fn_place_order(jsonb, uuid, text, text, text);
create or replace function public.fn_place_order(p_items jsonb, p_declaration uuid, p_phone text, p_payment text, p_source text default 'application', p_promo text default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid uuid := auth.uid();
  v_order uuid;
  v_level integer;
  b_lat double precision; b_lng double precision;
  it record;
  o public.offers; sh public.shops; v public.offer_variants;
  v_parcel uuid;
  s_lat double precision; s_lng double precision;
  km numeric; fee integer; sub integer; total_sub integer := 0; total_fee integer := 0;
  pr record; r record; v_applied integer := 0;
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

    v_parcel := null;
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

  -- Code promo : appliqué à chaque colis dont la boutique a ce code ; le sous-total du colis devient le montant réduit
  -- (la part du vendeur et la commission se calculent dessus). Un code saisi qui ne s'applique nulle part fait échouer la commande.
  if nullif(btrim(coalesce(p_promo, '')), '') is not null then
    for pr in select p.id, p.shop_id, p.subtotal_gnf from public.parcels p where p.order_id = v_order loop
      select * into r from private.promo_for(pr.shop_id, p_promo, pr.subtotal_gnf, uid);
      if r.promo_id is not null and r.discount_gnf > 0 then
        update public.parcels set subtotal_gnf = subtotal_gnf - r.discount_gnf, discount_gnf = r.discount_gnf, promo_code = upper(btrim(p_promo)) where id = pr.id;
        insert into public.promo_uses (promo_id, parcel_id, buyer_id, discount_gnf) values (r.promo_id, pr.id, uid, r.discount_gnf);
        total_sub := total_sub - r.discount_gnf; v_applied := v_applied + 1;
      end if;
    end loop;
    if v_applied = 0 then raise exception 'code promo non valable pour ce panier'; end if;
  end if;

  update public.parcels p set cod_amount_gnf = case when p_payment = 'livraison' then p.subtotal_gnf + p.delivery_fee_gnf else 0 end where p.order_id = v_order;
  update public.orders set subtotal_gnf = total_sub, delivery_fee_gnf = total_fee, total_gnf = total_sub + total_fee, payment_status = 'en_attente' where id = v_order;
  insert into public.delivery_events (parcel_id, kind, actor_id) select id, 'cree', uid from public.parcels where order_id = v_order;
  return v_order;
end $$;

revoke all on function public.fn_parcel_cancel(uuid, text), public.fn_seller_parcel(uuid), public.fn_promo_check(text, jsonb),
  public.fn_place_order(jsonb, uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.fn_parcel_cancel(uuid, text), public.fn_seller_parcel(uuid), public.fn_promo_check(text, jsonb),
  public.fn_place_order(jsonb, uuid, text, text, text, text) to authenticated;
revoke all on function private.promo_for(uuid, text, integer, uuid) from public, anon, authenticated;

commit;
