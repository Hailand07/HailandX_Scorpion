-- HAILANDX.md §50 (2026-11-01, décision du fondateur) : le client a 48 h après la remise pour signaler un problème, avec un motif
-- et une preuve ; la part du vendeur n'est versable qu'après ces 48 h, et reste retenue tant qu'un litige est ouvert.
-- Ne contient que des « create or replace » (aucune table, aucune donnée modifiée).

-- 1. Signalement par l'acheteur : colis en route, ou remis depuis moins de 48 h (au lieu de 72 h).
create or replace function public.fn_open_dispute(p_parcel uuid, p_reason text, p_details text default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare p public.parcels; o public.orders; d uuid;
begin
  select * into p from public.parcels where id = p_parcel for update;
  if not found then raise exception 'colis introuvable'; end if;
  select * into o from public.orders where id = p.order_id;
  if o.buyer_id <> auth.uid() then raise exception 'seul l''acheteur peut signaler un problème'; end if;
  if p.status = 'remis' then
    if p.delivered_at < now() - interval '48 hours' then raise exception 'le délai de 48 h après la remise est dépassé : contactez l''équipe Hailand'; end if;
  elsif p.status <> 'retire' then
    raise exception 'on ne peut signaler un problème qu''une fois le colis en route ou remis';
  end if;
  if exists (select 1 from public.disputes where parcel_id = p_parcel) then raise exception 'un litige est déjà ouvert pour ce colis'; end if;
  insert into public.disputes (parcel_id, opened_by, reason, details) values (p_parcel, auth.uid(), p_reason, nullif(btrim(p_details), '')) returning id into d;
  update public.parcels set status = 'litige' where id = p_parcel;
  insert into public.delivery_events (parcel_id, kind, actor_id) values (p_parcel, 'litige', auth.uid());
  return d;
end $$;

-- 2. Versable : le solde moins les ventes et gains de moins de 48 h, et moins les ventes dont le colis est en litige
--    (un litige ouvert à la 47e heure retient la part du vendeur jusqu'à la décision de l'équipe).
create or replace function private.payable_gnf(p_account text, p_id uuid) returns integer
language sql stable security definer set search_path = public, pg_temp as $$
  select greatest(0, coalesce(sum(l.amount_gnf), 0) - coalesce(sum(l.amount_gnf) filter (
    where l.amount_gnf > 0 and l.kind in ('reglement_vendeur', 'gain_livreur')
      and (l.created_at > now() - interval '48 hours' or (l.account = 'shop' and p.status = 'litige'))
      and coalesce(o.payment_method, '') <> 'hailandpay'
      and not (l.account = 'courier' and coalesce(o.payment_method, '') = 'livraison')), 0))::integer
  from public.ledger_entries l
  left join public.orders o on o.id = l.order_id
  left join public.parcels p on p.id = l.parcel_id
  where l.account = p_account and l.account_id = p_id
$$;
revoke all on function private.payable_gnf(text, uuid) from public, anon, authenticated;
