import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { as, freshDb, refused, U } from './harness';

/** HailandX Vendeur « niveau Shopify » : fiche d'un colis, motif d'annulation, prix barré, codes promo (HAILANDX.md §37). */
let db: PGlite;
const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;
const one = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await q<T>(sql, params))[0]!;
let shopA: string; let shopB: string; let offerA: string; let offerB: string; let buyerDecl: string; let buyer2Decl: string;

const place = async (who: string, decl: string, items: unknown[], promo: string | null = null) =>
  (await as(db, who, () => one<{ id: string }>('select fn_place_order($1::jsonb, $2, $3, $4, $5, $6) id', [JSON.stringify(items), decl, '+224612000001', 'livraison', 'application', promo]))).id;
const parcelOf = async (order: string, shop: string) => (await one<{ id: string }>('select id from parcels where order_id = $1 and shop_id = $2', [order, shop])).id;

beforeAll(async () => {
  db = await freshDb();
  const decl = async (u: string) => (await one<{ id: string }>(`insert into declarations (user_id, gps_point, quartier_id, gps_accuracy_m) values ($1, point(-13.6775, 9.5307), 'qtr-coleah', 5) returning id`, [u])).id;
  const dA = await decl(U.vendeur); const dB = await decl(U.vendeur2);
  buyerDecl = await decl(U.acheteur); buyer2Decl = await decl(U.acheteur2);
  await db.exec(`insert into buildings (id, status, is_validated) values ('b-1', 'actif', true); update declarations set certified_building_id = 'b-1' where id in ('${dA}', '${dB}')`);
  shopA = (await as(db, U.vendeur, () => one<{ id: string }>(`insert into shops (slug, name, owner_id, declaration_id) values ('kadi-wax', 'Kadi Wax', $1, $2) returning id`, [U.vendeur, dA]))).id;
  shopB = (await as(db, U.vendeur2, () => one<{ id: string }>(`insert into shops (slug, name, owner_id, declaration_id) values ('awa-mode', 'Awa Mode', $1, $2) returning id`, [U.vendeur2, dB]))).id;
  await as(db, U.vendeur, () => db.query('select fn_shop_open($1)', [shopA]));
  await as(db, U.vendeur2, () => db.query('select fn_shop_open($1)', [shopB]));
  const prod = async (slug: string, who: string) => (await as(db, who, () => one<{ id: string }>(`insert into catalog_products (slug, name, created_by) values ($1, $1, $2) returning id`, [slug, who]))).id;
  offerA = (await as(db, U.vendeur, async () => one<{ id: string }>(`insert into offers (shop_id, product_id, price_gnf) values ($1, $2, 100000) returning id`, [shopA, await prod('pagne', U.vendeur)]))).id;
  offerB = (await as(db, U.vendeur2, async () => one<{ id: string }>(`insert into offers (shop_id, product_id, price_gnf) values ($1, $2, 50000) returning id`, [shopB, await prod('sac', U.vendeur2)]))).id;
}, 60000);

describe('fiche d’un colis pour le vendeur', () => {
  let order: string; let parcel: string;
  it('articles, client pseudonyme (quartier, niveau, commandes chez vous), étapes ; jamais le téléphone', async () => {
    order = await place(U.acheteur, buyerDecl, [{ offer_id: offerA, qty: 2 }]);
    parcel = await parcelOf(order, shopA);
    const f = (await as(db, U.vendeur, () => one<{ fn_seller_parcel: Record<string, unknown> }>('select fn_seller_parcel($1)', [parcel]))).fn_seller_parcel;
    expect(f).toMatchObject({ status: 'attente_vendeur', subtotal_gnf: 200000, discount_gnf: 0, commission_bps: 800, payment_method: 'livraison' });
    expect(f.client).toMatchObject({ quartier: 'Coleah Domino', level: 1, orders_here: 1 });
    expect(String((f.client as { label: string }).label)).toMatch(/^Client [0-9A-F]{4}$/);
    expect(f.items).toEqual([{ name: 'pagne', variant: null, qty: 2, price_gnf: 100000, photo: null }]);
    expect((f.events as { kind: string }[]).map((e) => e.kind)).toEqual(['cree']);
    expect(JSON.stringify(f)).not.toContain('612000001');
  });
  it('un autre vendeur, l’acheteur ou un visiteur n’y ont pas accès', async () => {
    await refused(as(db, U.vendeur2, () => db.query('select fn_seller_parcel($1)', [parcel])));
    await refused(as(db, U.acheteur, () => db.query('select fn_seller_parcel($1)', [parcel])));
    await refused(as(db, 'anon', () => db.query('select fn_seller_parcel($1)', [parcel])));
  });
  it('le vendeur doit donner un motif pour annuler ; le client le reçoit dans sa notification', async () => {
    expect(await refused(as(db, U.vendeur, () => db.query('select fn_parcel_cancel($1)', [parcel])))).toMatch(/motif/);
    await as(db, U.vendeur, () => db.query('select fn_parcel_cancel($1, $2)', [parcel, '  Rupture de stock  ']));
    expect(await one('select status, cancel_reason, cancelled_by from parcels where id = $1', [parcel])).toEqual({ status: 'annule', cancel_reason: 'Rupture de stock', cancelled_by: 'vendeur' });
    expect(await q(`select body from notifications where user_id = $1 and title = 'Colis annulé'`, [U.acheteur])).toEqual([{ body: 'Kadi Wax : Rupture de stock' }]);
  });
  it('l’acheteur annule encore sans motif avant la préparation', async () => {
    const o = await place(U.acheteur, buyerDecl, [{ offer_id: offerA, qty: 1 }]);
    const p = await parcelOf(o, shopA);
    await as(db, U.acheteur, () => db.query('select fn_parcel_cancel($1)', [p]));
    expect(await one('select cancelled_by, cancel_reason from parcels where id = $1', [p])).toEqual({ cancelled_by: 'acheteur', cancel_reason: null });
  });
});

describe('prix barré', () => {
  it('l’ancien prix doit être supérieur au prix de vente', async () => {
    await as(db, U.vendeur, () => db.query('update offers set compare_at_gnf = 120000 where id = $1', [offerA]));
    expect(await as(db, 'anon', () => one('select price_gnf, compare_at_gnf from offers where id = $1', [offerA]))).toEqual({ price_gnf: 100000, compare_at_gnf: 120000 });
    await refused(as(db, U.vendeur, () => db.query('update offers set compare_at_gnf = 90000 where id = $1', [offerA])));
    await as(db, U.vendeur, () => db.query('update offers set compare_at_gnf = null where id = $1', [offerA]));
  });
});

describe('codes promo', () => {
  let promo: string;
  it('la boutique crée ses codes ; ni une autre boutique ni un acheteur ne les lisent', async () => {
    promo = (await as(db, U.vendeur, () => one<{ id: string }>(`insert into promo_codes (shop_id, code, kind, value, min_subtotal_gnf, max_uses) values ($1, 'KADI10', 'pourcentage', 10, 150000, 2) returning id`, [shopA]))).id;
    await refused(as(db, U.vendeur, () => db.query(`insert into promo_codes (shop_id, code, kind, value) values ($1, 'kadi', 'montant', 1000)`, [shopA])));
    await refused(as(db, U.vendeur, () => db.query(`insert into promo_codes (shop_id, code, kind, value) values ($1, 'TROP', 'pourcentage', 95)`, [shopA])));
    await refused(as(db, U.vendeur2, () => db.query(`insert into promo_codes (shop_id, code, kind, value) values ($1, 'PIRATE', 'montant', 1000)`, [shopA])));
    expect(await as(db, U.vendeur2, () => q('select id from promo_codes'))).toEqual([]);
    expect(await as(db, U.acheteur, () => q('select id from promo_codes'))).toEqual([]);
    await refused(as(db, 'anon', () => db.query('select id from promo_codes')));
  });
  it('aperçu avant commande : réduction par boutique, ou la raison du refus', async () => {
    const rows = await as(db, U.acheteur, () => q('select shop_name, subtotal_gnf, discount_gnf, reason from fn_promo_check($1, $2::jsonb)', ['kadi10', JSON.stringify([{ offer_id: offerA, qty: 2 }, { offer_id: offerB, qty: 1 }])]));
    expect(rows).toEqual([
      { shop_name: 'Kadi Wax', subtotal_gnf: 200000, discount_gnf: 20000, reason: null },
      { shop_name: 'Awa Mode', subtotal_gnf: 50000, discount_gnf: 0, reason: 'code inconnu pour cette boutique' },
    ]);
    expect((await as(db, U.acheteur, () => one('select reason from fn_promo_check($1, $2::jsonb)', ['KADI10', JSON.stringify([{ offer_id: offerA, qty: 1 }])]))).reason).toMatch(/achat minimum/);
  });
  it('à la commande, le colis est réduit (la commission se calcule après) ; un code invalide fait échouer la commande', async () => {
    expect(await refused(place(U.acheteur, buyerDecl, [{ offer_id: offerB, qty: 1 }], 'KADI10'))).toMatch(/code promo non valable/);
    const o = await place(U.acheteur, buyerDecl, [{ offer_id: offerA, qty: 2 }, { offer_id: offerB, qty: 1 }], ' kadi10 ');
    expect(await one('select subtotal_gnf, discount_gnf, promo_code, cod_amount_gnf - delivery_fee_gnf as cod_items from parcels where id = $1', [await parcelOf(o, shopA)]))
      .toEqual({ subtotal_gnf: 180000, discount_gnf: 20000, promo_code: 'KADI10', cod_items: 180000 });
    expect(await one('select discount_gnf from parcels where id = $1', [await parcelOf(o, shopB)])).toEqual({ discount_gnf: 0 });
    expect(await one('select subtotal_gnf from orders where id = $1', [o])).toEqual({ subtotal_gnf: 230000 });
    expect(await as(db, U.vendeur, () => q('select discount_gnf from promo_uses where promo_id = $1', [promo]))).toEqual([{ discount_gnf: 20000 }]);
  });
  it('une fois par client, et pas plus que le nombre d’utilisations prévu ; un colis annulé libère le code', async () => {
    expect(await refused(place(U.acheteur, buyerDecl, [{ offer_id: offerA, qty: 2 }], 'KADI10'))).toMatch(/code promo non valable/);
    const o2 = await place(U.acheteur2, buyer2Decl, [{ offer_id: offerA, qty: 2 }], 'KADI10');
    expect((await as(db, U.vendeur, () => one('select reason from fn_promo_check($1, $2::jsonb)', ['KADI10', JSON.stringify([{ offer_id: offerA, qty: 2 }])]))).reason).toBe('code épuisé');
    await as(db, U.vendeur, async () => db.query('select fn_parcel_cancel($1, $2)', [await parcelOf(o2, shopA), 'Client injoignable']));
    expect((await as(db, U.vendeur, () => one('select reason, discount_gnf from fn_promo_check($1, $2::jsonb)', ['KADI10', JSON.stringify([{ offer_id: offerA, qty: 2 }])])))).toEqual({ reason: null, discount_gnf: 20000 });
  });
  it('code désactivé ou expiré : refusé', async () => {
    await as(db, U.vendeur, () => db.query(`insert into promo_codes (shop_id, code, kind, value, ends_at, starts_at) values ($1, 'VIEUX', 'montant', 5000, now() - interval '1 day', now() - interval '3 days')`, [shopA]));
    await as(db, U.vendeur, () => db.query(`update promo_codes set active = false where id = $1`, [promo]));
    const check = (code: string) => as(db, U.acheteur2, () => one<{ reason: string }>('select reason from fn_promo_check($1, $2::jsonb)', [code, JSON.stringify([{ offer_id: offerA, qty: 2 }])]));
    expect((await check('VIEUX')).reason).toBe('code expiré');
    expect((await check('KADI10')).reason).toBe('code désactivé');
  });
});
