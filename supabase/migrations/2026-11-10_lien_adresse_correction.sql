-- HAILANDX.md §51 (2026-11-13) : deux compléments de la localisation.
--
--  1. LIEN DE LOCALISATION. Le client qui commande pour quelqu'un d'autre (ou qui n'est pas chez lui) envoie un lien au
--     destinataire. Celui-ci l'ouvre SUR PLACE, sans compte, et repère son bâtiment avec le même parcours (GPS + satellite).
--     L'adresse est enregistrée au compte du DEMANDEUR (une ligne de `declarations`, mêmes règles : le déclencheur de la base
--     attribue le code et l'adresse administrative). Le lien sert une seule fois et expire après 72 heures.
--     Le libellé de l'adresse est « Autre » (seules valeurs admises : Domicile, Travail, Autre) ; le nom donné au lien
--     (« Maman ») reste dans `address_requests.label`, que l'application affiche (« Chez Maman »).
--  2. CORRECTION DU POINT PAR LE LIVREUR. Arrivé à la bonne porte alors que le point enregistré est faux, le livreur du colis
--     enregistre sa position comme point de remise : le contrôle de distance de la remise se fait alors sur ce point.
--     Borne : 600 m du point enregistré pour une adresse mesurée au GPS, 5 km pour une adresse montrée sur la carte.
--     Le code de remise (ou le scan) reste exigé : la correction ne remplace jamais la signature du client.
--
-- Aucune suppression. `fn_parcel_handover` et `fn_mission_detail` reprennent le texte en production (2026-11-13) avec ces seuls ajouts.

-- ── 1. Lien de localisation ─────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.address_requests (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default encode(gen_random_bytes(12), 'hex'),
  requester_id uuid not null,
  label text not null check (length(label) between 1 and 40),
  -- Pas de clé étrangère : `declarations` est une table partagée (HailandMap, NavigationX) ; on ne lui ajoute aucune dépendance.
  declaration_id uuid,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '72 hours',
  fulfilled_at timestamptz
);
create index if not exists address_requests_requester_idx on public.address_requests (requester_id, created_at desc);
alter table public.address_requests enable row level security;
-- Le demandeur lit ses propres demandes (pour voir arriver l'adresse) ; toute écriture passe par les fonctions ci-dessous.
create policy address_requests_select_own on public.address_requests for select to authenticated using (requester_id = auth.uid());
revoke insert, update, delete on public.address_requests from anon, authenticated;

create or replace function public.fn_address_request_create(p_label text)
returns text language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare lbl text := left(btrim(coalesce(p_label, '')), 40); t text;
begin
  if auth.uid() is null then raise exception 'connexion requise'; end if;
  if lbl = '' then lbl := 'Destinataire'; end if;
  if (select count(*) from public.address_requests where requester_id = auth.uid() and fulfilled_at is null and expires_at > now()) >= 10 then
    raise exception 'trop de liens en attente : attendez qu''ils soient utilisés ou qu''ils expirent';
  end if;
  insert into public.address_requests (requester_id, label) values (auth.uid(), lbl) returning token into t;
  return t;
end $$;
revoke execute on function public.fn_address_request_create(text) from public, anon;
grant execute on function public.fn_address_request_create(text) to authenticated;

-- État d'un lien, lisible par le destinataire sans compte : rien de personnel n'est renvoyé.
create or replace function public.fn_address_request_info(p_token text)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((
    select jsonb_build_object('label', r.label,
      'state', case when r.fulfilled_at is not null then 'faite' when r.expires_at <= now() then 'expiree' else 'ouverte' end)
    from public.address_requests r where r.token = p_token), jsonb_build_object('state', 'inconnue'))
$$;
grant execute on function public.fn_address_request_info(text) to anon, authenticated;

-- Le destinataire enregistre l'adresse : même contenu qu'une déclaration faite depuis l'application, au compte du demandeur.
create or replace function public.fn_address_request_fulfil(
  p_token text, p_lng double precision, p_lat double precision, p_accuracy real,
  p_anchor_lng double precision default null, p_anchor_lat double precision default null,
  p_osm_id text default null, p_polygon text default null, p_certified text default null,
  p_located_by text default 'gps', p_landmark text default null, p_floor text default null, p_door text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare r public.address_requests; d public.declarations; poly public.geometry; anc public.geometry;
begin
  select * into r from public.address_requests where token = p_token for update;
  if not found then raise exception 'lien inconnu'; end if;
  if r.fulfilled_at is not null then raise exception 'ce lien a déjà servi'; end if;
  if r.expires_at <= now() then raise exception 'ce lien a expiré : demandez-en un nouveau'; end if;
  if p_lng is null or p_lat is null or p_lng not between -180 and 180 or p_lat not between -90 and 90 then raise exception 'position invalide'; end if;
  if coalesce(p_located_by, 'gps') not in ('gps', 'hors_cercle') then raise exception 'ce lien s''utilise sur place'; end if;
  if p_polygon is not null then poly := st_setsrid(st_geomfromgeojson(p_polygon), 4326); end if;
  if p_anchor_lng is not null and p_anchor_lat is not null then anc := st_setsrid(st_makepoint(p_anchor_lng, p_anchor_lat), 4326); end if;
  begin
    insert into public.declarations (user_id, gps_point, gps_accuracy_m, osm_polygon_id, osm_polygon_geom, anchor_point, certified_building_id,
      located_by, detected_level, declared_label, location_floor, location_door, declared_landmark)
    values (r.requester_id, st_setsrid(st_makepoint(p_lng, p_lat), 4326), nullif(p_accuracy, 0), case when poly is null then null else p_osm_id end, poly, anc, p_certified,
      coalesce(p_located_by, 'gps'), case when poly is null then 1 else 2 end, 'Autre',
      nullif(left(btrim(coalesce(p_floor, '')), 40), ''), nullif(left(btrim(coalesce(p_door, '')), 40), ''), nullif(left(btrim(coalesce(p_landmark, '')), 200), ''))
    returning * into d;
  exception when unique_violation then
    raise exception 'cette adresse est déjà enregistrée pour ce compte';
  end;
  update public.address_requests set declaration_id = d.id, fulfilled_at = now() where id = r.id;
  return jsonb_build_object('id', d.id, 'hailand_code', d.hailand_code, 'level', d.detected_level,
    'certified_building_id', d.certified_building_id, 'located_by', d.located_by);
end $$;
grant execute on function public.fn_address_request_fulfil(text, double precision, double precision, real, double precision, double precision, text, text, text, text, text, text, text) to anon, authenticated;

-- ── 2. Correction du point de remise par le livreur ─────────────────────────────────────────────────────────────────────
alter table public.parcels add column if not exists dropoff_fix_lat double precision;
alter table public.parcels add column if not exists dropoff_fix_lng double precision;
alter table public.parcels add column if not exists dropoff_fix_at timestamptz;

create or replace function public.fn_mission_fix_dropoff(p_parcel uuid)
returns jsonb language plpgsql security definer set search_path = public, private, extensions, pg_temp as $$
declare p public.parcels; o public.orders; c public.couriers; d public.declarations; dist double precision; lim double precision;
begin
  select * into p from public.parcels where id = p_parcel for update;
  if not found or p.courier_id is distinct from auth.uid() then raise exception 'colis introuvable'; end if;
  if p.status <> 'retire' then raise exception 'la correction se fait pendant la livraison, colis en main'; end if;
  select * into c from public.couriers where user_id = p.courier_id;
  if c.last_lat is null or c.last_seen_at is null or c.last_seen_at < now() - interval '2 minutes' then
    raise exception 'position inconnue : activez la localisation et réessayez';
  end if;
  select * into o from public.orders where id = p.order_id;
  select * into d from public.declarations where id = o.delivery_declaration_id;
  dist := public.fn_haversine_m(c.last_lat, c.last_lng, st_y(coalesce(d.anchor_point, d.gps_point)), st_x(coalesce(d.anchor_point, d.gps_point)));
  lim := case when coalesce(d.located_by, 'gps') = 'gps' then 600 else 5000 end;
  if dist > lim then raise exception 'trop loin de l''adresse enregistrée (% m) : appelez le client ou l''équipe Hailand', round(dist); end if;
  update public.parcels set dropoff_fix_lat = c.last_lat, dropoff_fix_lng = c.last_lng, dropoff_fix_at = now() where id = p_parcel;
  return jsonb_build_object('lat', c.last_lat, 'lng', c.last_lng, 'distance_m', round(dist));
end $$;
revoke execute on function public.fn_mission_fix_dropoff(uuid) from public, anon;
grant execute on function public.fn_mission_fix_dropoff(uuid) to authenticated;

create or replace function public.fn_parcel_handover(p_parcel uuid, p_method text, p_value text)
returns text language plpgsql security definer set search_path = public, private, extensions, pg_temp as $$
declare
  p public.parcels; o public.orders; c public.couriers; d public.declarations;
  a_lat double precision; a_lng double precision; dist double precision; tol double precision; ok boolean := false;
begin
  select * into p from public.parcels where id = p_parcel for update;
  if not found then raise exception 'colis introuvable'; end if;
  select * into o from public.orders where id = p.order_id;
  if p.status <> 'retire' then raise exception 'le colis n''est pas en cours de livraison (%)', p.status; end if;
  if p.handover_failures >= 5 then raise exception 'colis verrouillé : contactez l''équipe Hailand'; end if;

  select * into c from public.couriers where user_id = p.courier_id;
  select * into d from public.declarations where id = o.delivery_declaration_id;
  -- Point de remise : celui corrigé par le livreur à la porte s'il existe, sinon celui de l'adresse.
  a_lat := coalesce(p.dropoff_fix_lat, st_y(coalesce(d.anchor_point, d.gps_point))); a_lng := coalesce(p.dropoff_fix_lng, st_x(coalesce(d.anchor_point, d.gps_point)));
  if c.last_lat is null or c.last_seen_at is null or c.last_seen_at < now() - interval '10 minutes' then
    raise exception 'position du livreur inconnue : il doit activer sa localisation';
  end if;
  dist := public.fn_haversine_m(c.last_lat, c.last_lng, a_lat, a_lng);
  tol := case when p.dropoff_fix_lat is not null or d.anchor_point is not null then 150 else 150 + least(coalesce(d.gps_accuracy_m, 0), 100) end;
  if dist > tol then raise exception 'le livreur n''est pas à l''adresse (% m)', round(dist); end if;

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
    return 'refuse';
  end if;

  update public.parcels set status = 'remis', delivered_at = now() where id = p_parcel;
  insert into public.delivery_events (parcel_id, kind, actor_id, lat, lng) values (p_parcel, 'remis', auth.uid(), c.last_lat, c.last_lng);
  -- Espèces à reverser : le montant encaissé moins le gain que le livreur a gardé (§48, écrit par parcel_money_after).
  if p.cod_amount_gnf > 0 then
    update public.couriers set cash_balance_gnf = cash_balance_gnf + p.cod_amount_gnf
      + coalesce((select sum(amount_gnf) from public.ledger_entries where parcel_id = p_parcel and account = 'courier_cash' and kind = 'gain_garde_especes'), 0)
    where user_id = p.courier_id;
  end if;
  return 'remis';
end $$;

-- Mission du livreur : le point corrigé remplace le point de l'adresse (guidage et carte) ; `fixed` le signale.
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
      'lat', coalesce(p.dropoff_fix_lat, st_y(public.fn_declaration_point(bd.id))),
      'lng', coalesce(p.dropoff_fix_lng, st_x(public.fn_declaration_point(bd.id))),
      'fixed', p.dropoff_fix_lat is not null,
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
