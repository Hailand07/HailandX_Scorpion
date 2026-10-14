-- Hailand Flotte, navigation plein écran (étape 3 du plan, HAILANDX.md §27 et §30) : fiche de mission à deux arrêts et carte des
-- missions disponibles. Ajouts seulement (deux fonctions de lecture, aucune table modifiée). Idempotent.
-- Les fonctions renvoient du JSON : de nouveaux champs pourront s'ajouter sans supprimer la fonction (pas de DROP).
begin;

-- ── 1. Fiche de la mission acceptée : retrait et dépôt, réservée au livreur attribué ────────────────────────────────────────
-- Retrait : boutique, téléphone (WhatsApp de la boutique, sinon numéro du vendeur), point, quartier, commune, code, repère, contour.
-- Dépôt : téléphone et point exact de l'acheteur, niveau, précision, étage, porte, repère, quartier, commune, code, contour.
-- Contour : celui du bâtiment certifié (HailandMap) s'il existe, sinon le contour repéré à la déclaration ; null sinon.
create or replace function public.fn_mission_detail(p_parcel uuid)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'status', p.status,
    'fee_gnf', p.delivery_fee_gnf,
    'distance_km', p.distance_km,
    'cod_amount_gnf', p.cod_amount_gnf,
    'handover_failures', p.handover_failures,
    'pickup', jsonb_build_object(
      'name', s.name,
      'phone', coalesce(nullif(btrim(s.whatsapp), ''), su.phone::text),
      'lat', st_y(coalesce(sd.anchor_point, sd.gps_point)),
      'lng', st_x(coalesce(sd.anchor_point, sd.gps_point)),
      'quartier', sq.nom, 'commune', sc.nom, 'code', sd.hailand_code,
      'level', public.fn_declaration_level(sd.id),
      'landmark', sd.declared_landmark, 'floor', sd.location_floor, 'door', sd.location_door,
      'outline', st_asgeojson(coalesce(sb.geom_pg, sd.osm_polygon_geom))::jsonb
    ),
    'dropoff', jsonb_build_object(
      'phone', o.buyer_phone,
      'lat', st_y(coalesce(bd.anchor_point, bd.gps_point)),
      'lng', st_x(coalesce(bd.anchor_point, bd.gps_point)),
      'quartier', bq.nom, 'commune', bc.nom, 'code', bd.hailand_code,
      'level', public.fn_declaration_level(bd.id), 'accuracy_m', bd.gps_accuracy_m,
      'landmark', bd.declared_landmark, 'floor', bd.location_floor, 'door', bd.location_door,
      'outline', st_asgeojson(coalesce(bb.geom_pg, bd.osm_polygon_geom))::jsonb
    )
  )
  from public.parcels p
  join public.shops s on s.id = p.shop_id
  join public.declarations sd on sd.id = s.declaration_id
  left join auth.users su on su.id = s.owner_id
  left join public.quartiers sq on sq.id = sd.quartier_id
  left join public.communes sc on sc.id = sd.commune_id
  left join public.buildings sb on sb.id = sd.certified_building_id
  join public.orders o on o.id = p.order_id
  join public.declarations bd on bd.id = o.delivery_declaration_id
  left join public.quartiers bq on bq.id = bd.quartier_id
  left join public.communes bc on bc.id = bd.commune_id
  left join public.buildings bb on bb.id = bd.certified_building_id
  where p.id = p_parcel and p.courier_id = auth.uid() and p.status in ('accepte', 'retire')
$$;
revoke all on function public.fn_mission_detail(uuid) from public, anon;
grant execute on function public.fn_mission_detail(uuid) to authenticated;

-- ── 2. Carte des missions disponibles (livreur validé et disponible) ───────────────────────────────────────────────────
-- Avant l'acceptation, le dépôt n'est donné qu'à environ 300 m près (quartier, commune, point arrondi) : l'adresse exacte et
-- le téléphone de l'acheteur restent réservés au livreur qui accepte (fn_mission_detail).
create or replace function public.fn_missions_carte(p_lat double precision, p_lng double precision, p_radius_km numeric default 8)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(m order by (m->>'pickup_m')::int), '[]'::jsonb) from (
    select jsonb_build_object(
      'parcel_id', p.id, 'fee_gnf', p.delivery_fee_gnf, 'distance_km', p.distance_km, 'cod_amount_gnf', p.cod_amount_gnf, 'created_at', p.created_at,
      'pickup_m', round(public.fn_haversine_m(p_lat, p_lng, st_y(coalesce(sd.anchor_point, sd.gps_point)), st_x(coalesce(sd.anchor_point, sd.gps_point))))::int,
      'from_name', s.name, 'from_quartier', sq.nom, 'from_commune', sc.nom,
      'from_lat', st_y(coalesce(sd.anchor_point, sd.gps_point)), 'from_lng', st_x(coalesce(sd.anchor_point, sd.gps_point)),
      'to_quartier', bq.nom, 'to_commune', bc.nom, 'to_level', public.fn_declaration_level(bd.id),
      'to_lat', round((st_y(coalesce(bd.anchor_point, bd.gps_point)) / 0.003)::numeric) * 0.003,
      'to_lng', round((st_x(coalesce(bd.anchor_point, bd.gps_point)) / 0.003)::numeric) * 0.003
    ) as m
    from public.parcels p
    join public.shops s on s.id = p.shop_id
    join public.declarations sd on sd.id = s.declaration_id
    left join public.quartiers sq on sq.id = sd.quartier_id
    left join public.communes sc on sc.id = sd.commune_id
    join public.orders o on o.id = p.order_id
    join public.declarations bd on bd.id = o.delivery_declaration_id
    left join public.quartiers bq on bq.id = bd.quartier_id
    left join public.communes bc on bc.id = bd.commune_id
    where p.status = 'mission_proposee'
      and exists (select 1 from public.couriers c where c.user_id = auth.uid() and c.status = 'valide' and c.available)
      and public.fn_haversine_m(p_lat, p_lng, st_y(coalesce(sd.anchor_point, sd.gps_point)), st_x(coalesce(sd.anchor_point, sd.gps_point))) <= least(p_radius_km, 20) * 1000
  ) t
$$;
revoke all on function public.fn_missions_carte(double precision, double precision, numeric) from public, anon;
grant execute on function public.fn_missions_carte(double precision, double precision, numeric) to authenticated;

commit;
