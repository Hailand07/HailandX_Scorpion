import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { as, freshDb, refused, U } from './harness';

/** Boutique : rayons, « Suivre » et numéro WhatsApp contrôlé. Chaque `it` reprend l'état du précédent. */
let db: PGlite;
const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;
const one = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await q<T>(sql, params))[0]!;

let shopA: string; let shopB: string; let offerA: string; let sectionA: string; let sectionB: string;

beforeAll(async () => {
  db = await freshDb();
  shopA = (await as(db, U.vendeur, () => one<{ id: string }>(`insert into shops (slug, name, owner_id) values ('kadi-wax', 'Kadi Wax', $1) returning id`, [U.vendeur]))).id;
  shopB = (await as(db, U.vendeur2, () => one<{ id: string }>(`insert into shops (slug, name, owner_id) values ('tech-kaloum', 'Tech Kaloum', $1) returning id`, [U.vendeur2]))).id;
  await db.exec(`update shops set status = 'ouverte'`);
  const prod = await as(db, U.vendeur, () => one<{ id: string }>(`insert into catalog_products (slug, name, created_by) values ('pagne', 'Pagne', $1) returning id`, [U.vendeur]));
  offerA = (await as(db, U.vendeur, () => one<{ id: string }>(`insert into offers (shop_id, product_id, price_gnf) values ($1, $2, 100000) returning id`, [shopA, prod.id]))).id;
}, 60000);

describe('rayons', () => {
  it('le vendeur crée un rayon dans sa boutique, pas dans celle d’un autre', async () => {
    sectionA = (await as(db, U.vendeur, () => one<{ id: string }>(`insert into shop_sections (shop_id, name, position) values ($1, 'Boubous', 1) returning id`, [shopA]))).id;
    sectionB = (await as(db, U.vendeur2, () => one<{ id: string }>(`insert into shop_sections (shop_id, name) values ($1, 'Téléphones') returning id`, [shopB]))).id;
    await refused(as(db, U.vendeur, () => db.query(`insert into shop_sections (shop_id, name) values ($1, 'Intrus')`, [shopB])));
  });
  it('un visiteur lit les rayons mais ne peut pas en écrire', async () => {
    expect(await as(db, 'anon', () => q('select name from shop_sections order by name'))).toEqual([{ name: 'Boubous' }, { name: 'Téléphones' }]);
    await refused(as(db, 'anon', () => db.query(`insert into shop_sections (shop_id, name) values ($1, 'Visiteur')`, [shopA])));
  });
  it('un produit se range dans un rayon de sa boutique seulement', async () => {
    await as(db, U.vendeur, () => db.query('update offers set section_id = $1 where id = $2', [sectionA, offerA]));
    expect((await one<{ section_id: string }>('select section_id from offers where id = $1', [offerA])).section_id).toBe(sectionA);
    expect(await refused(as(db, U.vendeur, () => db.query('update offers set section_id = $1 where id = $2', [sectionB, offerA])))).toMatch(/rayon/);
  });
  it('supprimer un rayon laisse le produit en vente, sans rayon', async () => {
    await as(db, U.vendeur, () => db.query('delete from shop_sections where id = $1', [sectionA]));
    expect((await one<{ section_id: string | null }>('select section_id from offers where id = $1', [offerA])).section_id).toBeNull();
  });
});

describe('suivre une boutique', () => {
  it('un visiteur ne peut pas suivre', async () => {
    await refused(as(db, 'anon', () => db.query('select fn_follow_shop($1, true)', [shopA])));
  });
  it('un acheteur suit, la répétition ne double pas, le compteur est public', async () => {
    await as(db, U.acheteur, () => db.query('select fn_follow_shop($1, true)', [shopA]));
    const n = await as(db, U.acheteur, () => one<{ fn_follow_shop: number }>('select fn_follow_shop($1, true)', [shopA]));
    expect(n.fn_follow_shop).toBe(1);
    await as(db, U.acheteur2, () => db.query('select fn_follow_shop($1, true)', [shopA]));
    expect((await as(db, 'anon', () => one<{ fn_shop_followers: number }>('select fn_shop_followers($1)', [shopA]))).fn_shop_followers).toBe(2);
  });
  it('chacun ne lit que ses propres suivis, et l’écriture directe est refusée', async () => {
    expect(await as(db, U.acheteur, () => q('select user_id from shop_follows'))).toEqual([{ user_id: U.acheteur }]);
    await refused(as(db, U.acheteur, () => db.query(`insert into shop_follows (shop_id, user_id) values ($1, $2)`, [shopB, U.acheteur2])));
  });
  it('ne plus suivre retire le suivi', async () => {
    const n = await as(db, U.acheteur, () => one<{ fn_follow_shop: number }>('select fn_follow_shop($1, false)', [shopA]));
    expect(n.fn_follow_shop).toBe(1);
  });
  it('une boutique suspendue ne peut plus être suivie', async () => {
    await db.exec(`update shops set status = 'suspendue' where id = '${shopB}'`);
    await refused(as(db, U.acheteur, () => db.query('select fn_follow_shop($1, true)', [shopB])));
  });
});

describe('WhatsApp', () => {
  it('le vendeur enregistre un numéro valide ; un format incorrect est refusé', async () => {
    await as(db, U.vendeur, () => db.query(`update shops set whatsapp = '+224612345678' where id = $1`, [shopA]));
    await refused(as(db, U.vendeur, () => db.query(`update shops set whatsapp = 'appelez-moi' where id = $1`, [shopA])));
  });
});
