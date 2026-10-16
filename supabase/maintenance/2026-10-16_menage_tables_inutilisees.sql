-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- MÉNAGE DES TABLES INUTILISÉES (BASE_DE_DONNEES.md §9.1) — À EXÉCUTER PAR LE FONDATEUR dans l'éditeur SQL de Supabase.
--
-- Tables visées (plus lues ni écrites par aucune application, aucune fonction ni vue n'en dépend) :
--   admin_pays, admin_capitals, admin_points, admin_lines, populated_places, concessions, deliveries, facades.
-- Sécurité :
--   1. Chaque table est d'abord COPIÉE (structure + lignes) dans le schéma `sauvegarde_menage_20261016`.
--   2. Puis supprimée SANS « cascade » : si un objet en dépend encore, Postgres refuse et TOUT est annulé (une seule transaction).
--   3. Une table absente est simplement ignorée ; une seconde exécution ne fait rien de plus (la sauvegarde n'est pas écrasée).
-- Annuler : `create table public.<table> as table sauvegarde_menage_20261016.<table>;` (les index et contraintes ne sont pas recréés).
-- Quand vous êtes sûr de ne plus en avoir besoin : `drop schema sauvegarde_menage_20261016 cascade;`.
--
-- ⚠️ Le lot 3D (batiments_3d + 3 vues vue_*_statistiques) n'est PAS supprimé par défaut : décommentez la section en bas
--    seulement si vous renoncez à la 3D.
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
begin;

create schema if not exists sauvegarde_menage_20261016;

do $$
declare
  t text;
begin
  foreach t in array array['admin_pays', 'admin_capitals', 'admin_points', 'admin_lines', 'populated_places', 'concessions', 'deliveries', 'facades'] loop
    if to_regclass('public.' || t) is not null then
      if to_regclass('sauvegarde_menage_20261016.' || t) is null then
        execute format('create table sauvegarde_menage_20261016.%I as table public.%I', t, t);
      end if;
      execute format('drop table public.%I', t);
      raise notice 'Table % sauvegardée puis supprimée.', t;
    else
      raise notice 'Table % absente : ignorée.', t;
    end if;
  end loop;
end $$;

-- ── Lot 3D (facultatif) : à décommenter pour supprimer batiments_3d et ses trois vues de statistiques ──────────────────────
-- drop view if exists public.vue_communes_statistiques_3d, public.vue_quartiers_statistiques_3d, public.vue_prefectures_statistiques;
-- create table sauvegarde_menage_20261016.batiments_3d as table public.batiments_3d;
-- drop table public.batiments_3d;

commit;
