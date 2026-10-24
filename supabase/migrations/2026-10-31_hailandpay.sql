-- HailandPay et le Syli, argent de test (HAILANDX.md §42) — étape 1 : la base.
-- Accord du fondateur le 2026-10-24 (« validé, commence la base »). Idempotente.
-- Le Syli : 1 Syli = 1 GNF, sans valeur réelle. Recharge libre jusqu'à 50 000 000 Syli par compte (réglage hailandpay_topup_cap).
--   wallets           un portefeuille par compte (user_id) ou par boutique (shop_id) : solde, total rechargé soi-même
--   wallet_movements  l'historique lisible par le titulaire (recharge, paiement, remboursement, envoi, réception, retrait…)
--   ledger_entries    chaque mouvement est recopié au grand livre (compte « wallet ») : la Console vérifie l'équilibre au Syli près
--   Paiement d'une commande : débit immédiat, argent bloqué jusqu'à la remise ; règlements, gains et remboursements
--   versés automatiquement dans les portefeuilles (déclencheur sur le grand livre, quel que soit le chemin : remise, annulation, litige).

begin;

-- ───────────── Portefeuilles et mouvements ─────────────
create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete cascade,
  shop_id uuid unique references public.shops (id) on delete cascade,
  balance bigint not null default 0 check (balance >= 0),
  topped_up bigint not null default 0 check (topped_up >= 0),
  created_at timestamptz not null default now(),
  check ((user_id is null) <> (shop_id is null))
);
alter table public.wallets enable row level security;
drop policy if exists wallets_read on public.wallets;
create policy wallets_read on public.wallets for select to authenticated
  using (user_id = auth.uid() or (shop_id is not null and public.fn_is_shop_owner(shop_id)) or public.is_admin());
revoke insert, update, delete on public.wallets from anon, authenticated;
grant select on public.wallets to authenticated;

create table if not exists public.wallet_movements (
  id bigint generated always as identity primary key,
  wallet_id uuid not null references public.wallets (id) on delete cascade,
  kind text not null check (kind in ('recharge_test', 'credit_equipe', 'debit_equipe', 'paiement', 'remboursement', 'reglement_vente', 'gain_livraison',
                                     'reprise_vente', 'envoi', 'reception', 'retrait', 'vers_proprietaire', 'depuis_boutique')),
  amount bigint not null check (amount <> 0),
  balance_after bigint not null,
  counterparty_wallet uuid,
  counterparty_label text check (counterparty_label is null or length(counterparty_label) <= 80),
  order_id uuid,
  parcel_id uuid,
  note text check (note is null or length(note) <= 200),
  actor_id uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists wallet_movements_wallet_idx on public.wallet_movements (wallet_id, id desc);
alter table public.wallet_movements enable row level security;
drop policy if exists wallet_movements_read on public.wallet_movements;
create policy wallet_movements_read on public.wallet_movements for select to authenticated
  using (exists (select 1 from public.wallets w where w.id = wallet_id and (w.user_id = auth.uid() or (w.shop_id is not null and public.fn_is_shop_owner(w.shop_id)) or public.is_admin())));
revoke insert, update, delete on public.wallet_movements from anon, authenticated;
grant select on public.wallet_movements to authenticated;

-- HailandPay comme moyen de paiement et comme opérateur ; compte « wallet » au grand livre.
alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check check (payment_method in ('livraison', 'orange_money', 'hailandpay'));
alter table public.payments drop constraint if exists payments_provider_check;
alter table public.payments add constraint payments_provider_check check (provider in ('simulation', 'orange_money', 'hailandpay'));
alter table public.ledger_entries drop constraint if exists ledger_entries_account_check;
alter table public.ledger_entries add constraint ledger_entries_account_check check (account in ('escrow', 'shop', 'courier', 'platform', 'buyer', 'courier_cash', 'wallet'));

-- ───────────── Outils internes ─────────────
create or replace function private.wallet_of_user(p_user uuid) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare w uuid;
begin
  insert into public.wallets (user_id) values (p_user) on conflict (user_id) do nothing;
  select id into w from public.wallets where user_id = p_user;
  return w;
end $$;

create or replace function private.wallet_of_shop(p_shop uuid) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare w uuid;
begin
  insert into public.wallets (shop_id) values (p_shop) on conflict (shop_id) do nothing;
  select id into w from public.wallets where shop_id = p_shop;
  return w;
end $$;

/** Le seul chemin qui change un solde : verrou, solde jamais négatif, historique et grand livre écrits ensemble. */
create or replace function private.wallet_move(p_wallet uuid, p_kind text, p_amount bigint, p_order uuid, p_parcel uuid, p_counterparty uuid, p_label text, p_note text)
returns bigint language plpgsql security definer set search_path = public, pg_temp as $$
declare nb bigint;
begin
  if p_amount = 0 then return (select balance from public.wallets where id = p_wallet); end if;
  update public.wallets set balance = balance + p_amount where id = p_wallet and balance + p_amount >= 0 returning balance into nb;
  if not found then
    if exists (select 1 from public.wallets where id = p_wallet) then raise exception 'solde HailandPay insuffisant'; end if;
    raise exception 'portefeuille introuvable';
  end if;
  insert into public.wallet_movements (wallet_id, kind, amount, balance_after, counterparty_wallet, counterparty_label, order_id, parcel_id, note)
  values (p_wallet, p_kind, p_amount, nb, p_counterparty, p_label, p_order, p_parcel, nullif(btrim(coalesce(p_note, '')), ''));
  insert into public.ledger_entries (account, account_id, parcel_id, order_id, kind, amount_gnf) values ('wallet', p_wallet, p_parcel, p_order, 'portefeuille_' || p_kind, p_amount);
  return nb;
end $$;

/** « Mariama B. » : prénom et initiale du nom (profil Hailand), jamais le nom complet. */
create or replace function private.masked_name(p_user uuid) returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((
    select case when array_length(w, 1) > 1 then w[1] || ' ' || upper(left(w[array_length(w, 1)], 1)) || '.' else w[1] end
    from (select regexp_split_to_array(btrim(p.full_name), '\s+') w from public.profiles p where p.id = p_user::text and nullif(btrim(p.full_name), '') is not null limit 1) x
  ), 'Compte Hailand')
$$;
create or replace function private.masked_phone(p_user uuid) returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select left(right(u.phone, 9), 1) || '•• •• ' || right(u.phone, 2) from auth.users u where u.id = p_user), '')
$$;
revoke all on function private.wallet_of_user(uuid), private.wallet_of_shop(uuid), private.wallet_move(uuid, text, bigint, uuid, uuid, uuid, text, text),
  private.masked_name(uuid), private.masked_phone(uuid) from public, anon, authenticated;

-- ───────────── Règlements automatiques (déclencheur sur le grand livre) ─────────────
-- Commandes payées par HailandPay : ce que le grand livre doit à une boutique, à un livreur ou à un acheteur est versé
-- aussitôt dans son portefeuille (écriture de versement en face) ; ce qu'une boutique rend est repris sur le sien.
create or replace function private.hailandpay_after_ledger() returns trigger
language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pm text; take bigint; w uuid;
begin
  if new.order_id is null or new.account = 'wallet' then return new; end if;
  select payment_method into pm from public.orders where id = new.order_id;
  if pm is distinct from 'hailandpay' then return new; end if;
  if new.account = 'shop' and new.kind = 'reglement_vendeur' and new.amount_gnf > 0 then
    perform private.wallet_move(private.wallet_of_shop(new.account_id), 'reglement_vente', new.amount_gnf, new.order_id, new.parcel_id, null, null, null);
    insert into public.ledger_entries (account, account_id, parcel_id, order_id, kind, amount_gnf) values ('shop', new.account_id, new.parcel_id, new.order_id, 'reversement_portefeuille', -new.amount_gnf);
  elsif new.account = 'courier' and new.kind = 'gain_livreur' and new.amount_gnf > 0 and new.account_id is not null then
    perform private.wallet_move(private.wallet_of_user(new.account_id), 'gain_livraison', new.amount_gnf, new.order_id, new.parcel_id, null, null, null);
    insert into public.ledger_entries (account, account_id, parcel_id, order_id, kind, amount_gnf) values ('courier', new.account_id, new.parcel_id, new.order_id, 'versement_portefeuille', -new.amount_gnf);
  elsif new.account = 'buyer' and new.kind = 'remboursement' and new.amount_gnf > 0 then
    perform private.wallet_move(private.wallet_of_user(new.account_id), 'remboursement', new.amount_gnf, new.order_id, new.parcel_id, null, null, null);
    insert into public.ledger_entries (account, account_id, parcel_id, order_id, kind, amount_gnf) values ('buyer', new.account_id, new.parcel_id, new.order_id, 'remboursement_portefeuille', -new.amount_gnf);
  elsif new.account = 'shop' and new.kind in ('annulation_vendeur', 'remboursement_partiel_vendeur') and new.amount_gnf < 0 then
    -- La boutique rend ce qu'elle avait reçu, dans la limite de son solde ; le reste reste dû au grand livre.
    w := private.wallet_of_shop(new.account_id);
    select least(balance, -new.amount_gnf) into take from public.wallets where id = w;
    if take > 0 then
      perform private.wallet_move(w, 'reprise_vente', -take, new.order_id, new.parcel_id, null, null, null);
      insert into public.ledger_entries (account, account_id, parcel_id, order_id, kind, amount_gnf) values ('shop', new.account_id, new.parcel_id, new.order_id, 'reprise_portefeuille', take);
    end if;
  end if;
  return new;
end $$;
revoke all on function private.hailandpay_after_ledger() from public, anon, authenticated;
drop trigger if exists ledger_hailandpay on public.ledger_entries;
create trigger ledger_hailandpay after insert on public.ledger_entries for each row execute function private.hailandpay_after_ledger();

-- ───────────── Paiement d'une commande par HailandPay ─────────────
create or replace function public.fn_place_order(p_items jsonb, p_declaration uuid, p_phone text, p_payment text, p_source text default 'application', p_promo text default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
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
begin
  if uid is null then raise exception 'connexion requise'; end if;
  if p_payment not in ('livraison', 'orange_money', 'hailandpay') then raise exception 'paiement non reconnu'; end if;
  if p_phone is null or p_phone !~ '^\+?[0-9 ]{8,16}$' then raise exception 'téléphone invalide'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'panier vide'; end if;
  if jsonb_array_length(p_items) > 50 then raise exception 'panier trop grand'; end if;

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
      -- Frais : base 6 000 + 2 100 GNF/km, arrondi à 500, minimum 8 000 (⚠️ valeurs provisoires, identiques à packages/commerce).
      fee := greatest(8000, (round((6000 + 2100 * km) / 500.0) * 500)::integer);
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

-- ───────────── Remboursement avant remise : aussi pour HailandPay (argent bloqué) ─────────────
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

-- ───────────── Fonctions publiques ─────────────
/** Mon portefeuille (créé à la première visite), montant bloqué dans mes commandes en cours, et les portefeuilles de mes boutiques. */
create or replace function public.fn_wallet_me()
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
declare uid uuid := auth.uid(); w public.wallets; v uuid;
begin
  if uid is null then raise exception 'connexion requise'; end if;
  v := private.wallet_of_user(uid); -- créé à la première visite (hors du WHERE : sur une table vide il ne serait jamais appelé)
  select * into w from public.wallets where id = v;
  return jsonb_build_object(
    'wallet_id', w.id, 'balance', w.balance, 'topped_up', w.topped_up,
    'topup_cap', private.setting_int('hailandpay_topup_cap', 50000000),
    'held', (select coalesce(sum(p.subtotal_gnf + p.delivery_fee_gnf), 0) from public.parcels p join public.orders o on o.id = p.order_id
              where o.buyer_id = uid and o.payment_method = 'hailandpay' and p.status not in ('remis', 'annule')),
    'shops', coalesce((select jsonb_agg(jsonb_build_object('shop_id', s.id, 'name', s.name, 'wallet_id', private.wallet_of_shop(s.id),
                 'balance', (select balance from public.wallets x where x.shop_id = s.id),
                 'pending', (select coalesce(sum(p.subtotal_gnf - round(p.subtotal_gnf * private.setting_int('commission_bps', 800) / 10000.0)), 0)
                             from public.parcels p join public.orders o on o.id = p.order_id
                             where p.shop_id = s.id and o.payment_method = 'hailandpay' and p.status not in ('remis', 'annule'))) order by s.name)
               from public.shops s where public.fn_is_shop_owner(s.id)), '[]'::jsonb));
end $$;

/** Recharge de test en libre-service : plafond cumulé par compte (50 000 000 Syli par défaut). */
create or replace function public.fn_wallet_topup(p_amount bigint)
returns bigint language plpgsql security definer set search_path = public, private, pg_temp as $$
declare uid uuid := auth.uid(); w public.wallets; v uuid; cap bigint := private.setting_int('hailandpay_topup_cap', 50000000);
begin
  if uid is null then raise exception 'connexion requise'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'montant invalide'; end if;
  v := private.wallet_of_user(uid);
  select * into w from public.wallets where id = v for update;
  if w.topped_up + p_amount > cap then
    raise exception 'plafond de recharge de test atteint : encore % Syli possibles (plafond % Syli). Au-delà, l''équipe Hailand peut créditer votre compte.',
      public.fn_gnf(greatest(0, cap - w.topped_up)::integer), public.fn_gnf(cap::integer);
  end if;
  update public.wallets set topped_up = topped_up + p_amount where id = w.id;
  return private.wallet_move(w.id, 'recharge_test', p_amount, null, null, null, null, 'Recharge de test');
end $$;

/** Avant un envoi : le compte existe-t-il ? Nom masqué (« Mariama B. ») et numéro masqué, jamais le nom complet. */
create or replace function public.fn_wallet_lookup(p_phone text)
returns table (label text, phone_masked text)
language plpgsql stable security definer set search_path = public, private, pg_temp as $$
declare v_phone text := public.fn_gn_phone_digits(p_phone); v_uid uuid;
begin
  if auth.uid() is null then raise exception 'connexion requise'; end if;
  if v_phone is null then raise exception 'numéro guinéen invalide'; end if;
  select u.id into v_uid from auth.users u where u.phone = v_phone limit 1;
  if v_uid is null then raise exception 'aucun compte Hailand avec ce numéro'; end if;
  if v_uid = auth.uid() then raise exception 'c''est votre propre numéro'; end if;
  return query select private.masked_name(v_uid), private.masked_phone(v_uid);
end $$;

/** Envoi entre comptes Hailand par numéro : sans frais, immédiat, non annulable ; le destinataire est prévenu. */
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
    private.masked_name(uid) || coalesce(' : « ' || nullif(btrim(p_note), '') || ' »', '') || ' (argent de test HailandPay)', '/compte/hailandpay');
  return nb;
end $$;

/** Retrait simulé (vers un opérateur, rien n'est réellement versé) : depuis mon portefeuille ou celui d'une de mes boutiques. */
create or replace function public.fn_wallet_withdraw(p_amount bigint, p_method text default 'orange_money', p_number text default null, p_shop uuid default null)
returns bigint language plpgsql security definer set search_path = public, private, pg_temp as $$
declare uid uuid := auth.uid(); w uuid;
begin
  if uid is null then raise exception 'connexion requise'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'montant invalide'; end if;
  if p_method not in ('orange_money', 'soutra_money', 'paycard', 'banque') then raise exception 'moyen de retrait inconnu'; end if;
  if p_shop is not null then
    if not public.fn_is_shop_owner(p_shop) then raise exception 'réservé au propriétaire de la boutique'; end if;
    w := private.wallet_of_shop(p_shop);
  else
    w := private.wallet_of_user(uid);
  end if;
  return private.wallet_move(w, 'retrait', -p_amount, null, null, null, null,
    'Retrait simulé vers ' || case p_method when 'orange_money' then 'Orange Money' when 'soutra_money' then 'Soutra Money' when 'paycard' then 'PayCard' else 'un compte bancaire' end
      || coalesce(' · ' || right(regexp_replace(p_number, '\D', '', 'g'), 4), ''));
end $$;

/** Le propriétaire fait passer de l'argent de sa boutique vers son portefeuille personnel. */
create or replace function public.fn_shop_wallet_to_owner(p_shop uuid, p_amount bigint)
returns bigint language plpgsql security definer set search_path = public, private, pg_temp as $$
declare uid uuid := auth.uid(); ws uuid; wu uuid; nb bigint; shop_name text;
begin
  if uid is null then raise exception 'connexion requise'; end if;
  if not public.fn_is_shop_owner(p_shop) then raise exception 'réservé au propriétaire de la boutique'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'montant invalide'; end if;
  select name into shop_name from public.shops where id = p_shop;
  ws := private.wallet_of_shop(p_shop); wu := private.wallet_of_user(uid);
  perform 1 from public.wallets where id in (ws, wu) order by id for update;
  nb := private.wallet_move(ws, 'vers_proprietaire', -p_amount, null, null, wu, 'Portefeuille du propriétaire', null);
  perform private.wallet_move(wu, 'depuis_boutique', p_amount, null, null, ws, shop_name, null);
  return nb;
end $$;

/** Équipe : créditer (montant positif) ou débiter (négatif) un compte ou une boutique, motif obligatoire, inscrit au journal. */
create or replace function public.fn_wallet_admin_adjust(p_amount bigint, p_motif text, p_phone text default null, p_shop uuid default null)
returns bigint language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_uid uuid; w uuid; nb bigint;
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
  if v_uid is not null then
    perform private.notify(v_uid, 'paiement', case when p_amount > 0 then 'L''équipe Hailand a crédité ' else 'L''équipe Hailand a débité ' end || public.fn_gnf(abs(p_amount)::integer) || ' Syli',
      btrim(p_motif) || ' (argent de test HailandPay)', '/compte/hailandpay');
  end if;
  return nb;
end $$;

/** Console : masse de Syli, portefeuilles, sommes bloquées, et contrôle d'équilibre (solde = grand livre, pour chaque portefeuille). */
create or replace function public.fn_hailandpay_overview()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'réservé à l''équipe Hailand'; end if;
  return jsonb_build_object(
    'in_wallets', (select coalesce(sum(balance), 0) from public.wallets),
    'wallets_users', (select count(*) from public.wallets where user_id is not null),
    'wallets_shops', (select count(*) from public.wallets where shop_id is not null),
    'held', (select coalesce(sum(p.subtotal_gnf + p.delivery_fee_gnf), 0) from public.parcels p join public.orders o on o.id = p.order_id
             where o.payment_method = 'hailandpay' and o.payment_status = 'bloque' and p.status not in ('remis', 'annule')),
    'topups', (select coalesce(sum(amount), 0) from public.wallet_movements where kind = 'recharge_test'),
    'credits', (select coalesce(sum(amount), 0) from public.wallet_movements where kind = 'credit_equipe'),
    'debits', (select coalesce(-sum(amount), 0) from public.wallet_movements where kind = 'debit_equipe'),
    'withdrawals', (select coalesce(-sum(amount), 0) from public.wallet_movements where kind = 'retrait'),
    'imbalanced', (select count(*) from public.wallets w where w.balance <> (select coalesce(sum(l.amount_gnf), 0) from public.ledger_entries l where l.account = 'wallet' and l.account_id = w.id)),
    'recent', coalesce((select jsonb_agg(x order by x.id desc) from (
       select m.id, m.kind, m.amount, m.created_at, m.counterparty_label, coalesce(s.name, private.masked_name(w.user_id) || ' · ' || private.masked_phone(w.user_id)) as holder
       from public.wallet_movements m join public.wallets w on w.id = m.wallet_id left join public.shops s on s.id = w.shop_id
       order by m.id desc limit 30) x), '[]'::jsonb));
end $$;

revoke all on function public.fn_wallet_me(), public.fn_wallet_topup(bigint), public.fn_wallet_lookup(text), public.fn_wallet_transfer(text, bigint, text),
  public.fn_wallet_withdraw(bigint, text, text, uuid), public.fn_shop_wallet_to_owner(uuid, bigint), public.fn_wallet_admin_adjust(bigint, text, text, uuid),
  public.fn_hailandpay_overview(), public.fn_place_order(jsonb, uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.fn_wallet_me(), public.fn_wallet_topup(bigint), public.fn_wallet_lookup(text), public.fn_wallet_transfer(text, bigint, text),
  public.fn_wallet_withdraw(bigint, text, text, uuid), public.fn_shop_wallet_to_owner(uuid, bigint), public.fn_wallet_admin_adjust(bigint, text, text, uuid),
  public.fn_hailandpay_overview(), public.fn_place_order(jsonb, uuid, text, text, text, text) to authenticated;

commit;
