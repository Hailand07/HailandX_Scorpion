-- Phase 6 : paiement numérique (Orange Money) avec séquestre, règlement à la remise, remboursements et grand livre.
-- ⚠️ Taux PROVISOIRES à valider par le fondateur : commission 8 % sur les articles, 80 % des frais de livraison au livreur.
-- Le fournisseur de paiement est branché par le serveur (route de notification signée) ; ici seule la comptabilité interne est décidée par la base.

-- ── Réglages ────────────────────────────────────────────────────────────────────────────────────────────────────────────
create table public.settings (key text primary key, value text not null, updated_at timestamptz not null default now());
insert into public.settings (key, value) values ('commission_bps', '800'), ('courier_share_bps', '8000'), ('payment_mode', 'simulation') on conflict do nothing;
alter table public.settings enable row level security;
create policy settings_read on public.settings for select to authenticated using (true);
create policy settings_admin on public.settings for update to authenticated using (public.is_admin()) with check (public.is_admin());
revoke insert, delete, truncate on public.settings from anon, authenticated;
revoke select, update on public.settings from anon;

-- ── Paiements et grand livre ────────────────────────────────────────────────────────────────────────────────────────────
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id),
  provider text not null check (provider in ('simulation', 'orange_money')),
  provider_ref text,
  amount_gnf integer not null check (amount_gnf > 0),
  refunded_gnf integer not null default 0 check (refunded_gnf >= 0),
  status text not null default 'initie' check (status in ('initie', 'paye', 'echoue', 'rembourse')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
alter table public.payments enable row level security;
create policy payments_read on public.payments for select to authenticated using (public.is_admin() or public.fn_is_order_buyer(order_id));
revoke insert, update, delete, truncate on public.payments from anon, authenticated;
revoke select on public.payments from anon;

create table public.ledger_entries (
  id bigint generated always as identity primary key,
  account text not null check (account in ('escrow', 'shop', 'courier', 'platform', 'buyer')),
  account_id uuid,
  parcel_id uuid references public.parcels (id),
  order_id uuid references public.orders (id),
  kind text not null,
  amount_gnf integer not null,
  created_at timestamptz not null default now()
);
create index ledger_account_idx on public.ledger_entries (account, account_id);
create unique index ledger_once on public.ledger_entries (parcel_id, account, kind)
  where kind in ('reglement_vendeur', 'gain_livreur', 'commission', 'liberation', 'encaissement_especes', 'annulation_vendeur', 'annulation_commission', 'remboursement', 'remboursement_escrow');
alter table public.ledger_entries enable row level security;
create policy ledger_read on public.ledger_entries for select to authenticated using (
  public.is_admin()
  or (account = 'shop' and public.fn_is_shop_member(account_id))
  or (account in ('courier', 'buyer') and account_id = auth.uid()));
revoke insert, update, delete, truncate on public.ledger_entries from anon, authenticated;
revoke select on public.ledger_entries from anon;

create or replace function private.is_service_role() returns boolean language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') = 'service_role'
$$;
create or replace function private.setting_int(p_key text, p_default integer) returns integer language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select value::integer from public.settings where key = p_key), p_default)
$$;

-- ── Démarrage d'un paiement (acheteur) ──────────────────────────────────────────────────────────────────────────────────
create or replace function public.fn_pay_start(p_order uuid)
returns table (payment_id uuid, provider text, amount_gnf integer) language plpgsql security definer set search_path = public, pg_temp as $$
declare o public.orders; pm public.payments; mode text;
begin
  select * into o from public.orders where id = p_order;
  if not found or o.buyer_id <> auth.uid() then raise exception 'commande introuvable'; end if;
  if o.payment_method <> 'orange_money' then raise exception 'cette commande se paie en espèces à la livraison'; end if;
  if o.payment_status <> 'en_attente' then raise exception 'cette commande est déjà payée ou remboursée'; end if;
  select coalesce((select value from public.settings where key = 'payment_mode'), 'simulation') into mode;
  insert into public.payments (order_id, provider, amount_gnf) values (p_order, mode, o.total_gnf) on conflict (order_id) do nothing;
  select * into pm from public.payments where order_id = p_order;
  return query select pm.id, pm.provider, pm.amount_gnf;
end $$;

-- ── Confirmation d'un paiement : le serveur (notification signée du fournisseur) ou l'équipe (essais) ───────────────────────
create or replace function public.fn_payment_confirm(p_order uuid, p_ref text, p_amount integer)
returns text language plpgsql security definer set search_path = public, private, pg_temp as $$
declare o public.orders;
begin
  if not (private.is_service_role() or public.is_admin()) then raise exception 'confirmation réservée au serveur de paiement ou à l''équipe Hailand'; end if;
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'commande introuvable'; end if;
  if o.payment_method <> 'orange_money' then raise exception 'cette commande se paie en espèces à la livraison'; end if;
  if o.payment_status <> 'en_attente' then raise exception 'cette commande est déjà payée ou remboursée'; end if;
  if p_amount is distinct from o.total_gnf then raise exception 'montant incorrect : % au lieu de %', p_amount, o.total_gnf; end if;
  insert into public.payments (order_id, provider, amount_gnf, status, provider_ref, paid_at)
    values (p_order, coalesce((select value from public.settings where key = 'payment_mode'), 'simulation'), o.total_gnf, 'paye', nullif(btrim(p_ref), ''), now())
    on conflict (order_id) do update set status = 'paye', provider_ref = nullif(btrim(p_ref), ''), paid_at = now();
  update public.orders set payment_status = 'bloque' where id = p_order;
  insert into public.ledger_entries (account, order_id, kind, amount_gnf) values ('escrow', p_order, 'paiement', o.total_gnf);
  return 'bloque';
end $$;

-- Un colis payé d'avance ne se prépare qu'une fois l'argent bloqué (séquestre).
create or replace function public.fn_parcel_ready(p_parcel uuid)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare p public.parcels;
begin
  select * into p from public.parcels where id = p_parcel for update;
  if not found then raise exception 'colis introuvable'; end if;
  if not (public.is_admin() or public.fn_is_shop_member(p.shop_id)) then raise exception 'droits insuffisants'; end if;
  if p.status <> 'attente_vendeur' then raise exception 'ce colis n''est plus à préparer (%)', p.status; end if;
  if exists (select 1 from public.orders o where o.id = p.order_id and o.payment_method = 'orange_money' and o.payment_status <> 'bloque') then
    raise exception 'paiement en attente : le colis se prépare dès que l''acheteur a payé';
  end if;
  update public.parcels set status = 'mission_proposee', ready_at = now() where id = p_parcel;
  insert into public.delivery_events (parcel_id, kind, actor_id) values (p_parcel, 'prepare', auth.uid()), (p_parcel, 'propose', auth.uid());
  return 'mission_proposee';
end $$;

-- ── Règlement à la remise, remboursement à l'annulation ou au litige ────────────────────────────────────────────────────────
create or replace function public.parcel_money_after() returns trigger language plpgsql security definer set search_path = public, private, pg_temp as $$
declare
  o public.orders; bps integer; cshare integer; commission integer; shop_net integer; courier_gain integer; platform_gain integer; total integer; settled boolean; refunded integer;
begin
  select * into o from public.orders where id = new.order_id;
  total := new.subtotal_gnf + new.delivery_fee_gnf;

  if new.status = 'remis' and old.status is distinct from 'remis' then
    bps := private.setting_int('commission_bps', 800); cshare := private.setting_int('courier_share_bps', 8000);
    commission := round(new.subtotal_gnf * bps / 10000.0)::integer;
    shop_net := new.subtotal_gnf - commission;
    courier_gain := round(new.delivery_fee_gnf * cshare / 10000.0)::integer;
    platform_gain := commission + new.delivery_fee_gnf - courier_gain;
    if o.payment_method = 'livraison' then
      insert into public.ledger_entries (account, parcel_id, order_id, kind, amount_gnf) values ('escrow', new.id, o.id, 'encaissement_especes', total) on conflict do nothing;
    end if;
    insert into public.ledger_entries (account, account_id, parcel_id, order_id, kind, amount_gnf) values
      ('shop', new.shop_id, new.id, o.id, 'reglement_vendeur', shop_net),
      ('courier', new.courier_id, new.id, o.id, 'gain_livreur', courier_gain),
      ('platform', null, new.id, o.id, 'commission', platform_gain),
      ('escrow', null, new.id, o.id, 'liberation', -total)
      on conflict do nothing;
    if not exists (select 1 from public.parcels where order_id = o.id and status not in ('remis', 'annule')) then
      update public.orders set payment_status = 'libere' where id = o.id and payment_status in ('bloque', 'en_attente');
    end if;

  elsif new.status = 'annule' and old.status is distinct from 'annule' then
    settled := exists (select 1 from public.ledger_entries where parcel_id = new.id and kind = 'reglement_vendeur');
    if settled then
      -- Remise déjà réglée au vendeur (litige tranché pour l'acheteur) : on reprend la part du vendeur et la commission ; l'acheteur est remboursé des articles.
      bps := private.setting_int('commission_bps', 800);
      commission := round(new.subtotal_gnf * bps / 10000.0)::integer;
      shop_net := new.subtotal_gnf - commission;
      insert into public.ledger_entries (account, account_id, parcel_id, order_id, kind, amount_gnf) values
        ('shop', new.shop_id, new.id, o.id, 'annulation_vendeur', -shop_net),
        ('platform', null, new.id, o.id, 'annulation_commission', -commission),
        ('buyer', o.buyer_id, new.id, o.id, 'remboursement', new.subtotal_gnf)
        on conflict do nothing;
    elsif o.payment_method = 'orange_money' and o.payment_status = 'bloque' then
      -- Payé d'avance, rien de livré : la part de ce colis sort du séquestre et revient à l'acheteur.
      insert into public.ledger_entries (account, account_id, parcel_id, order_id, kind, amount_gnf) values
        ('escrow', null, new.id, o.id, 'remboursement_escrow', -total),
        ('buyer', o.buyer_id, new.id, o.id, 'remboursement', total)
        on conflict do nothing;
      update public.payments set refunded_gnf = refunded_gnf + total where order_id = o.id;
      select refunded_gnf into refunded from public.payments where order_id = o.id;
      if not exists (select 1 from public.parcels where order_id = o.id and status <> 'annule') then
        update public.payments set status = 'rembourse' where order_id = o.id;
        update public.orders set payment_status = 'rembourse' where id = o.id;
      elsif not exists (select 1 from public.parcels where order_id = o.id and status not in ('remis', 'annule')) then
        update public.orders set payment_status = 'libere' where id = o.id;
      end if;
    end if;
  end if;
  return new;
end $$;
create trigger parcels_money after update of status on public.parcels for each row execute function public.parcel_money_after();

-- ── Reversements : l'équipe enregistre ce qui a été versé aux vendeurs et rendu aux acheteurs ───────────────────────────────
create or replace function public.fn_shop_payout(p_shop uuid, p_amount integer)
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare bal integer;
begin
  if not public.is_admin() then raise exception 'réservé à l''équipe Hailand'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'montant invalide'; end if;
  select coalesce(sum(amount_gnf), 0) into bal from public.ledger_entries where account = 'shop' and account_id = p_shop;
  if p_amount > bal then raise exception 'solde insuffisant (% GNF dû au vendeur)', bal; end if;
  insert into public.ledger_entries (account, account_id, kind, amount_gnf) values ('shop', p_shop, 'reversement_vendeur', -p_amount);
  return bal - p_amount;
end $$;

create or replace function public.fn_refund_paid(p_buyer uuid, p_amount integer)
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare bal integer;
begin
  if not public.is_admin() then raise exception 'réservé à l''équipe Hailand'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'montant invalide'; end if;
  select coalesce(sum(amount_gnf), 0) into bal from public.ledger_entries where account = 'buyer' and account_id = p_buyer;
  if p_amount > bal then raise exception 'solde insuffisant (% GNF à rembourser)', bal; end if;
  insert into public.ledger_entries (account, account_id, kind, amount_gnf) values ('buyer', p_buyer, 'remboursement_verse', -p_amount);
  return bal - p_amount;
end $$;

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace)
           and p.proname in ('fn_pay_start', 'fn_payment_confirm', 'fn_shop_payout', 'fn_refund_paid', 'parcel_money_after', 'is_service_role', 'setting_int', 'fn_parcel_ready') loop
    execute format('revoke all on function %s from public, anon', f.sig);
    if f.proname in ('fn_pay_start', 'fn_shop_payout', 'fn_refund_paid', 'fn_parcel_ready') then execute format('grant execute on function %s to authenticated', f.sig); end if;
    if f.proname = 'fn_payment_confirm' then execute format('grant execute on function %s to authenticated', f.sig); end if;
    if f.proname in ('parcel_money_after') then execute format('revoke all on function %s from authenticated', f.sig); end if;
  end loop;
end $$;

-- Le serveur de paiement (clé de service, côté serveur seulement) confirme les paiements reçus du fournisseur.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.fn_payment_confirm(uuid, text, integer) to service_role;
  end if;
end $$;
