# Offres de démonstration de HailandShop (2026-10-23)

Demande du fondateur : « de la même manière que pour Djigo Shop, ajoute des produits pour le compte créé avec le numéro 612746342… des produits similaires à ceux de Djigo Shop… pour voir comment s'affichent les mêmes produits proposés par différents vendeurs, et comment le prix influence ».
Insertions faites en production le 2026-10-23 (accord explicite du fondateur pour cette opération), boutique **HailandShop** (`hailandshop`, compte du +224 612 74 63 42).

- **25 offres** (`offers`) sur **25 fiches de démonstration de Djigo Shop** (mêmes `catalog_products`, adresse web `demo-…`) : c'est le cas « même produit, plusieurs vendeurs ». Aucune nouvelle fiche créée.
- **34 variantes** (`offer_variants`) avec stock fictif, **6 rayons** (`shop_sections`) : Téléphones et high-tech, Mode et chaussures, Beauté, Maison, Épicerie, Santé.
- Photos : celles de la fiche commune (adresses web externes, voir `2026-10-22_catalogue_demo_djigo.md`).
- Prix volontairement variés pour montrer la concurrence (HAILANDX.md §39) : moins cher que Djigo (iPhone 13 Pro, AirPods, Jordan 1, Realme, iPad mini, riz, fonio, karité…), au même prix (Oppo), plus cher (Galaxy S10, MacBook, Puma, montre, micro-ondes…) et un prix **exagéré** (miel 165 000 GNF contre 120 000 : +38 %) pour voir l'alerte du vendeur et l'offre reléguée. Quatre prix barrés (iPhone 13 Pro, AirPods, Jordan 1, blender) et trois produits mis en avant.

## Retirer ces offres

Vérifier d'abord qu'aucune commande ne les contient :

```sql
select count(*) from order_items oi join offers o on o.id = oi.offer_id join shops s on s.id = o.shop_id join catalog_products c on c.id = o.product_id
where s.slug = 'hailandshop' and c.slug like 'demo-%';
```

Si 0, dans une transaction :

```sql
begin;
delete from offer_variants where offer_id in (select o.id from offers o join shops s on s.id = o.shop_id join catalog_products c on c.id = o.product_id where s.slug = 'hailandshop' and c.slug like 'demo-%');
delete from offers where shop_id = (select id from shops where slug = 'hailandshop') and product_id in (select id from catalog_products where slug like 'demo-%');
commit;
```

(Les rayons peuvent rester : le vendeur les gère dans HailandX Vendeur. Le retrait du catalogue de Djigo Shop — fichier du 2026-10-22 — supprime aussi ces offres puisqu'il retire toutes les offres sur les fiches `demo-`.)
