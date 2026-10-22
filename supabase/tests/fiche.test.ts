import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { as, freshDb, refused, U } from './harness';

/** Fiche produit détaillée : description et caractéristiques, modifiables par le créateur de la fiche ou l'équipe, avec limites de taille. */
let db: PGlite;
const one = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0]!;
let product: string; let shopId: string;

beforeAll(async () => {
  db = await freshDb();
  await db.exec(`insert into categories (id, name, position) values ('telephones', 'Téléphones', 3), ('electronique', 'Électronique', 6) on conflict do nothing`);
  const sd = (await one<{ id: string }>(`insert into declarations (user_id, gps_point, quartier_id, gps_accuracy_m) values ($1, point(-13.6775, 9.5307), 'qtr-coleah', 5) returning id`, [U.vendeur])).id;
  await db.exec(`insert into buildings (id, status, is_validated) values ('b-1', 'actif', true); update declarations set certified_building_id = 'b-1' where id = '${sd}'`);
  shopId = (await as(db, U.vendeur, () => one<{ id: string }>(`insert into shops (slug, name, owner_id, declaration_id) values ('kadi-tel', 'Kadi Tel', $1, $2) returning id`, [U.vendeur, sd]))).id;
  // Fiche créée avec ses caractéristiques dès l'ajout du produit.
  product = (await as(db, U.vendeur, () => one<{ id: string }>(
    `insert into catalog_products (slug, name, category_id, created_by, description, attributes) values ('galaxy-a15', 'Galaxy A15', 'telephones', $1, 'Téléphone neuf, scellé.', $2) returning id`,
    [U.vendeur, JSON.stringify({ marque: 'Samsung', stockage: '128', points_forts: ['Grande batterie'] })]))).id;
}, 60000);

describe('fiche produit détaillée', () => {
  it('la description et les caractéristiques sont lisibles par tous (vitrine)', async () => {
    expect(await one('select description, attributes from catalog_products where id = $1', [product])).toEqual({ description: 'Téléphone neuf, scellé.', attributes: { marque: 'Samsung', stockage: '128', points_forts: ['Grande batterie'] } });
  });
  it('le créateur complète sa fiche ; un autre vendeur ne peut pas la modifier', async () => {
    const slug = await as(db, U.vendeur, () => one<{ s: string }>('select fn_product_update_details($1, $2, $3::jsonb) s', [product, '  Neuf, garantie 1 an.  ', JSON.stringify({ marque: 'Samsung', modele: 'Galaxy A15', garantie: '1 an' })]));
    expect(slug).toEqual({ s: 'galaxy-a15' });
    expect(await one('select description, attributes->>\'modele\' m, category_id c from catalog_products where id = $1', [product])).toEqual({ description: 'Neuf, garantie 1 an.', m: 'Galaxy A15', c: 'telephones' });
    const err = await as(db, U.vendeur2, () => db.query('select fn_product_update_details($1, $2, $3::jsonb)', [product, 'pirate', '{}']).then(() => '', (e: Error) => e.message));
    expect(err).toMatch(/seul le vendeur qui l'a créée/);
    // Et pas d'écriture directe non plus (seule l'équipe modifie la table).
    await as(db, U.vendeur, () => db.query(`update catalog_products set description = 'x' where id = $1`, [product]));
    expect((await one<{ d: string }>('select description d from catalog_products where id = $1', [product])).d).toBe('Neuf, garantie 1 an.');
  });
  it('l’équipe peut corriger une fiche ; une catégorie inconnue est refusée', async () => {
    await as(db, U.admin, () => db.query('select fn_product_update_details($1, $2, $3::jsonb, $4)', [product, 'Corrigé par l’équipe.', '{}', 'electronique']));
    expect(await one('select description, category_id c from catalog_products where id = $1', [product])).toEqual({ description: 'Corrigé par l’équipe.', c: 'electronique' });
    await refused(as(db, U.admin, () => db.query('select fn_product_update_details($1, $2, $3::jsonb, $4)', [product, 'x', '{}', 'nimporte'])));
  });
  it('limites : description de plus de 4 000 caractères, caractéristiques qui ne sont pas un objet, note d’offre trop longue', async () => {
    await refused(as(db, U.vendeur, () => db.query('select fn_product_update_details($1, $2, $3::jsonb)', [product, 'x'.repeat(4001), '{}'])));
    await refused(as(db, U.vendeur, () => db.query('select fn_product_update_details($1, $2, $3::jsonb)', [product, 'ok', '["liste"]'])));
    await refused(as(db, U.vendeur, () => db.query('select fn_product_update_details($1, $2, $3::jsonb)', [product, 'ok', JSON.stringify({ x: 'y'.repeat(20000) })])));
    await as(db, U.vendeur, () => db.query('select fn_shop_open($1)', [shopId]));
    await refused(as(db, U.vendeur, () => db.query(`insert into offers (shop_id, product_id, price_gnf, description) values ($1, $2, 1000, $3)`, [shopId, product, 'n'.repeat(1001)])));
  });
});
