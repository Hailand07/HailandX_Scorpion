-- Tarifs de livraison modifiables dans la Console (HAILANDX.md §44). Demande du fondateur le 2026-10-25 : « on va rendre les
-- tarifs modifiables dans la console ». Frais d'un colis = base + prix par km × distance à vol d'oiseau (boutique → adresse),
-- arrondis à 500 GNF, jamais sous le minimum. Valeurs de départ = valeurs actuelles (6 000 + 2 100/km, minimum 8 000) : seul
-- le fondateur les change (Console → Paramètres, motif au journal). Les colis déjà commandés gardent leurs frais. Idempotente.
begin;

insert into public.settings (key, value) values ('delivery_base_gnf', '6000'), ('delivery_per_km_gnf', '2100'), ('delivery_min_gnf', '8000')
  on conflict (key) do nothing;

create or replace function private.delivery_fee(p_km numeric) returns integer
language sql stable security definer set search_path = public, private, pg_temp as $$
  select greatest(private.setting_int('delivery_min_gnf', 8000),
    (round((private.setting_int('delivery_base_gnf', 6000) + private.setting_int('delivery_per_km_gnf', 2100) * greatest(coalesce(p_km, 0), 0)) / 500.0) * 500)::integer)
$$;
revoke all on function private.delivery_fee(numeric) from public, anon, authenticated;

-- Aperçu pour la Console : frais pour une distance donnée avec les réglages actuels.
create or replace function public.fn_delivery_fee_preview(p_km numeric) returns integer
language sql stable security definer set search_path = public, private, pg_temp as $$ select private.delivery_fee(p_km) $$;
revoke all on function public.fn_delivery_fee_preview(numeric) from public, anon;
grant execute on function public.fn_delivery_fee_preview(numeric) to authenticated;

create or replace function public.fn_console_setting_update(p_key text, p_value text, p_motif text) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_old text; v_new text := btrim(coalesce(p_value, ''));
begin
  if not public.fn_is_fondateur() then raise exception 'paramètres : réservé au fondateur'; end if;
  if length(btrim(coalesce(p_motif, ''))) < 3 then raise exception 'paramètres : indiquez un motif'; end if;
  if p_key in ('commission_bps', 'courier_share_bps') then
    if v_new !~ '^\d{1,5}$' or v_new::int > 10000 then raise exception 'paramètres : valeur hors limites (0 à 100 %%)'; end if;
  elsif p_key in ('delivery_base_gnf', 'delivery_min_gnf') then
    if v_new !~ '^\d{1,7}$' or v_new::int > 1000000 then raise exception 'paramètres : montant hors limites (0 à 1 000 000 GNF)'; end if;
  elsif p_key = 'delivery_per_km_gnf' then
    if v_new !~ '^\d{1,6}$' or v_new::int > 100000 then raise exception 'paramètres : prix par km hors limites (0 à 100 000 GNF)'; end if;
  elsif p_key = 'payment_mode' then
    if v_new not in ('simulation', 'chapchappay_test', 'chapchappay') then raise exception 'paramètres : mode de paiement inconnu'; end if;
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

create or replace function public.fn_delivery_quote(p_declaration uuid, p_offers uuid[])
returns table (shop_id uuid, shop_name text, distance_km numeric, fee_gnf integer)
language plpgsql stable security definer set search_path = public, private, pg_temp as $$
declare b_lat double precision; b_lng double precision;
begin
  select st_y(coalesce(d.anchor_point, d.gps_point)), st_x(coalesce(d.anchor_point, d.gps_point)) into b_lat, b_lng
    from public.declarations d where d.id = p_declaration and d.user_id = auth.uid();
  if not found then raise exception 'adresse de livraison introuvable pour ce compte'; end if;
  return query
    select s.id, s.name, k.km, private.delivery_fee(k.km)
      from public.shops s
      join public.declarations sd on sd.id = s.declaration_id
      cross join lateral (select round((public.fn_haversine_m(st_y(coalesce(sd.anchor_point, sd.gps_point)), st_x(coalesce(sd.anchor_point, sd.gps_point)), b_lat, b_lng) / 1000.0)::numeric, 2) as km) k
     where s.id in (select o.shop_id from public.offers o where o.id = any(p_offers))
     order by s.name;
end $$;

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
begin
  if uid is null then raise exception 'connexion requise'; end if;
  if p_payment not in ('livraison', 'orange_money', 'hailandpay') then raise exception 'paiement non reconnu'; end if;
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

commit;
