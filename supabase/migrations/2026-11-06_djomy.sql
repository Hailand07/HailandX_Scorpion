-- Paiement en ligne par Djomy (HAILANDX.md §47), à côté de Chap Chap Pay. Compte marchand ouvert par le fondateur le
-- 2026-10-25 au nom de Loura Voyage SARL (sandbox + compte live). Documentation API v1.0 copiée par le fondateur.
-- Réglage payment_mode : + 'djomy_test' (sandbox Djomy, équipe seulement) et 'djomy' (production, ouvert à tous).
-- Frais réellement prélevés par Djomy (champ « fees » du webhook) gardés dans payments.provider_fee_gnf : ils servent au
-- calcul exact d'une annulation tardive (§45). Idempotente. ⚠️ Contient un « drop constraint » : à coller dans l'éditeur SQL.
begin;

alter table public.payments drop constraint if exists payments_provider_check;
alter table public.payments add constraint payments_provider_check check (provider in ('simulation', 'orange_money', 'hailandpay', 'chapchappay', 'djomy'));
alter table public.payments add column if not exists provider_fee_gnf integer check (provider_fee_gnf is null or provider_fee_gnf >= 0);
comment on column public.payments.provider_fee_gnf is 'Frais prélevés par le fournisseur sur ce paiement (GNF), s''il les communique (Djomy) — §47';

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
    if v_new not in ('simulation', 'chapchappay_test', 'chapchappay', 'djomy_test', 'djomy') then raise exception 'paramètres : mode de paiement inconnu'; end if;
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

create or replace function private.payment_provider() returns text language sql stable security definer set search_path = public, pg_temp as $$
  select case when m like 'chapchappay%' then 'chapchappay' when m like 'djomy%' then 'djomy' else 'simulation' end
  from (select coalesce((select value from public.settings where key = 'payment_mode'), 'simulation') m) x
$$;
revoke all on function private.payment_provider() from public, anon, authenticated;

create or replace function public.fn_pay_start(p_order uuid)
returns table (payment_id uuid, provider text, amount_gnf integer) language plpgsql security definer set search_path = public, private, pg_temp as $$
declare o public.orders; pm public.payments; mode text := coalesce((select value from public.settings where key = 'payment_mode'), 'simulation');
begin
  select * into o from public.orders where id = p_order;
  if not found or o.buyer_id <> auth.uid() then raise exception 'commande introuvable'; end if;
  if o.payment_method <> 'orange_money' then raise exception 'cette commande ne se paie pas en ligne'; end if;
  if o.payment_status <> 'en_attente' then raise exception 'cette commande est déjà payée ou remboursée'; end if;
  if not exists (select 1 from public.parcels where order_id = p_order and status <> 'annule') then raise exception 'cette commande est annulée : rien à payer'; end if;
  if mode in ('chapchappay_test', 'djomy_test') and not public.is_admin() then raise exception 'le paiement en ligne est en essai : réservé à l''équipe Hailand pour l''instant'; end if;
  insert into public.payments (order_id, provider, amount_gnf, provider_test) values (p_order, private.payment_provider(), o.total_gnf, mode not in ('chapchappay', 'djomy'))
    on conflict (order_id) do nothing;
  select * into pm from public.payments where order_id = p_order;
  return query select pm.id, pm.provider, pm.amount_gnf;
end $$;

create or replace function public.fn_pay_attach(p_order uuid, p_operation text, p_url text, p_test boolean)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  if not private.is_service_role() then raise exception 'réservé au serveur de paiement'; end if;
  -- Fournisseur du mode en cours (Chap Chap Pay ou Djomy) : la route vient de créer le lien chez lui.
  update public.payments set provider = private.payment_provider(), operation_id = p_operation, checkout_url = p_url, provider_test = coalesce(p_test, true),
    provider_status = 'new', updated_at = now()
  where order_id = p_order and status = 'initie';
  if not found then raise exception 'paiement introuvable ou déjà réglé'; end if;
end $$;

create or replace function public.fn_payment_confirm(p_order uuid, p_ref text, p_amount integer)
returns text language plpgsql security definer set search_path = public, private, pg_temp as $$
declare o public.orders;
begin
  if not (private.is_service_role() or public.is_admin()) then raise exception 'confirmation réservée au serveur de paiement ou à l''équipe Hailand'; end if;
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'commande introuvable'; end if;
  if o.payment_method <> 'orange_money' then raise exception 'cette commande ne se paie pas en ligne'; end if;
  if o.payment_status <> 'en_attente' then raise exception 'cette commande est déjà payée ou remboursée'; end if;
  if p_amount is distinct from o.total_gnf then raise exception 'montant incorrect : % au lieu de %', p_amount, o.total_gnf; end if;
  insert into public.payments (order_id, provider, amount_gnf, status, provider_ref, paid_at)
    values (p_order, case when private.is_service_role() then private.payment_provider() else 'simulation' end, o.total_gnf, 'paye', nullif(btrim(p_ref), ''), now())
    on conflict (order_id) do update set status = 'paye', provider_ref = nullif(btrim(p_ref), ''), paid_at = now(), updated_at = now(),
      provider_status = case when private.is_service_role() then 'success' else public.payments.provider_status end;
  update public.orders set payment_status = 'bloque' where id = p_order;
  insert into public.ledger_entries (account, order_id, kind, amount_gnf) values ('escrow', p_order, 'paiement', o.total_gnf);
  return 'bloque';
end $$;

-- Frais communiqués par le fournisseur (serveur seulement).
create or replace function public.fn_pay_provider_fee(p_order uuid, p_fee integer)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  if not private.is_service_role() then raise exception 'réservé au serveur de paiement'; end if;
  if p_fee is null or p_fee < 0 then return; end if;
  update public.payments set provider_fee_gnf = p_fee, updated_at = now() where order_id = p_order;
end $$;
revoke all on function public.fn_pay_provider_fee(uuid, integer) from public, anon, authenticated;
grant execute on function public.fn_pay_provider_fee(uuid, integer) to authenticated, service_role;

create or replace function private.provider_fee_gnf(p_order uuid, p_amount integer) returns integer
language sql stable security definer set search_path = public, pg_temp as $$
  select case when o.payment_method = 'orange_money' and pay.status = 'paye' then
    case
      -- Frais réellement prélevés, donnés par le fournisseur (Djomy) : au prorata du colis.
      when pay.provider_fee_gnf is not null then round(pay.provider_fee_gnf * p_amount::numeric / greatest(o.total_gnf, 1))::integer
      -- Chap Chap Pay : 2 % + 200 GNF (carte 2,5 %), la part fixe au prorata des colis.
      when pay.provider = 'chapchappay' then
        (round(p_amount * case when lower(coalesce(pay.provider_method, '')) in ('card', 'carte', 'bank_card', 'visa', 'mastercard') then 250 else 200 end / 10000.0)
         + round(200.0 * p_amount / greatest(o.total_gnf, 1)))::integer
      else 0 end
    else 0 end
    from public.orders o left join public.payments pay on pay.order_id = o.id where o.id = p_order
$$;
revoke all on function private.provider_fee_gnf(uuid, integer) from public, anon, authenticated;

commit;
