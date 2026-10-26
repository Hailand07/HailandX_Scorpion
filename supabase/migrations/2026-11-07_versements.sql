-- Versements aux vendeurs et aux livreurs (HAILANDX.md §48). Décisions du fondateur le 2026-10-26 : Hailand paie les frais
-- de versement ; versement chaque semaine ; l'argent d'une vente devient disponible 48 h après la remise (délai pour un
-- litige) ; sur une commande en espèces, le livreur garde son gain et ne reverse que le reste.
-- Chaque boutique et chaque livreur enregistre son moyen de versement (Orange Money, MTN MoMo, Kulu, Soutra Money, PayCard
-- ou banque) ; un CHANGEMENT de moyen n'est utilisable qu'après 48 h (parade contre le détournement d'un compte) et prévient
-- le titulaire et l'équipe. L'équipe enregistre chaque versement (Console → Argent) ; versement automatique par l'API Djomy
-- plus tard. Ajouts et create or replace seulement. Idempotente.
begin;

create table if not exists public.payout_methods (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references public.shops (id) on delete cascade,
  courier_id uuid references public.couriers (user_id) on delete cascade,
  method text not null check (method in ('orange_money', 'mtn_momo', 'kulu', 'soutra_money', 'paycard', 'banque')),
  account_number text not null check (length(account_number) between 6 and 40),
  holder_name text not null check (length(btrim(holder_name)) between 2 and 120),
  usable_from timestamptz not null default now(),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  check ((shop_id is null) <> (courier_id is null))
);
create index if not exists payout_methods_shop on public.payout_methods (shop_id, created_at desc);
create index if not exists payout_methods_courier on public.payout_methods (courier_id, created_at desc);
comment on table public.payout_methods is 'Moyens de versement des boutiques et des livreurs (historique : le plus récent fait foi), §48';
alter table public.payout_methods enable row level security;
drop policy if exists payout_methods_read on public.payout_methods;
create policy payout_methods_read on public.payout_methods for select to authenticated
  using ((shop_id is not null and public.fn_is_shop_owner(shop_id)) or courier_id = auth.uid() or public.is_admin());

create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references public.shops (id) on delete set null,
  courier_id uuid references public.couriers (user_id) on delete set null,
  amount_gnf integer not null check (amount_gnf > 0),
  method text not null, account_number text not null, holder_name text not null,
  channel text not null default 'manuel' check (channel in ('manuel', 'djomy', 'chapchappay')),
  provider_ref text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  check ((shop_id is null) <> (courier_id is null))
);
comment on table public.payouts is 'Versements faits aux boutiques et aux livreurs, avec le moyen utilisé (copie), §48';
alter table public.payouts enable row level security;
drop policy if exists payouts_read on public.payouts;
create policy payouts_read on public.payouts for select to authenticated
  using ((shop_id is not null and public.fn_is_shop_owner(shop_id)) or courier_id = auth.uid() or public.is_admin());

-- Numéro de mobile money ramené à 224XXXXXXXXX ; un compte bancaire est gardé tel quel (sans espaces superflus).
create or replace function private.payout_account(p_method text, p_account text) returns text
language plpgsql immutable set search_path = public, pg_temp as $$
declare d text := regexp_replace(coalesce(p_account, ''), '\D', '', 'g');
begin
  if p_method = 'banque' then return nullif(regexp_replace(btrim(coalesce(p_account, '')), '\s+', ' ', 'g'), ''); end if;
  if d like '00%' then d := substr(d, 3); end if;
  if length(d) = 9 then d := '224' || d; end if;
  if d !~ '^224[0-9]{9}$' then return null; end if;
  return d;
end $$;

-- Enregistrer ou changer son moyen de versement : propriétaire de la boutique, ou le livreur pour lui-même.
create or replace function public.fn_payout_method_set(p_shop uuid, p_method text, p_account text, p_holder text)
returns timestamptz language plpgsql security definer set search_path = public, private, pg_temp as $$
declare acc text := private.payout_account(p_method, p_account); had boolean; usable timestamptz; who text;
begin
  if auth.uid() is null then raise exception 'connexion requise'; end if;
  if p_method not in ('orange_money', 'mtn_momo', 'kulu', 'soutra_money', 'paycard', 'banque') then raise exception 'moyen de versement inconnu'; end if;
  if acc is null then raise exception 'numéro invalide : un numéro guinéen à 9 chiffres (ex. 620 00 00 00)'; end if;
  if length(btrim(coalesce(p_holder, ''))) < 2 then raise exception 'indiquez le nom du titulaire du compte'; end if;
  if p_shop is not null then
    if not public.fn_is_shop_owner(p_shop) then raise exception 'réservé au propriétaire de la boutique'; end if;
    had := exists (select 1 from public.payout_methods where shop_id = p_shop);
  else
    if not exists (select 1 from public.couriers where user_id = auth.uid()) then raise exception 'réservé aux livreurs de la Flotte'; end if;
    had := exists (select 1 from public.payout_methods where courier_id = auth.uid());
  end if;
  -- Premier moyen : utilisable tout de suite. Changement : 48 h d'attente, titulaire et équipe prévenus.
  usable := case when had then now() + interval '48 hours' else now() end;
  insert into public.payout_methods (shop_id, courier_id, method, account_number, holder_name, usable_from)
  values (p_shop, case when p_shop is null then auth.uid() end, p_method, acc, btrim(p_holder), usable);
  if had then
    if p_shop is not null then
      perform private.notify_shop(p_shop, 'argent', 'Moyen de versement modifié', 'Il sera utilisé à partir du ' || to_char(usable, 'DD/MM à HH24:MI') || '. Si ce n''est pas vous, prévenez Hailand tout de suite.', '/vendeur/argent');
      select name into who from public.shops where id = p_shop;
    else
      perform private.notify(auth.uid(), 'argent', 'Moyen de versement modifié', 'Il sera utilisé à partir du ' || to_char(usable, 'DD/MM à HH24:MI') || '. Si ce n''est pas vous, prévenez Hailand tout de suite.', '/');
      select full_name into who from public.couriers where user_id = auth.uid();
    end if;
    perform private.notify_admins('argent', 'Moyen de versement modifié', coalesce(who, '') || ' — utilisable dans 48 h', '/console/argent');
  end if;
  return usable;
end $$;

-- Ce qui peut être versé : le solde moins les ventes et gains de moins de 48 h (hors HailandPay, déjà versé au portefeuille,
-- et hors espèces gardées par le livreur).
create or replace function private.payable_gnf(p_account text, p_id uuid) returns integer
language sql stable security definer set search_path = public, pg_temp as $$
  select greatest(0, coalesce(sum(l.amount_gnf), 0) - coalesce(sum(l.amount_gnf) filter (
    where l.amount_gnf > 0 and l.kind in ('reglement_vendeur', 'gain_livreur') and l.created_at > now() - interval '48 hours'
      and coalesce(o.payment_method, '') <> 'hailandpay'
      and not (l.account = 'courier' and coalesce(o.payment_method, '') = 'livraison')), 0))::integer
  from public.ledger_entries l left join public.orders o on o.id = l.order_id
  where l.account = p_account and l.account_id = p_id
$$;

-- Pour la boutique ou le livreur : solde, disponible, en attente (48 h), moyen de versement.
create or replace function public.fn_my_payout_summary(p_shop uuid default null)
returns table (balance_gnf integer, payable_gnf integer, waiting_gnf integer, method text, account_number text, holder_name text, usable_from timestamptz)
language plpgsql stable security definer set search_path = public, private, pg_temp as $$
declare acc text; v_id uuid; bal integer; pay integer; m public.payout_methods;
begin
  if p_shop is not null then
    if not public.fn_is_shop_owner(p_shop) then raise exception 'réservé au propriétaire de la boutique'; end if;
    acc := 'shop'; v_id := p_shop;
    select * into m from public.payout_methods where shop_id = p_shop order by created_at desc limit 1;
  else
    acc := 'courier'; v_id := auth.uid();
    select * into m from public.payout_methods where courier_id = auth.uid() order by created_at desc limit 1;
  end if;
  select coalesce(sum(amount_gnf), 0)::integer into bal from public.ledger_entries where account = acc and account_id = v_id;
  pay := private.payable_gnf(acc, v_id);
  return query select bal, pay, greatest(0, bal - pay), m.method, m.account_number, m.holder_name, m.usable_from;
end $$;

-- Équipe : les versements de la semaine (boutiques et livreurs à qui Hailand doit de l'argent).
create or replace function public.fn_payouts_due()
returns table (kind text, target_id uuid, name text, phone text, balance_gnf integer, payable_gnf integer, method text, account_number text, holder_name text, usable_from timestamptz)
language plpgsql stable security definer set search_path = public, private, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'réservé à l''équipe Hailand'; end if;
  return query
  with bal as (
    select l.account, l.account_id, sum(l.amount_gnf)::integer b from public.ledger_entries l
     where l.account in ('shop', 'courier') and l.account_id is not null group by 1, 2 having sum(l.amount_gnf) > 0
  )
  select case when bal.account = 'shop' then 'boutique' else 'livreur' end, bal.account_id,
         coalesce(s.name, c.full_name, '—'), c.phone, bal.b, private.payable_gnf(bal.account, bal.account_id),
         m.method, m.account_number, m.holder_name, m.usable_from
    from bal
    left join public.shops s on bal.account = 'shop' and s.id = bal.account_id
    left join public.couriers c on bal.account = 'courier' and c.user_id = bal.account_id
    left join lateral (select * from public.payout_methods pm
       where (bal.account = 'shop' and pm.shop_id = bal.account_id) or (bal.account = 'courier' and pm.courier_id = bal.account_id)
       order by pm.created_at desc limit 1) m on true
   order by bal.b desc;
end $$;

-- Équipe : enregistre un versement fait (sur le moyen en vigueur, jamais plus que le disponible).
create or replace function public.fn_payout_record(p_kind text, p_target uuid, p_amount integer, p_ref text default null)
returns uuid language plpgsql security definer set search_path = public, private, pg_temp as $$
declare acc text := case p_kind when 'boutique' then 'shop' when 'livreur' then 'courier' end; m public.payout_methods; pay integer; v uuid;
begin
  if not public.is_admin() then raise exception 'réservé à l''équipe Hailand'; end if;
  if acc is null then raise exception 'destinataire inconnu'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'montant invalide'; end if;
  select * into m from public.payout_methods
   where (acc = 'shop' and shop_id = p_target) or (acc = 'courier' and courier_id = p_target) order by created_at desc limit 1;
  if not found then raise exception 'aucun moyen de versement enregistré'; end if;
  if m.usable_from > now() then raise exception 'moyen de versement modifié récemment : utilisable à partir du %', to_char(m.usable_from, 'DD/MM à HH24:MI'); end if;
  pay := private.payable_gnf(acc, p_target);
  if p_amount > pay then raise exception 'montant supérieur au disponible (% GNF)', pay; end if;
  insert into public.payouts (shop_id, courier_id, amount_gnf, method, account_number, holder_name, provider_ref)
  values (case when acc = 'shop' then p_target end, case when acc = 'courier' then p_target end, p_amount, m.method, m.account_number, m.holder_name, nullif(btrim(coalesce(p_ref, '')), ''))
  returning id into v;
  insert into public.ledger_entries (account, account_id, kind, amount_gnf)
  values (acc, p_target, case when acc = 'shop' then 'reversement_vendeur' else 'reversement_livreur' end, -p_amount);
  if acc = 'shop' then
    perform private.notify_shop(p_target, 'argent', 'Versement envoyé', public.fn_gnf(p_amount) || ' GNF envoyés sur votre compte (' || m.method || ' ••' || right(m.account_number, 2) || ').', '/vendeur/argent');
  else
    perform private.notify(p_target, 'argent', 'Versement envoyé', public.fn_gnf(p_amount) || ' GNF envoyés sur votre compte (' || m.method || ' ••' || right(m.account_number, 2) || ').', '/livraisons');
    perform private.journal('versement_livreur', 'livreur', p_target::text, jsonb_build_object('montant', p_amount, 'moyen', m.method));
  end if;
  return v;
end $$;

revoke all on function private.payout_account(text, text), private.payable_gnf(text, uuid) from public, anon, authenticated;
revoke all on function public.fn_payout_method_set(uuid, text, text, text), public.fn_my_payout_summary(uuid), public.fn_payouts_due(), public.fn_payout_record(text, uuid, integer, text) from public, anon;
grant execute on function public.fn_payout_method_set(uuid, text, text, text), public.fn_my_payout_summary(uuid), public.fn_payouts_due(), public.fn_payout_record(text, uuid, integer, text) to authenticated;

create or replace function public.parcel_money_after()
returns trigger language plpgsql security definer set search_path = public, private, pg_temp as $$
declare
  o public.orders; bps integer; cshare integer; commission integer; shop_net integer; courier_gain integer; platform_gain integer; total integer; settled boolean; refunded integer; fee_back integer;
  comp integer; prov integer; keep integer;
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
      -- L'argent est dans la poche du livreur jusqu'à ce qu'il le reverse à l'équipe (fn_courier_cash_settle).
      if new.cod_amount_gnf > 0 and new.courier_id is not null then
        insert into public.ledger_entries (account, account_id, parcel_id, order_id, kind, amount_gnf)
        values ('courier_cash', new.courier_id, new.id, o.id, 'especes_encaissees', new.cod_amount_gnf) on conflict do nothing;
      end if;
    end if;
    insert into public.ledger_entries (account, account_id, parcel_id, order_id, kind, amount_gnf) values
      ('shop', new.shop_id, new.id, o.id, 'reglement_vendeur', shop_net),
      ('courier', new.courier_id, new.id, o.id, 'gain_livreur', courier_gain),
      ('platform', null, new.id, o.id, 'commission', platform_gain),
      ('escrow', null, new.id, o.id, 'liberation', -total)
      on conflict do nothing;
    -- §48 : sur une commande en espèces, le livreur garde son gain sur l'argent encaissé (il ne reverse que le reste).
    if o.payment_method = 'livraison' and new.cod_amount_gnf > 0 and new.courier_id is not null and courier_gain > 0 then
      insert into public.ledger_entries (account, account_id, parcel_id, order_id, kind, amount_gnf) values
        ('courier', new.courier_id, new.id, o.id, 'gain_garde_especes', -courier_gain),
        ('courier_cash', new.courier_id, new.id, o.id, 'gain_garde_especes', -courier_gain)
        on conflict do nothing;
    end if;
    if not exists (select 1 from public.parcels where order_id = o.id and status not in ('remis', 'annule')) then
      update public.orders set payment_status = 'libere' where id = o.id and payment_status in ('bloque', 'en_attente');
    end if;

  elsif new.status = 'annule' and old.status is distinct from 'annule' then
    settled := exists (select 1 from public.ledger_entries where parcel_id = new.id and kind = 'reglement_vendeur');
    if settled then
      bps := private.setting_int('commission_bps', 800);
      commission := round(new.subtotal_gnf * bps / 10000.0)::integer;
      shop_net := new.subtotal_gnf - commission;
      -- H4 : litige tranché pour l'acheteur → les frais de livraison lui sont rendus, repris à la boutique.
      fee_back := case when exists (select 1 from public.disputes d where d.parcel_id = new.id and d.status = 'resolu' and d.resolution = 'acheteur')
                       then new.delivery_fee_gnf else 0 end;
      insert into public.ledger_entries (account, account_id, parcel_id, order_id, kind, amount_gnf) values
        ('shop', new.shop_id, new.id, o.id, 'annulation_vendeur', -(shop_net + fee_back)),
        ('platform', null, new.id, o.id, 'annulation_commission', -commission),
        ('buyer', o.buyer_id, new.id, o.id, 'remboursement', new.subtotal_gnf + fee_back)
        on conflict do nothing;
    else
      -- §45 : indemnité du livreur parti (old.courier_id : fn_parcel_cancel vide courier_id) et frais de paiement retenus.
      comp := case when old.courier_id is not null then new.cancel_courier_gnf else 0 end;
      prov := new.cancel_provider_gnf;
      if comp > 0 then
        insert into public.ledger_entries (account, account_id, parcel_id, order_id, kind, amount_gnf)
        values ('courier', old.courier_id, new.id, o.id, 'gain_livreur', comp) on conflict do nothing;
      end if;
      if o.payment_method in ('orange_money', 'hailandpay') and o.payment_status = 'bloque' then
        keep := case when new.cancelled_by = 'acheteur' then least(total, comp + prov) else 0 end;
        insert into public.ledger_entries (account, account_id, parcel_id, order_id, kind, amount_gnf)
        values ('escrow', null, new.id, o.id, 'remboursement_escrow', -total) on conflict do nothing;
        if total - keep > 0 then
          insert into public.ledger_entries (account, account_id, parcel_id, order_id, kind, amount_gnf)
          values ('buyer', o.buyer_id, new.id, o.id, 'remboursement', total - keep) on conflict do nothing;
        end if;
        if new.cancelled_by = 'acheteur' and prov > 0 then
          insert into public.ledger_entries (account, account_id, parcel_id, order_id, kind, amount_gnf)
          values ('platform', null, new.id, o.id, 'frais_paiement_annulation', prov) on conflict do nothing;
        end if;
        update public.payments set refunded_gnf = refunded_gnf + (total - keep) where order_id = o.id;
        if not exists (select 1 from public.parcels where order_id = o.id and status <> 'annule') then
          update public.payments set status = 'rembourse' where order_id = o.id;
          update public.orders set payment_status = 'rembourse' where id = o.id;
        elsif not exists (select 1 from public.parcels where order_id = o.id and status not in ('remis', 'annule')) then
          update public.orders set payment_status = 'libere' where id = o.id;
        end if;
      else
        keep := 0;  -- espèces (ou paiement en ligne pas encore reçu) : rien à retenir sur l'acheteur
      end if;
      -- Qui paie l'indemnité qui n'a pas été retenue sur l'acheteur : la boutique si elle a annulé, sinon Hailand.
      if comp > 0 and keep < comp + prov then
        if new.cancelled_by = 'vendeur' then
          insert into public.ledger_entries (account, account_id, parcel_id, order_id, kind, amount_gnf)
          values ('shop', new.shop_id, new.id, o.id, 'annulation_vendeur', -comp) on conflict do nothing;
        else
          insert into public.ledger_entries (account, account_id, parcel_id, order_id, kind, amount_gnf)
          values ('platform', null, new.id, o.id, 'indemnite_livreur', -comp) on conflict do nothing;
        end if;
      end if;
    end if;
  end if;
  return new;
end $$;

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
  a_lat := st_y(coalesce(d.anchor_point, d.gps_point)); a_lng := st_x(coalesce(d.anchor_point, d.gps_point));
  if c.last_lat is null or c.last_seen_at is null or c.last_seen_at < now() - interval '10 minutes' then
    raise exception 'position du livreur inconnue : il doit activer sa localisation';
  end if;
  dist := public.fn_haversine_m(c.last_lat, c.last_lng, a_lat, a_lng);
  tol := case when d.anchor_point is not null then 150 else 150 + least(coalesce(d.gps_accuracy_m, 0), 100) end;
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

-- Rappel chaque lundi (8 h 07, heure de Conakry = UTC) : l'équipe reçoit le nombre de versements prêts.
create or replace function private.payouts_weekly_notice() returns void
language plpgsql security definer set search_path = public, private, pg_temp as $$
declare n integer; total integer;
begin
  select count(*), coalesce(sum(p), 0) into n, total from (
    select private.payable_gnf(l.account, l.account_id) p from public.ledger_entries l
     where l.account in ('shop', 'courier') and l.account_id is not null group by l.account, l.account_id) x where p > 0;
  if n > 0 then perform private.notify_admins('argent', 'Versements de la semaine', n || ' versement(s) prêt(s), ' || public.fn_gnf(total) || ' GNF', '/console/argent'); end if;
end $$;
revoke all on function private.payouts_weekly_notice() from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'hailandx-versements-hebdo';
    perform cron.schedule('hailandx-versements-hebdo', '7 8 * * 1', 'select private.payouts_weekly_notice()');
  end if;
end $$;

commit;
