-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- FLOTTE : BÂTIMENTS EXACTS, CONTOURS DE RETRAIT ET DE DÉPÔT, PLAFOND D'ESPÈCES CLAIR (retour du fondateur, 2026-10-21).
--
-- 1. Le principe de Hailand est la précision au bâtiment : les points de retrait et de dépôt sont désormais le bâtiment certifié
--    lui-même (point intérieur au contour certifié), et le dépôt n'est plus arrondi à ≈ 300 m sur la carte des missions
--    (décision du fondateur : un point approximatif sur une adresse certifiée de niveau 3 est inacceptable).
--    Restent cachés avant l'acceptation : téléphone, code Hailand, étage, porte, repère de l'acheteur.
-- 2. Les contours des deux bâtiments (retrait, dépôt) sont renvoyés pour être surlignés dans Flotte.
-- 3. Refus d'une mission au-delà du plafond d'espèces : message exact (montant à encaisser, plafond, déjà en main).
-- 4. Hailand Console : le fondateur règle le plafond d'espèces d'un livreur (journalisé).
-- Remplacements de fonctions et ajout de fonctions ; aucune donnée existante n'est modifiée.
-- APPLIQUÉE EN PRODUCTION le 2026-10-21 (accord du fondateur), en deux migrations : flotte_batiments_exacts_points,
-- flotte_batiments_exacts_mission_plafond. Vérifié : mission en attente → retrait et dépôt à 0 m de leurs bâtiments certifiés, contours renvoyés.
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

/** Point du bâtiment d'une déclaration : intérieur au contour certifié s'il existe, sinon point d'ancrage, sinon point GPS. */
create or replace function public.fn_declaration_point(p_declaration uuid)
returns public.geometry language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(st_pointonsurface(b.geom_pg), d.anchor_point, d.gps_point)
  from public.declarations d left join public.buildings b on b.id = d.certified_building_id
  where d.id = p_declaration
$$;
revoke all on function public.fn_declaration_point(uuid) from public, anon, authenticated;

/** Contour à surligner : bâtiment certifié, sinon contour repéré (OpenStreetMap), sinon rien. */
create or replace function public.fn_declaration_outline(p_declaration uuid)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select st_asgeojson(coalesce(b.geom_pg, d.osm_polygon_geom))::jsonb
  from public.declarations d left join public.buildings b on b.id = d.certified_building_id
  where d.id = p_declaration
$$;
revoke all on function public.fn_declaration_outline(uuid) from public, anon, authenticated;

-- ── 1–2. Carte des missions : points exacts et contours ──────────────────────────────────────────────────────────────────
create or replace function public.fn_missions_carte(p_lat double precision, p_lng double precision, p_radius_km numeric default 8)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(m order by (m->>'pickup_m')::int), '[]'::jsonb) from (
    select jsonb_build_object(
      'parcel_id', p.id, 'fee_gnf', p.delivery_fee_gnf, 'distance_km', p.distance_km, 'cod_amount_gnf', p.cod_amount_gnf, 'created_at', p.created_at,
      'pickup_m', round(public.fn_haversine_m(p_lat, p_lng, st_y(sp), st_x(sp)))::int,
      'from_name', s.name, 'from_quartier', sq.nom, 'from_commune', sc.nom, 'from_level', public.fn_declaration_level(sd.id),
      'from_lat', st_y(sp), 'from_lng', st_x(sp), 'from_outline', public.fn_declaration_outline(sd.id),
      'to_quartier', bq.nom, 'to_commune', bc.nom, 'to_level', public.fn_declaration_level(bd.id),
      'to_lat', st_y(bp), 'to_lng', st_x(bp), 'to_outline', public.fn_declaration_outline(bd.id)
    ) as m
    from public.parcels p
    join public.shops s on s.id = p.shop_id
    join public.declarations sd on sd.id = s.declaration_id
    cross join lateral (select public.fn_declaration_point(sd.id) as sp) xs
    left join public.quartiers sq on sq.id = sd.quartier_id
    left join public.communes sc on sc.id = sd.commune_id
    join public.orders o on o.id = p.order_id
    join public.declarations bd on bd.id = o.delivery_declaration_id
    cross join lateral (select public.fn_declaration_point(bd.id) as bp) xb
    left join public.quartiers bq on bq.id = bd.quartier_id
    left join public.communes bc on bc.id = bd.commune_id
    where p.status = 'mission_proposee'
      and exists (select 1 from public.couriers c where c.user_id = auth.uid() and c.status = 'valide' and c.available)
      and public.fn_haversine_m(p_lat, p_lng, st_y(sp), st_x(sp)) <= least(p_radius_km, 20) * 1000
  ) t
$$;
revoke all on function public.fn_missions_carte(double precision, double precision, numeric) from public, anon;
grant execute on function public.fn_missions_carte(double precision, double precision, numeric) to authenticated;

-- ── Mission acceptée : mêmes points exacts ────────────────────────────────────────────────────────────────────────────────
create or replace function public.fn_mission_detail(p_parcel uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'status', p.status,
    'fee_gnf', p.delivery_fee_gnf,
    'distance_km', p.distance_km,
    'cod_amount_gnf', p.cod_amount_gnf,
    'handover_failures', p.handover_failures,
    'pickup', jsonb_build_object(
      'name', s.name,
      'phone', coalesce(nullif(btrim(s.whatsapp), ''), su.phone::text),
      'lat', st_y(public.fn_declaration_point(sd.id)),
      'lng', st_x(public.fn_declaration_point(sd.id)),
      'quartier', sq.nom, 'commune', sc.nom, 'code', sd.hailand_code,
      'level', public.fn_declaration_level(sd.id),
      'landmark', sd.declared_landmark, 'floor', sd.location_floor, 'door', sd.location_door,
      'outline', public.fn_declaration_outline(sd.id)
    ),
    'dropoff', jsonb_build_object(
      'phone', o.buyer_phone,
      'lat', st_y(public.fn_declaration_point(bd.id)),
      'lng', st_x(public.fn_declaration_point(bd.id)),
      'quartier', bq.nom, 'commune', bc.nom, 'code', bd.hailand_code,
      'level', public.fn_declaration_level(bd.id), 'accuracy_m', bd.gps_accuracy_m,
      'landmark', bd.declared_landmark, 'floor', bd.location_floor, 'door', bd.location_door,
      'outline', public.fn_declaration_outline(bd.id)
    )
  )
  from public.parcels p
  join public.shops s on s.id = p.shop_id
  join public.declarations sd on sd.id = s.declaration_id
  left join auth.users su on su.id = s.owner_id
  left join public.quartiers sq on sq.id = sd.quartier_id
  left join public.communes sc on sc.id = sd.commune_id
  join public.orders o on o.id = p.order_id
  join public.declarations bd on bd.id = o.delivery_declaration_id
  left join public.quartiers bq on bq.id = bd.quartier_id
  left join public.communes bc on bc.id = bd.commune_id
  where p.id = p_parcel and p.courier_id = auth.uid() and p.status in ('accepte', 'retire')
$$;
revoke all on function public.fn_mission_detail(uuid) from public, anon;
grant execute on function public.fn_mission_detail(uuid) to authenticated;

/** Montant lisible pour un message : 865500 → « 865 500 ». */
create or replace function public.fn_gnf(p integer) returns text language sql immutable set search_path = public, pg_temp as $$
  select replace(to_char(p, 'FM999,999,999,999'), ',', ' ')
$$;

-- ── 3. Acceptation : message exact quand la mission dépasse le plafond d'espèces ─────────────────────────────────────────
create or replace function public.fn_courier_accept(p_parcel uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare c public.couriers; p public.parcels;
begin
  select * into c from public.couriers where user_id = auth.uid();
  if not found or c.status <> 'valide' then raise exception 'compte livreur non validé'; end if;
  if not c.available then raise exception 'vous êtes indisponible'; end if;
  update public.parcels set status = 'accepte', courier_id = c.user_id where id = p_parcel and status = 'mission_proposee' returning * into p;
  if not found then raise exception 'mission déjà prise ou indisponible'; end if;
  if c.cash_balance_gnf + p.cod_amount_gnf > c.cash_limit_gnf then
    update public.parcels set status = 'mission_proposee', courier_id = null where id = p_parcel;
    if c.cash_balance_gnf = 0 then
      raise exception 'plafond d''espèces : cette mission demande d''encaisser % GNF, plus que votre plafond de % GNF. Demandez à l''équipe Hailand de le relever.',
        public.fn_gnf(p.cod_amount_gnf), public.fn_gnf(c.cash_limit_gnf);
    end if;
    raise exception 'plafond d''espèces : vous avez déjà % GNF en main ; avec les % GNF de cette mission, vous dépasseriez votre plafond de % GNF. Reversez vos espèces ou demandez à l''équipe de relever le plafond.',
      public.fn_gnf(c.cash_balance_gnf), public.fn_gnf(p.cod_amount_gnf), public.fn_gnf(c.cash_limit_gnf);
  end if;
  insert into public.delivery_events (parcel_id, kind, actor_id) values (p_parcel, 'accepte', c.user_id);
  return 'accepte';
end $$;

-- ── 4. Console : plafond d'espèces d'un livreur (fondateur, journalisé) ──────────────────────────────────────────────────
create or replace function public.fn_console_courier_cash_limit(p_courier uuid, p_limit integer, p_motif text)
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare v_old integer;
begin
  if not public.fn_is_fondateur() then raise exception 'plafond d''espèces : réservé au fondateur'; end if;
  if length(btrim(coalesce(p_motif, ''))) < 3 then raise exception 'plafond d''espèces : indiquez un motif'; end if;
  if p_limit is null or p_limit < 0 or p_limit > 20000000 then raise exception 'plafond d''espèces : entre 0 et 20 000 000 GNF'; end if;
  select cash_limit_gnf into v_old from public.couriers where user_id = p_courier;
  if not found then raise exception 'livreur introuvable'; end if;
  update public.couriers set cash_limit_gnf = p_limit where user_id = p_courier;
  perform private.journal('livreur_plafond', 'livreur', p_courier::text, jsonb_build_object('avant', v_old, 'apres', p_limit), btrim(p_motif));
  return p_limit;
end $$;
revoke execute on function public.fn_console_courier_cash_limit(uuid, integer, text) from public, anon;
grant execute on function public.fn_console_courier_cash_limit(uuid, integer, text) to authenticated;
