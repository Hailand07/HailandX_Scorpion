-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- HAILANDX VENDEUR « NIVEAU SHOPIFY », SUITE DU PLAN (HAILANDX.md §37, étapes 5, 7 et 9 ; maquettes v6).
--
-- A. Boutique en ligne : horaires (`shops.hours`), mode vacances (`vacation_until`, `vacation_note` : commandes fermées,
--    vitrine visible), politique d'échange et de garantie (`policy`), produits mis en avant (`offers.featured`).
--    `fn_place_order` refuse une commande pendant les vacances (le reste est inchangé).
-- B. Clients : `fn_shop_clients` — clients de la boutique, PSEUDONYMES (« Client 7F3A », même calcul que `fn_seller_parcel`) :
--    quartier, nombre de commandes, total, première et dernière commande. Jamais le numéro, le nom ni l'adresse exacte.
-- C. Équipe : le propriétaire ajoute un employé par son numéro (compte Hailand existant), 5 au plus ; un employé prépare les
--    commandes, gère produits, marketing et questions, mais ne voit pas l'argent (`ledger_entries`), ne modifie pas la
--    boutique (`shops`) et ne gère pas l'équipe. Nouvelle fonction de droit `fn_is_shop_owner`.
-- Ajouts seulement, sauf `fn_place_order` (contrôle des vacances) et deux politiques resserrées (`shops_update`, `ledger_read`).
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

begin;

-- ── C (d'abord : les politiques s'en servent). Propriétaire d'une boutique ─────────────────────────────────────────────
create or replace function public.fn_is_shop_owner(p_shop uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.shop_members m where m.shop_id = p_shop and m.user_id = auth.uid() and m.role = 'proprietaire')
$$;

-- ── A. Boutique en ligne ────────────────────────────────────────────────────────────────────────────────────────────────
-- hours : {"lun": ["08:00", "20:00"], "mar": [...], …, "dim": null}  (null ou absent = fermé ce jour-là).
alter table public.shops add column if not exists hours jsonb;
alter table public.shops add column if not exists vacation_until date;
alter table public.shops add column if not exists vacation_note text;
alter table public.shops add column if not exists policy text;
alter table public.shops drop constraint if exists shops_hours_check;
alter table public.shops add constraint shops_hours_check check (hours is null or (jsonb_typeof(hours) = 'object' and pg_column_size(hours) <= 2000));
alter table public.shops drop constraint if exists shops_vacation_note_check;
alter table public.shops add constraint shops_vacation_note_check check (vacation_note is null or length(vacation_note) <= 140);
alter table public.shops drop constraint if exists shops_policy_check;
alter table public.shops add constraint shops_policy_check check (policy is null or length(policy) <= 600);
alter table public.offers add column if not exists featured boolean not null default false;

-- Modifier la boutique : le propriétaire (et l'équipe Hailand), plus les employés.
drop policy if exists shops_update on public.shops;
create policy shops_update on public.shops for update to authenticated
  using (public.fn_is_shop_owner(id) or public.is_admin()) with check (public.fn_is_shop_owner(id) or public.is_admin());

-- L'argent de la boutique : le propriétaire seulement.
drop policy if exists ledger_read on public.ledger_entries;
create policy ledger_read on public.ledger_entries for select to authenticated using (
  public.is_admin()
  or (account = 'shop' and public.fn_is_shop_owner(account_id))
  or (account in ('courier', 'buyer') and account_id = auth.uid()));

-- ── B. Clients ──────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Clients de ma boutique (colis non annulés), les plus récents d'abord. Pseudonymes : aucune donnée personnelle. */
create or replace function public.fn_shop_clients(p_shop uuid)
returns table (client text, quartier text, orders bigint, total_gnf bigint, first_at timestamptz, last_at timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select 'Client ' || upper(substr(md5(o.buyer_id::text || p_shop::text), 1, 4)),
         (select coalesce(q.nom, c.nom) from public.declarations d left join public.quartiers q on q.id = d.quartier_id
            left join public.communes c on c.id = d.commune_id
           where d.id = (array_agg(o.delivery_declaration_id order by p.created_at desc))[1]),
         count(distinct p.order_id), sum(p.subtotal_gnf)::bigint, min(p.created_at), max(p.created_at)
    from public.parcels p join public.orders o on o.id = p.order_id
   where p.shop_id = p_shop and p.status <> 'annule' and public.fn_is_shop_member(p_shop)
   group by o.buyer_id
   order by max(p.created_at) desc
   limit 500
$$;

-- ── C. Équipe ───────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Membres de ma boutique : rôle et numéro masqué (« +224 62• •• •• 41 »). */
create or replace function public.fn_shop_members(p_shop uuid)
returns table (user_id uuid, role text, phone_masked text, me boolean)
language sql stable security definer set search_path = public, pg_temp as $$
  select m.user_id, m.role,
         case when u.phone is null or length(u.phone) < 6 then 'numéro inconnu'
              else '+' || left(u.phone, 5) || '• •• •• ' || right(u.phone, 2) end,
         m.user_id = auth.uid()
    from public.shop_members m left join auth.users u on u.id = m.user_id
   where m.shop_id = p_shop and public.fn_is_shop_member(p_shop)
   order by (m.role = 'proprietaire') desc, m.user_id
$$;

/** Le propriétaire ajoute un employé par son numéro ; le compte Hailand doit déjà exister. L'employé est prévenu. */
create or replace function public.fn_shop_member_add(p_shop uuid, p_phone text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_digits text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'); v_user uuid; v_name text;
begin
  if not public.fn_is_shop_owner(p_shop) then raise exception 'réservé au propriétaire de la boutique'; end if;
  if length(v_digits) = 9 then v_digits := '224' || v_digits; end if;
  if v_digits !~ '^[0-9]{11,15}$' then raise exception 'numéro invalide'; end if;
  select id into v_user from auth.users where regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') = v_digits limit 1;
  if v_user is null then raise exception 'ce numéro n''a pas encore de compte Hailand : demandez-lui de se connecter une fois à HailandX Vendeur'; end if;
  if exists (select 1 from public.shop_members where shop_id = p_shop and user_id = v_user) then raise exception 'ce numéro fait déjà partie de l''équipe'; end if;
  if (select count(*) from public.shop_members where shop_id = p_shop and role = 'employe') >= 5 then raise exception 'équipe complète : 5 employés au plus'; end if;
  insert into public.shop_members (shop_id, user_id, role) values (p_shop, v_user, 'employe');
  select name into v_name from public.shops where id = p_shop;
  perform private.notify(v_user, 'equipe', 'Vous faites partie de l''équipe de ' || v_name, 'Ouvrez HailandX Vendeur pour préparer les commandes.', '/vendeur');
  return v_user;
end $$;

/** Le propriétaire retire un employé (jamais lui-même). */
create or replace function public.fn_shop_member_remove(p_shop uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.fn_is_shop_owner(p_shop) then raise exception 'réservé au propriétaire de la boutique'; end if;
  delete from public.shop_members where shop_id = p_shop and user_id = p_user and role = 'employe';
  if not found then raise exception 'employé introuvable'; end if;
end $$;

-- ── A (suite). Commande : refusée pendant les vacances de la boutique ───────────────────────────────────────────────────
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
begin
  if uid is null then raise exception 'connexion requise'; end if;
  if p_payment not in ('livraison', 'orange_money') then raise exception 'paiement non reconnu'; end if;
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
  insert into public.delivery_events (parcel_id, kind, actor_id) select id, 'cree', uid from public.parcels where order_id = v_order;
  return v_order;
end $$;

revoke all on function public.fn_is_shop_owner(uuid), public.fn_shop_clients(uuid), public.fn_shop_members(uuid),
  public.fn_shop_member_add(uuid, text), public.fn_shop_member_remove(uuid, uuid), public.fn_place_order(jsonb, uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.fn_is_shop_owner(uuid), public.fn_shop_clients(uuid), public.fn_shop_members(uuid),
  public.fn_shop_member_add(uuid, text), public.fn_shop_member_remove(uuid, uuid), public.fn_place_order(jsonb, uuid, text, text, text, text)
  to authenticated;

commit;
