-- HailandX — parcours vendeur et suppression de compte.
--  1. Les produits ne se créent qu'une fois la vente ouverte (boutique certifiée) : le tableau de bord vendeur est réservé aux boutiques ouvertes.
--  2. Suppression de son propre compte (Paramètres) : vérifications, puis purge des données personnelles. Le compte est commun à HailandX,
--     Flotte, NavigationX et HailandMap : tout est supprimé. Ce qui engage d'autres personnes (achats livrés, argent, litiges) bloque la
--     suppression en libre-service : elle passe alors par l'équipe Hailand (anonymisation à prévoir).
--     (La fonction de suppression elle-même est dans 2026-10-19_hailandx_compte_suppression.sql : le connecteur du bac à sable ne sait pas
--     enregistrer une fonction contenant des DELETE, elle est exécutée par le fondateur dans l'éditeur SQL de Supabase.)
begin;

-- ── 1. Produits seulement quand la boutique est ouverte ──────────────────────────────────────────────────────────────────────────────
create or replace function public.offers_require_open_shop() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare st text;
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  select status into st from public.shops where id = new.shop_id;
  if st is distinct from 'ouverte' then raise exception 'produits : la boutique doit être ouverte à la vente (adresse certifiée par Hailand)'; end if;
  return new;
end $$;
create trigger offers_require_open_shop before insert on public.offers for each row execute function public.offers_require_open_shop();
revoke all on function public.offers_require_open_shop() from public, anon, authenticated;

-- ── 2. Suppression de compte ───────────────────────────────────────────────────────────────────────────────────────────────────────────
-- Ce qui empêche la suppression en libre-service (affiché avant toute confirmation).
create or replace function public.fn_account_delete_check() returns table (code text, message text)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'connexion requise'; end if;
  if exists (select 1 from public.parcels p join public.orders o on o.id = p.order_id where o.buyer_id = u and p.status in ('attente_vendeur', 'prepare', 'mission_proposee', 'accepte', 'retire')) then
    return query select 'commande_en_cours'::text, 'Une de vos commandes est en cours : attendez sa livraison ou annulez-la.'::text;
  end if;
  if exists (select 1 from public.parcels p join public.orders o on o.id = p.order_id where o.buyer_id = u and p.status in ('remis', 'litige')) then
    return query select 'historique_achats'::text, 'Vous avez des achats livrés ou en litige : cet historique engage d''autres personnes. Contactez l''équipe Hailand pour supprimer ce compte.'::text;
  end if;
  if exists (select 1 from public.shops s join public.parcels p on p.shop_id = s.id join public.orders o on o.id = p.order_id where s.owner_id = u and o.buyer_id <> u) then
    return query select 'boutique_commandes'::text, 'Votre boutique a des commandes de clients : cet historique doit être conservé. Contactez l''équipe Hailand.'::text;
  end if;
  if exists (select 1 from public.parcels p where p.courier_id = u) then
    return query select 'livraisons'::text, 'Vous avez des livraisons en cours ou effectuées comme livreur : contactez l''équipe Hailand.'::text;
  end if;
  if exists (select 1 from public.couriers c where c.user_id = u and c.cash_balance_gnf > 0) then
    return query select 'especes'::text, 'Vous avez des espèces à reverser à Hailand : réglez-les avant de supprimer votre compte.'::text;
  end if;
  if exists (select 1 from public.ledger_entries l where (l.account = 'shop' and l.account_id in (select id from public.shops where owner_id = u))
                or (l.account in ('courier', 'buyer') and l.account_id = u)
                or l.order_id in (select id from public.orders where buyer_id = u)) then
    return query select 'argent'::text, 'Des mouvements d''argent sont enregistrés pour ce compte : contactez l''équipe Hailand.'::text;
  end if;
  if exists (select 1 from public.agents a where a.id = u and a.active and a.role = 'admin')
     and not exists (select 1 from public.agents a where a.id <> u and a.active and a.role = 'admin') then
    return query select 'dernier_admin'::text, 'Ce compte est le dernier administrateur : nommez un autre administrateur avant de le supprimer.'::text;
  end if;
end $$;

revoke all on function public.fn_account_delete_check() from public, anon;
grant execute on function public.fn_account_delete_check() to authenticated;

commit;
