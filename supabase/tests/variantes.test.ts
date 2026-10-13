import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { as, freshDb, refused, U } from './harness';

/** Variantes : plusieurs par offre, stock par variante, libellé figé dans la commande. */
let db: PGlite;
const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;
const one = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await q<T>(sql, params))[0]!;

let shopId: string; let offerId: string; let vM: string; let vL: string; let buyerDecl: string; let order: string;

beforeAll(async () => {
  db = await freshDb();
  const sd = (await one<{ id: string }>(`insert into declarations (user_id, gps_point, quartier_id, gps_accuracy_m) values ($1, point(-13.6775, 9.5307), 'qtr-coleah', 5) returning id`, [U.vendeur])).id;
  buyerDecl = (await one<{ id: string }>(`insert into declarations (user_id, gps_point, quartier_id, gps_accuracy_m) values ($1, point(-13.6775, 9.5672), 'qtr-coleah', 5) returning id`, [U.acheteur])).id;
  await db.exec(`insert into buildings (id, status, is_validated) values ('b-1', 'actif', true); update declarations set certified_building_id = 'b-1' where id = '${sd}'`);
  shopId = (await as(db, U.vendeur, () => one<{ id: string }>(`insert into shops (slug, name, owner_id, declaration_id) values ('kadi-wax', 'Kadi Wax', $1, $2) returning id`, [U.vendeur, sd]))).id;
  await as(db, U.vendeur, () => db.query('select fn_shop_open($1)', [shopId]));
  const prod = await as(db, U.vendeur, () => one<{ id: string }>(`insert into catalog_products (slug, name, created_by) values ('boubou', 'Boubou', $1) returning id`, [U.vendeur]));
  offerId = (await as(db, U.vendeur, () => one<{ id: string }>(`insert into offers (shop_id, product_id, price_gnf) values ($1, $2, 150000) returning id`, [shopId, prod.id]))).id;
}, 60000);

describe('variantes', () => {
  it('le vendeur ajoute plusieurs variantes avec un stock chacune', async () => {
    vM = (await as(db, U.vendeur, () => one<{ id: string }>(`insert into offer_variants (offer_id, label, stock) values ($1, 'M · Bleu', 3) returning id`, [offerId]))).id;
    vL = (await as(db, U.vendeur, () => one<{ id: string }>(`insert into offer_variants (offer_id, label, stock) values ($1, 'L · Bleu', 0) returning id`, [offerId]))).id;
    expect(await q('select label from offer_variants where offer_id = $1 order by label', [offerId])).toEqual([{ label: 'L · Bleu' }, { label: 'M · Bleu' }]);
  });
  it('un même libellé (même en majuscules) ne se répète pas dans une offre ; un libellé vide est refusé', async () => {
    await refused(as(db, U.vendeur, () => db.query(`insert into offer_variants (offer_id, label, stock) values ($1, 'm · bleu', 1)`, [offerId])));
    await refused(as(db, U.vendeur, () => db.query(`insert into offer_variants (offer_id, label, stock) values ($1, '  ', 1)`, [offerId])));
  });
  it('une variante épuisée ne se commande pas, une variante en stock oui (stock décompté par variante)', async () => {
    const items = (v: string) => JSON.stringify([{ offer_id: offerId, variant_id: v, qty: 1 }]);
    await refused(as(db, U.acheteur, () => db.query('select fn_place_order($1::jsonb, $2, $3, $4)', [items(vL), buyerDecl, '+224612000001', 'livraison'])));
    order = (await as(db, U.acheteur, () => one<{ fn_place_order: string }>('select fn_place_order($1::jsonb, $2, $3, $4)', [items(vM), buyerDecl, '+224612000001', 'livraison']))).fn_place_order;
    expect((await one<{ stock: number }>('select stock from offer_variants where id = $1', [vM])).stock).toBe(2);
    expect((await one<{ stock: number }>('select stock from offer_variants where id = $1', [vL])).stock).toBe(0);
  });
  it('la commande garde le libellé acheté, même si le vendeur renomme la variante', async () => {
    await as(db, U.vendeur, () => db.query(`update offer_variants set label = 'M · Marine' where id = $1`, [vM]));
    expect(await q('select name_snapshot, variant_label from order_items where order_id = $1', [order])).toEqual([{ name_snapshot: 'Boubou', variant_label: 'M · Bleu' }]);
  });
  it('une variante déjà commandée ne se supprime pas (on met son stock à 0)', async () => {
    await refused(as(db, U.vendeur, () => db.query('delete from offer_variants where id = $1', [vM])));
    await as(db, U.vendeur, () => db.query('delete from offer_variants where id = $1', [vL]));
    expect(await q('select 1 from offer_variants where id = $1', [vL])).toHaveLength(0);
  });
});
