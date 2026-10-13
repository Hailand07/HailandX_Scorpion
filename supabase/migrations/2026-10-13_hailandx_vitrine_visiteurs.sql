-- Les visiteurs n'ont pas le droit d'exécuter is_admin() (durcissement du 2026-10-05) : leurs règles de lecture n'y font donc pas appel.
-- Les règles existantes passent aux comptes connectés ; de nouvelles règles, sans is_admin(), couvrent les visiteurs.
-- APPLIQUÉE le 2026-10-13 (défaut trouvé en rejouant le flux sur la vraie base : la vitrine restait vide pour un visiteur).
alter policy shops_read on public.shops to authenticated;
alter policy products_read on public.catalog_products to authenticated;
alter policy offers_read on public.offers to authenticated;
alter policy variants_read on public.offer_variants to authenticated;

create policy shops_read_anon on public.shops for select to anon using (status <> 'suspendue');
create policy products_read_anon on public.catalog_products for select to anon using (status = 'actif');
create policy offers_read_anon on public.offers for select to anon using (active);
create policy variants_read_anon on public.offer_variants for select to anon
  using (exists (select 1 from public.offers o where o.id = offer_id and o.active));
