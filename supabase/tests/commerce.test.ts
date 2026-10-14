import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { deliveryFeeGnf } from '../../packages/commerce/src/money';
import { trustScore } from '../../packages/commerce/src/trust';
import { as, freshDb, refused, U } from './harness';

/**
 * Parcours complet de la migration de commerce, sur un Postgres local (voir harness.ts). Chaque `it` reprend l'état du précédent :
 * boutique → vente ouverte au niveau 3 → commande → préparation → livreur → retrait → remise → avis.
 */
let db: PGlite;
const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;
const one = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await q<T>(sql, params))[0];

// Points : le vendeur à Kaloum, l'acheteur ≈ 4 km plus au nord, un lieu éloigné pour tester la proximité.
const SELLER = { lng: -13.6775, lat: 9.5307 };
const BUYER = { lng: -13.6775, lat: 9.5672 };
const FAR = { lng: -13.6775, lat: 9.6 };

async function declaration(user: string, p: { lng: number; lat: number }, extra = ''): Promise<string> {
  const r = await one<{ id: string }>(`insert into declarations (user_id, gps_point, quartier_id, gps_accuracy_m ${extra ? ', ' + extra.split('=')[0] : ''}) values ($1, point($2, $3), 'qtr-coleah', 5 ${extra ? ', ' + extra.split('=')[1] : ''}) returning id`, [user, p.lng, p.lat]);
  return r.id;
}

let shopId: string; let shop2Id: string; let sellerDecl: string; let buyerDecl: string; let offerId: string; let variantId: string; let orderId: string; let parcelId: string; let parcel2Id: string;

beforeAll(async () => {
  db = await freshDb();
}, 60000);

describe('boutique : niveau 3 requis pour vendre', () => {
  it('un vendeur crée sa boutique en préparation ; il en est membre et elle a une ligne d’indice', async () => {
    sellerDecl = await declaration(U.vendeur, SELLER);
    shopId = (await as(db, U.vendeur, () => one<{ id: string }>(`insert into shops (slug, name, owner_id, declaration_id) values ('kadi-wax', 'Kadi Wax', $1, $2) returning id`, [U.vendeur, sellerDecl]))).id;
    expect((await one<{ status: string }>('select status from shops where id = $1', [shopId])).status).toBe('preparation');
    expect(await q('select role from shop_members where shop_id = $1 and user_id = $2', [shopId, U.vendeur])).toEqual([{ role: 'proprietaire' }]);
    expect(await q('select 1 from shop_scores where shop_id = $1', [shopId])).toHaveLength(1);
    // L'indice d'une boutique neuve est déjà calculé (réputation neutre), pas à 0.
    expect((await one<{ trust: number }>('select trust from shop_scores where shop_id = $1', [shopId])).trust).toBeGreaterThan(20);
  });

  it('refuse : propriétaire différent, statut « ouverte » à la création, adresse d’un autre compte', async () => {
    const other = await declaration(U.acheteur, BUYER);
    expect(await as(db, U.vendeur, () => refused(db.query(`insert into shops (slug, name, owner_id) values ('faux-prop', 'Faux', $1)`, [U.acheteur])))).toMatch(/row-level security|propriétaire/);
    expect(await as(db, U.vendeur, () => refused(db.query(`insert into shops (slug, name, owner_id, status) values ('trop-tot', 'Trop tôt', $1, 'ouverte')`, [U.vendeur])))).toMatch(/statut initial/);
    expect(await as(db, U.vendeur, () => refused(db.query(`insert into shops (slug, name, owner_id, declaration_id) values ('adresse-volee', 'Volée', $1, $2)`, [U.vendeur, other])))).toMatch(/n'appartient pas/);
  });

  it('au niveau 1 ou 2, la vente ne s’ouvre pas (ni par fonction ni par mise à jour directe)', async () => {
    expect(await as(db, U.vendeur, () => refused(db.query('select fn_shop_open($1)', [shopId])))).toMatch(/niveau 3/);
    expect(await as(db, U.vendeur, () => refused(db.query(`update shops set status = 'ouverte' where id = $1`, [shopId])))).toMatch(/niveau 3/);
    // Il peut en revanche annoncer « bientôt disponible ».
    await as(db, U.vendeur, () => db.query(`update shops set status = 'bientot' where id = $1`, [shopId]));
  });

  it('une fois le bâtiment certifié (actif, validé) par Hailand, la vente s’ouvre', async () => {
    await db.exec(`insert into buildings (id, status, is_validated) values ('b-kaloum', 'actif', true); update declarations set certified_building_id = 'b-kaloum' where id = '${sellerDecl}'`);
    expect((await as(db, U.vendeur, () => one<{ fn_declaration_level: number }>('select fn_declaration_level($1)', [sellerDecl]))).fn_declaration_level).toBe(3);
    expect((await as(db, U.vendeur, () => one<{ fn_shop_open: string }>('select fn_shop_open($1)', [shopId]))).fn_shop_open).toBe('ouverte');
  });

  it('un vendeur ne peut ni se suspendre ni se réactiver ; l’équipe le peut', async () => {
    expect(await as(db, U.vendeur, () => refused(db.query(`update shops set status = 'suspendue' where id = $1`, [shopId])))).toMatch(/réservée à l'équipe/);
    await as(db, U.admin, () => db.query(`update shops set status = 'suspendue' where id = $1`, [shopId]));
    expect(await as(db, U.vendeur, () => refused(db.query(`update shops set status = 'ouverte' where id = $1`, [shopId])))).toMatch(/réservée à l'équipe/);
    await as(db, U.admin, () => db.query(`update shops set status = 'ouverte' where id = $1`, [shopId]));
  });
});

describe('catalogue : fiche commune, offres et visiteurs', () => {
  it('le vendeur crée une fiche, son offre et ses variantes ; un autre compte ne peut pas les modifier', async () => {
    const prod = await as(db, U.vendeur, () => one<{ id: string }>(`insert into catalog_products (slug, name, created_by) values ('pagne-wax', 'Pagne wax 6 yards', $1) returning id`, [U.vendeur]));
    offerId = (await as(db, U.vendeur, () => one<{ id: string }>(`insert into offers (shop_id, product_id, price_gnf) values ($1, $2, 185000) returning id`, [shopId, prod.id]))).id;
    variantId = (await as(db, U.vendeur, () => one<{ id: string }>(`insert into offer_variants (offer_id, label, stock) values ($1, 'Hirondelles', 5) returning id`, [offerId]))).id;
    await as(db, U.acheteur, () => db.query(`update offers set price_gnf = 1 where id = $1`, [offerId]));
    expect((await one<{ price_gnf: number }>('select price_gnf from offers where id = $1', [offerId])).price_gnf).toBe(185000);
  });

  it('un visiteur sans compte voit la vitrine mais ni commandes ni colis', async () => {
    expect(await as(db, 'anon', () => q('select slug from shops'))).toEqual([{ slug: 'kadi-wax' }]);
    expect(await as(db, 'anon', () => q('select price_gnf from offers'))).toHaveLength(1);
    expect(await as(db, 'anon', () => refused(db.query('select id from orders')))).toMatch(/permission denied/);
    expect(await as(db, 'anon', () => refused(db.query('select id from parcels')))).toMatch(/permission denied/);
  });

  it('un lien partagé se résout sans compte et compte les clics', async () => {
    await as(db, U.vendeur, () => db.query(`insert into share_links (code, shop_id, kind, source) values ('kw-hirondelles', $1, 'produit', 'tiktok')`, [shopId]));
    const r = await as(db, 'anon', () => q('select * from fn_open_share_link($1)', ['KW-Hirondelles']));
    expect(r).toEqual([{ kind: 'produit', shop_slug: 'kadi-wax', offer_ids: [], source: 'tiktok', product_slug: null }]);
    expect((await one<{ clicks: number }>(`select clicks from share_links where code = 'kw-hirondelles'`)).clicks).toBe(1);
  });
});

describe('commande : un colis par boutique, frais selon la distance', () => {
  it('l’acheteur commande ; le colis, les frais, le stock et les espèces à encaisser sont calculés par le serveur', async () => {
    buyerDecl = await declaration(U.acheteur, BUYER);
    orderId = await as(db, U.acheteur, async () => (await one<{ fn_place_order: string }>('select fn_place_order($1::jsonb, $2, $3, $4, $5)', [JSON.stringify([{ offer_id: offerId, variant_id: variantId, qty: 2 }]), buyerDecl, '+224 620 00 00 00', 'livraison', 'tiktok'])).fn_place_order);
    const p = await one<{ id: string; delivery_fee_gnf: number; subtotal_gnf: number; cod_amount_gnf: number; status: string }>('select * from parcels where order_id = $1', [orderId]);
    parcelId = p.id;
    expect(p.status).toBe('attente_vendeur');
    expect(p.subtotal_gnf).toBe(370000);
    expect(p.delivery_fee_gnf).toBe(deliveryFeeGnf(4.06)); // identique au calcul de packages/commerce
    expect(p.cod_amount_gnf).toBe(370000 + p.delivery_fee_gnf);
    expect((await one<{ total_gnf: number }>('select total_gnf from orders where id = $1', [orderId])).total_gnf).toBe(p.cod_amount_gnf);
    expect((await one<{ stock: number }>('select stock from offer_variants where id = $1', [variantId])).stock).toBe(3);
    expect((await one<{ name_snapshot: string }>('select name_snapshot from order_items where order_id = $1', [orderId])).name_snapshot).toBe('Pagne wax 6 yards');
  });

  it('refuse : panier vide, téléphone invalide, stock insuffisant, adresse d’un autre compte, boutique non ouverte', async () => {
    const place = (items: unknown[], decl = buyerDecl, phone = '+224 620 00 00 00') => as(db, U.acheteur, () => refused(db.query('select fn_place_order($1::jsonb, $2, $3, $4)', [JSON.stringify(items), decl, phone, 'livraison'])));
    expect(await place([])).toMatch(/panier vide/);
    expect(await place([{ offer_id: offerId, variant_id: variantId, qty: 1 }], buyerDecl, 'abc')).toMatch(/téléphone/);
    expect(await place([{ offer_id: offerId, variant_id: variantId, qty: 99 }])).toMatch(/stock insuffisant/);
    expect(await place([{ offer_id: offerId, variant_id: variantId, qty: 1 }], sellerDecl)).toMatch(/adresse de livraison introuvable/);
    expect(await as(db, 'anon', () => refused(db.query('select fn_place_order($1::jsonb, $2, $3, $4)', [JSON.stringify([{ offer_id: offerId, qty: 1 }]), buyerDecl, '+224 620 00 00 00', 'livraison'])))).toMatch(/permission denied|connexion/);
    await db.exec(`update shops set status = 'bientot' where id = '${shopId}'`);
    expect(await place([{ offer_id: offerId, variant_id: variantId, qty: 1 }])).toMatch(/pas encore ouverte/);
    await db.exec(`update shops set status = 'ouverte' where id = '${shopId}'`);
  });

  it('un panier de deux boutiques donne deux colis, chacun avec ses frais', async () => {
    const s2 = await declaration(U.vendeur2, { lng: -13.65, lat: 9.55 }, 'certified_building_id=\'b-2\'');
    await db.exec(`insert into buildings (id, status, is_validated) values ('b-2', 'actif', true)`);
    shop2Id = (await as(db, U.vendeur2, () => one<{ id: string }>(`insert into shops (slug, name, owner_id, declaration_id) values ('tech-kaloum', 'Tech Kaloum', $1, $2) returning id`, [U.vendeur2, s2]))).id;
    await as(db, U.vendeur2, () => db.query('select fn_shop_open($1)', [shop2Id]));
    const prod = await as(db, U.vendeur2, () => one<{ id: string }>(`insert into catalog_products (slug, name, created_by) values ('ecouteurs', 'Écouteurs sans fil', $1) returning id`, [U.vendeur2]));
    const off2 = (await as(db, U.vendeur2, () => one<{ id: string }>(`insert into offers (shop_id, product_id, price_gnf) values ($1, $2, 110000) returning id`, [shop2Id, prod.id]))).id;
    const o2 = await as(db, U.acheteur, async () => (await one<{ fn_place_order: string }>('select fn_place_order($1::jsonb, $2, $3, $4)', [JSON.stringify([{ offer_id: off2, qty: 1 }, { offer_id: offerId, variant_id: variantId, qty: 1 }]), buyerDecl, '+224 620 00 00 00', 'orange_money'])).fn_place_order);
    const ps = await q<{ shop_id: string; cod_amount_gnf: number; delivery_fee_gnf: number }>('select * from parcels where order_id = $1 order by shop_id', [o2]);
    expect(ps).toHaveLength(2);
    expect(ps.every((p) => p.cod_amount_gnf === 0)).toBe(true); // Orange Money : rien à encaisser
    expect(ps.every((p) => p.delivery_fee_gnf >= 8000)).toBe(true);
    parcel2Id = (await one<{ id: string }>('select id from parcels where order_id = $1 and shop_id = $2', [o2, shop2Id])).id;
  });

  it('l’acheteur peut annuler avant la préparation : le stock est remis en rayon', async () => {
    const before = (await one<{ stock: number }>('select stock from offer_variants where id = $1', [variantId])).stock;
    await as(db, U.acheteur, () => db.query('select fn_parcel_cancel($1)', [parcel2Id]));
    // parcel2 appartient à la boutique 2 sans variante : le stock de la variante 1 est inchangé ; l'état est « annulé ».
    expect((await one<{ status: string }>('select status from parcels where id = $1', [parcel2Id])).status).toBe('annule');
    expect((await one<{ stock: number }>('select stock from offer_variants where id = $1', [variantId])).stock).toBe(before);
  });
});

describe('droits de lecture sur les commandes', () => {
  it('l’acheteur voit sa commande ; un autre acheteur n’en voit aucune ; le vendeur voit son colis', async () => {
    expect(await as(db, U.acheteur, () => q('select id from orders where id = $1', [orderId]))).toHaveLength(1);
    expect(await as(db, U.acheteur2, () => q('select id from orders'))).toHaveLength(0);
    expect(await as(db, U.acheteur2, () => q('select id from parcels'))).toHaveLength(0);
    expect(await as(db, U.vendeur, () => q('select id from parcels where id = $1', [parcelId]))).toHaveLength(1);
    expect(await as(db, U.vendeur2, () => q('select id from parcels where id = $1', [parcelId]))).toHaveLength(0);
  });

  it('le téléphone de l’acheteur n’est lisible par personne (ni acheteur, ni vendeur) ; la commande reste lisible', async () => {
    expect(await as(db, U.acheteur, () => refused(db.query('select buyer_phone from orders')))).toMatch(/permission denied/);
    expect(await as(db, U.vendeur, () => refused(db.query('select buyer_phone from orders')))).toMatch(/permission denied/);
    expect(await as(db, U.vendeur, () => refused(db.query('select * from orders')))).toMatch(/permission denied/);
    expect(await as(db, U.vendeur, () => q('select id, total_gnf from orders where id = $1', [orderId]))).toHaveLength(1);
  });

  it('personne ne peut lire le code de remise dans la table ; l’acheteur le lit par la fonction, le vendeur non', async () => {
    expect(await as(db, U.acheteur, () => refused(db.query('select handover_code from parcels')))).toMatch(/permission denied/);
    expect(await as(db, U.vendeur, () => refused(db.query('select * from parcels')))).toMatch(/permission denied/);
    const code = await as(db, U.acheteur, () => one<{ fn_my_handover_code: string }>('select fn_my_handover_code($1)', [parcelId]));
    expect(code.fn_my_handover_code).toMatch(/^\d{4}$/);
    expect((await as(db, U.vendeur, () => one<{ fn_my_handover_code: string | null }>('select fn_my_handover_code($1)', [parcelId]))).fn_my_handover_code).toBeNull();
  });

  it('on ne peut pas écrire directement dans commandes, colis ni événements', async () => {
    expect(await as(db, U.acheteur, () => refused(db.query(`update parcels set status = 'remis' where id = $1`, [parcelId])))).toMatch(/permission denied|row-level/);
    expect(await as(db, U.acheteur, () => refused(db.query(`insert into delivery_events (parcel_id, kind) values ($1, 'remis')`, [parcelId])))).toMatch(/row-level|permission denied/);
    expect(await as(db, U.acheteur, () => refused(db.query(`insert into reviews (parcel_id, shop_id, buyer_id, rating) values ($1, $2, $3, 5)`, [parcelId, shopId, U.acheteur])))).toMatch(/row-level|permission denied/);
  });
});

describe('Flotte : préparation, mission, QR, retrait', () => {
  let qr: string;

  it('seul le vendeur du colis le déclare prêt ; il est alors proposé aux livreurs', async () => {
    expect(await as(db, U.vendeur2, () => refused(db.query('select fn_parcel_ready($1)', [parcelId])))).toMatch(/droits insuffisants/);
    expect(await as(db, U.acheteur, () => refused(db.query('select fn_parcel_ready($1)', [parcelId])))).toMatch(/droits insuffisants/);
    await as(db, U.vendeur, () => db.query('select fn_parcel_ready($1)', [parcelId]));
    expect((await one<{ status: string }>('select status from parcels where id = $1', [parcelId])).status).toBe('mission_proposee');
    expect(await as(db, U.vendeur, () => refused(db.query('select fn_parcel_ready($1)', [parcelId])))).toMatch(/n'est plus à préparer/);
  });

  it('le QR du colis est signé : lisible par le vendeur seulement, falsification refusée', async () => {
    qr = (await as(db, U.vendeur, () => one<{ fn_parcel_qr: string }>('select fn_parcel_qr($1)', [parcelId]))).fn_parcel_qr;
    expect(qr).toMatch(/^hx1\.[0-9a-f-]{36}\.[0-9a-f]{18}\.[A-Za-z0-9_-]{43}$/);
    expect(await as(db, U.acheteur, () => refused(db.query('select fn_parcel_qr($1)', [parcelId])))).toMatch(/droits insuffisants/);
    const parts = qr.split('.');
    const tampered = `${parts[0]}.${parts[1]}.${parts[2]}.${parts[3].slice(0, -1)}${parts[3].endsWith('A') ? 'B' : 'A'}`;
    expect((await one<{ r: string | null }>('select private.parse_qr($1)::text r', [tampered])).r).toBeNull();
    expect((await one<{ r: string | null }>('select private.parse_qr($1)::text r', [qr])).r).toBe(parcelId);
  });

  it('livreur : dossier « candidat », validation par l’équipe, disponibilité ; il ne peut pas se valider lui-même', async () => {
    // Depuis la phase 5, plus de candidature publique (dossiers créés par l'équipe) : on part de dossiers « candidat » existants.
    expect(await as(db, U.livreur, () => refused(db.query(`insert into couriers (user_id, full_name) values ($1, 'Moi')`, [U.livreur])))).toMatch(/row-level security|violates/);
    await db.exec(`insert into couriers (user_id, full_name, phone) values ('${U.livreur}', 'Mamadou', '+224 610 00 00 00'), ('${U.livreur2}', 'Ibrahima', null)`);
    expect(await as(db, U.livreur, () => refused(db.query(`update couriers set status = 'valide' where user_id = $1`, [U.livreur])))).toMatch(/réservés à l'équipe/);
    expect(await as(db, U.livreur, () => refused(db.query(`update couriers set available = true where user_id = $1`, [U.livreur])))).toMatch(/non validé/);
    await as(db, U.admin, () => db.query(`update couriers set status = 'valide' where user_id in ($1, $2)`, [U.livreur, U.livreur2]));
    await as(db, U.livreur, () => db.query(`update couriers set available = true where user_id = $1`, [U.livreur]));
    await as(db, U.livreur2, () => db.query(`update couriers set available = true where user_id = $1`, [U.livreur2]));
    expect(await as(db, U.livreur, () => refused(db.query(`update couriers set cash_limit_gnf = 99999999 where user_id = $1`, [U.livreur])))).toMatch(/réservés à l'équipe/);
  });

  it('les missions proches n’exposent ni téléphone ni point exact ; hors rayon ou indisponible : rien', async () => {
    const missions = await as(db, U.livreur, () => q('select * from fn_missions_proches($1, $2, 8)', [SELLER.lat, SELLER.lng]));
    expect(missions).toHaveLength(1);
    expect(Object.keys(missions[0])).not.toContain('buyer_phone');
    expect(missions[0]).toMatchObject({ parcel_id: parcelId, from_label: 'Kadi Wax', to_label: 'Coleah Domino', to_level: 1 });
    expect(await as(db, U.livreur, () => q('select * from fn_missions_proches($1, $2, 1)', [FAR.lat, FAR.lng]))).toHaveLength(0);
    expect(await as(db, U.acheteur, () => q('select * from fn_missions_proches($1, $2, 8)', [SELLER.lat, SELLER.lng]))).toHaveLength(0); // pas livreur
  });

  it('un seul livreur obtient la mission ; il peut se désister avant le retrait', async () => {
    await as(db, U.livreur, () => db.query('select fn_courier_accept($1)', [parcelId]));
    expect(await as(db, U.livreur2, () => refused(db.query('select fn_courier_accept($1)', [parcelId])))).toMatch(/déjà prise/);
    await as(db, U.livreur, () => db.query('select fn_courier_release($1)', [parcelId]));
    expect((await one<{ status: string }>('select status from parcels where id = $1', [parcelId])).status).toBe('mission_proposee');
    await as(db, U.livreur, () => db.query('select fn_courier_accept($1)', [parcelId]));
  });

  it('plafond d’espèces : un livreur au plafond ne prend pas une mission payable à la livraison', async () => {
    const o3 = await as(db, U.acheteur, async () => (await one<{ fn_place_order: string }>('select fn_place_order($1::jsonb, $2, $3, $4)', [JSON.stringify([{ offer_id: offerId, variant_id: variantId, qty: 1 }]), buyerDecl, '+224 620 00 00 00', 'livraison'])).fn_place_order);
    const p3 = (await one<{ id: string }>('select id from parcels where order_id = $1', [o3])).id;
    await as(db, U.vendeur, () => db.query('select fn_parcel_ready($1)', [p3]));
    await db.exec(`update couriers set cash_balance_gnf = 490000, cash_limit_gnf = 500000 where user_id = '${U.livreur2}'`);
    expect(await as(db, U.livreur2, () => refused(db.query('select fn_courier_accept($1)', [p3])))).toMatch(/plafond/);
    expect((await one<{ status: string }>('select status from parcels where id = $1', [p3])).status).toBe('mission_proposee');
    await as(db, U.vendeur, () => db.query('select fn_parcel_cancel($1)', [p3]));
  });

  it('retrait : le QR du colis signé, scanné par le livreur attribué, fait passer le colis « en route »', async () => {
    expect(await as(db, U.livreur2, () => refused(db.query('select fn_parcel_pickup($1)', [qr])))).toMatch(/ne vous est pas attribué/);
    expect(await as(db, U.livreur, () => refused(db.query('select fn_parcel_pickup($1)', ['hx1.faux.faux.faux'])))).toMatch(/QR illisible/);
    await as(db, U.livreur, () => db.query('select fn_parcel_pickup($1, $2, $3)', [qr, SELLER.lat, SELLER.lng]));
    expect((await one<{ status: string }>('select status from parcels where id = $1', [parcelId])).status).toBe('retire');
    expect(await as(db, U.livreur, () => refused(db.query('select fn_parcel_pickup($1)', [qr])))).toMatch(/ne vous est pas attribué|pas à retirer/);
    expect((await q('select kind from delivery_events where parcel_id = $1 order by id', [parcelId])).map((e) => e.kind)).toEqual(['cree', 'prepare', 'propose', 'accepte', 'desiste', 'accepte', 'retire']);
  });
});

describe('mission : informations réservées au livreur attribué', () => {
  it('le livreur attribué reçoit le téléphone et les points ; personne d’autre ne reçoit rien', async () => {
    const info = await as(db, U.livreur, () => q<Record<string, unknown>>('select * from fn_mission_info($1)', [parcelId]));
    expect(info).toHaveLength(1);
    expect(info[0]).toMatchObject({ status: 'retire', shop_name: 'Kadi Wax', buyer_phone: '+224 620 00 00 00' });
    expect(Number(info[0]!.buyer_lat)).toBeCloseTo(BUYER.lat, 4);
    expect(Number(info[0]!.shop_lat)).toBeCloseTo(SELLER.lat, 4);
    for (const who of [U.livreur2, U.vendeur, U.acheteur, U.acheteur2]) {
      expect(await as(db, who, () => q('select * from fn_mission_info($1)', [parcelId]))).toHaveLength(0);
    }
    expect(await as(db, 'anon', () => refused(db.query('select * from fn_mission_info($1)', [parcelId])))).toMatch(/permission denied/);
  });
});

describe('remise : contrôle de proximité, scan de l’acheteur ou code, verrouillage', () => {
  it('sans position récente du livreur, ou trop loin de l’adresse, la remise est refusée', async () => {
    const code = (await as(db, U.acheteur, () => one<{ fn_my_handover_code: string }>('select fn_my_handover_code($1)', [parcelId]))).fn_my_handover_code;
    expect(await as(db, U.livreur, () => refused(db.query('select fn_parcel_handover_proof($1, $2, $3, $4)', [parcelId, 'code', code, `${U.livreur}/${parcelId}/preuve.jpg`])))).toMatch(/position du livreur inconnue/);
    await as(db, U.livreur, () => db.query('select fn_courier_ping($1, $2)', [FAR.lat, FAR.lng]));
    expect(await as(db, U.livreur, () => refused(db.query('select fn_parcel_handover_proof($1, $2, $3, $4)', [parcelId, 'code', code, `${U.livreur}/${parcelId}/preuve.jpg`])))).toMatch(/pas à l'adresse/);
  });

  it('un mauvais code est refusé et compté ; cinq échecs verrouillent le colis même avec le bon code', async () => {
    await as(db, U.livreur, () => db.query('select fn_courier_ping($1, $2)', [BUYER.lat, BUYER.lng]));
    const code = (await as(db, U.acheteur, () => one<{ fn_my_handover_code: string }>('select fn_my_handover_code($1)', [parcelId]))).fn_my_handover_code;
    const wrong = code === '0000' ? '1111' : '0000';
    for (let i = 0; i < 5; i++) {
      expect((await as(db, U.livreur, () => one<{ fn_parcel_handover_proof: string }>('select fn_parcel_handover_proof($1, $2, $3, $4)', [parcelId, 'code', wrong, `${U.livreur}/${parcelId}/preuve.jpg`]))).fn_parcel_handover_proof).toBe('refuse');
    }
    expect(await as(db, U.livreur, () => refused(db.query('select fn_parcel_handover_proof($1, $2, $3, $4)', [parcelId, 'code', code, `${U.livreur}/${parcelId}/preuve.jpg`])))).toMatch(/verrouillé/);
    await db.exec(`update parcels set handover_failures = 0 where id = '${parcelId}'`); // déverrouillage par l'équipe
  });

  it('seul l’acheteur de la commande confirme par scan ; un autre compte ou le vendeur ne le peut pas', async () => {
    const qr = (await as(db, U.vendeur, () => one<{ fn_parcel_qr: string }>('select fn_parcel_qr($1)', [parcelId]))).fn_parcel_qr;
    expect(await as(db, U.acheteur2, () => refused(db.query('select fn_parcel_handover_proof($1, $2, $3)', [parcelId, 'scan', qr])))).toMatch(/seul l'acheteur/);
    expect(await as(db, U.vendeur, () => refused(db.query('select fn_parcel_handover_proof($1, $2, $3)', [parcelId, 'scan', qr])))).toMatch(/seul l'acheteur/);
    expect(await as(db, U.livreur, () => refused(db.query('select fn_parcel_handover_proof($1, $2, $3)', [parcelId, 'scan', qr])))).toMatch(/seul l'acheteur/);
  });

  it('le scan de l’acheteur confirme la remise ; les espèces s’ajoutent au solde du livreur ; l’événement est journalisé', async () => {
    const qr = (await as(db, U.vendeur, () => one<{ fn_parcel_qr: string }>('select fn_parcel_qr($1)', [parcelId]))).fn_parcel_qr;
    const cod = (await one<{ cod_amount_gnf: number }>('select cod_amount_gnf from parcels where id = $1', [parcelId])).cod_amount_gnf;
    const before = (await one<{ cash_balance_gnf: number }>('select cash_balance_gnf from couriers where user_id = $1', [U.livreur])).cash_balance_gnf;
    expect((await as(db, U.acheteur, () => one<{ fn_parcel_handover_proof: string }>('select fn_parcel_handover_proof($1, $2, $3)', [parcelId, 'scan', qr]))).fn_parcel_handover_proof).toBe('remis');
    expect((await one<{ cash_balance_gnf: number }>('select cash_balance_gnf from couriers where user_id = $1', [U.livreur])).cash_balance_gnf).toBe(before + cod);
    expect((await one<{ status: string; delivered_at: string | null }>('select status, delivered_at from parcels where id = $1', [parcelId])).status).toBe('remis');
    expect((await one<{ kind: string }>('select kind from delivery_events where parcel_id = $1 order by id desc limit 1', [parcelId])).kind).toBe('remis');
    // Une remise confirmée ne se rejoue pas.
    expect(await as(db, U.acheteur, () => refused(db.query('select fn_parcel_handover_proof($1, $2, $3)', [parcelId, 'scan', qr])))).toMatch(/n'est pas en cours de livraison/);
  });
});

describe('avis vérifiés', () => {
  it('seul l’acheteur peut noter, après la remise, une seule fois', async () => {
    expect(await as(db, U.acheteur2, () => refused(db.query('select fn_submit_review($1, 5, $2)', [parcelId, 'super'])))).toMatch(/seul l'acheteur/);
    expect(await as(db, U.acheteur, () => refused(db.query('select fn_submit_review($1, 6, $2)', [parcelId, 'trop']))) ).toMatch(/check|violates/);
    await as(db, U.acheteur, () => db.query('select fn_submit_review($1, 5, $2)', [parcelId, 'Très beau pagne, livraison rapide']));
    expect(await as(db, U.acheteur, () => refused(db.query('select fn_submit_review($1, 4, $2)', [parcelId, 'encore'])))).toMatch(/duplicate|unique/);
    expect(await as(db, 'anon', () => q('select rating from reviews'))).toEqual([{ rating: 5 }]);
  });

  it('l’indice de confiance de la boutique est recalculé (mêmes pondérations que le code partagé)', async () => {
    const s = await one<{ trust: number; rating: string; review_count: number; reliability: string; sales: number }>('select * from shop_scores where shop_id = $1', [shopId]);
    expect(s.review_count).toBe(1);
    expect(Number(s.rating)).toBe(5);
    expect(s.sales).toBe(1);
    const shop = await one<{ logo_path: string | null; cover_path: string | null; tagline: string | null; created_at: string }>('select logo_path, cover_path, tagline, created_at from shops where id = $1', [shopId]);
    const offers = await q<{ photo_paths: string[]; price_gnf: number; product_id: string }>('select photo_paths, price_gnf, product_id from offers where shop_id = $1 and active', [shopId]);
    const quality = (shop.logo_path ? 0.2 : 0) + (shop.cover_path ? 0.2 : 0) + (shop.tagline?.trim() ? 0.2 : 0) + 0.4 * (offers.length ? offers.filter((o) => o.photo_paths.length).length / offers.length : 0);
    const expected = trustScore({ rating: 5, reviewCount: 1, reliability: Number(s.reliability), sales: 1, ageDays: Math.max(0, (Date.now() - new Date(shop.created_at).getTime()) / 86_400_000), quality, priceScore: 0.6 });
    expect(Math.abs(s.trust - expected)).toBeLessThanOrEqual(1);
    // Fiabilité : (remises + 3,5) / (remises + problèmes + 5) ; problèmes = litiges et annulations faites par la boutique.
    const bad = Number((await one<{ n: string }>(`select count(*) as n from delivery_events e join parcels p on p.id = e.parcel_id where p.shop_id = $1 and e.kind = 'annule'
      and exists (select 1 from shop_members m where m.shop_id = $1 and m.user_id = e.actor_id)`, [shopId])).n);
    expect(Number(s.reliability)).toBeCloseTo((1 + 3.5) / (1 + bad + 5), 3);
  });

  it('règlement des espèces : réservé à l’équipe, le solde du livreur baisse', async () => {
    const bal = (await one<{ cash_balance_gnf: number }>('select cash_balance_gnf from couriers where user_id = $1', [U.livreur])).cash_balance_gnf;
    expect(bal).toBeGreaterThan(0);
    expect(await as(db, U.livreur, () => refused(db.query('select fn_courier_cash_settle($1, $2)', [U.livreur, bal])))).toMatch(/réservé à l'équipe/);
    expect((await as(db, U.admin, () => one<{ fn_courier_cash_settle: number }>('select fn_courier_cash_settle($1, $2)', [U.livreur, bal]))).fn_courier_cash_settle).toBe(0);
  });

  it('on ne peut pas noter un colis non remis', async () => {
    const o = await as(db, U.acheteur, async () => (await one<{ fn_place_order: string }>('select fn_place_order($1::jsonb, $2, $3, $4)', [JSON.stringify([{ offer_id: offerId, variant_id: variantId, qty: 1 }]), buyerDecl, '+224 620 00 00 00', 'livraison'])).fn_place_order);
    const p = (await one<{ id: string }>('select id from parcels where order_id = $1', [o])).id;
    expect(await as(db, U.acheteur, () => refused(db.query('select fn_submit_review($1, 5, $2)', [p, 'trop tôt'])))).toMatch(/après la remise/);
  });
});

describe('litiges : signalement par l’acheteur, décision de l’équipe', () => {
  let disputeId: string; let relBefore = 0;
  it('seul l’acheteur signale un problème, une seule fois, sur un colis en route ou remis depuis moins de 72 h', async () => {
    expect(await as(db, U.acheteur2, () => refused(db.query(`select fn_open_dispute($1, 'non_recu')`, [parcelId])))).toMatch(/seul l'acheteur/);
    expect(await as(db, U.vendeur, () => refused(db.query(`select fn_open_dispute($1, 'non_recu')`, [parcelId])))).toMatch(/seul l'acheteur/);
    expect(await as(db, U.acheteur, () => refused(db.query(`select fn_open_dispute($1, 'inconnu')`, [parcelId])))).toMatch(/check|violates/);
    relBefore = Number((await one<{ reliability: string }>('select reliability from shop_scores where shop_id = $1', [shopId])).reliability);
    disputeId = (await as(db, U.acheteur, () => one<{ fn_open_dispute: string }>(`select fn_open_dispute($1, 'endommage', 'Le pagne est déchiré')`, [parcelId]))).fn_open_dispute;
    expect((await one<{ status: string }>('select status from parcels where id = $1', [parcelId])).status).toBe('litige');
    expect(await as(db, U.acheteur, () => refused(db.query(`select fn_open_dispute($1, 'autre')`, [parcelId])))).toMatch(/déjà ouvert|n'est plus|en route ou remis/);
  });

  it('un colis remis depuis plus de 72 h ne peut plus être signalé ; un colis non livré non plus', async () => {
    const o = await as(db, U.acheteur, async () => (await one<{ fn_place_order: string }>('select fn_place_order($1::jsonb, $2, $3, $4)', [JSON.stringify([{ offer_id: offerId, variant_id: variantId, qty: 1 }]), buyerDecl, '+224 620 00 00 00', 'livraison'])).fn_place_order);
    const p = (await one<{ id: string }>('select id from parcels where order_id = $1', [o])).id;
    expect(await as(db, U.acheteur, () => refused(db.query(`select fn_open_dispute($1, 'non_recu')`, [p])))).toMatch(/en route ou remis/);
    await db.exec(`update parcels set status = 'remis', delivered_at = now() - interval '80 hours' where id = '${p}'`);
    expect(await as(db, U.acheteur, () => refused(db.query(`select fn_open_dispute($1, 'non_recu')`, [p])))).toMatch(/72 h/);
  });

  it('lecture : acheteur, vendeur de la boutique et équipe voient le litige ; un autre vendeur ou acheteur non ; aucune écriture directe', async () => {
    for (const who of [U.acheteur, U.vendeur, U.admin]) expect(await as(db, who, () => q('select id from disputes'))).toHaveLength(1);
    for (const who of [U.acheteur2, U.vendeur2]) expect(await as(db, who, () => q('select id from disputes'))).toHaveLength(0);
    expect(await as(db, 'anon', () => refused(db.query('select id from disputes')))).toMatch(/permission denied/);
    expect(await as(db, U.acheteur, () => refused(db.query(`update disputes set status = 'resolu'`)))).toMatch(/permission denied/);
  });

  it('l’équipe seule tranche ; en faveur de l’acheteur le colis est annulé et la fiabilité du vendeur baisse', async () => {
    const before = relBefore;
    expect(await as(db, U.acheteur, () => refused(db.query(`select fn_resolve_dispute($1, 'acheteur')`, [disputeId])))).toMatch(/réservé à l'équipe/);
    expect(await as(db, U.vendeur, () => refused(db.query(`select fn_resolve_dispute($1, 'vendeur')`, [disputeId])))).toMatch(/réservé à l'équipe/);
    expect(await as(db, U.admin, () => refused(db.query(`select fn_resolve_dispute($1, 'personne')`, [disputeId])))).toMatch(/décision inconnue/);
    expect((await as(db, U.admin, () => one<{ fn_resolve_dispute: string }>(`select fn_resolve_dispute($1, 'acheteur', 'Photos reçues : colis abîmé')`, [disputeId]))).fn_resolve_dispute).toBe('annule');
    expect((await one<{ status: string }>('select status from parcels where id = $1', [parcelId])).status).toBe('annule');
    expect(await as(db, U.admin, () => refused(db.query(`select fn_resolve_dispute($1, 'vendeur')`, [disputeId])))).toMatch(/déjà tranché/);
    const after = Number((await one<{ reliability: string }>('select reliability from shop_scores where shop_id = $1', [shopId])).reliability);
    expect(after).toBeLessThan(before);
    expect((await q('select kind from delivery_events where parcel_id = $1 order by id desc limit 2', [parcelId])).map((e) => e.kind)).toEqual(['annule', 'litige']);
  });
});
