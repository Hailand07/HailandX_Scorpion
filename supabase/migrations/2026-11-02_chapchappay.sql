-- Paiement en ligne par Chap Chap Pay (HAILANDX.md §43) : Orange Money, MTN MoMo, PayCard, cartes… sur une seule page de paiement.
-- Le moyen de paiement de la commande reste « orange_money » (= payé d'avance, argent bloqué jusqu'à la remise) ; le fournisseur
-- qui encaisse est noté dans payments.provider. Le serveur de HailandX crée l'opération chez Chap Chap Pay et reçoit sa
-- notification signée (routes /api/paiement/chapchappay/*) ; la base garde la comptabilité (séquestre, règlement, remboursement).
-- Réglage payment_mode : 'simulation' (équipe : bouton « Simuler »), 'chapchappay_test' (Chap Chap Pay, clés de test, équipe
-- seulement), 'chapchappay' (ouvert à tous). Idempotente. ⚠️ Contient un « drop constraint » : à coller dans l'éditeur SQL.
begin;

-- ───── Paiements : fournisseur, opération et suivi ─────
alter table public.payments drop constraint if exists payments_provider_check;
alter table public.payments add constraint payments_provider_check check (provider in ('simulation', 'orange_money', 'hailandpay', 'chapchappay'));
alter table public.payments add column if not exists operation_id text;
alter table public.payments add column if not exists checkout_url text;
alter table public.payments add column if not exists provider_status text;
alter table public.payments add column if not exists provider_method text;
alter table public.payments add column if not exists provider_test boolean not null default false;
alter table public.payments add column if not exists updated_at timestamptz;
create unique index if not exists payments_operation_once on public.payments (operation_id) where operation_id is not null;
comment on column public.payments.operation_id is 'Identifiant de l''opération chez le fournisseur (Chap Chap Pay : operation_id)';
comment on column public.payments.provider_status is 'Dernier statut reçu du fournisseur : new, pending, success, failed, canceled, error, expired';

-- ───── Le réglage accepte les modes Chap Chap Pay ─────
create or replace function public.fn_console_setting_update(p_key text, p_value text, p_motif text) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_old text; v_new text := btrim(coalesce(p_value, ''));
begin
  if not public.fn_is_fondateur() then raise exception 'paramètres : réservé au fondateur'; end if;
  if length(btrim(coalesce(p_motif, ''))) < 3 then raise exception 'paramètres : indiquez un motif'; end if;
  if p_key in ('commission_bps', 'courier_share_bps') then
    if v_new !~ '^\d{1,5}$' or v_new::int > 10000 then raise exception 'paramètres : valeur hors limites (0 à 100 %%)'; end if;
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
-- L'ancien mode « orange_money » n'avait pas de fournisseur branché : il revient à l'essai (équipe).
update public.settings set value = 'simulation' where key = 'payment_mode' and value = 'orange_money';

create or replace function private.payment_provider() returns text language sql stable security definer set search_path = public, pg_temp as $$
  select case when m like 'chapchappay%' then 'chapchappay' when m = 'simulation' then 'simulation' else 'simulation' end
  from (select coalesce((select value from public.settings where key = 'payment_mode'), 'simulation') m) x
$$;
revoke all on function private.payment_provider() from public, anon, authenticated;

-- ───── Démarrage d'un paiement (acheteur) — même signature qu'avant ─────
create or replace function public.fn_pay_start(p_order uuid)
returns table (payment_id uuid, provider text, amount_gnf integer) language plpgsql security definer set search_path = public, private, pg_temp as $$
declare o public.orders; pm public.payments; mode text := coalesce((select value from public.settings where key = 'payment_mode'), 'simulation');
begin
  select * into o from public.orders where id = p_order;
  if not found or o.buyer_id <> auth.uid() then raise exception 'commande introuvable'; end if;
  if o.payment_method <> 'orange_money' then raise exception 'cette commande ne se paie pas en ligne'; end if;
  if o.payment_status <> 'en_attente' then raise exception 'cette commande est déjà payée ou remboursée'; end if;
  if mode = 'chapchappay_test' and not public.is_admin() then raise exception 'le paiement en ligne est en essai : réservé à l''équipe Hailand pour l''instant'; end if;
  insert into public.payments (order_id, provider, amount_gnf, provider_test) values (p_order, private.payment_provider(), o.total_gnf, mode <> 'chapchappay')
    on conflict (order_id) do nothing;
  select * into pm from public.payments where order_id = p_order;
  return query select pm.id, pm.provider, pm.amount_gnf;
end $$;

-- ───── Lien de paiement créé chez Chap Chap Pay (serveur seulement) ─────
create or replace function public.fn_pay_attach(p_order uuid, p_operation text, p_url text, p_test boolean)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  if not private.is_service_role() then raise exception 'réservé au serveur de paiement'; end if;
  update public.payments set provider = 'chapchappay', operation_id = p_operation, checkout_url = p_url, provider_test = coalesce(p_test, true),
    provider_status = 'new', updated_at = now()
  where order_id = p_order and status = 'initie';
  if not found then raise exception 'paiement introuvable ou déjà réglé'; end if;
end $$;

-- ───── Statut reçu du fournisseur (notification ou vérification) : ne confirme jamais à lui seul ─────
-- « success » passe par fn_payment_confirm ; un lien expiré est oublié pour pouvoir en créer un nouveau.
create or replace function public.fn_pay_provider_status(p_order uuid, p_status text, p_method text default null)
returns text language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v text := lower(btrim(coalesce(p_status, '')));
begin
  if not private.is_service_role() then raise exception 'réservé au serveur de paiement'; end if;
  if v not in ('new', 'pending', 'success', 'failed', 'canceled', 'error', 'expired') then raise exception 'statut inconnu : %', p_status; end if;
  update public.payments set provider_status = v, provider_method = coalesce(nullif(btrim(p_method), ''), provider_method), updated_at = now(),
    operation_id = case when v = 'expired' then null else operation_id end, checkout_url = case when v = 'expired' then null else checkout_url end
  where order_id = p_order and status = 'initie';
  return v;
end $$;

-- ───── Confirmation : comme avant, avec le bon fournisseur ─────
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
    values (p_order, case when private.is_service_role() then 'chapchappay' else 'simulation' end, o.total_gnf, 'paye', nullif(btrim(p_ref), ''), now())
    on conflict (order_id) do update set status = 'paye', provider_ref = nullif(btrim(p_ref), ''), paid_at = now(), updated_at = now(),
      provider_status = case when private.is_service_role() then 'success' else public.payments.provider_status end;
  update public.orders set payment_status = 'bloque' where id = p_order;
  insert into public.ledger_entries (account, order_id, kind, amount_gnf) values ('escrow', p_order, 'paiement', o.total_gnf);
  return 'bloque';
end $$;

revoke all on function public.fn_pay_attach(uuid, text, text, boolean), public.fn_pay_provider_status(uuid, text, text) from public, anon, authenticated;
-- La fonction vérifie elle-même la clé de service (private.is_service_role) ; un compte ordinaire est refusé.
grant execute on function public.fn_pay_attach(uuid, text, text, boolean), public.fn_pay_provider_status(uuid, text, text) to authenticated, service_role;

commit;
