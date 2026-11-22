-- §64 : créneau et zone de livraison de la Flotte (HAILANDX.md §64).
-- Début de la Flotte : un livreur en scooter électrique, disponible du lundi au samedi de 14 h à 18 h, basé à Kobaya (Ratoma).
-- Réglages (Console → Paramètres, fondateur) : jours, heures du créneau, heure limite de commande pour être livré le jour même,
-- communes servies. Chaque commande garde la date de livraison promise (orders.delivery_date). Ajouts seulement.
-- Conakry est à l'heure UTC toute l'année (pas d'heure d'été) : les heures se comparent en UTC.
begin;

insert into public.settings (key, value) values
  ('livraison_jours', '1,2,3,4,5,6'),
  ('livraison_debut', '14:00'),
  ('livraison_fin', '18:00'),
  ('livraison_heure_limite', '13:00'),
  ('livraison_communes', 'com-ratoma')
on conflict (key) do nothing;

alter table public.orders add column if not exists delivery_date date;
comment on column public.orders.delivery_date is 'Jour de livraison promis à la commande (créneau du réglage livraison_debut–livraison_fin), §64';
grant select (delivery_date) on public.orders to authenticated;

create or replace function private.setting_text(p_key text, p_default text) returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select btrim(value) from public.settings where key = p_key), p_default)
$$;

-- Jour de livraison d'une commande passée à p_at : aujourd'hui si c'est un jour de livraison et avant l'heure limite,
-- sinon le prochain jour de livraison.
create or replace function private.delivery_date(p_at timestamptz) returns date
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  l timestamp := p_at at time zone 'UTC';
  v_jours int[] := coalesce(nullif(string_to_array(private.setting_text('livraison_jours', '1,2,3,4,5,6'), ','), '{}')::int[], array[1,2,3,4,5,6,7]);
  v_limite time := private.setting_text('livraison_heure_limite', '13:00')::time;
  d date := (p_at at time zone 'UTC')::date;
begin
  if extract(isodow from d)::int = any(v_jours) and l::time < v_limite then return d; end if;
  for i in 1..7 loop
    d := d + 1;
    if extract(isodow from d)::int = any(v_jours) then return d; end if;
  end loop;
  return l::date + 1;
end $$;

-- L'adresse est-elle dans une commune servie ? (commune de la déclaration, sinon celle de son quartier ; réglage vide = partout)
create or replace function private.delivery_zone_ok(p_declaration uuid) returns boolean
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_list text := private.setting_text('livraison_communes', ''); v_commune text;
begin
  if v_list = '' then return true; end if;
  select coalesce(d.commune_id, q.commune_id) into v_commune
    from public.declarations d left join public.quartiers q on q.id = d.quartier_id where d.id = p_declaration;
  return v_commune is not null and v_commune = any(string_to_array(v_list, ','));
end $$;

create or replace function private.delivery_zone_names() returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(string_agg(c.nom, ', ' order by c.nom), 'aucune commune')
    from public.communes c where c.id = any(string_to_array(private.setting_text('livraison_communes', ''), ','))
$$;
revoke all on function private.setting_text(text, text), private.delivery_date(timestamptz), private.delivery_zone_ok(uuid), private.delivery_zone_names() from public, anon, authenticated;

-- Ce que l'application montre avant la commande : prochain créneau et, pour une adresse du compte, si elle est servie.
create or replace function public.fn_delivery_window(p_declaration uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public, private, pg_temp as $$
declare
  v_jour date := private.delivery_date(now());
  v_list text := private.setting_text('livraison_communes', '');
  v_ok boolean; v_commune text;
begin
  if p_declaration is not null and auth.uid() is not null
     and exists (select 1 from public.declarations d where d.id = p_declaration and d.user_id = auth.uid()) then
    v_ok := private.delivery_zone_ok(p_declaration);
    select c.nom into v_commune from public.declarations d left join public.quartiers q on q.id = d.quartier_id
      left join public.communes c on c.id = coalesce(d.commune_id, q.commune_id) where d.id = p_declaration;
  end if;
  return jsonb_build_object(
    'jour', v_jour,
    'aujourdhui', v_jour = (now() at time zone 'UTC')::date,
    'debut', private.setting_text('livraison_debut', '14:00'),
    'fin', private.setting_text('livraison_fin', '18:00'),
    'limite', private.setting_text('livraison_heure_limite', '13:00'),
    'jours', private.setting_text('livraison_jours', '1,2,3,4,5,6'),
    'partout', v_list = '',
    'communes', coalesce((select jsonb_agg(c.nom order by c.nom) from public.communes c where c.id = any(string_to_array(v_list, ','))), '[]'::jsonb),
    'zone_ok', v_ok,
    'commune', v_commune);
end $$;
revoke all on function public.fn_delivery_window(uuid) from public;
grant execute on function public.fn_delivery_window(uuid) to anon, authenticated;

create or replace function public.fn_place_order(p_items jsonb, p_declaration uuid, p_phone text, p_payment text, p_source text default 'application', p_promo text default null)
returns uuid language plpgsql security definer set search_path = public, private, pg_temp as $$
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
  v_wallet uuid;
  v_until timestamptz;
begin
  if uid is null then raise exception 'connexion requise'; end if;
  if p_payment not in ('livraison', 'orange_money', 'hailandpay') then raise exception 'paiement non reconnu'; end if;
  if p_phone is null or p_phone !~ '^\+?[0-9 ]{8,16}$' then raise exception 'téléphone invalide'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'panier vide'; end if;
  if jsonb_array_length(p_items) > 50 then raise exception 'panier trop grand'; end if;
  -- Annulation tardive (§45) : après une commande en espèces annulée par l'acheteur alors que le livreur était parti, le
  -- paiement à la livraison est suspendu 30 jours (le déplacement du livreur a été payé par Hailand) ; en ligne ou HailandPay restent possibles.
  if p_payment = 'livraison' then
    select max(e.created_at) + interval '30 days' into v_until from public.parcels x join public.orders xo on xo.id = x.order_id
      join public.delivery_events e on e.parcel_id = x.id and e.kind = 'annule'
     where xo.buyer_id = uid and xo.payment_method = 'livraison' and x.cancelled_by = 'acheteur' and x.cancel_courier_gnf > 0;
    if v_until > now() then
      raise exception 'paiement à la livraison indisponible jusqu''au % : une commande en espèces a été annulée après le départ du livreur. Payez par Mobile Money ou HailandPay.', to_char(v_until, 'DD/MM');
    end if;
  end if;

  -- Adresse de livraison : celle de l'acheteur, niveau 1 au minimum (Scorpion).
  select coalesce(st_y(coalesce(d.anchor_point, d.gps_point)), 0), coalesce(st_x(coalesce(d.anchor_point, d.gps_point)), 0)
    into b_lat, b_lng from public.declarations d where d.id = p_declaration and d.user_id = uid;
  if not found then raise exception 'adresse de livraison introuvable pour ce compte'; end if;
  v_level := public.fn_declaration_level(p_declaration);
  if v_level is null or v_level < 1 then raise exception 'livraison impossible : adresse non enregistrée'; end if;
  -- Zone de livraison (§64) : les communes servies par la Flotte (réglage Console « livraison_communes » ; vide = partout).
  if not private.delivery_zone_ok(p_declaration) then
    raise exception 'livraison pas encore disponible à cette adresse : Hailand livre pour l''instant à %', private.delivery_zone_names();
  end if;

  insert into public.orders (buyer_id, delivery_declaration_id, buyer_phone, payment_method, subtotal_gnf, delivery_fee_gnf, total_gnf, source, delivery_date)
  values (uid, p_declaration, btrim(p_phone), p_payment, 0, 0, 0, p_source, private.delivery_date(now())) returning id into v_order;

  -- Parcours des lignes : un colis par boutique.
  for it in select (e->>'offer_id')::uuid as offer_id, nullif(e->>'variant_id', '')::uuid as variant_id, greatest(1, least(99, coalesce((e->>'qty')::int, 1))) as qty
            from jsonb_array_elements(p_items) e order by 1
  loop
    select * into o from public.offers where id = it.offer_id and active;
    if not found then raise exception 'produit indisponible'; end if;
    select * into sh from public.shops where id = o.shop_id;
    if sh.status <> 'ouverte' then raise exception 'la boutique % n''est pas encore ouverte à la vente', sh.name; end if;
    -- Mode vacances : la vitrine reste visible, les commandes sont fermées jusqu'à la date de retour.
    if sh.vacation_until is not null and sh.vacation_until >= current_date then raise exception 'la boutique % est en congé jusqu''au %', sh.name, to_char(sh.vacation_until, 'DD/MM'); end if;
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
      -- Frais : réglages de la Console (base + prix par km à vol d'oiseau, arrondi à 500, minimum) — private.delivery_fee.
      fee := private.delivery_fee(km);
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
  -- HailandPay : le portefeuille de l'acheteur est débité tout de suite ; l'argent reste bloqué (séquestre) jusqu'à la remise.
  if p_payment = 'hailandpay' then
    v_wallet := private.wallet_of_user(uid);
    perform private.wallet_move(v_wallet, 'paiement', -(total_sub + total_fee)::bigint, v_order, null, null, null, null);
    insert into public.payments (order_id, provider, amount_gnf, status, paid_at) values (v_order, 'hailandpay', total_sub + total_fee, 'paye', now());
    update public.orders set payment_status = 'bloque' where id = v_order;
    insert into public.ledger_entries (account, order_id, kind, amount_gnf) values ('escrow', v_order, 'paiement', total_sub + total_fee);
  end if;
  insert into public.delivery_events (parcel_id, kind, actor_id) select id, 'cree', uid from public.parcels where order_id = v_order;
  return v_order;
end $$;

create or replace function public.fn_console_setting_update(p_key text, p_value text, p_motif text) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_old text; v_new text := btrim(coalesce(p_value, ''));
begin
  if not public.fn_is_fondateur() then raise exception 'paramètres : réservé au fondateur'; end if;
  if length(btrim(coalesce(p_motif, ''))) < 3 then raise exception 'paramètres : indiquez un motif'; end if;
  if p_key in ('commission_bps', 'courier_share_bps', 'cancel_fee_accepte_bps', 'cancel_fee_retire_bps') then
    if v_new !~ '^\d{1,5}$' or v_new::int > 10000 then raise exception 'paramètres : valeur hors limites (0 à 100 %%)'; end if;
  elsif p_key in ('delivery_base_gnf', 'delivery_min_gnf') then
    if v_new !~ '^\d{1,7}$' or v_new::int > 1000000 then raise exception 'paramètres : montant hors limites (0 à 1 000 000 GNF)'; end if;
  elsif p_key = 'delivery_per_km_gnf' then
    if v_new !~ '^\d{1,6}$' or v_new::int > 100000 then raise exception 'paramètres : prix par km hors limites (0 à 100 000 GNF)'; end if;
  elsif p_key = 'payment_mode' then
    if v_new not in ('simulation', 'chapchappay_test', 'chapchappay', 'djomy_test', 'djomy') then raise exception 'paramètres : mode de paiement inconnu'; end if;
  elsif p_key = 'livraison_jours' then
    if v_new !~ '^[1-7](,[1-7]){0,6}$' then raise exception 'paramètres : jours de livraison illisibles (1 = lundi … 7 = dimanche)'; end if;
  elsif p_key in ('livraison_debut', 'livraison_fin', 'livraison_heure_limite') then
    if v_new !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'paramètres : heure illisible (ex. 14:00)'; end if;
  elsif p_key = 'livraison_communes' then
    if v_new <> '' and (v_new !~ '^[a-z0-9-]+(,[a-z0-9-]+)*$'
        or exists (select 1 from unnest(string_to_array(v_new, ',')) x where not exists (select 1 from public.communes c where c.id = x))) then
      raise exception 'paramètres : commune inconnue';
    end if;
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

commit;
