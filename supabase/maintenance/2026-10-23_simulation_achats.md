# Simulation complète acheteur ↔ vendeur (2026-10-23)

Demande du fondateur : « une utilisation complète entre acheteur et vendeur… divers achats, différents avis, retours du vendeur… que tous les cas soient touchés… paiement en espèces » avec les comptes **+224 610 01 04 19** et **+224 623 77 01 66**. Rapport et anomalies : `HAILANDX.md` §40.
Écritures faites en production le 2026-10-23 (accord explicite du fondateur pour cette opération), **par les vraies fonctions de la base**, exécutées au nom de chaque compte (rôle `authenticated` + identité du compte, comme le font les applications). Aucun SMS : les notifications restent dans les applications.

## Préalable
Le fondateur a enregistré lui-même une adresse dans NavigationX pour chaque numéro (niveau 2, précision 500 m).

## Ce qui a été créé
| Qui | Quoi |
|---|---|
| HailandShop | code promo `BIENVENUE10` (−10 % dès 100 000 GNF, 50 utilisations, une fois par client) |
| Djigo Shop | code promo `DJIGO20K` (−20 000 GNF dès 300 000 GNF) |
| 623 77 01 66 | suit les 2 boutiques ; 3 favoris ; 2 questions (miel, Jordan 1) |
| 610 01 04 19 | suit HailandShop ; 2 favoris ; 1 question (micro-ondes) |
| 12 commandes, 13 colis | tous payés **à la livraison** (espèces) ; sources application, WhatsApp, Facebook, TikTok |

| Commande | Acheteur | Boutique(s) | Situation jouée | État final |
|---|---|---|---|---|
| O1 Jordan 1 (42) + AirPods | 610 | HailandShop | code `BIENVENUE10`, venue de WhatsApp | remis, avis 5★ |
| O2 coque + micro-ondes / karité ×2 | 610 | Djigo + HailandShop | panier sur 2 boutiques (2 colis, 2 frais), code `DJIGO20K` | remis, avis 4★ (Djigo) et 3★ (HailandShop) |
| O3 miel + riz | 623 | HailandShop | code `BIENVENUE10` ; miel au prix exagéré | remis, avis 2★ « trop cher », **signalé** par la boutique, **maintenu** par l'équipe |
| O4 iPhone 13 Pro Graphite | 623 | Djigo | **annulé par le vendeur** (rupture) | annulé |
| O5 Galaxy S10 | 623 | HailandShop | **annulé par l'acheteur** avant préparation | annulé |
| O6 tensiomètre + fonio ×3 | 610 | Djigo | remis puis **litige** « endommagé », 2 messages, **tranché pour l'acheteur**, remboursement payé | annulé (remboursé 455 000 GNF) |
| O7 Realme vert | 623 | HailandShop | **faux code** (1234) refusé, puis bon code | remis, avis 5★ |
| O8 robe M + thermomètre ×2 | 623 | Djigo | — | remis, avis 5★ |
| O9 montre | 610 | HailandShop | laissée **à préparer** | attente vendeur |
| O10 lampes ×2 | 623 | Djigo | préparée, **mission proposée** | mission proposée |
| O11 fonio ×5 | 610 | HailandShop | **en route** | retiré |
| O12 AirPods | 623 | Djigo | **livreur en route vers la boutique** | accepté |

Livreur : le 610 01 04 19 (déjà livreur validé). Plafond d'espèces relevé de 1 000 000 à **15 000 000 GNF** par l'équipe (motif inscrit au journal) ; positions simulées (`fn_courier_ping`) à la boutique puis à l'adresse ; photo de remise : chemin valide, **sans fichier** (la base ne vérifie que le chemin).
Argent : 5 000 000 GNF d'espèces reversés à l'équipe (reste 1 877 000 en main) ; remboursement de 455 000 GNF au 610 marqué payé ; versements de 1 000 000 GNF à Djigo Shop et 3 000 000 GNF à HailandShop (restent 435 200 et 1 243 960 GNF dus).
Correction manuelle : `cancelled_by` des colis O4 (`vendeur`) et O5 (`acheteur`) — la fonction avait écrit `equipe` (anomalie A1 du §40).

## Retirer ces données (si le fondateur le demande)
⚠️ Les écritures d'argent (`ledger_entries`) sont liées : tout retirer d'un bloc, dans une transaction, après avoir vérifié la liste.

```sql
begin;
create temp table sim_o on commit drop as
  select o.id from orders o join auth.users u on u.id = o.buyer_id
  where u.phone in ('224610010419', '224623770166') and o.created_at between '2026-10-23 22:30+00' and '2026-10-23 23:00+00';
create temp table sim_p on commit drop as select id from parcels where order_id in (select id from sim_o);
delete from ledger_entries where order_id in (select id from sim_o) or parcel_id in (select id from sim_p);
delete from review_reports where review_id in (select id from reviews where parcel_id in (select id from sim_p));
delete from reviews where parcel_id in (select id from sim_p);
delete from dispute_messages where dispute_id in (select id from disputes where parcel_id in (select id from sim_p));
delete from disputes where parcel_id in (select id from sim_p);
delete from promo_uses where parcel_id in (select id from sim_p);
delete from delivery_events where parcel_id in (select id from sim_p);
-- remettre le stock des colis non annulés (les annulés l'ont déjà remis, sauf O6 tranché en litige)
update offer_variants v set stock = v.stock + i.quantity from order_items i join parcels p on p.id = i.parcel_id
  where i.parcel_id in (select id from sim_p) and i.variant_id = v.id and (p.status <> 'annule' or p.id = '32dba900-aa74-4456-91ee-627368c752b5');
delete from order_items where order_id in (select id from sim_o);
delete from parcels where id in (select id from sim_p);
delete from orders where id in (select id from sim_o);
delete from promo_codes where code in ('BIENVENUE10', 'DJIGO20K');
delete from notifications where created_at between '2026-10-23 22:30+00' and '2026-10-23 23:00+00';
update couriers set cash_balance_gnf = 0, cash_limit_gnf = 1000000, available = false where phone = '+224610010419';
commit;
```
Ajouter, dans la même transaction, les écritures de l'équipe qui ne portent pas de commande (versements aux boutiques et remboursement payé) :

```sql
delete from ledger_entries where order_id is null and kind in ('reversement_vendeur', 'remboursement_verse')
  and created_at between '2026-10-23 22:30+00' and '2026-10-23 23:00+00';
```

Le reversement d'espèces du livreur n'a pas d'écriture dans le grand livre (seulement `couriers.cash_balance_gnf` et le journal). Les actions de l'équipe restent dans `console_journal` (lignes 6 à 12) : c'est un journal, on le garde.
Puis recalculer les indices : `select fn_refresh_shop_score(id) from shops;`.
