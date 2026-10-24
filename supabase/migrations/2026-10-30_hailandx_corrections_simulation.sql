-- HailandX — corrections issues de la simulation complète acheteur ↔ vendeur du 2026-10-23 (HAILANDX.md §40 et §41).
-- Accord du fondateur le 2026-10-24 (« corrige A1 et A2 puis A3 à A6 ainsi que le reste ; laisse à 15 millions le plafond »).
-- Idempotente : peut être rejouée sans dommage.
--   A1  annulation : vendeur, puis acheteur, puis équipe (un administrateur qui vend ou achète n'annule plus « au nom de l'équipe »)
--   A2  notifications de litige du vendeur → HailandX Vendeur (/vendeur/commandes/<colis>)
--   A3  notifications d'équipe → Hailand Console (/console/…), plus jamais dans le fil acheteur
--   A4  plafond d'espèces : compte aussi les missions acceptées non livrées ; plafond par défaut 15 000 000 GNF
--   A5  le vendeur est prévenu de la remise et de la somme ajoutée à son solde
--   A6  annulation : « remettre en stock ? » (p_restock)
--   A7  litige : remboursement partiel (p_refund_gnf, disputes.refund_gnf)
--   A8  textes des notifications (commande avec article et montant, annulations, décision de litige)
--   A9  frais de livraison connus avant de commander (fn_delivery_quote)
--   A10 grand livre : compte « courier_cash » (espèces chez les livreurs)
--   A11 remise : tolérance plafonnée (une adresse imprécise ne permet plus de remettre à 650 m)
--   A13 ventes : « commandé » et « encaissé » (fn_shop_sales.delivered_gnf)

begin;

-- ───────────── A1 + A6 : annulation ─────────────
drop function if exists public.fn_parcel_cancel(uuid, text);
create or replace function public.fn_parcel_cancel(p_parcel uuid, p_reason text default null, p_restock boolean default true)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare p public.parcels; o public.orders; v_by text; v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  select * into p from public.parcels where id = p_parcel for update;
  if not found then raise exception 'colis introuvable'; end if;
  select * into o from public.orders where id = p.order_id;
  -- Le rôle réel d'abord : un administrateur qui est aussi vendeur ou acheteur agit comme tel.
  if public.fn_is_shop_member(p.shop_id) and p.status in ('attente_vendeur', 'prepare', 'mission_proposee', 'accepte') then v_by := 'vendeur';
  elsif o.buyer_id = auth.uid() and p.status = 'attente_vendeur' then v_by := 'acheteur';
  elsif public.is_admin() then v_by := 'equipe';
  else raise exception 'annulation impossible à ce stade';
  end if;
  if p.status in ('retire', 'remis', 'annule') and v_by <> 'equipe' then raise exception 'annulation impossible à ce stade'; end if;
  if p.status = 'annule' then raise exception 'ce colis est déjà annulé'; end if;
  if v_by = 'vendeur' and (v_reason is null or length(v_reason) < 3) then raise exception 'indiquez le motif de l''annulation : le client le verra'; end if;
  update public.parcels set status = 'annule', courier_id = null, cancel_reason = left(v_reason, 300), cancelled_by = v_by where id = p_parcel;
  -- Le stock revient en rayon, sauf si le vendeur dit le contraire (rupture : il n'y a plus rien à vendre).
  if v_by <> 'vendeur' or coalesce(p_restock, true) then
    update public.offer_variants v set stock = v.stock + i.quantity from public.order_items i where i.parcel_id = p_parcel and i.variant_id = v.id;
  end if;
  insert into public.delivery_events (parcel_id, kind, actor_id) values (p_parcel, 'annule', auth.uid());
  return 'annule';
end $$;

-- ───────────── A4 : plafond d'espèces ─────────────
alter table public.couriers alter column cash_limit_gnf set default 15000000;

create or replace function public.fn_courier_accept(p_parcel uuid)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare c public.couriers; p public.parcels; pending integer;
begin
  select * into c from public.couriers where user_id = auth.uid();
  if not found or c.status <> 'valide' then raise exception 'compte livreur non validé'; end if;
  if not c.available then raise exception 'vous êtes indisponible'; end if;
  update public.parcels set status = 'accepte', courier_id = c.user_id where id = p_parcel and status = 'mission_proposee' returning * into p;
  if not found then raise exception 'mission déjà prise ou indisponible'; end if;
  -- Espèces à encaisser sur les missions déjà acceptées ou en route (pas encore remises).
  select coalesce(sum(x.cod_amount_gnf), 0) into pending from public.parcels x
   where x.courier_id = c.user_id and x.status in ('accepte', 'retire') and x.id <> p.id;
  if c.cash_balance_gnf + pending + p.cod_amount_gnf > c.cash_limit_gnf then
    update public.parcels set status = 'mission_proposee', courier_id = null where id = p_parcel;
    if c.cash_balance_gnf = 0 and pending = 0 then
      raise exception 'plafond d''espèces : cette mission demande d''encaisser % GNF, plus que votre plafond de % GNF. Demandez à l''équipe Hailand de le relever.',
        public.fn_gnf(p.cod_amount_gnf), public.fn_gnf(c.cash_limit_gnf);
    end if;
    raise exception 'plafond d''espèces : % GNF en main et % GNF à encaisser sur vos missions en cours ; avec les % GNF de cette mission, vous dépasseriez votre plafond de % GNF. Livrez ou reversez vos espèces d''abord.',
      public.fn_gnf(c.cash_balance_gnf), public.fn_gnf(pending), public.fn_gnf(p.cod_amount_gnf), public.fn_gnf(c.cash_limit_gnf);
  end if;
  insert into public.delivery_events (parcel_id, kind, actor_id) values (p_parcel, 'accepte', c.user_id);
  return 'accepte';
end $$;

-- ───────────── A11 : tolérance de remise plafonnée ─────────────
-- Point désigné sur la carte (anchor_point) : 150 m. Sinon 150 m + précision du GPS, plafonnée à 100 m (250 m au plus).
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
  if p.cod_amount_gnf > 0 then update public.couriers set cash_balance_gnf = cash_balance_gnf + p.cod_amount_gnf where user_id = p.courier_id; end if;
  return 'remis';
end $$;

-- ───────────── A10 : espèces chez les livreurs dans le grand livre ─────────────
alter table public.ledger_entries drop constraint if exists ledger_entries_account_check;
alter table public.ledger_entries add constraint ledger_entries_account_check check (account in ('escrow', 'shop', 'courier', 'platform', 'buyer', 'courier_cash'));
drop index if exists public.ledger_once;
create unique index ledger_once on public.ledger_entries (parcel_id, account, kind)
  where kind in ('reglement_vendeur', 'gain_livreur', 'commission', 'liberation', 'encaissement_especes', 'annulation_vendeur', 'annulation_commission',
                 'remboursement', 'remboursement_escrow', 'especes_encaissees', 'remboursement_partiel_vendeur', 'remboursement_partiel_commission');

create or replace function public.parcel_money_after()
returns trigger language plpgsql security definer set search_path = public, private, pg_temp as $$
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
    if not exists (select 1 from public.parcels where order_id = o.id and status not in ('remis', 'annule')) then
      update public.orders set payment_status = 'libere' where id = o.id and payment_status in ('bloque', 'en_attente');
    end if;

  elsif new.status = 'annule' and old.status is distinct from 'annule' then
    settled := exists (select 1 from public.ledger_entries where parcel_id = new.id and kind = 'reglement_vendeur');
    if settled then
      bps := private.setting_int('commission_bps', 800);
      commission := round(new.subtotal_gnf * bps / 10000.0)::integer;
      shop_net := new.subtotal_gnf - commission;
      insert into public.ledger_entries (account, account_id, parcel_id, order_id, kind, amount_gnf) values
        ('shop', new.shop_id, new.id, o.id, 'annulation_vendeur', -shop_net),
        ('platform', null, new.id, o.id, 'annulation_commission', -commission),
        ('buyer', o.buyer_id, new.id, o.id, 'remboursement', new.subtotal_gnf)
        on conflict do nothing;
    elsif o.payment_method = 'orange_money' and o.payment_status = 'bloque' then
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

create or replace function public.fn_courier_cash_settle(p_courier uuid, p_amount integer)
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare before integer; nb integer;
begin
  if not public.is_admin() then raise exception 'réservé à l''équipe Hailand'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'montant invalide'; end if;
  select cash_balance_gnf into before from public.couriers where user_id = p_courier for update;
  if not found then raise exception 'livreur introuvable'; end if;
  update public.couriers set cash_balance_gnf = greatest(0, cash_balance_gnf - p_amount) where user_id = p_courier returning cash_balance_gnf into nb;
  if before - nb > 0 then
    insert into public.ledger_entries (account, account_id, kind, amount_gnf) values ('courier_cash', p_courier, 'especes_reversees', -(before - nb));
  end if;
  return nb;
end $$;

-- Solde d'ouverture : les espèces déjà en main avant ce compte (une seule fois par livreur).
insert into public.ledger_entries (account, account_id, kind, amount_gnf)
select 'courier_cash', c.user_id, 'solde_ouverture', c.cash_balance_gnf from public.couriers c
where c.cash_balance_gnf > 0 and not exists (select 1 from public.ledger_entries l where l.account = 'courier_cash' and l.account_id = c.user_id);

-- ───────────── A7 : remboursement partiel d'un litige ─────────────
alter table public.disputes add column if not exists refund_gnf integer;
alter table public.disputes drop constraint if exists disputes_refund_gnf_check;
alter table public.disputes add constraint disputes_refund_gnf_check check (refund_gnf is null or refund_gnf > 0);

drop function if exists public.fn_resolve_dispute(uuid, text, text);
create or replace function public.fn_resolve_dispute(p_dispute uuid, p_in_favor_of text, p_note text default null, p_refund_gnf integer default null)
returns text language plpgsql security definer set search_path = public, private, pg_temp as $$
declare d public.disputes; p public.parcels; o public.orders; new_status text; v_refund integer; bps integer; comm integer;
begin
  if not public.is_admin() then raise exception 'réservé à l''équipe Hailand'; end if;
  if p_in_favor_of not in ('acheteur', 'vendeur') then raise exception 'décision inconnue'; end if;
  select * into d from public.disputes where id = p_dispute for update;
  if not found then raise exception 'litige introuvable'; end if;
  if d.status <> 'ouvert' then raise exception 'ce litige est déjà tranché'; end if;
  select * into p from public.parcels where id = d.parcel_id for update;
  select * into o from public.orders where id = p.order_id;
  if p_in_favor_of = 'acheteur' then
    if p_refund_gnf is not null and p_refund_gnf <= 0 then raise exception 'montant du remboursement invalide'; end if;
    v_refund := least(coalesce(p_refund_gnf, p.subtotal_gnf), p.subtotal_gnf);
  end if;
  -- Remboursement total : colis annulé (règles d'annulation du grand livre). Partiel : le colis reste remis, on rend une partie.
  new_status := case when p_in_favor_of = 'acheteur' and v_refund >= p.subtotal_gnf then 'annule' else 'remis' end;
  update public.disputes set status = 'resolu', resolution = p_in_favor_of, note = nullif(btrim(p_note), ''), refund_gnf = v_refund,
    resolved_by = auth.uid(), resolved_at = now() where id = p_dispute;
  update public.parcels set status = new_status, delivered_at = coalesce(delivered_at, now()) where id = d.parcel_id;
  if p_in_favor_of = 'acheteur' and new_status = 'remis' then
    bps := private.setting_int('commission_bps', 800);
    comm := round(v_refund * bps / 10000.0)::integer;
    insert into public.ledger_entries (account, account_id, parcel_id, order_id, kind, amount_gnf) values
      ('shop', p.shop_id, p.id, o.id, 'remboursement_partiel_vendeur', -(v_refund - comm)),
      ('platform', null, p.id, o.id, 'remboursement_partiel_commission', -comm),
      ('buyer', o.buyer_id, p.id, o.id, 'remboursement', v_refund)
      on conflict do nothing;
  end if;
  insert into public.delivery_events (parcel_id, kind, actor_id) values (d.parcel_id, new_status, auth.uid());
  return new_status;
end $$;

-- ───────────── A2, A3, A5, A8 : notifications ─────────────
create or replace function public.notify_parcel_events()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare buyer uuid; shop_name text; net integer;
begin
  -- La « nouvelle commande » part de l'événement « cree » (notify_new_parcel), quand articles et montant sont connus.
  if tg_op = 'INSERT' then return new; end if;
  if new.status is not distinct from old.status then return new; end if;
  select o.buyer_id into buyer from public.orders o where o.id = new.order_id;
  select name into shop_name from public.shops where id = new.shop_id;
  -- Sortie d'un litige : c'est la décision (notify_dispute_resolved) qui prévient les deux parties.
  if old.status = 'litige' and new.status in ('remis', 'annule') then return new; end if;
  case new.status
    when 'accepte' then perform private.notify(buyer, 'suivi', 'Un livreur a accepté votre colis', shop_name, '/commandes/' || new.order_id);
    when 'retire' then perform private.notify(buyer, 'suivi', 'Votre colis est en route', 'Gardez votre code de remise à portée de main.', '/commandes/' || new.order_id);
    when 'remis' then
      perform private.notify(buyer, 'suivi', 'Colis remis', 'Donnez votre avis sur ' || shop_name || '.', '/commandes/' || new.order_id);
      select amount_gnf into net from public.ledger_entries where parcel_id = new.id and account = 'shop' and kind = 'reglement_vendeur';
      perform private.notify_shop(new.shop_id, 'commande', 'Colis remis au client',
        case when net is not null then public.fn_gnf(net) || ' GNF ajoutés à votre solde (commission Hailand déduite).' else 'La livraison est terminée.' end,
        '/vendeur/commandes/' || new.id);
    when 'annule' then
      if new.cancelled_by is distinct from 'acheteur' then
        perform private.notify(buyer, 'suivi', 'Colis annulé', shop_name || coalesce(' : ' || new.cancel_reason, ''), '/commandes/' || new.order_id);
      end if;
      if new.cancelled_by = 'acheteur' then
        perform private.notify_shop(new.shop_id, 'commande', 'Commande annulée par le client', 'Inutile de la préparer ; le stock est remis en rayon.', '/vendeur/commandes/' || new.id);
      elsif new.cancelled_by = 'equipe' then
        perform private.notify_shop(new.shop_id, 'commande', 'Colis annulé par l''équipe Hailand', coalesce(new.cancel_reason, 'Voir le détail de la commande.'), '/vendeur/commandes/' || new.id);
      end if;
    when 'litige' then
      perform private.notify_shop(new.shop_id, 'litige', 'Un acheteur a signalé un problème', 'Donnez votre version dans les échanges : l''équipe Hailand tranche.', '/vendeur/commandes/' || new.id);
      perform private.notify_admins('litige', 'Litige à traiter', shop_name, '/console/litiges');
    else null;
  end case;
  return new;
end $$;

create or replace function public.notify_new_parcel()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare p public.parcels; first_item text; n integer; quartier text;
begin
  if new.kind <> 'cree' then return new; end if;
  select * into p from public.parcels where id = new.parcel_id;
  select count(*) into n from public.order_items where parcel_id = p.id;
  select i.name_snapshot || case when v.label is not null and v.label <> 'Standard' then ' (' || v.label || ')' else '' end
           || case when i.quantity > 1 then ' ×' || i.quantity else '' end
    into first_item
    from public.order_items i left join public.offer_variants v on v.id = i.variant_id
   where i.parcel_id = p.id order by i.price_gnf_snapshot * i.quantity desc, i.name_snapshot limit 1;
  select q.nom into quartier from public.orders o join public.declarations d on d.id = o.delivery_declaration_id
    left join public.quartiers q on q.id = d.quartier_id where o.id = p.order_id;
  perform private.notify_shop(p.shop_id, 'commande', 'Nouvelle commande · ' || public.fn_gnf(p.subtotal_gnf) || ' GNF',
    coalesce(first_item, 'Articles') || case when n > 1 then ' + ' || (n - 1) || case when n > 2 then ' autres articles' else ' autre article' end else '' end
      || coalesce(' · ' || quartier, '') || '. À préparer.',
    '/vendeur/commandes/' || p.id);
  return new;
end $$;
drop trigger if exists delivery_events_notify on public.delivery_events;
create trigger delivery_events_notify after insert on public.delivery_events for each row execute function public.notify_new_parcel();

create or replace function public.notify_dispute_message()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare d public.disputes; p public.parcels;
begin
  select * into d from public.disputes where id = new.dispute_id;
  select * into p from public.parcels where id = d.parcel_id;
  if new.author_role <> 'acheteur' then perform private.notify(d.opened_by, 'litige', 'Nouveau message dans votre litige', left(new.body, 120), '/commandes/' || p.order_id); end if;
  if new.author_role <> 'vendeur' then perform private.notify_shop(p.shop_id, 'litige', 'Nouveau message dans un litige', left(new.body, 120), '/vendeur/commandes/' || p.id); end if;
  if new.author_role <> 'equipe' then perform private.notify_admins('litige', 'Nouveau message dans un litige', left(new.body, 120), '/console/litiges'); end if;
  return new;
end $$;

create or replace function public.notify_dispute_resolved()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare p public.parcels; partial boolean;
begin
  if new.status = 'resolu' and old.status <> 'resolu' then
    select * into p from public.parcels where id = new.parcel_id;
    partial := new.resolution = 'acheteur' and new.refund_gnf is not null and new.refund_gnf < p.subtotal_gnf;
    if new.resolution = 'acheteur' then
      perform private.notify(new.opened_by, 'litige', 'Litige tranché en votre faveur',
        public.fn_gnf(coalesce(new.refund_gnf, p.subtotal_gnf)) || ' GNF vous seront remboursés' || case when partial then ' (remboursement partiel).' else '.' end, '/commandes/' || p.order_id);
      perform private.notify_shop(p.shop_id, 'litige', 'Litige tranché en faveur de l''acheteur',
        case when partial then 'Remboursement partiel de ' || public.fn_gnf(new.refund_gnf) || ' GNF, retiré de votre solde.' else 'Colis annulé et remboursé ; le montant est retiré de votre solde.' end,
        '/vendeur/commandes/' || p.id);
    else
      perform private.notify(new.opened_by, 'litige', 'Litige tranché en faveur du vendeur', 'La livraison est confirmée.' || coalesce(' ' || new.note, ''), '/commandes/' || p.order_id);
      perform private.notify_shop(p.shop_id, 'litige', 'Litige tranché en votre faveur', 'La livraison est confirmée ; votre solde est conservé.', '/vendeur/commandes/' || p.id);
    end if;
  end if;
  return new;
end $$;

create or replace function public.notify_review_report_new()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform private.notify_admins('avis', 'Avis signalé par un vendeur', new.reason, '/console/litiges');
  return new;
end $$;

-- Notifications déjà envoyées : liens corrigés (le vendeur les retrouve dans HailandX Vendeur, l'équipe dans la Console).
update public.notifications set link = '/console/litiges' where link = '/admin';
update public.notifications n set link = '/vendeur/commandes/' || p.id
  from public.parcels p join public.shop_members m on m.shop_id = p.shop_id
 where n.kind = 'litige' and n.link = '/commandes/' || p.order_id and m.user_id = n.user_id
   and n.title in ('Un acheteur a signalé un problème', 'Nouveau message dans un litige', 'Litige tranché');

-- ───────────── A9 : frais de livraison connus avant de commander ─────────────
-- Même calcul que fn_place_order (base 6 000 + 2 100 GNF/km, arrondi à 500, minimum 8 000) : un colis par boutique.
create or replace function public.fn_delivery_quote(p_declaration uuid, p_offers uuid[])
returns table (shop_id uuid, shop_name text, distance_km numeric, fee_gnf integer)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare b_lat double precision; b_lng double precision;
begin
  select st_y(coalesce(d.anchor_point, d.gps_point)), st_x(coalesce(d.anchor_point, d.gps_point)) into b_lat, b_lng
    from public.declarations d where d.id = p_declaration and d.user_id = auth.uid();
  if not found then raise exception 'adresse de livraison introuvable pour ce compte'; end if;
  return query
    select s.id, s.name, k.km, greatest(8000, (round((6000 + 2100 * k.km) / 500.0) * 500)::integer)
      from public.shops s
      join public.declarations sd on sd.id = s.declaration_id
      cross join lateral (select round((public.fn_haversine_m(st_y(coalesce(sd.anchor_point, sd.gps_point)), st_x(coalesce(sd.anchor_point, sd.gps_point)), b_lat, b_lng) / 1000.0)::numeric, 2) as km) k
     where s.id in (select o.shop_id from public.offers o where o.id = any(p_offers))
     order by s.name;
end $$;

-- ───────────── A13 : commandé et encaissé ─────────────
drop function if exists public.fn_shop_sales(uuid, integer);
create or replace function public.fn_shop_sales(p_shop uuid, p_days integer default 30)
returns table (day date, parcels integer, revenue_gnf bigint, delivered_gnf bigint)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not (public.fn_is_shop_member(p_shop) or public.is_admin()) then raise exception 'ventes : réservé aux membres de la boutique'; end if;
  return query
    select d::date, coalesce(count(p.id), 0)::integer, coalesce(sum(p.subtotal_gnf), 0)::bigint,
           coalesce(sum(p.subtotal_gnf) filter (where p.status = 'remis'), 0)::bigint
    from generate_series((current_date - (greatest(1, least(p_days, 365)) - 1))::timestamp, current_date::timestamp, interval '1 day') d
    left join public.parcels p on p.shop_id = p_shop and p.status <> 'annule' and p.created_at::date = d::date
    group by d order by d;
end $$;

revoke all on function public.fn_parcel_cancel(uuid, text, boolean), public.fn_resolve_dispute(uuid, text, text, integer),
  public.fn_delivery_quote(uuid, uuid[]), public.fn_shop_sales(uuid, integer) from public, anon, authenticated;
grant execute on function public.fn_parcel_cancel(uuid, text, boolean), public.fn_resolve_dispute(uuid, text, text, integer),
  public.fn_delivery_quote(uuid, uuid[]), public.fn_shop_sales(uuid, integer) to authenticated;

commit;
