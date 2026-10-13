-- HailandX — fonction de suppression de son propre compte (voir 2026-10-19_hailandx_compte.sql pour le contexte).
-- À EXÉCUTER PAR LE FONDATEUR dans l'éditeur SQL de Supabase (le connecteur du bac à sable bloque les instructions DELETE, même dans une fonction).
-- Idempotent : peut être relancé sans risque.
-- Supprime le compte de l'appelant et ses données (confirmation : taper SUPPRIMER). Retire aussi les droits d'équipe éventuels (agents).
create or replace function public.fn_delete_my_account(p_confirm text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare u uuid := auth.uid(); why text;
begin
  if u is null then raise exception 'connexion requise'; end if;
  if p_confirm is distinct from 'SUPPRIMER' then raise exception 'confirmation incorrecte : tapez SUPPRIMER'; end if;
  select string_agg(message, ' ') into why from public.fn_account_delete_check();
  if why is not null then raise exception 'suppression impossible : %', why; end if;

  delete from public.dispute_messages where author_id = u;
  update public.disputes set resolved_by = null where resolved_by = u;
  update public.review_reports set decided_by = null where decided_by = u;
  delete from public.review_reports where reported_by = u;
  delete from public.certification_priorities where requested_by = u;
  -- Commandes sans conséquence pour d'autres (aucune livraison faite, aucun argent) : supprimées avec leurs colis.
  delete from public.payments where order_id in (select id from public.orders where buyer_id = u);
  delete from public.orders where buyer_id = u;
  -- Boutiques du compte (avec offres, variantes, rayons, liens, abonnés, indice).
  delete from public.shops where owner_id = u;
  delete from public.shop_members where user_id = u;
  delete from public.catalog_products c where c.created_by = u and not exists (select 1 from public.offers o where o.product_id = c.id);
  update public.catalog_products set created_by = null where created_by = u;
  delete from public.couriers where user_id = u;
  delete from public.declarations where user_id = u;
  delete from public.profiles where id = u::text;
  delete from public.agents where id = u;
  delete from auth.users where id = u;
end $$;

revoke all on function public.fn_delete_my_account(text) from public, anon;
grant execute on function public.fn_delete_my_account(text) to authenticated;
