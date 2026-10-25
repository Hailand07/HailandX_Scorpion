-- Annulation tardive : frais retenus quand l'acheteur annule après le départ du livreur (HAILANDX.md §45). Demande du fondateur
-- le 2026-10-25 : « à partir de là déjà des frais pourront s'appliquer, on lui restituera son argent bien sûr mais après avoir pris
-- ce que ça a exactement coûté au livreur et à Hailand ».
--   Avant qu'un livreur accepte : annulation gratuite, remboursement total (inchangé).
--   Livreur parti vers la boutique (« accepte ») : indemnité du livreur = 50 % des frais de livraison (réglage cancel_fee_accepte_bps).
--   Colis en route (« retire ») : 100 % des frais de livraison (cancel_fee_retire_bps) — course faite et retour du colis à la boutique.
--   + Paiement Chap Chap Pay : ses frais réels sur ce colis (2 % + 200 GNF ; carte 2,5 %), que Hailand a payés et ne récupère pas.
--   Qui paie : l'acheteur (retenu sur son remboursement) ; la boutique si c'est elle qui annule après l'acceptation ; Hailand si
--   l'équipe annule, ou si la commande était payable en espèces (rien à retenir) — l'acheteur perd alors le paiement à la
--   livraison pendant 30 jours. Hailand ne prend aucune commission sur un colis annulé.
-- Ajouts (colonnes, réglages) et create or replace seulement. Idempotente.
begin;

alter table public.parcels add column if not exists cancel_courier_gnf integer not null default 0 check (cancel_courier_gnf >= 0);
alter table public.parcels add column if not exists cancel_provider_gnf integer not null default 0 check (cancel_provider_gnf >= 0);
alter table public.parcels add column if not exists return_courier_id uuid;
alter table public.parcels add column if not exists returned_at timestamptz;
comment on column public.parcels.cancel_courier_gnf is 'Annulation pendant la mission : indemnité due au livreur (GNF), §45';
comment on column public.parcels.cancel_provider_gnf is 'Annulation tardive par l''acheteur : frais Chap Chap Pay retenus (GNF), §45';
comment on column public.parcels.return_courier_id is 'Livreur qui avait le colis au moment de l''annulation et doit le rapporter à la boutique';
comment on column public.parcels.returned_at is 'Colis annulé rapporté à la boutique';

insert into public.settings (key, value) values ('cancel_fee_accepte_bps', '5000'), ('cancel_fee_retire_bps', '10000') on conflict (key) do nothing;

-- Les deux taux d'indemnité se règlent dans Console → Paramètres (0 à 100 % des frais de livraison).
create or replace function public.fn_console_setting_update(p_key text, p_value text, p_motif text) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_old text; v_new text := btrim(coalesce(p_value, ''));
begin
  if not public.fn_is_fondateur() then raise exception 'paramètres : réservé au fondateur'; end if;
  if length(btrim(coalesce(p_motif, ''))) < 3 then raise exception 'paramètres : indiquez un motif'; end if;
  if p_key in ('commission_bps', 'courier_share_bps', 'cancel_fee_accepte_bps', 'cancel_fee_retire_bps') then
    if v_new !~ '^\d{1,5}$' or v_new::int > 10000 then raise exception 'paramètres : valeur hors limites (0 à 100 %%)'; end if;
  elsif p_key in ('delivery_base_gnf', 'delivery_min_gnf') then
    if v_new !~ '^\d{1,7}$' or v_new::int > 1000000 then raise exception 'paramètres : montant hors limites (0 à 1 000 000 GNF)'; end if;
  elsif p_key = 'delivery_per_km_gnf' then
    if v_new !~ '^\d{1,6}$' or v_new::int > 100000 then raise exception 'paramètres : prix par km hors limites (0 à 100 000 GNF)'; end if;
  elsif p_key = 'payment_mode' then
    if v_new not in ('simulation', 'chapchappay_test', 'chapchappay') then raise exception 'paramètres : mode de paiement inconnu'; end if;
  else
    raise exception 'paramètres : clé inconnue';
  end if;
  select value into v_old from public.settings where key = p_key;
  if not found then raise exception 'paramètres : clé absente de la base'; end if;
  if v_old = v_new then return v_new; end if;
  perform set_config('hailand.motif', p_motif, true);
  update public.settings set value = v_new where key = p_key;
  perform set_config('hailand.motif', '', true);
  return v_new;
end $$;

-- Frais réels de Chap Chap Pay sur un montant d'une commande (la part fixe de 200 GNF au prorata des colis).
create or replace function private.provider_fee_gnf(p_order uuid, p_amount integer) returns integer
language sql stable security definer set search_path = public, pg_temp as $$
  select case when o.payment_method = 'orange_money' and pay.provider = 'chapchappay' and pay.status = 'paye' then
    (round(p_amount * case when lower(coalesce(pay.provider_method, '')) in ('card', 'carte', 'bank_card', 'visa', 'mastercard') then 250 else 200 end / 10000.0)
     + round(200.0 * p_amount / greatest(o.total_gnf, 1)))::integer else 0 end
    from public.orders o left join public.payments pay on pay.order_id = o.id where o.id = p_order
$$;
revoke all on function private.provider_fee_gnf(uuid, integer) from public, anon, authenticated;

-- Ce que coûterait l'annulation d'un colis à son stade actuel : indemnité du livreur, frais de paiement (si c'est l'acheteur).
create or replace function private.cancel_costs(p_parcel uuid, p_by text, out courier_gnf integer, out provider_gnf integer)
language plpgsql stable security definer set search_path = public, private, pg_temp as $$
declare p public.parcels; o public.orders;
begin
  select * into p from public.parcels where id = p_parcel;
  select * into o from public.orders where id = p.order_id;
  courier_gnf := case p.status
    when 'accepte' then round(p.delivery_fee_gnf * private.setting_int('cancel_fee_accepte_bps', 5000) / 10000.0)::integer
    when 'retire' then round(p.delivery_fee_gnf * private.setting_int('cancel_fee_retire_bps', 10000) / 10000.0)::integer
    else 0 end;
  provider_gnf := case when courier_gnf > 0 and p_by = 'acheteur' and o.payment_status = 'bloque'
    then private.provider_fee_gnf(o.id, p.subtotal_gnf + p.delivery_fee_gnf) else 0 end;
  -- Jamais plus que ce qui a été payé pour ce colis.
  provider_gnf := least(provider_gnf, greatest(p.subtotal_gnf + p.delivery_fee_gnf - courier_gnf, 0));
end $$;
revoke all on function private.cancel_costs(uuid, text) from public, anon, authenticated;

-- Pour l'écran de l'acheteur : ce qui serait retenu et rendu s'il annule maintenant.
create or replace function public.fn_parcel_cancel_quote(p_parcel uuid)
returns table (status text, courier_gnf integer, provider_gnf integer, refund_gnf integer, prepaid boolean, cash_suspended_until date)
language plpgsql stable security definer set search_path = public, private, pg_temp as $$
declare p public.parcels; o public.orders; c record;
begin
  select * into p from public.parcels where id = p_parcel;
  select * into o from public.orders where id = p.order_id;
  if not found or o.buyer_id is distinct from auth.uid() then raise exception 'colis introuvable'; end if;
  select * into c from private.cancel_costs(p_parcel, 'acheteur');
  return query select p.status, c.courier_gnf, c.provider_gnf,
    case when o.payment_status = 'bloque' then p.subtotal_gnf + p.delivery_fee_gnf - c.courier_gnf - c.provider_gnf else 0 end,
    o.payment_status = 'bloque',
    case when o.payment_method = 'livraison' and c.courier_gnf > 0 then (now() + interval '30 days')::date end;
end $$;
revoke all on function public.fn_parcel_cancel_quote(uuid) from public, anon;
grant execute on function public.fn_parcel_cancel_quote(uuid) to authenticated;

create or replace function public.fn_parcel_cancel(p_parcel uuid, p_reason text default null, p_restock boolean default true)
returns text language plpgsql security definer set search_path = public, private, pg_temp as $$
declare p public.parcels; o public.orders; v_by text; v_reason text := nullif(btrim(coalesce(p_reason, '')), ''); c record;
begin
  select * into p from public.parcels where id = p_parcel for update;
  if not found then raise exception 'colis introuvable'; end if;
  select * into o from public.orders where id = p.order_id;
  -- Le rôle réel d'abord : un administrateur qui est aussi vendeur ou acheteur agit comme tel.
  -- L'acheteur peut annuler jusqu'à la remise ; après le départ du livreur, des frais sont retenus (§45).
  if public.fn_is_shop_member(p.shop_id) and p.status in ('attente_vendeur', 'prepare', 'mission_proposee', 'accepte') then v_by := 'vendeur';
  elsif o.buyer_id = auth.uid() and p.status in ('attente_vendeur', 'prepare', 'mission_proposee', 'accepte', 'retire') then v_by := 'acheteur';
  elsif public.is_admin() then v_by := 'equipe';
  else raise exception 'annulation impossible à ce stade';
  end if;
  if p.status in ('retire', 'remis', 'annule') and v_by not in ('equipe', 'acheteur') then raise exception 'annulation impossible à ce stade'; end if;
  if p.status in ('remis', 'annule', 'litige') and v_by = 'acheteur' then raise exception 'annulation impossible à ce stade'; end if;
  if p.status = 'annule' then raise exception 'ce colis est déjà annulé'; end if;
  if v_by = 'vendeur' and (v_reason is null or length(v_reason) < 3) then raise exception 'indiquez le motif de l''annulation : le client le verra'; end if;
  select * into c from private.cancel_costs(p_parcel, v_by);
  update public.parcels set status = 'annule', courier_id = null, cancel_reason = left(v_reason, 300), cancelled_by = v_by,
    cancel_courier_gnf = case when p.courier_id is not null then c.courier_gnf else 0 end, cancel_provider_gnf = c.provider_gnf,
    return_courier_id = case when p.status = 'retire' then p.courier_id end
   where id = p_parcel;
  -- Le stock revient en rayon, sauf si le vendeur dit le contraire (rupture : il n'y a plus rien à vendre).
  if v_by <> 'vendeur' or coalesce(p_restock, true) then
    update public.offer_variants v set stock = v.stock + i.quantity from public.order_items i where i.parcel_id = p_parcel and i.variant_id = v.id;
  end if;
  insert into public.delivery_events (parcel_id, kind, actor_id) values (p_parcel, 'annule', auth.uid());
  return 'annule';
end $$;

-- Le livreur (ou la boutique) confirme que le colis annulé est revenu à la boutique.
create or replace function public.fn_parcel_returned(p_parcel uuid)
returns text language plpgsql security definer set search_path = public, private, pg_temp as $$
declare p public.parcels;
begin
  select * into p from public.parcels where id = p_parcel for update;
  if not found or p.return_courier_id is null then raise exception 'aucun retour attendu pour ce colis'; end if;
  if p.return_courier_id is distinct from auth.uid() and not public.fn_is_shop_member(p.shop_id) then raise exception 'aucun retour attendu pour ce colis'; end if;
  if p.returned_at is not null then return 'deja_rendu'; end if;
  update public.parcels set returned_at = now() where id = p_parcel;
  perform private.notify_shop(p.shop_id, 'commande', 'Colis annulé rapporté', 'Le livreur a rapporté le colis à la boutique.', '/vendeur/commandes/' || p.id);
  return 'rendu';
end $$;

-- Colis à rapporter, pour l'application Flotte.
create or replace function public.fn_my_returns()
returns table (parcel_id uuid, shop_name text, shop_lat double precision, shop_lng double precision, courier_gnf integer)
language sql stable security definer set search_path = public, pg_temp as $$
  select p.id, s.name, st_y(coalesce(d.anchor_point, d.gps_point)), st_x(coalesce(d.anchor_point, d.gps_point)), p.cancel_courier_gnf
    from public.parcels p join public.shops s on s.id = p.shop_id left join public.declarations d on d.id = s.declaration_id
   where p.return_courier_id = auth.uid() and p.returned_at is null and p.status = 'annule'
$$;
revoke all on function public.fn_parcel_returned(uuid), public.fn_my_returns() from public, anon;
grant execute on function public.fn_parcel_returned(uuid), public.fn_my_returns() to authenticated;

-- Argent d'un colis : à la remise (inchangé), à l'annulation (frais d'annulation tardive §45, litige H4).
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
      -- Annulation pendant la mission (§45) : le livreur est prévenu ; s'il a le colis, il le rapporte à la boutique.
      if old.status in ('accepte', 'retire') and old.courier_id is not null then
        perform private.notify(old.courier_id, 'mission', 'Mission annulée',
          case when old.status = 'retire' then 'Rapportez le colis à ' || shop_name || ', puis touchez « Rendu à la boutique ». ' else '' end
          || case when new.cancel_courier_gnf > 0 then public.fn_gnf(new.cancel_courier_gnf) || ' GNF vous sont dus pour le déplacement.' else '' end, '/');
      end if;
      if new.cancelled_by = 'acheteur' then
        perform private.notify_shop(new.shop_id, 'commande', 'Commande annulée par le client',
          case when old.status = 'retire' then 'Le livreur vous rapporte le colis ; remettez les articles en rayon à son retour.' else 'Inutile de la préparer ; le stock est remis en rayon.' end, '/vendeur/commandes/' || new.id);
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

create or replace function public.fn_place_order(p_items jsonb, p_declaration uuid, p_phone text, p_payment text, p_source text default 'application', p_promo text default null)
returns uuid language plpgsql security definer set search_path = public, private, pg_temp as $$
declare
  uid uuid := auth.uid();
  v_order uuid;
  v_level integer;
  b_lat double precision; b_lng double precision;
  it record;
  o public.offers; sh public.shops; v public.offer_variants;
  v_parcel uuid;
  s_lat double precision; s_lng double precision;
  km numeric; fee integer; sub integer; total_sub integer := 0; total_fee integer := 0;
  pr record; r record; v_applied integer := 0;
  v_wallet uuid;
  v_until timestamptz;
begin
  if uid is null then raise exception 'connexion requise'; end if;
  if p_payment not in ('livraison', 'orange_money', 'hailandpay') then raise exception 'paiement non reconnu'; end if;
  if p_phone is null or p_phone !~ '^\+?[0-9 ]{8,16}$' then raise exception 'téléphone invalide'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'panier vide'; end if;
  if jsonb_array_length(p_items) > 50 then raise exception 'panier trop grand'; end if;
  -- Annulation tardive (§45) : après une commande en espèces annulée par l'acheteur alors que le livreur était parti, le
  -- paiement à la livraison est suspendu 30 jours (le déplacement du livreur a été payé par Hailand) ; en ligne ou HailandPay restent possibles.
  if p_payment = 'livraison' then
    select max(e.created_at) + interval '30 days' into v_until from public.parcels x join public.orders xo on xo.id = x.order_id
      join public.delivery_events e on e.parcel_id = x.id and e.kind = 'annule'
     where xo.buyer_id = uid and xo.payment_method = 'livraison' and x.cancelled_by = 'acheteur' and x.cancel_courier_gnf > 0;
    if v_until > now() then
      raise exception 'paiement à la livraison indisponible jusqu''au % : une commande en espèces a été annulée après le départ du livreur. Payez par Mobile Money ou HailandPay.', to_char(v_until, 'DD/MM');
    end if;
  end if;

  -- Adresse de livraison : celle de l'acheteur, niveau 1 au minimum (Scorpion).
  select coalesce(st_y(coalesce(d.anchor_point, d.gps_point)), 0), coalesce(st_x(coalesce(d.anchor_point, d.gps_point)), 0)
    into b_lat, b_lng from public.declarations d where d.id = p_declaration and d.user_id = uid;
  if not found then raise exception 'adresse de livraison introuvable pour ce compte'; end if;
  v_level := public.fn_declaration_level(p_declaration);
  if v_level is null or v_level < 1 then raise exception 'livraison impossible : adresse non enregistrée'; end if;

  insert into public.orders (buyer_id, delivery_declaration_id, buyer_phone, payment_method, subtotal_gnf, delivery_fee_gnf, total_gnf, source)
  values (uid, p_declaration, btrim(p_phone), p_payment, 0, 0, 0, p_source) returning id into v_order;

  -- Parcours des lignes : un colis par boutique.
  for it in select (e->>'offer_id')::uuid as offer_id, nullif(e->>'variant_id', '')::uuid as variant_id, greatest(1, least(99, coalesce((e->>'qty')::int, 1))) as qty
            from jsonb_array_elements(p_items) e order by 1
  loop
    select * into o from public.offers where id = it.offer_id and active;
    if not found then raise exception 'produit indisponible'; end if;
    select * into sh from public.shops where id = o.shop_id;
    if sh.status <> 'ouverte' then raise exception 'la boutique % n''est pas encore ouverte à la vente', sh.name; end if;
    -- Mode vacances : la vitrine reste visible, les commandes sont fermées jusqu'à la date de retour.
    if sh.vacation_until is not null and sh.vacation_until >= current_date then raise exception 'la boutique % est en congé jusqu''au %', sh.name, to_char(sh.vacation_until, 'DD/MM'); end if;
    -- Le niveau 3 est revérifié au moment de vendre (une adresse peut avoir perdu sa certification).
    if coalesce(public.fn_declaration_level(sh.declaration_id), 0) <> 3 then raise exception 'la boutique % n''a plus d''adresse certifiée', sh.name; end if;

    if it.variant_id is not null then
      select * into v from public.offer_variants where id = it.variant_id and offer_id = o.id for update;
      if not found then raise exception 'variante introuvable'; end if;
      if v.stock < it.qty then raise exception 'stock insuffisant pour % (%)', o.id, v.label; end if;
      update public.offer_variants set stock = stock - it.qty where id = v.id;
    end if;

    v_parcel := null;
    select p.id into v_parcel from public.parcels p where p.order_id = v_order and p.shop_id = o.shop_id;
    if v_parcel is null then
      select coalesce(st_y(coalesce(d.anchor_point, d.gps_point)), 0), coalesce(st_x(coalesce(d.anchor_point, d.gps_point)), 0)
        into s_lat, s_lng from public.declarations d where d.id = sh.declaration_id;
      km := round((public.fn_haversine_m(s_lat, s_lng, b_lat, b_lng) / 1000.0)::numeric, 2);
      -- Frais : réglages de la Console (base + prix par km à vol d'oiseau, arrondi à 500, minimum) — private.delivery_fee.
      fee := private.delivery_fee(km);
      insert into public.parcels (order_id, shop_id, subtotal_gnf, delivery_fee_gnf, distance_km) values (v_order, o.shop_id, 0, fee, km) returning id into v_parcel;
      total_fee := total_fee + fee;
    end if;

    insert into public.order_items (order_id, parcel_id, offer_id, variant_id, name_snapshot, price_gnf_snapshot, quantity)
    select v_order, v_parcel, o.id, it.variant_id, cp.name, o.price_gnf, it.qty from public.catalog_products cp where cp.id = o.product_id;
    sub := o.price_gnf * it.qty;
    update public.parcels set subtotal_gnf = subtotal_gnf + sub where id = v_parcel;
    total_sub := total_sub + sub;
  end loop;

  -- Code promo : appliqué à chaque colis dont la boutique a ce code ; le sous-total du colis devient le montant réduit
  -- (la part du vendeur et la commission se calculent dessus). Un code saisi qui ne s'applique nulle part fait échouer la commande.
  if nullif(btrim(coalesce(p_promo, '')), '') is not null then
    for pr in select p.id, p.shop_id, p.subtotal_gnf from public.parcels p where p.order_id = v_order loop
      select * into r from private.promo_for(pr.shop_id, p_promo, pr.subtotal_gnf, uid);
      if r.promo_id is not null and r.discount_gnf > 0 then
        update public.parcels set subtotal_gnf = subtotal_gnf - r.discount_gnf, discount_gnf = r.discount_gnf, promo_code = upper(btrim(p_promo)) where id = pr.id;
        insert into public.promo_uses (promo_id, parcel_id, buyer_id, discount_gnf) values (r.promo_id, pr.id, uid, r.discount_gnf);
        total_sub := total_sub - r.discount_gnf; v_applied := v_applied + 1;
      end if;
    end loop;
    if v_applied = 0 then raise exception 'code promo non valable pour ce panier'; end if;
  end if;

  update public.parcels p set cod_amount_gnf = case when p_payment = 'livraison' then p.subtotal_gnf + p.delivery_fee_gnf else 0 end where p.order_id = v_order;
  update public.orders set subtotal_gnf = total_sub, delivery_fee_gnf = total_fee, total_gnf = total_sub + total_fee, payment_status = 'en_attente' where id = v_order;
  -- HailandPay : le portefeuille de l'acheteur est débité tout de suite ; l'argent reste bloqué (séquestre) jusqu'à la remise.
  if p_payment = 'hailandpay' then
    v_wallet := private.wallet_of_user(uid);
    perform private.wallet_move(v_wallet, 'paiement', -(total_sub + total_fee)::bigint, v_order, null, null, null, null);
    insert into public.payments (order_id, provider, amount_gnf, status, paid_at) values (v_order, 'hailandpay', total_sub + total_fee, 'paye', now());
    update public.orders set payment_status = 'bloque' where id = v_order;
    insert into public.ledger_entries (account, order_id, kind, amount_gnf) values ('escrow', v_order, 'paiement', total_sub + total_fee);
  end if;
  insert into public.delivery_events (parcel_id, kind, actor_id) select id, 'cree', uid from public.parcels where order_id = v_order;
  return v_order;
end $$;

commit;
