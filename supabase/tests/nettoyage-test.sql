-- Nettoyage des données créées par les tests réels (boutique « Test Claude », commandes, livreur de test, adresse de test).
-- À exécuter par le fondateur (éditeur SQL de Supabase) : le connecteur du bac à sable bloque les DELETE.
-- Ne supprime que ce qui porte la marque des tests (identifiants « test-claude-… », « Livreur Test Claude », code d'adresse « TESTX-… »).
do $$
declare sh uuid[]; ord uuid[]; par uuid[]; cou uuid[];
begin
  select array_agg(id) into sh from public.shops where slug like 'test-claude-%';
  if sh is not null then
    select array_agg(distinct order_id) into ord from public.parcels where shop_id = any(sh);
    select array_agg(id) into par from public.parcels where shop_id = any(sh);
    select array_agg(user_id) into cou from public.couriers where full_name like 'Livreur Test Claude%';
    -- tables qui référencent les colis ou les commandes (ordre : enfants d'abord)
    delete from public.ledger_entries where parcel_id = any(coalesce(par, '{}')) or order_id = any(coalesce(ord, '{}'))
      or (account = 'shop' and account_id = any(sh)) or (account = 'courier' and account_id = any(coalesce(cou, '{}')));
    delete from public.disputes where parcel_id = any(coalesce(par, '{}'));
    delete from public.payments where order_id = any(coalesce(ord, '{}'));
    delete from public.delivery_events where parcel_id = any(coalesce(par, '{}'));
    delete from public.reviews where shop_id = any(sh);
    delete from public.order_items where order_id = any(coalesce(ord, '{}'));
    delete from public.parcels where shop_id = any(sh);
    delete from public.orders where id = any(coalesce(ord, '{}'));
    delete from public.shops where id = any(sh);   -- supprime en cascade membres, indice, offres, variantes et liens
  end if;
  delete from public.catalog_products where slug like '%-test-claude-%';
  delete from public.couriers where full_name like 'Livreur Test Claude%';
  delete from public.declarations where hailand_code like 'TESTX-%';
  -- Les images de test (dossier du compte de test) se suppriment depuis Storage > hx-media.
end $$;
