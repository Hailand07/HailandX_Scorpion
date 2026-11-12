-- HAILANDX.md §51 (2026-11-12) : adresse montrée sans GPS fiable, et photo du portail pour le livreur.
--  * declarations.located_by : 'gps' (mesuré sur place, cas normal), 'hors_cercle' (sur place, bâtiment montré hors du cercle
--    après des tentatives GPS ratées), 'a_distance' (montré sans y être). Pour les deux derniers : le point montré est gardé
--    quelle que soit sa distance au GPS, et AUCUN rattachement à un bâtiment certifié n'est fait (ni demandé, ni automatique) :
--    on ne devient pas « niveau 3 » en touchant une carte. Le livreur confirmera l'endroit.
--  * declarations.gate_photo_path : photo du portail ou de l'entrée (stockage hx-media), montrée au livreur.
-- Aucune suppression. Les fonctions de déclencheur reprennent le texte en production (2026-11-12), avec ces seuls ajouts.

alter table public.declarations add column if not exists located_by text not null default 'gps' check (located_by in ('gps', 'hors_cercle', 'a_distance'));
alter table public.declarations add column if not exists gate_photo_path text check (gate_photo_path is null or length(gate_photo_path) <= 300);

create or replace function public.trg_fn_declarations_before_insert()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare
  anchor geometry; a record; reg_code text; pp int; cc int; qq int; seq int; scope text; bl record;
  free boolean := coalesce(new.located_by, 'gps') <> 'gps';
  requested text := new.certified_building_id; lim double precision := greatest(100, coalesce(new.gps_accuracy_m, 0));
begin
  if new.osm_polygon_geom is not null then
    anchor := st_pointonsurface(new.osm_polygon_geom);
  elsif new.anchor_point is not null and new.gps_point is not null
        and (free or st_distance(new.anchor_point::geography, new.gps_point::geography) <= lim) then
    anchor := st_setsrid(new.anchor_point, 4326);
  else
    anchor := new.gps_point;
  end if;
  -- Bâtiment certifié confirmé visuellement par l'utilisateur (jamais pour une adresse montrée sans GPS fiable).
  new.certified_building_id := null; new.link_method := null; new.linked_at := null;
  if requested is not null and new.gps_point is not null and not free then
    select b.id, b.admin_code, b.admin_seq, b.geom_pg into bl from public.buildings b
     where b.id = requested and b.status = 'actif' and b.is_validated is true and b.geom_pg is not null
       and st_dwithin(b.geom_pg::geography, new.gps_point::geography, lim);
    if bl.id is not null then
      new.certified_building_id := bl.id; new.link_method := 'resident'; new.linked_at := now();
      if not st_contains(bl.geom_pg, anchor) then anchor := st_pointonsurface(bl.geom_pg); end if;
    end if;
  end if;
  new.anchor_point := anchor;
  select * into a from fn_resolve_admin_address(st_x(anchor), st_y(anchor));
  if a.commune_id is null or a.region_id is null then
    raise exception 'ADRESSE_ADMINISTRATIVE_INTROUVABLE' using errcode = 'P0001',
      hint = 'Le point se trouve hors des zones administratives connues.';
  end if;
  new.region_id := a.region_id; new.prefecture_id := a.prefecture_id; new.commune_id := a.commune_id;
  new.quartier_id := a.quartier_id; new.admin_source := a.source;
  new.detected_level := case when new.osm_polygon_geom is not null then 2 else 1 end;

  if new.certified_building_id is null then
    -- Adresse montrée sans GPS fiable : aucune recherche (la requête ne renvoie rien, `bl` reste vide).
    select b.id, b.admin_code, b.admin_seq, b.geom_pg into bl from public.buildings b
     where b.id = case when free then null else public.fn_find_certified_building(anchor) end;
    if bl.id is not null then
      new.certified_building_id := bl.id; new.link_method := 'gps_auto'; new.linked_at := now();
    end if;
  end if;
  if new.unit_id is not null and (bl.id is null or not exists (select 1 from public.building_units u where u.id = new.unit_id and u.building_id = bl.id)) then
    new.unit_id := null;
  end if;

  seq := null;
  if bl.admin_code is not null then
    seq := bl.admin_seq;
  elsif new.osm_polygon_geom is not null then
    select d.building_seq into seq
    from declarations d
    where d.commune_id = new.commune_id
      and d.quartier_id is not distinct from new.quartier_id
      and d.osm_polygon_geom is not null and d.building_seq is not null
      and (
        (new.osm_polygon_id is not null and d.osm_polygon_id = new.osm_polygon_id)
        or (st_intersects(d.osm_polygon_geom, new.osm_polygon_geom)
            and st_area(st_intersection(st_makevalid(d.osm_polygon_geom), st_makevalid(new.osm_polygon_geom))::geography)
                >= 0.6 * least(st_area(d.osm_polygon_geom::geography), st_area(new.osm_polygon_geom::geography)))
      )
    order by d.created_at limit 1;
  end if;

  if seq is null then
    scope := coalesce(new.quartier_id, new.commune_id);
    insert into quartier_counters (scope_id, last_seq) values (scope, 1)
    on conflict (scope_id) do update set last_seq = quartier_counters.last_seq + 1
    returning last_seq into seq;
  end if;
  new.building_seq := seq;

  if bl.admin_code is not null then
    new.hailand_code := bl.admin_code;
  else
    select code into reg_code from regions where id = new.region_id;
    pp := case when new.prefecture_id is null then 0 else fn_admin_ordinal('prefecture', new.prefecture_id, new.region_id) end;
    cc := case when new.prefecture_id is null then 0 else fn_admin_ordinal('commune', new.commune_id, new.prefecture_id) end;
    qq := case when new.quartier_id is null then 0 else fn_admin_ordinal('quartier', new.quartier_id, new.commune_id) end;
    new.hailand_code := format('GN-%s-%s-%s-%s-%s', reg_code, lpad(pp::text, 2, '0'), lpad(cc::text, 2, '0'), lpad(qq::text, 3, '0'), lpad(seq::text, 4, '0'));
  end if;

  new.status := 'active';
  return new;
end $function$;

-- Mise à jour : la façon dont l'adresse a été donnée ne se modifie pas (la photo du portail, si : le résident peut la refaire).
create or replace function public.trg_fn_declarations_before_update()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
declare linking boolean := coalesce(current_setting('hailand.link', true), 'off') = 'on';
begin
  new.user_id := old.user_id; new.gps_point := old.gps_point; new.gps_accuracy_m := old.gps_accuracy_m;
  new.osm_polygon_id := old.osm_polygon_id; new.osm_polygon_geom := old.osm_polygon_geom; new.detected_level := old.detected_level;
  new.region_id := old.region_id; new.prefecture_id := old.prefecture_id; new.commune_id := old.commune_id;
  new.quartier_id := old.quartier_id; new.admin_source := old.admin_source;
  new.located_by := old.located_by;
  if old.anchor_point is not null then new.anchor_point := old.anchor_point; end if;
  new.building_seq := old.building_seq; new.hailand_code := old.hailand_code; new.created_at := old.created_at;
  if not linking then
    new.certification_note := old.certification_note; new.certification_decided_at := old.certification_decided_at;
    if new.certification_status is distinct from old.certification_status then
      if new.certification_status = 'demandee' and old.certification_status is distinct from 'demandee' then
        new.certification_requested_at := now(); new.certification_note := null; new.certification_decided_at := null;
      else
        new.certification_status := old.certification_status;
      end if;
    end if;
    if new.certification_status is not distinct from old.certification_status then
      new.certification_requested_at := old.certification_requested_at;
    end if;
    if new.certified_building_id is distinct from old.certified_building_id then
      if old.certified_building_id is not null and exists (
           select 1 from buildings b where b.id = new.certified_building_id and b.parent_building_id = old.certified_building_id
             and b.status = 'actif' and b.is_validated is true) then
        new.link_method := 'resident'; new.linked_at := now();
      else
        new.certified_building_id := old.certified_building_id;
      end if;
    end if;
    if not (new.certified_building_id is distinct from old.certified_building_id or new.unit_id is distinct from old.unit_id) then
      new.link_method := old.link_method; new.linked_at := old.linked_at;
    end if;
    if new.unit_id is not null and (new.certified_building_id is null or not exists (
         select 1 from building_units u where u.id = new.unit_id and u.building_id = new.certified_building_id and u.active)) then
      new.unit_id := old.unit_id;
    end if;
  end if;
  return new;
end $function$;

-- Mission du livreur : photo de l'entrée et façon dont l'adresse a été donnée (« à confirmer » si montrée sans GPS).
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
      'photo', sd.gate_photo_path, 'located_by', sd.located_by,
      'outline', public.fn_declaration_outline(sd.id)
    ),
    'dropoff', jsonb_build_object(
      'phone', o.buyer_phone,
      'lat', st_y(public.fn_declaration_point(bd.id)),
      'lng', st_x(public.fn_declaration_point(bd.id)),
      'quartier', bq.nom, 'commune', bc.nom, 'code', bd.hailand_code,
      'level', public.fn_declaration_level(bd.id), 'accuracy_m', bd.gps_accuracy_m,
      'landmark', bd.declared_landmark, 'floor', bd.location_floor, 'door', bd.location_door,
      'photo', bd.gate_photo_path, 'located_by', bd.located_by,
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
