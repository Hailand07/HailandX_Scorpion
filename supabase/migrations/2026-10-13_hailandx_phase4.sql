-- Phase 4 : indice de confiance recalculé, informations de mission du livreur, règlement des espèces.
-- Mêmes pondérations que packages/commerce/src/trust.ts (avis 35 · fiabilité 30 · expérience 15 · qualité 10 · prix 10).

-- ── Indice de confiance d'une boutique ──────────────────────────────────────────────────────────────────────────────────
create or replace function public.fn_refresh_shop_score(p_shop uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  s public.shops;
  v_rating numeric := 0; v_count int := 0;
  v_ok int := 0; v_bad int := 0; v_rel numeric;
  v_prep int;
  v_age numeric;
  v_quality numeric; v_price numeric;
  v_reviews numeric; v_exp numeric; v_trust int;
  v_offers int; v_photos int;
begin
  select * into s from public.shops where id = p_shop;
  if not found then return; end if;

  select coalesce(avg(rating), 0), count(*) into v_rating, v_count from public.reviews where shop_id = p_shop;
  select count(*) filter (where status = 'remis'), count(*) filter (where status = 'litige')
    into v_ok, v_bad from public.parcels where shop_id = p_shop;
  -- Annulations causées par la boutique (annulation faite par un membre de la boutique).
  v_bad := v_bad + (select count(*) from public.delivery_events e join public.parcels p on p.id = e.parcel_id
                    where p.shop_id = p_shop and e.kind = 'annule' and exists (select 1 from public.shop_members m where m.shop_id = p_shop and m.user_id = e.actor_id));
  -- Fiabilité : a priori de 0,7 pesant 5 commandes, pour ne pas punir ni récompenser une boutique sans historique.
  v_rel := (v_ok + 3.5) / (v_ok + v_bad + 5);

  select round(avg(extract(epoch from (ready_at - created_at)) / 60))::int into v_prep from (
    select ready_at, created_at from public.parcels where shop_id = p_shop and ready_at is not null order by created_at desc limit 50) t;

  v_age := greatest(0, extract(epoch from (now() - s.created_at)) / 86400);

  -- Qualité : logo, bandeau, présentation, et part des offres actives avec photo.
  select count(*), count(*) filter (where cardinality(photo_paths) > 0) into v_offers, v_photos from public.offers where shop_id = p_shop and active;
  v_quality := (case when s.logo_path is not null then 0.2 else 0 end) + (case when s.cover_path is not null then 0.2 else 0 end)
             + (case when coalesce(btrim(s.tagline), '') <> '' then 0.2 else 0 end)
             + 0.4 * (case when v_offers = 0 then 0 else v_photos::numeric / v_offers end);

  -- Prix : pour chaque offre ayant au moins un concurrent sur la même fiche, 1 si moins cher que la moyenne des autres, sinon décroît ; neutre (0,6) sans comparaison.
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

create or replace function public.shop_score_after_review() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin perform public.fn_refresh_shop_score(new.shop_id); return new; end $$;
create trigger reviews_score after insert on public.reviews for each row execute function public.shop_score_after_review();

create or replace function public.shop_score_after_parcel() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status is distinct from old.status and new.status in ('remis', 'litige', 'annule', 'mission_proposee') then perform public.fn_refresh_shop_score(new.shop_id); end if;
  return new;
end $$;
create trigger parcels_score after update on public.parcels for each row execute function public.shop_score_after_parcel();

-- ── Informations de mission : seulement pour le livreur attribué, tant que le colis n'est pas remis ──────────────────────────
-- Le téléphone de l'acheteur et le point exact de livraison ne sortent que par ici.
create or replace function public.fn_mission_info(p_parcel uuid)
returns table (status text, shop_name text, shop_lat double precision, shop_lng double precision, buyer_phone text,
               buyer_lat double precision, buyer_lng double precision, buyer_level integer, buyer_accuracy_m real,
               buyer_floor text, buyer_door text, buyer_landmark text, cod_amount_gnf integer)
language sql stable security definer set search_path = public, pg_temp as $$
  select p.status, s.name, st_y(coalesce(sd.anchor_point, sd.gps_point)), st_x(coalesce(sd.anchor_point, sd.gps_point)),
         o.buyer_phone, st_y(coalesce(bd.anchor_point, bd.gps_point)), st_x(coalesce(bd.anchor_point, bd.gps_point)),
         public.fn_declaration_level(o.delivery_declaration_id), bd.gps_accuracy_m, bd.location_floor, bd.location_door, bd.declared_landmark, p.cod_amount_gnf
  from public.parcels p
  join public.shops s on s.id = p.shop_id
  join public.declarations sd on sd.id = s.declaration_id
  join public.orders o on o.id = p.order_id
  join public.declarations bd on bd.id = o.delivery_declaration_id
  where p.id = p_parcel and p.courier_id = auth.uid() and p.status in ('accepte', 'retire')
$$;

-- ── Règlement des espèces : l'équipe enregistre le reversement d'un livreur ───────────────────────────────────────────────
create or replace function public.fn_courier_cash_settle(p_courier uuid, p_amount integer)
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare nb integer;
begin
  if not public.is_admin() then raise exception 'réservé à l''équipe Hailand'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'montant invalide'; end if;
  update public.couriers set cash_balance_gnf = greatest(0, cash_balance_gnf - p_amount) where user_id = p_courier returning cash_balance_gnf into nb;
  if not found then raise exception 'livreur introuvable'; end if;
  return nb;
end $$;

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p where p.pronamespace = 'public'::regnamespace
           and p.proname in ('fn_refresh_shop_score', 'shop_score_after_review', 'shop_score_after_parcel', 'fn_mission_info', 'fn_courier_cash_settle') loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    if f.proname in ('fn_mission_info', 'fn_courier_cash_settle') then execute format('grant execute on function %s to authenticated', f.sig); end if;
  end loop;
end $$;
