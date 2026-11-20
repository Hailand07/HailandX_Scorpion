-- Retraits à la demande (HAILANDX.md §62). Décision du fondateur le 2026-11-18 : le vendeur voit son SOLDE (ce qui lui revient),
-- la part DISPONIBLE (48 h après la remise, sans litige) et la part EN ATTENTE ; il RETIRE quand il veut, à partir de
-- 10 000 GNF. Étape 1 : le retrait crée une demande ; l'équipe envoie l'argent depuis le compte Chap Chap Pay de Hailand
-- (à la main) puis marque la demande « envoyée » (le versement est alors écrit au grand livre par fn_payout_record).
-- Étape 2 (plus tard) : envoi automatique par la PUSH API de Chap Chap Pay. Hailand paie les frais d'envoi (§48).
-- Ajouts et create or replace seulement. Idempotente.
begin;

create table if not exists public.payout_requests (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references public.shops (id) on delete set null,
  courier_id uuid references public.couriers (user_id) on delete set null,
  amount_gnf integer not null check (amount_gnf > 0),
  method text not null, account_number text not null, holder_name text not null,
  status text not null default 'demande' check (status in ('demande', 'envoye', 'refuse', 'annule')),
  reason text,
  payout_id uuid references public.payouts (id) on delete set null,
  requested_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  decided_by uuid,
  decided_at timestamptz,
  check ((shop_id is null) <> (courier_id is null))
);
create index if not exists payout_requests_shop on public.payout_requests (shop_id, created_at desc);
create index if not exists payout_requests_courier on public.payout_requests (courier_id, created_at desc);
create index if not exists payout_requests_open on public.payout_requests (created_at) where status = 'demande';
-- Une seule demande en cours par boutique et par livreur : plus simple à traiter, impossible de demander deux fois le même argent.
create unique index if not exists payout_requests_one_open_shop on public.payout_requests (shop_id) where status = 'demande' and shop_id is not null;
create unique index if not exists payout_requests_one_open_courier on public.payout_requests (courier_id) where status = 'demande' and courier_id is not null;
comment on table public.payout_requests is 'Demandes de retrait des boutiques (et des livreurs) : traitées par l''équipe, §62';
alter table public.payout_requests enable row level security;
drop policy if exists payout_requests_read on public.payout_requests;
create policy payout_requests_read on public.payout_requests for select to authenticated
  using ((shop_id is not null and public.fn_is_shop_owner(shop_id)) or courier_id = auth.uid() or public.is_admin());

-- Montant minimum d'un retrait (réglable par l'équipe dans `settings`).
create or replace function private.withdraw_min_gnf() returns integer
language sql stable security definer set search_path = public, private, pg_temp as $$
  select private.setting_int('retrait_minimum_gnf', 10000)
$$;

-- Ce qui peut être retiré : le disponible moins la demande en cours.
create or replace function private.withdrawable_gnf(p_account text, p_id uuid) returns integer
language sql stable security definer set search_path = public, private, pg_temp as $$
  select greatest(0, private.payable_gnf(p_account, p_id) - coalesce((
    select sum(r.amount_gnf) from public.payout_requests r
     where r.status = 'demande' and ((p_account = 'shop' and r.shop_id = p_id) or (p_account = 'courier' and r.courier_id = p_id))), 0))::integer
$$;

-- Le solde, pour l'écran du vendeur : tout ce qui lui revient, la part retirable, la part en attente et sa prochaine date
-- de déblocage, la demande en cours, le minimum, et le moyen de versement.
create or replace function public.fn_my_balance(p_shop uuid default null)
returns table (balance_gnf integer, payable_gnf integer, waiting_gnf integer, pending_gnf integer, withdrawable_gnf integer,
               next_release_at timestamptz, next_release_gnf integer, min_gnf integer,
               method text, account_number text, holder_name text, usable_from timestamptz)
language plpgsql stable security definer set search_path = public, private, pg_temp as $$
declare acc text; v_id uuid; bal integer; pay integer; pend integer; m public.payout_methods; nxt timestamptz; nxt_amt integer;
begin
  if p_shop is not null then
    if not public.fn_is_shop_owner(p_shop) then raise exception 'réservé au propriétaire de la boutique'; end if;
    acc := 'shop'; v_id := p_shop;
    select * into m from public.payout_methods where shop_id = p_shop order by created_at desc limit 1;
  else
    if auth.uid() is null then raise exception 'connexion requise'; end if;
    acc := 'courier'; v_id := auth.uid();
    select * into m from public.payout_methods where courier_id = auth.uid() order by created_at desc limit 1;
  end if;
  select coalesce(sum(amount_gnf), 0)::integer into bal from public.ledger_entries where account = acc and account_id = v_id;
  pay := private.payable_gnf(acc, v_id);
  select coalesce(sum(amount_gnf), 0)::integer into pend from public.payout_requests
   where status = 'demande' and ((acc = 'shop' and shop_id = v_id) or (acc = 'courier' and courier_id = v_id));
  -- Prochaine vente qui devient retirable (la plus ancienne de moins de 48 h) et son montant.
  select l.created_at + interval '48 hours', l.amount_gnf into nxt, nxt_amt
    from public.ledger_entries l left join public.orders o on o.id = l.order_id
   where l.account = acc and l.account_id = v_id and l.amount_gnf > 0 and l.kind in ('reglement_vendeur', 'gain_livreur')
     and l.created_at > now() - interval '48 hours' and coalesce(o.payment_method, '') <> 'hailandpay'
   order by l.created_at limit 1;
  return query select bal, pay, greatest(0, bal - pay), pend, greatest(0, pay - pend), nxt, nxt_amt, private.withdraw_min_gnf(),
                      m.method, m.account_number, m.holder_name, m.usable_from;
end $$;

-- Demander un retrait : propriétaire de la boutique (ou le livreur pour lui-même, p_shop null).
create or replace function public.fn_withdraw_request(p_shop uuid, p_amount integer)
returns uuid language plpgsql security definer set search_path = public, private, pg_temp as $$
declare acc text; v_id uuid; m public.payout_methods; can integer; mini integer := private.withdraw_min_gnf(); v uuid; who text;
begin
  if auth.uid() is null then raise exception 'connexion requise'; end if;
  if p_shop is not null then
    if not public.fn_is_shop_owner(p_shop) then raise exception 'réservé au propriétaire de la boutique'; end if;
    acc := 'shop'; v_id := p_shop;
    select * into m from public.payout_methods where shop_id = p_shop order by created_at desc limit 1;
    select name into who from public.shops where id = p_shop;
  else
    if not exists (select 1 from public.couriers where user_id = auth.uid()) then raise exception 'réservé aux livreurs de la Flotte'; end if;
    acc := 'courier'; v_id := auth.uid();
    select * into m from public.payout_methods where courier_id = auth.uid() order by created_at desc limit 1;
    select full_name into who from public.couriers where user_id = auth.uid();
  end if;
  if m.id is null then raise exception 'indiquez d''abord où recevoir votre argent (Orange Money, MTN…)'; end if;
  if m.usable_from > now() then raise exception 'moyen de versement modifié récemment : retrait possible à partir du %', to_char(m.usable_from, 'DD/MM à HH24:MI'); end if;
  if exists (select 1 from public.payout_requests where status = 'demande' and ((acc = 'shop' and shop_id = v_id) or (acc = 'courier' and courier_id = v_id))) then
    raise exception 'un retrait est déjà en cours : attendez qu''il soit envoyé, ou annulez-le';
  end if;
  if p_amount is null or p_amount < mini then raise exception 'le retrait minimum est de % GNF', public.fn_gnf(mini); end if;
  can := private.withdrawable_gnf(acc, v_id);
  if p_amount > can then raise exception 'montant supérieur à votre disponible (% GNF)', public.fn_gnf(can); end if;
  insert into public.payout_requests (shop_id, courier_id, amount_gnf, method, account_number, holder_name)
  values (case when acc = 'shop' then v_id end, case when acc = 'courier' then v_id end, p_amount, m.method, m.account_number, m.holder_name)
  returning id into v;
  perform private.notify_admins('argent', 'Demande de retrait', coalesce(who, '') || ' — ' || public.fn_gnf(p_amount) || ' GNF', '/console/argent');
  return v;
end $$;

-- Annuler sa demande, tant qu'elle n'est pas envoyée.
create or replace function public.fn_withdraw_cancel(p_request uuid)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare r public.payout_requests;
begin
  select * into r from public.payout_requests where id = p_request for update;
  if not found then raise exception 'demande introuvable'; end if;
  if not ((r.shop_id is not null and public.fn_is_shop_owner(r.shop_id)) or r.courier_id = auth.uid()) then raise exception 'cette demande ne vous appartient pas'; end if;
  if r.status <> 'demande' then raise exception 'cette demande est déjà traitée'; end if;
  update public.payout_requests set status = 'annule', decided_at = now(), decided_by = auth.uid() where id = p_request;
end $$;

-- Équipe : les demandes en cours (les plus anciennes d'abord), avec le disponible actuel du demandeur.
create or replace function public.fn_withdraw_requests()
returns table (id uuid, kind text, target_id uuid, name text, amount_gnf integer, payable_gnf integer, method text, account_number text, holder_name text, created_at timestamptz)
language plpgsql stable security definer set search_path = public, private, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'réservé à l''équipe Hailand'; end if;
  return query
  select r.id, case when r.shop_id is not null then 'boutique' else 'livreur' end, coalesce(r.shop_id, r.courier_id),
         coalesce(s.name, c.full_name, '—'), r.amount_gnf,
         private.payable_gnf(case when r.shop_id is not null then 'shop' else 'courier' end, coalesce(r.shop_id, r.courier_id)),
         r.method, r.account_number, r.holder_name, r.created_at
    from public.payout_requests r
    left join public.shops s on s.id = r.shop_id
    left join public.couriers c on c.user_id = r.courier_id
   where r.status = 'demande'
   order by r.created_at;
end $$;

-- Équipe : l'argent est envoyé (Chap Chap Pay, Orange Money…) → versement écrit au grand livre, demandeur prévenu.
create or replace function public.fn_withdraw_done(p_request uuid, p_ref text default null)
returns uuid language plpgsql security definer set search_path = public, private, pg_temp as $$
declare r public.payout_requests; v uuid;
begin
  if not public.is_admin() then raise exception 'réservé à l''équipe Hailand'; end if;
  select * into r from public.payout_requests where id = p_request for update;
  if not found then raise exception 'demande introuvable'; end if;
  if r.status <> 'demande' then raise exception 'cette demande est déjà traitée'; end if;
  -- Même contrôles qu'un versement : moyen en vigueur, jamais plus que le disponible.
  v := public.fn_payout_record(case when r.shop_id is not null then 'boutique' else 'livreur' end, coalesce(r.shop_id, r.courier_id), r.amount_gnf, p_ref);
  update public.payout_requests set status = 'envoye', payout_id = v, decided_at = now(), decided_by = auth.uid() where id = p_request;
  return v;
end $$;

-- Équipe : refuser une demande (motif obligatoire, montré au demandeur).
create or replace function public.fn_withdraw_refuse(p_request uuid, p_reason text)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare r public.payout_requests; txt text := btrim(coalesce(p_reason, ''));
begin
  if not public.is_admin() then raise exception 'réservé à l''équipe Hailand'; end if;
  if length(txt) < 3 then raise exception 'indiquez le motif du refus'; end if;
  select * into r from public.payout_requests where id = p_request for update;
  if not found then raise exception 'demande introuvable'; end if;
  if r.status <> 'demande' then raise exception 'cette demande est déjà traitée'; end if;
  update public.payout_requests set status = 'refuse', reason = txt, decided_at = now(), decided_by = auth.uid() where id = p_request;
  if r.shop_id is not null then
    perform private.notify_shop(r.shop_id, 'argent', 'Retrait refusé', public.fn_gnf(r.amount_gnf) || ' GNF : ' || txt, '/vendeur/argent');
  else
    perform private.notify(r.courier_id, 'argent', 'Retrait refusé', public.fn_gnf(r.amount_gnf) || ' GNF : ' || txt, '/livraisons');
  end if;
end $$;

revoke all on function private.withdraw_min_gnf(), private.withdrawable_gnf(text, uuid) from public, anon, authenticated;
revoke all on function public.fn_my_balance(uuid), public.fn_withdraw_request(uuid, integer), public.fn_withdraw_cancel(uuid),
  public.fn_withdraw_requests(), public.fn_withdraw_done(uuid, text), public.fn_withdraw_refuse(uuid, text) from public, anon;
grant execute on function public.fn_my_balance(uuid), public.fn_withdraw_request(uuid, integer), public.fn_withdraw_cancel(uuid),
  public.fn_withdraw_requests(), public.fn_withdraw_done(uuid, text), public.fn_withdraw_refuse(uuid, text) to authenticated;

commit;
