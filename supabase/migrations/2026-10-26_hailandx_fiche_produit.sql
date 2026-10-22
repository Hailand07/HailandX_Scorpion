-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- FICHE PRODUIT DÉTAILLÉE (demande du fondateur, 2026-10-22 ; HAILANDX.md §33).
--
-- La fiche commune d'un produit (`catalog_products`) a déjà une description et des caractéristiques (`attributes`, JSON) :
-- elles sont désormais remplies par le vendeur selon la fiche type de la catégorie (`packages/commerce/src/fiche.ts`).
-- 1. Limites de taille (description ≤ 4 000 caractères, caractéristiques : objet JSON ≤ 16 Ko).
-- 2. `fn_product_update_details` : le CRÉATEUR de la fiche (ou l'équipe) peut la compléter ou la corriger après coup
--    (description, caractéristiques, catégorie). Les autres vendeurs du même produit gardent leur propre note
--    (`offers.description`) et l'état (`offers.condition`) : ils ne modifient pas la fiche commune.
-- Ajouts seulement ; aucune donnée existante n'est modifiée (les 3 fiches actuelles respectent déjà ces limites).
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'catalog_products_description_len') then
    alter table public.catalog_products add constraint catalog_products_description_len check (description is null or length(description) <= 4000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'catalog_products_attributes_shape') then
    alter table public.catalog_products add constraint catalog_products_attributes_shape check (jsonb_typeof(attributes) = 'object' and pg_column_size(attributes) <= 16384);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'offers_description_len') then
    alter table public.offers add constraint offers_description_len check (description is null or length(description) <= 1000);
  end if;
end $$;

/** Compléter la fiche commune d'un produit : son créateur ou l'équipe. Renvoie le slug de la fiche. */
create or replace function public.fn_product_update_details(p_product uuid, p_description text, p_attributes jsonb, p_category text default null)
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare v public.catalog_products;
begin
  select * into v from public.catalog_products where id = p_product;
  if not found then raise exception 'fiche produit introuvable'; end if;
  if v.created_by is distinct from auth.uid() and not public.is_admin() then
    raise exception 'fiche produit : seul le vendeur qui l''a créée peut la modifier (ajoutez votre note dans votre offre)';
  end if;
  if p_category is not null and not exists (select 1 from public.categories c where c.id = p_category) then raise exception 'catégorie inconnue'; end if;
  update public.catalog_products
     set description = nullif(btrim(coalesce(p_description, '')), ''),
         attributes = coalesce(p_attributes, '{}'::jsonb),
         category_id = coalesce(p_category, category_id)
   where id = p_product;
  return v.slug;
end $$;
revoke execute on function public.fn_product_update_details(uuid, text, jsonb, text) from public, anon;
grant execute on function public.fn_product_update_details(uuid, text, jsonb, text) to authenticated;
