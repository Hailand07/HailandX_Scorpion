-- Litiges : l'acheteur signale un problème (colis non reçu, abîmé, différent) ; l'équipe tranche. La décision pèse sur l'indice de confiance du vendeur.
create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  parcel_id uuid not null unique references public.parcels (id),
  opened_by uuid not null references auth.users (id),
  reason text not null check (reason in ('non_recu', 'endommage', 'different', 'autre')),
  details text check (details is null or length(details) <= 1000),
  status text not null default 'ouvert' check (status in ('ouvert', 'resolu')),
  resolution text check (resolution in ('acheteur', 'vendeur')),
  note text check (note is null or length(note) <= 1000),
  resolved_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index disputes_status_idx on public.disputes (status, created_at);

alter table public.disputes enable row level security;
-- Lecture : l'acheteur qui a ouvert, l'équipe, le vendeur et le livreur du colis. Aucune écriture directe.
create policy disputes_read on public.disputes for select to authenticated using (
  opened_by = auth.uid() or public.is_admin()
  or exists (select 1 from public.parcels p where p.id = parcel_id and (p.courier_id = auth.uid() or public.fn_is_shop_member(p.shop_id))));
revoke insert, update, delete, truncate on public.disputes from anon, authenticated;
revoke select on public.disputes from anon;

-- L'acheteur signale un problème : colis en route, ou remis depuis moins de 72 h.
create or replace function public.fn_open_dispute(p_parcel uuid, p_reason text, p_details text default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare p public.parcels; o public.orders; d uuid;
begin
  select * into p from public.parcels where id = p_parcel for update;
  if not found then raise exception 'colis introuvable'; end if;
  select * into o from public.orders where id = p.order_id;
  if o.buyer_id <> auth.uid() then raise exception 'seul l''acheteur peut signaler un problème'; end if;
  if p.status = 'remis' then
    if p.delivered_at < now() - interval '72 hours' then raise exception 'le délai de 72 h après la remise est dépassé : contactez l''équipe Hailand'; end if;
  elsif p.status <> 'retire' then
    raise exception 'on ne peut signaler un problème qu''une fois le colis en route ou remis';
  end if;
  if exists (select 1 from public.disputes where parcel_id = p_parcel) then raise exception 'un litige est déjà ouvert pour ce colis'; end if;
  insert into public.disputes (parcel_id, opened_by, reason, details) values (p_parcel, auth.uid(), p_reason, nullif(btrim(p_details), '')) returning id into d;
  update public.parcels set status = 'litige' where id = p_parcel;
  insert into public.delivery_events (parcel_id, kind, actor_id) values (p_parcel, 'litige', auth.uid());
  return d;
end $$;

-- L'équipe tranche : en faveur de l'acheteur (colis annulé, remboursement à organiser) ou du vendeur (remise confirmée).
create or replace function public.fn_resolve_dispute(p_dispute uuid, p_in_favor_of text, p_note text default null)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare d public.disputes; new_status text;
begin
  if not public.is_admin() then raise exception 'réservé à l''équipe Hailand'; end if;
  if p_in_favor_of not in ('acheteur', 'vendeur') then raise exception 'décision inconnue'; end if;
  select * into d from public.disputes where id = p_dispute for update;
  if not found then raise exception 'litige introuvable'; end if;
  if d.status <> 'ouvert' then raise exception 'ce litige est déjà tranché'; end if;
  new_status := case when p_in_favor_of = 'acheteur' then 'annule' else 'remis' end;
  update public.disputes set status = 'resolu', resolution = p_in_favor_of, note = nullif(btrim(p_note), ''), resolved_by = auth.uid(), resolved_at = now() where id = p_dispute;
  update public.parcels set status = new_status, delivered_at = coalesce(delivered_at, now()) where id = d.parcel_id;
  insert into public.delivery_events (parcel_id, kind, actor_id) values (d.parcel_id, new_status, auth.uid());
  return new_status;
end $$;

-- L'indice de confiance tient compte des litiges tranchés contre le vendeur.
create or replace function public.fn_refresh_shop_score(p_shop uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  s public.shops;
  v_rating numeric := 0; v_count int := 0;
  v_ok int := 0; v_bad int := 0; v_rel numeric;
  v_prep int; v_age numeric; v_quality numeric; v_price numeric;
  v_reviews numeric; v_exp numeric; v_trust int; v_offers int; v_photos int;
begin
  select * into s from public.shops where id = p_shop;
  if not found then return; end if;
  select coalesce(avg(rating), 0), count(*) into v_rating, v_count from public.reviews where shop_id = p_shop;
  select count(*) filter (where status = 'remis'), count(*) filter (where status = 'litige') into v_ok, v_bad from public.parcels where shop_id = p_shop;
  v_bad := v_bad + (select count(*) from public.delivery_events e join public.parcels p on p.id = e.parcel_id
                    where p.shop_id = p_shop and e.kind = 'annule' and exists (select 1 from public.shop_members m where m.shop_id = p_shop and m.user_id = e.actor_id));
  -- Litiges tranchés en faveur de l'acheteur : un problème de plus pour le vendeur.
  v_bad := v_bad + (select count(*) from public.disputes dd join public.parcels p on p.id = dd.parcel_id where p.shop_id = p_shop and dd.resolution = 'acheteur');
  v_rel := (v_ok + 3.5) / (v_ok + v_bad + 5);
  select round(avg(extract(epoch from (ready_at - created_at)) / 60))::int into v_prep from (
    select ready_at, created_at from public.parcels where shop_id = p_shop and ready_at is not null order by created_at desc limit 50) t;
  v_age := greatest(0, extract(epoch from (now() - s.created_at)) / 86400);
  select count(*), count(*) filter (where cardinality(photo_paths) > 0) into v_offers, v_photos from public.offers where shop_id = p_shop and active;
  v_quality := (case when s.logo_path is not null then 0.2 else 0 end) + (case when s.cover_path is not null then 0.2 else 0 end)
             + (case when coalesce(btrim(s.tagline), '') <> '' then 0.2 else 0 end)
             + 0.4 * (case when v_offers = 0 then 0 else v_photos::numeric / v_offers end);
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

revoke all on function public.fn_open_dispute(uuid, text, text) from public, anon;
revoke all on function public.fn_resolve_dispute(uuid, text, text) from public, anon;
grant execute on function public.fn_open_dispute(uuid, text, text) to authenticated;
grant execute on function public.fn_resolve_dispute(uuid, text, text) to authenticated;
revoke all on function public.fn_refresh_shop_score(uuid) from public, anon, authenticated;
