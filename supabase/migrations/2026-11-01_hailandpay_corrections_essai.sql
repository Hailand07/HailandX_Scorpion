-- Corrections de l'essai HailandPay (HAILANDX.md §42, étape 4 : anomalies H1 à H5). Accord du fondateur le 2026-10-24 :
-- « oui corrige H1 à H3, rends les frais et remets en stock ». Idempotente (uniquement des create or replace).
--   H1  textes des notifications en Syli pour une commande payée par HailandPay (remise, annulation, litige)
--   H2  « Vous avez reçu … Syli » : nom masqué ET numéro masqué de l'envoyeur
--   H3  crédit / débit de l'équipe sur une boutique : ses membres sont prévenus (HailandX Vendeur → Argent)
--   H4  remboursement total par litige : les frais de livraison sont rendus aussi, à la charge de la boutique
--       (le litige est tranché contre elle) ; le livreur garde son gain, il a fait la course
--   H5  remboursement total par litige : les articles sont remis en stock
begin;

-- ───────────── H4 : argent d'un colis annulé après la remise (litige tranché pour l'acheteur) ─────────────
create or replace function public.parcel_money_after()
returns trigger language plpgsql security definer set search_path = public, private, pg_temp as $$
declare
  o public.orders; bps integer; cshare integer; commission integer; shop_net integer; courier_gain integer; platform_gain integer; total integer; settled boolean; refunded integer; fee_back integer;
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
      -- H4 : litige tranché pour l'acheteur → les frais de livraison lui sont rendus, repris à la boutique.
      fee_back := case when exists (select 1 from public.disputes d where d.parcel_id = new.id and d.status = 'resolu' and d.resolution = 'acheteur')
                       then new.delivery_fee_gnf else 0 end;
      insert into public.ledger_entries (account, account_id, parcel_id, order_id, kind, amount_gnf) values
        ('shop', new.shop_id, new.id, o.id, 'annulation_vendeur', -(shop_net + fee_back)),
        ('platform', null, new.id, o.id, 'annulation_commission', -commission),
        ('buyer', o.buyer_id, new.id, o.id, 'remboursement', new.subtotal_gnf + fee_back)
        on conflict do nothing;
    elsif o.payment_method in ('orange_money', 'hailandpay') and o.payment_status = 'bloque' then
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

-- ───────────── H5 : remboursement total par litige → articles remis en stock ─────────────
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
  -- Remboursement total : colis annulé (articles + frais rendus, articles remis en stock). Partiel : le colis reste remis.
  new_status := case when p_in_favor_of = 'acheteur' and v_refund >= p.subtotal_gnf then 'annule' else 'remis' end;
  update public.disputes set status = 'resolu', resolution = p_in_favor_of, note = nullif(btrim(p_note), ''), refund_gnf = v_refund,
    resolved_by = auth.uid(), resolved_at = now() where id = p_dispute;
  update public.parcels set status = new_status, delivered_at = coalesce(delivered_at, now()) where id = d.parcel_id;
  if new_status = 'annule' then
    update public.offer_variants v set stock = v.stock + i.quantity from public.order_items i where i.parcel_id = p.id and i.variant_id = v.id;
  end if;
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

-- ───────────── H1 : textes selon le moyen de paiement ─────────────
create or replace function public.notify_parcel_events()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare buyer uuid; shop_name text; net integer; pm text;
begin
  -- La « nouvelle commande » part de l'événement « cree » (notify_new_parcel), quand articles et montant sont connus.
  if tg_op = 'INSERT' then return new; end if;
  if new.status is not distinct from old.status then return new; end if;
  select o.buyer_id, o.payment_method into buyer, pm from public.orders o where o.id = new.order_id;
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
        case when net is null then 'La livraison est terminée.'
             when pm = 'hailandpay' then public.fn_gnf(net) || ' Syli versés dans le portefeuille HailandPay de la boutique (commission Hailand déduite).'
             else public.fn_gnf(net) || ' GNF ajoutés à votre solde (commission Hailand déduite).' end,
        '/vendeur/commandes/' || new.id);
    when 'annule' then
      if new.cancelled_by is distinct from 'acheteur' then
        perform private.notify(buyer, 'suivi', 'Colis annulé', shop_name || coalesce(' : ' || new.cancel_reason, '')
          || case when pm = 'hailandpay' then ' — vos Syli sont rendus dans votre portefeuille HailandPay.' else '' end, '/commandes/' || new.order_id);
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

create or replace function public.notify_dispute_resolved()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare p public.parcels; partial boolean; pm text; amount integer; unit text; buyer_txt text; shop_txt text;
begin
  if new.status = 'resolu' and old.status <> 'resolu' then
    select * into p from public.parcels where id = new.parcel_id;
    select payment_method into pm from public.orders where id = p.order_id;
    unit := case when pm = 'hailandpay' then ' Syli' else ' GNF' end;
    partial := new.resolution = 'acheteur' and new.refund_gnf is not null and new.refund_gnf < p.subtotal_gnf;
    if new.resolution = 'acheteur' then
      -- Total : articles + frais de livraison (H4) ; partiel : le montant décidé.
      amount := case when partial then new.refund_gnf else p.subtotal_gnf + p.delivery_fee_gnf end;
      buyer_txt := public.fn_gnf(amount) || unit
        || case when pm = 'hailandpay' then ' rendus dans votre portefeuille HailandPay' else ' vous seront remboursés' end
        || case when partial then ' (remboursement partiel).' else ' (articles et livraison).' end;
      shop_txt := case when partial then 'Remboursement partiel de ' || public.fn_gnf(new.refund_gnf) || unit
                       else 'Colis annulé et remboursé, frais de livraison compris ; articles remis en stock. Le montant (' || public.fn_gnf(amount) || unit || ')' end
        || case when pm = 'hailandpay' then ', repris sur le portefeuille HailandPay de la boutique (moins la commission rendue).' else ', retiré de votre solde (moins la commission rendue).' end;
      perform private.notify(new.opened_by, 'litige', 'Litige tranché en votre faveur', buyer_txt, '/commandes/' || p.order_id);
      perform private.notify_shop(p.shop_id, 'litige', 'Litige tranché en faveur de l''acheteur', shop_txt, '/vendeur/commandes/' || p.id);
    else
      perform private.notify(new.opened_by, 'litige', 'Litige tranché en faveur du vendeur', 'La livraison est confirmée.' || coalesce(' ' || new.note, ''), '/commandes/' || p.order_id);
      perform private.notify_shop(p.shop_id, 'litige', 'Litige tranché en votre faveur', 'La livraison est confirmée ; votre solde est conservé.', '/vendeur/commandes/' || p.id);
    end if;
  end if;
  return new;
end $$;

-- ───────────── H2 : l'envoyeur reconnaissable ─────────────
create or replace function public.fn_wallet_transfer(p_phone text, p_amount bigint, p_note text default null)
returns bigint language plpgsql security definer set search_path = public, private, pg_temp as $$
declare uid uuid := auth.uid(); v_phone text := public.fn_gn_phone_digits(p_phone); v_to uuid; w_from uuid; w_to uuid; nb bigint; to_label text; from_label text;
begin
  if uid is null then raise exception 'connexion requise'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'montant invalide'; end if;
  if v_phone is null then raise exception 'numéro guinéen invalide'; end if;
  select u.id into v_to from auth.users u where u.phone = v_phone limit 1;
  if v_to is null then raise exception 'aucun compte Hailand avec ce numéro'; end if;
  if v_to = uid then raise exception 'c''est votre propre numéro'; end if;
  w_from := private.wallet_of_user(uid); w_to := private.wallet_of_user(v_to);
  to_label := private.masked_name(v_to) || ' · ' || private.masked_phone(v_to);
  from_label := private.masked_name(uid) || ' · ' || private.masked_phone(uid);
  -- Ordre de verrouillage fixe (évite deux envois croisés bloqués l'un par l'autre).
  perform 1 from public.wallets where id in (w_from, w_to) order by id for update;
  nb := private.wallet_move(w_from, 'envoi', -p_amount, null, null, w_to, to_label, left(p_note, 200));
  perform private.wallet_move(w_to, 'reception', p_amount, null, null, w_from, from_label, left(p_note, 200));
  perform private.notify(v_to, 'paiement', 'Vous avez reçu ' || public.fn_gnf(p_amount::integer) || ' Syli',
    'De ' || from_label || coalesce(' : « ' || nullif(btrim(p_note), '') || ' »', '') || ' (argent de test HailandPay)', '/compte/hailandpay');
  return nb;
end $$;

-- ───────────── H3 : la boutique prévenue d'un crédit ou d'un débit de l'équipe ─────────────
create or replace function public.fn_wallet_admin_adjust(p_amount bigint, p_motif text, p_phone text default null, p_shop uuid default null)
returns bigint language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_uid uuid; w uuid; nb bigint; title text;
begin
  if not public.is_admin() then raise exception 'réservé à l''équipe Hailand'; end if;
  if p_amount is null or p_amount = 0 then raise exception 'montant invalide'; end if;
  if length(btrim(coalesce(p_motif, ''))) < 3 then raise exception 'indiquez le motif : il est inscrit au journal'; end if;
  if (p_phone is null) = (p_shop is null) then raise exception 'choisissez un compte (numéro) ou une boutique'; end if;
  if p_shop is not null then
    w := private.wallet_of_shop(p_shop);
  else
    select u.id into v_uid from auth.users u where u.phone = public.fn_gn_phone_digits(p_phone) limit 1;
    if v_uid is null then raise exception 'aucun compte Hailand avec ce numéro'; end if;
    w := private.wallet_of_user(v_uid);
  end if;
  nb := private.wallet_move(w, case when p_amount > 0 then 'credit_equipe' else 'debit_equipe' end, p_amount, null, null, null, 'Équipe Hailand', btrim(p_motif));
  perform private.journal(case when p_amount > 0 then 'hailandpay_credit' else 'hailandpay_debit' end, case when p_shop is null then 'compte' else 'boutique' end,
    coalesce(v_uid::text, p_shop::text), jsonb_build_object('montant', abs(p_amount), 'solde_apres', nb), btrim(p_motif));
  title := case when p_amount > 0 then 'L''équipe Hailand a crédité ' else 'L''équipe Hailand a débité ' end || public.fn_gnf(abs(p_amount)::integer) || ' Syli';
  if v_uid is not null then
    perform private.notify(v_uid, 'paiement', title, btrim(p_motif) || ' (argent de test HailandPay)', '/compte/hailandpay');
  else
    perform private.notify_shop(p_shop, 'paiement', title || ' (boutique)', btrim(p_motif) || ' (argent de test HailandPay)', '/vendeur/argent');
  end if;
  return nb;
end $$;

commit;
