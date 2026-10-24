# Essai complet HailandPay en Syli (2026-10-24)

Demande du fondateur : « oui vas-y pour l'essai complet » (étape 4 du plan `HAILANDX.md` §42). Rapport et anomalies : `HAILANDX.md` §42, « Étape 4 ».
Écritures faites en production le 2026-10-24 entre **20:34:21 et 20:37:45 UTC**, **par les vraies fonctions de la base**, exécutées au nom de chaque compte (rôle `authenticated` + identité du compte, comme le font les applications). Aucun SMS : les notifications restent dans les applications. Le Syli est de l'argent de test, sans valeur.

## Ce qui a été joué
| Étape | Qui | Quoi | Résultat |
|---|---|---|---|
| A | 623 77 01 66 | recharge de test 5 000 000 Syli ; O1 lunettes (HailandShop), O2 ballon (Djigo) + tensiomètre (HailandShop), O3 thermos (Djigo), toutes payées **HailandPay** | 923 000 Syli débités, argent **bloqué** |
| A | 610 01 04 19 | recharge 400 000 ; O4 miel (Djigo) payé HailandPay | 162 500 débités |
| B | 610 et 623 | 8 refus attendus : commande sans solde suffisant, envoi à soi-même, à un numéro inconnu, au-delà du solde, retrait au-delà du solde, boutique d'autrui, recharge au-delà du plafond (« encore 45 000 000 possibles »), montant nul | ✅ tous refusés, rien d'écrit |
| C | 623 → 610 | envoi de 300 000 Syli « Pour la chemise » | 610 prévenu |
| C | 623 | annule O3 avant préparation | 145 000 rendus |
| C | Djigo | annule O4 (rupture, sans remise en stock) | 162 500 rendus au 610 |
| C | 610 | O5 chemise L ×2 (HailandShop), payée avec les Syli reçus | 365 500 débités |
| C | boutiques | colis O1, O2 (×2), O5 prêts | missions proposées |
| D | livreur 610 | accepte 4 missions, retire (QR) aux 2 boutiques, remet (code + photo) aux 2 adresses | remis ; Djigo + 87 400, HailandShop + 846 400, livreur + 102 800 ; **espèces inchangées** (1 877 000) |
| E | 623, équipe (610) | litige tensiomètre → remboursement total ; lunettes → geste de 60 000 ; ballon → pour le vendeur | 380 000 et 60 000 rendus au 623 ; 349 600 et 55 200 repris à HailandShop |
| F | propriétaire HailandShop | 300 000 vers son portefeuille ; retrait simulé PayCard de 100 000 depuis la boutique | boutique 41 600, propriétaire 300 000 |
| F | 610 | retrait simulé Orange Money 200 000 | 237 300 |
| F | équipe (623) | crédit de 50 000 à Djigo, débit de 10 000 au 610 (motifs inscrits au journal) | Djigo 137 400, 610 227 300 |

**Soldes finaux** : 623 = 4 362 000 · 610 = 227 300 · propriétaire HailandShop = 300 000 · HailandShop = 41 600 · Djigo = 137 400 → **5 068 300 Syli** dans les portefeuilles.
**Contrôle** : injectés 5 400 000 (recharges) + 50 000 (crédit) − 10 000 (débit) − 300 000 (retraits) = 5 140 000 = 5 068 300 (portefeuilles) + **71 700** (commission Hailand gardée : 46 000 sur les articles + 25 700, sa part de 20 % des frais de livraison). Séquestre, dû aux boutiques, aux acheteurs et au livreur : **0**. `fn_hailandpay_overview` : **0 portefeuille déséquilibré**.

## Retirer ces données (si le fondateur le demande)
⚠️ Tout d'un bloc, dans une transaction, après avoir vérifié la liste. Les portefeuilles n'existaient pas avant l'essai : on peut tous les vider.

```sql
begin;
create temp table e_o on commit drop as select unnest(array['093e4524-aac9-4372-9a61-b067da1b3e3c','31d57b63-7d5c-45d4-82b9-84cfc3ec81a5','d62375d1-8888-4979-9412-2f017037a7c7','d84fabcf-5d48-443e-8f6f-c4c3d8a58cd3','1cdf9d8b-5856-468e-8f24-9eabb9f58b9b']::uuid[]) id;
create temp table e_p on commit drop as select id from parcels where order_id in (select id from e_o);
delete from wallet_movements;
delete from ledger_entries where account = 'wallet' or order_id in (select id from e_o) or parcel_id in (select id from e_p);
delete from wallets;
delete from dispute_messages where dispute_id in (select id from disputes where parcel_id in (select id from e_p));
delete from disputes where parcel_id in (select id from e_p);
delete from delivery_events where parcel_id in (select id from e_p);
delete from payments where order_id in (select id from e_o);
-- stock : lunettes +1, ballon +1, tensiomètre +1, chemise L +2, miel +1 (le thermos a déjà été remis en rayon)
update offer_variants set stock = stock + 1 where id in ('6d90b86c-4625-4d30-b0aa-641f08a28c55','0e714b31-0713-434d-a7d2-4a6251ec3788','1c228c0c-4fac-40b2-8ec1-8468e852c1c9','f002622f-6024-4581-9f77-4d9c416209bb');
update offer_variants set stock = stock + 2 where id = 'a14d2267-3026-4cbe-8518-a45e3e2e4311';
delete from order_items where order_id in (select id from e_o);
delete from parcels where id in (select id from e_p);
delete from orders where id in (select id from e_o);
delete from notifications where created_at between '2026-10-24 20:34+00' and '2026-10-24 20:38+00';
commit;
```
Les actions de l'équipe restent dans `console_journal` (5 lignes : 2 HailandPay, 3 litiges) : c'est un journal, on le garde. Puis `select fn_refresh_shop_score(id) from shops;`.
