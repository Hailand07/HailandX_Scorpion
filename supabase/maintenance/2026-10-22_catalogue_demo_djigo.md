# Catalogue de démonstration de Djigo Shop (2026-10-22)

Demande du fondateur : « ajoute plein de produits, de différentes catégories, remplis tout à 100 %, avec des images… pour voir à quoi ressemblera l'appli ».
Insertions faites en production le 2026-10-22 (accord explicite du fondateur pour cette opération), boutique **Djigo Shop** (`djigo-shop`).

- **50 produits** (`catalog_products`, adresse web commençant par **`demo-`**), une offre chacun (`offers`), variantes et stock (`offer_variants`), dans 10 rayons créés pour la boutique (`shop_sections`).
- Répartition : mode 9 · informatique et audio 7 · beauté 6 · téléphones 6 · maison 5 · épicerie 4 · santé 4 · enfants 3 · moto 3 · accessoires et divers 3.
- Fiches remplies selon la fiche type de chaque catégorie (`packages/commerce/src/fiche.ts`) : description, 4 points forts, toutes les caractéristiques, mot du vendeur sur certaines offres. Complétude 100 % sauf le thermomètre (2 photos : la 3e trouvée montrait un thermomètre à mercure, contraire à la fiche).
- Prix en GNF fixés à titre d'exemple (ordre de grandeur du marché de Conakry), stocks fictifs.

## Photos

Les photos sont des **adresses web externes** (pas de fichier dans le stockage Hailand) : `mediaUrl` (`packages/kit/src/media.ts`) rend telle quelle une adresse `https://…`.
- `cdn.dummyjson.com` : catalogue de démonstration public prévu pour les essais d'applications (photos de produits sur fond neutre).
- Wikimedia Commons (licences libres, auteurs ci-dessous) pour les produits locaux.

⚠️ Ces photos dépendent de ces sites : à remplacer par de vraies photos des vendeurs avant toute ouverture au public. Les produits de démonstration ne doivent pas être vendus.

## Retirer le catalogue de démonstration

Vérifier d'abord qu'aucune commande ne les contient :

```sql
select count(*) from order_items oi join offers o on o.id = oi.offer_id join catalog_products c on c.id = o.product_id where c.slug like 'demo-%';
```

Si 0, dans une transaction :

```sql
begin;
delete from offer_variants where offer_id in (select o.id from offers o join catalog_products c on c.id = o.product_id where c.slug like 'demo-%');
delete from offers where product_id in (select id from catalog_products where slug like 'demo-%');
delete from product_favorites where product_id in (select id from catalog_products where slug like 'demo-%');
delete from catalog_products where slug like 'demo-%';
commit;
```

(Les rayons de Djigo Shop peuvent rester ; le vendeur les gère dans HailandX Vendeur.)

## Crédits des photos Wikimedia Commons

| Produit | Fichier | Auteur | Licence |
|---|---|---|---|
| Beurre de karité pur de Haute-Guinée 500 g | [Mélange du Beurre de karité et huiles essentielles dans une boite pour massage 02.jpg](https://commons.wikimedia.org/wiki/File:M%C3%A9lange_du_Beurre_de_karit%C3%A9_et_huiles_essentielles_dans_une_boite_pour_massage_02.jpg) | Adoscam | CC BY-SA 4.0 |
| Beurre de karité pur de Haute-Guinée 500 g | [Naturally Processed Shea Butter 2.jpg](https://commons.wikimedia.org/wiki/File:Naturally_Processed_Shea_Butter_2.jpg) | Dhee jah | CC BY-SA 4.0 |
| Beurre de karité pur de Haute-Guinée 500 g | [Shea butter 2024.jpg](https://commons.wikimedia.org/wiki/File:Shea_butter_2024.jpg) | Vision L1 | CC0 |
| Riz parfumé thaï AAA sac de 50 kg | [AAA Golden Boy Fragrant Rice Sack (2).jpg](https://commons.wikimedia.org/wiki/File:AAA_Golden_Boy_Fragrant_Rice_Sack_(2).jpg) | inconnu | CC BY-SA 4.0 |
| Riz parfumé thaï AAA sac de 50 kg | [Bird on a sack of rice.jpg](https://commons.wikimedia.org/wiki/File:Bird_on_a_sack_of_rice.jpg) | Kritzolina | CC BY-SA 4.0 |
| Riz parfumé thaï AAA sac de 50 kg | [Rice sacks.jpg](https://commons.wikimedia.org/wiki/File:Rice_sacks.jpg) | ProjectManhattan | CC BY-SA 3.0 |
| Huile de palme rouge artisanale 5 L | [Palm Oil 0.jpg](https://commons.wikimedia.org/wiki/File:Palm_Oil_0.jpg) | Amuzujoe | CC BY-SA 4.0 |
| Huile de palme rouge artisanale 5 L | [Bottles of red oil.jpg](https://commons.wikimedia.org/wiki/File:Bottles_of_red_oil.jpg) | Daniel Paullll | CC BY-SA 4.0 |
| Huile de palme rouge artisanale 5 L | [Oil Palm from Idanre.jpg](https://commons.wikimedia.org/wiki/File:Oil_Palm_from_Idanre.jpg) | Ei'eke | CC BY-SA 4.0 |
| Miel naturel du Fouta 1 kg | [Antiguan honey products at an exhibition in Saint Lucia.jpg](https://commons.wikimedia.org/wiki/File:Antiguan_honey_products_at_an_exhibition_in_Saint_Lucia.jpg) | Government of Antigua and Barbuda | Public domain |
| Miel naturel du Fouta 1 kg | [Dipper stick and honey in a jar.jpg](https://commons.wikimedia.org/wiki/File:Dipper_stick_and_honey_in_a_jar.jpg) | Shixart1985 | CC BY 2.0 |
| Miel naturel du Fouta 1 kg | [Three French monofloral honey jars.jpg](https://commons.wikimedia.org/wiki/File:Three_French_monofloral_honey_jars.jpg) | Hayden Soloviev | CC BY 4.0 |
| Fonio précuit lavé 1 kg | [Fonio Grains (Digitaria Exilis).jpg](https://commons.wikimedia.org/wiki/File:Fonio_Grains_(Digitaria_Exilis).jpg) | Gabbri.gabbri | CC BY-SA 4.0 |
| Fonio précuit lavé 1 kg | [Acha (Fonio).jpg](https://commons.wikimedia.org/wiki/File:Acha_(Fonio).jpg) | Fatima Bukar | CC BY-SA 4.0 |
| Fonio précuit lavé 1 kg | [SEN Village Chief Theodore.jpg](https://commons.wikimedia.org/wiki/File:SEN_Village_Chief_Theodore.jpg) | Richard Nyberg, USAID | Public domain |
| Ballon de football taille 5 | [Giant Soccer Ball.jpg](https://commons.wikimedia.org/wiki/File:Giant_Soccer_Ball.jpg) | A. Scott Fulkerson | CC BY-SA 4.0 |
| Ballon de football taille 5 | [Adidas MLS Tango 12 soccer ball.jpg](https://commons.wikimedia.org/wiki/File:Adidas_MLS_Tango_12_soccer_ball.jpg) | Empire-ants | CC BY-SA 4.0 |
| Ballon de football taille 5 | [Just a soccer ball (34782492153).jpg](https://commons.wikimedia.org/wiki/File:Just_a_soccer_ball_(34782492153).jpg) | bluesbby from Mountain View, USA | CC BY 2.0 |
| Tensiomètre électronique au bras | [2020 Sfigmomanometr elektroniczny.jpg](https://commons.wikimedia.org/wiki/File:2020_Sfigmomanometr_elektroniczny.jpg) | Jacek Halicki | CC BY-SA 4.0 |
| Tensiomètre électronique au bras | [Sphygmomanometer, automatic blood pressure monitor. Oscillometric measurements, millimeter of mercury (mmHg) unit.jpg](https://commons.wikimedia.org/wiki/File:Sphygmomanometer,_automatic_blood_pressure_monitor._Oscillometric_measurements,_millimeter_of_mercury_(mmHg)_unit.jpg) | Albarubescens | CC BY-SA 4.0 |
| Tensiomètre électronique au bras | [An Omron wrist blood pressure monitor.jpg](https://commons.wikimedia.org/wiki/File:An_Omron_wrist_blood_pressure_monitor.jpg) | Marvelousola01 | CC0 |
| Moustiquaire imprégnée 2 places | [Yong Farmstay mosquito net bed.jpg](https://commons.wikimedia.org/wiki/File:Yong_Farmstay_mosquito_net_bed.jpg) | Tofeiku | CC BY-SA 4.0 |
| Moustiquaire imprégnée 2 places | [Mosquito Net (5855064364).jpg](https://commons.wikimedia.org/wiki/File:Mosquito_Net_(5855064364).jpg) | Can Pac Swire from Toronto, Canada | CC BY-SA 2.0 |
| Moustiquaire imprégnée 2 places | [Children under mosquito net (26483462482).jpg](https://commons.wikimedia.org/wiki/File:Children_under_mosquito_net_(26483462482).jpg) | President's Malaria Initiative | Public domain |
| Thermomètre médical digital | [Digital Thermometer.jpg](https://commons.wikimedia.org/wiki/File:Digital_Thermometer.jpg) | Srini297 | CC BY-SA 4.0 |
| Thermomètre médical digital | [Nurse checks child's temperature with digital thermometer in a clinical setting undefined.jpg](https://commons.wikimedia.org/wiki/File:Nurse_checks_child%27s_temperature_with_digital_thermometer_in_a_clinical_setting_undefined.jpg) | Shixart1985 | CC BY 2.0 |
| Casque moto intégral homologué | [Full-Face Helmet 9274.jpg](https://commons.wikimedia.org/wiki/File:Full-Face_Helmet_9274.jpg) | Ashley Pomeroy | CC BY-SA 4.0 |
| Casque moto intégral homologué | [Motorcyclist with Nikko Moto Racing Helmet.jpg](https://commons.wikimedia.org/wiki/File:Motorcyclist_with_Nikko_Moto_Racing_Helmet.jpg) | Noah Wulf | CC BY-SA 3.0 |
| Casque moto intégral homologué | [Kreta (GR), Rethymno, Motorroller -- 2023 -- 8344 (crop).jpg](https://commons.wikimedia.org/wiki/File:Kreta_(GR),_Rethymno,_Motorroller_--_2023_--_8344_(crop).jpg) | Dietmar Rabich | CC BY-SA 4.0 |
| Lampe solaire rechargeable LED | [Solar lamp Home appliance Rotimi8.jpg](https://commons.wikimedia.org/wiki/File:Solar_lamp_Home_appliance_Rotimi8.jpg) | Rotimi8 | CC BY-SA 4.0 |
| Lampe solaire rechargeable LED | [Christopher from Zambia studying by the light of a solar lamp.jpg](https://commons.wikimedia.org/wiki/File:Christopher_from_Zambia_studying_by_the_light_of_a_solar_lamp.jpg) | Patrick Bentley | CC BY 2.0 |
| Lampe solaire rechargeable LED | [Solar integrated light.jpg](https://commons.wikimedia.org/wiki/File:Solar_integrated_light.jpg) | Fumikas Sagisavas | CC0 |
| Thermos isotherme inox 1 L | [Термос (4).jpg](https://commons.wikimedia.org/wiki/File:%D0%A2%D0%B5%D1%80%D0%BC%D0%BE%D1%81_(4).jpg) | Schekinov Alexey Victorovich | CC BY-SA 4.0 |
| Thermos isotherme inox 1 L | [Термос (1).jpg](https://commons.wikimedia.org/wiki/File:%D0%A2%D0%B5%D1%80%D0%BC%D0%BE%D1%81_(1).jpg) | Schekinov Alexey Victorovich | CC BY-SA 4.0 |
| Thermos isotherme inox 1 L | [Vintage Aladdin Vacuum Flas.jpg](https://commons.wikimedia.org/wiki/File:Vintage_Aladdin_Vacuum_Flas.jpg) | Quercus acuta | CC BY-SA 4.0 |
