-- HailandX — suivi du colis sur carte (acheteur) et ventes par période et par source (vendeur).
-- Écarts signalés au §21 de HAILANDX.md (maquettes 7 et 10).
begin;

-- ── Suivi : l'acheteur voit la boutique, sa destination et, SEULEMENT quand le colis est retiré, la dernière position du livreur ─
-- (position récente : moins de 10 minutes). Jamais le téléphone ni les positions d'un livreur hors de ses courses.
create or replace function public.fn_parcel_tracking(p_parcel uuid)
returns table (status text, shop_lng double precision, shop_lat double precision, dest_lng double precision, dest_lat double precision,
               courier_lng double precision, courier_lat double precision, courier_seen_at timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select p.status,
         st_x(coalesce(sd.anchor_point, sd.gps_point)), st_y(coalesce(sd.anchor_point, sd.gps_point)),
         st_x(coalesce(dd.anchor_point, dd.gps_point)), st_y(coalesce(dd.anchor_point, dd.gps_point)),
         case when p.status = 'retire' and c.last_seen_at > now() - interval '10 minutes' then c.last_lng end,
         case when p.status = 'retire' and c.last_seen_at > now() - interval '10 minutes' then c.last_lat end,
         case when p.status = 'retire' and c.last_seen_at > now() - interval '10 minutes' then c.last_seen_at end
  from public.parcels p
  join public.orders o on o.id = p.order_id
  join public.shops s on s.id = p.shop_id
  left join public.declarations sd on sd.id = s.declaration_id
  join public.declarations dd on dd.id = o.delivery_declaration_id
  left join public.couriers c on c.user_id = p.courier_id
  where p.id = p_parcel and o.buyer_id = auth.uid()
$$;

-- ── Ventes du vendeur : par jour et par source, sur les colis non annulés ───────────────────────────────────────────────────
create or replace function public.fn_shop_sales(p_shop uuid, p_days integer default 30)
returns table (day date, parcels integer, revenue_gnf bigint)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not (public.fn_is_shop_member(p_shop) or public.is_admin()) then raise exception 'ventes : réservé aux membres de la boutique'; end if;
  return query
    select d::date, coalesce(count(p.id), 0)::integer, coalesce(sum(p.subtotal_gnf), 0)::bigint
    from generate_series((current_date - (greatest(1, least(p_days, 365)) - 1))::timestamp, current_date::timestamp, interval '1 day') d
    left join public.parcels p on p.shop_id = p_shop and p.status <> 'annule' and p.created_at::date = d::date
    group by d order by d;
end $$;

create or replace function public.fn_shop_sources(p_shop uuid, p_days integer default 30)
returns table (source text, parcels integer, revenue_gnf bigint)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not (public.fn_is_shop_member(p_shop) or public.is_admin()) then raise exception 'ventes : réservé aux membres de la boutique'; end if;
  return query
    select coalesce(o.source, 'application'), count(p.id)::integer, coalesce(sum(p.subtotal_gnf), 0)::bigint
    from public.parcels p join public.orders o on o.id = p.order_id
    where p.shop_id = p_shop and p.status <> 'annule' and p.created_at >= current_date - (greatest(1, least(p_days, 365)) - 1)
    group by 1 order by 3 desc;
end $$;

revoke all on function public.fn_parcel_tracking(uuid), public.fn_shop_sales(uuid, integer), public.fn_shop_sources(uuid, integer) from public, anon, authenticated;
grant execute on function public.fn_parcel_tracking(uuid), public.fn_shop_sales(uuid, integer), public.fn_shop_sources(uuid, integer) to authenticated;

commit;
