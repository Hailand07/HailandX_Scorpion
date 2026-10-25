-- Annulation automatique des commandes payables en ligne jamais payées (HAILANDX.md §43). Accord du fondateur le 2026-10-25
-- (« oui fais l'annulation automatique »). Une commande « Mobile Money ou carte » encore à payer 72 h après sa création
-- (le lien Chap Chap Pay expire au bout de 72 h) est annulée et ses articles reviennent en stock ; on attend tant qu'un
-- paiement est en cours de confirmation ou qu'un lien a moins de 73 h. Un paiement arrivé malgré tout après l'annulation
-- est aussitôt compté à rembourser. Exécution toutes les heures par pg_cron (activé ici s'il est disponible). Idempotente.
begin;

create or replace function private.expire_unpaid_online_orders(p_hours integer default 72)
returns integer language plpgsql security definer set search_path = public, private, pg_temp as $$
declare o record; p record; n integer := 0;
begin
  for o in
    select ord.id from public.orders ord left join public.payments pay on pay.order_id = ord.id
     where ord.payment_method = 'orange_money' and ord.payment_status = 'en_attente'
       and ord.created_at < now() - make_interval(hours => p_hours)
       and exists (select 1 from public.parcels x where x.order_id = ord.id and x.status not in ('annule', 'remis'))
       and (pay.order_id is null or (pay.status = 'initie'
            and (pay.operation_id is null or coalesce(pay.updated_at, ord.created_at) < now() - make_interval(hours => p_hours + 1))))
     for update of ord skip locked
  loop
    for p in select id from public.parcels where order_id = o.id and status not in ('annule', 'remis') for update loop
      update public.parcels set status = 'annule', courier_id = null, cancelled_by = 'equipe',
        cancel_reason = 'Paiement non reçu dans les ' || p_hours || ' h : commande annulée automatiquement, articles remis en stock.'
       where id = p.id;
      update public.offer_variants v set stock = v.stock + i.quantity from public.order_items i where i.parcel_id = p.id and i.variant_id = v.id;
      insert into public.delivery_events (parcel_id, kind, actor_id) values (p.id, 'annule', null);
    end loop;
    update public.payments set provider_status = coalesce(provider_status, 'expired'), operation_id = null, checkout_url = null, updated_at = now()
     where order_id = o.id and status = 'initie';
    n := n + 1;
  end loop;
  if n > 0 then perform private.journal('commandes_impayees_annulees', 'commande', null, jsonb_build_object('nombre', n, 'delai_h', p_hours), 'automatique'); end if;
  return n;
end $$;
revoke all on function private.expire_unpaid_online_orders(integer) from public, anon, authenticated;

-- Paiement confirmé pour une commande déjà annulée (paiement tardif) : on l'encaisse puis on le compte aussitôt à rembourser.
create or replace function private.refund_if_cancelled() returns trigger
language plpgsql security definer set search_path = public, private, pg_temp as $$
declare total integer;
begin
  if new.payment_status = 'bloque' and old.payment_status = 'en_attente'
     and not exists (select 1 from public.parcels where order_id = new.id and status <> 'annule') then
    total := new.total_gnf;
    insert into public.ledger_entries (account, account_id, order_id, kind, amount_gnf) values
      ('escrow', null, new.id, 'remboursement_tardif', -total),
      ('buyer', new.buyer_id, new.id, 'remboursement', total);
    update public.payments set refunded_gnf = refunded_gnf + total, status = 'rembourse', updated_at = now() where order_id = new.id;
    new.payment_status := 'rembourse';
    perform private.notify(new.buyer_id, 'paiement', 'Paiement reçu après l''annulation',
      'Votre commande avait été annulée faute de paiement à temps : les ' || public.fn_gnf(total) || ' GNF vous seront remboursés.', '/commandes/' || new.id);
    perform private.notify_admins('paiement', 'Remboursement à faire (paiement tardif)', public.fn_gnf(total) || ' GNF', '/console/argent');
  end if;
  return new;
end $$;
revoke all on function private.refund_if_cancelled() from public, anon, authenticated;
drop trigger if exists orders_refund_if_cancelled on public.orders;
create trigger orders_refund_if_cancelled before update of payment_status on public.orders for each row execute function private.refund_if_cancelled();

-- On ne démarre pas le paiement d'une commande entièrement annulée.
create or replace function public.fn_pay_start(p_order uuid)
returns table (payment_id uuid, provider text, amount_gnf integer) language plpgsql security definer set search_path = public, private, pg_temp as $$
declare o public.orders; pm public.payments; mode text := coalesce((select value from public.settings where key = 'payment_mode'), 'simulation');
begin
  select * into o from public.orders where id = p_order;
  if not found or o.buyer_id <> auth.uid() then raise exception 'commande introuvable'; end if;
  if o.payment_method <> 'orange_money' then raise exception 'cette commande ne se paie pas en ligne'; end if;
  if o.payment_status <> 'en_attente' then raise exception 'cette commande est déjà payée ou remboursée'; end if;
  if not exists (select 1 from public.parcels where order_id = p_order and status <> 'annule') then raise exception 'cette commande est annulée : rien à payer'; end if;
  if mode = 'chapchappay_test' and not public.is_admin() then raise exception 'le paiement en ligne est en essai : réservé à l''équipe Hailand pour l''instant'; end if;
  insert into public.payments (order_id, provider, amount_gnf, provider_test) values (p_order, private.payment_provider(), o.total_gnf, mode <> 'chapchappay')
    on conflict (order_id) do nothing;
  select * into pm from public.payments where order_id = p_order;
  return query select pm.id, pm.provider, pm.amount_gnf;
end $$;

-- Toutes les heures (minute 17). Sans pg_cron (banc de test), rien n'est planifié.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname = 'hailandx-commandes-impayees';
    perform cron.schedule('hailandx-commandes-impayees', '17 * * * *', 'select private.expire_unpaid_online_orders(72)');
  end if;
end $$;

commit;
