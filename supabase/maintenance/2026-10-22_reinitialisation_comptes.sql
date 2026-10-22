-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- REMISE À ZÉRO DES COMPTES DE L'ÉCOSYSTÈME HAILAND (phase de test) — décidée par le fondateur le 2026-10-14
-- (HAILANDX.md §31, ECOSYSTEME_HAILAND.md §14).
--
-- À EXÉCUTER PAR LE FONDATEUR dans l'éditeur SQL de Supabase (une seule fois, d'un bloc). Tout se fait dans UNE transaction :
-- si une ligne échoue, rien n'est modifié.
--
-- Ce que fait le script :
--   0. Refuse de s'exécuter deux fois (la sauvegarde existerait déjà).
--   1. SAUVEGARDE tout ce qui va être effacé dans le schéma `sauvegarde_20261022` (non exposé aux applications).
--   2. Vide toutes les données d'usage de TOUS les comptes, administrateurs compris : adresses (déclarations), boutiques,
--      produits, commandes, colis, paiements, avis, litiges, livreurs, notifications, journal de la console, demandes de
--      certification, favoris, abonnements.
--   3. Retire les « bâtiments réclamés » (buildings.claimed_by) ; le cadastre lui-même n'est PAS touché.
--   4. Supprime tous les comptes SAUF ceux de la table `agents` (les 5 administrateurs / agents HailandMap : ils sont les
--      auteurs des bâtiments du cadastre et gardent leur rôle).
--   5. Ferme toutes les sessions ouvertes : tout le monde, administrateurs compris, devra se reconnecter.
--
-- Ce que le script ne fait PAS (à faire à la main, voir en bas) : vider les photos du stockage (Supabase interdit de le faire
-- en SQL).
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
begin;

-- ── 0. Garde-fou ─────────────────────────────────────────────────────────────────────────────────────────────────────────
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'sauvegarde_20261022') then
    raise exception 'La remise à zéro a déjà été exécutée (le schéma sauvegarde_20261022 existe). Rien n''a été modifié.';
  end if;
end $$;

-- ── 1. Sauvegarde ────────────────────────────────────────────────────────────────────────────────────────────────────────
create schema sauvegarde_20261022;
revoke all on schema sauvegarde_20261022 from public, anon, authenticated;
create table sauvegarde_20261022.auth_users as table auth.users;
create table sauvegarde_20261022.auth_identities as table auth.identities;
create table sauvegarde_20261022.agents as table public.agents;
create table sauvegarde_20261022.buildings_claimed as select id, claimed_by from public.buildings where claimed_by is not null;
create table sauvegarde_20261022.declarations as table public.declarations;
create table sauvegarde_20261022.shops as table public.shops;
create table sauvegarde_20261022.shop_members as table public.shop_members;
create table sauvegarde_20261022.shop_scores as table public.shop_scores;
create table sauvegarde_20261022.shop_sections as table public.shop_sections;
create table sauvegarde_20261022.shop_follows as table public.shop_follows;
create table sauvegarde_20261022.catalog_products as table public.catalog_products;
create table sauvegarde_20261022.offers as table public.offers;
create table sauvegarde_20261022.offer_variants as table public.offer_variants;
create table sauvegarde_20261022.share_links as table public.share_links;
create table sauvegarde_20261022.product_favorites as table public.product_favorites;
create table sauvegarde_20261022.orders as table public.orders;
create table sauvegarde_20261022.order_items as table public.order_items;
create table sauvegarde_20261022.parcels as table public.parcels;
create table sauvegarde_20261022.delivery_events as table public.delivery_events;
create table sauvegarde_20261022.payments as table public.payments;
create table sauvegarde_20261022.ledger_entries as table public.ledger_entries;
create table sauvegarde_20261022.reviews as table public.reviews;
create table sauvegarde_20261022.review_reports as table public.review_reports;
create table sauvegarde_20261022.disputes as table public.disputes;
create table sauvegarde_20261022.dispute_messages as table public.dispute_messages;
create table sauvegarde_20261022.couriers as table public.couriers;
create table sauvegarde_20261022.certification_priorities as table public.certification_priorities;
create table sauvegarde_20261022.notifications as table public.notifications;
create table sauvegarde_20261022.console_journal as table public.console_journal;
-- Questions-réponses (migration 2026-10-27) : sauvegardées et vidées seulement si la table existe déjà.
do $q$ begin
  if to_regclass('public.product_questions') is not null then
    execute 'create table sauvegarde_20261022.product_questions as table public.product_questions';
  end if;
end $q$;

-- ── 2. Données d'usage : tout est vidé (y compris celles des administrateurs) ─────────────────────────────────────────────
-- TRUNCATE sans CASCADE : si une table liée avait été oubliée, la transaction échouerait sans rien modifier.
-- La table des questions-réponses (migration 2026-10-27) référence boutiques et produits : vidée dans la même instruction si elle existe.
do $q$
declare t text := 'public.notifications, public.dispute_messages, public.disputes, public.review_reports, public.reviews, public.delivery_events, public.ledger_entries, public.payments, public.order_items, public.parcels, public.orders, public.product_favorites, public.shop_follows, public.share_links, public.offer_variants, public.offers, public.shop_sections, public.shop_scores, public.shop_members, public.certification_priorities, public.shops, public.catalog_products, public.couriers, public.console_journal, public.declarations';
begin
  if to_regclass('public.product_questions') is not null then t := 'public.product_questions, ' || t; end if;
  execute 'truncate table ' || t;
end $q$;

-- ── 3. Réclamations de bâtiments (le cadastre reste intact) ───────────────────────────────────────────────────────────────
update public.buildings set claimed_by = null where claimed_by is not null;

-- ── 4. Comptes : seuls ceux de la table agents sont gardés ────────────────────────────────────────────────────────────────
delete from auth.users u where not exists (select 1 from public.agents a where a.id = u.id);

-- ── 5. Toutes les sessions sont fermées (reconnexion obligatoire pour tous) ──────────────────────────────────────────────
delete from auth.sessions;

-- ── Contrôle : doit afficher 0 partout sauf « comptes_gardes » (= nombre d'agents) et « batiments » (inchangé) ────────────
select
  (select count(*) from auth.users) as comptes_gardes,
  (select count(*) from public.agents) as agents,
  (select count(*) from public.declarations) as declarations,
  (select count(*) from public.shops) as boutiques,
  (select count(*) from public.orders) as commandes,
  (select count(*) from public.couriers) as livreurs,
  (select count(*) from public.notifications) as notifications,
  (select count(*) from public.buildings where claimed_by is not null) as batiments_reclames,
  (select count(*) from public.buildings) as batiments,
  (select count(*) from auth.sessions) as sessions;

commit;

-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- APRÈS LE SCRIPT (à la main, tableau de bord Supabase) :
--   • Storage → hx-media : sélectionner tous les fichiers → Delete (logos, photos de produits des anciennes boutiques).
--   • Storage → hx-preuves : idem (photos de remise).
--   • Sur chaque téléphone de test : se déconnecter des applications (ou vider les données du site) si une page reste ouverte.
--
-- RETOUR ARRIÈRE (seulement si nécessaire, à demander à Claude) : les copies sont dans le schéma sauvegarde_20261022.
-- Quand les essais auront repris sans problème, la sauvegarde pourra être supprimée :  drop schema sauvegarde_20261022 cascade;
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
