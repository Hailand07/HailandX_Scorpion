import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { as, freshDb, refused, U } from './harness';

/** HailandX Vendeur, suite du plan §37 : boutique en ligne (horaires, vacances, politique), clients pseudonymes, équipe. */
let db: PGlite;
const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;
const one = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await q<T>(sql, params))[0]!;
let shop: string; let offer: string; let buyerDecl: string; let buyer2Decl: string;

const place = (who: string, decl: string) =>
  as(db, who, () => one<{ id: string }>('select fn_place_order($1::jsonb, $2, $3, $4) id', [JSON.stringify([{ offer_id: offer, qty: 1 }]), decl, '+224612000001', 'livraison']));

beforeAll(async () => {
  db = await freshDb();
  await db.exec(`update auth.users set phone = '224620000002' where id = '${U.vendeur2}'; update auth.users set phone = '224620000001' where id = '${U.vendeur}'`);
  const decl = async (u: string) => (await one<{ id: string }>(`insert into declarations (user_id, gps_point, quartier_id, gps_accuracy_m) values ($1, point(-13.6775, 9.5307), 'qtr-coleah', 5) returning id`, [u])).id;
  const d = await decl(U.vendeur); buyerDecl = await decl(U.acheteur); buyer2Decl = await decl(U.acheteur2);
  await db.exec(`insert into buildings (id, status, is_validated) values ('b-1', 'actif', true); update declarations set certified_building_id = 'b-1' where id = '${d}'`);
  shop = (await as(db, U.vendeur, () => one<{ id: string }>(`insert into shops (slug, name, owner_id, declaration_id) values ('kadi-wax', 'Kadi Wax', $1, $2) returning id`, [U.vendeur, d]))).id;
  await as(db, U.vendeur, () => db.query('select fn_shop_open($1)', [shop]));
  const prod = (await as(db, U.vendeur, () => one<{ id: string }>(`insert into catalog_products (slug, name, created_by) values ('pagne', 'Pagne', $1) returning id`, [U.vendeur]))).id;
  offer = (await as(db, U.vendeur, () => one<{ id: string }>(`insert into offers (shop_id, product_id, price_gnf) values ($1, $2, 100000) returning id`, [shop, prod]))).id;
}, 60000);

describe('boutique en ligne', () => {
  it('le propriétaire enregistre horaires, politique et produit mis en avant ; le public les lit', async () => {
    await as(db, U.vendeur, () => db.query(`update shops set hours = '{"lun": ["08:00", "20:00"], "dim": null}', policy = 'Échange sous 3 jours si non porté.' where id = $1`, [shop]));
    await as(db, U.vendeur, () => db.query('update offers set featured = true where id = $1', [offer]));
    expect(await as(db, 'anon', () => one('select hours, policy from shops where id = $1', [shop]))).toEqual({ hours: { lun: ['08:00', '20:00'], dim: null }, policy: 'Échange sous 3 jours si non porté.' });
    expect(await as(db, 'anon', () => one('select featured from offers where id = $1', [offer]))).toEqual({ featured: true });
    await refused(as(db, U.vendeur, () => db.query(`update shops set hours = '[1, 2]' where id = $1`, [shop])));
  });
  it('mode vacances : la commande est refusée jusqu’à la date de retour, puis reprend', async () => {
    await as(db, U.vendeur, () => db.query(`update shops set vacation_until = current_date + 3, vacation_note = 'De retour lundi' where id = $1`, [shop]));
    expect(await refused(place(U.acheteur, buyerDecl))).toMatch(/en congé jusqu/);
    await as(db, U.vendeur, () => db.query('update shops set vacation_until = null where id = $1', [shop]));
    expect((await place(U.acheteur, buyerDecl)).id).toBeTruthy();
  });
});

describe('clients de la boutique', () => {
  it('pseudonymes, nombre de commandes et total ; colis annulés exclus ; jamais d’identifiant ni de numéro', async () => {
    await place(U.acheteur, buyerDecl);
    const o = await place(U.acheteur2, buyer2Decl);
    const p = (await one<{ id: string }>('select id from parcels where order_id = $1', [o.id])).id;
    await as(db, U.acheteur2, () => db.query('select fn_parcel_cancel($1)', [p]));
    const rows = await as(db, U.vendeur, () => q<{ client: string; quartier: string; orders: number; total_gnf: number }>('select client, quartier, orders::int, total_gnf::int from fn_shop_clients($1)', [shop]));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ quartier: 'Coleah Domino', orders: 2, total_gnf: 200000 });
    expect(rows[0]!.client).toMatch(/^Client [0-9A-F]{4}$/);
    const f = await as(db, U.vendeur, () => one<{ fn_seller_parcel: { client: { label: string } } }>('select fn_seller_parcel(id) from parcels where order_id = (select id from orders where buyer_id = $1 limit 1)', [U.acheteur]));
    expect(f.fn_seller_parcel.client.label).toBe(rows[0]!.client);
    expect(await as(db, U.vendeur2, () => q('select * from fn_shop_clients($1)', [shop]))).toEqual([]);
  });
});

describe('équipe', () => {
  it('le propriétaire ajoute un employé par son numéro ; l’employé est prévenu ; numéros masqués', async () => {
    expect(await refused(as(db, U.vendeur, () => db.query('select fn_shop_member_add($1, $2)', [shop, '620 99 99 99'])))).toMatch(/pas encore de compte/);
    await as(db, U.vendeur, () => db.query('select fn_shop_member_add($1, $2)', [shop, '620 00 00 02']));
    expect(await refused(as(db, U.vendeur, () => db.query('select fn_shop_member_add($1, $2)', [shop, '+224620000002'])))).toMatch(/déjà/);
    expect(await q(`select link from notifications where user_id = $1 and kind = 'equipe'`, [U.vendeur2])).toEqual([{ link: '/vendeur' }]);
    const m = await as(db, U.vendeur2, () => q('select role, phone_masked, me from fn_shop_members($1)', [shop]));
    expect(m).toEqual([{ role: 'proprietaire', phone_masked: '+22462• •• •• 01', me: false }, { role: 'employe', phone_masked: '+22462• •• •• 02', me: true }]);
  });
  it('l’employé prépare et gère les produits, mais ne voit pas l’argent, ne modifie pas la boutique et ne gère pas l’équipe', async () => {
    await as(db, U.vendeur2, () => db.query('update offers set price_gnf = 95000 where id = $1', [offer]));
    expect(await one('select price_gnf from offers where id = $1', [offer])).toEqual({ price_gnf: 95000 });
    await as(db, U.vendeur2, () => db.query(`update shops set name = 'Pirate' where id = $1`, [shop]));
    expect(await one('select name from shops where id = $1', [shop])).toEqual({ name: 'Kadi Wax' });
    await db.exec(`insert into ledger_entries (account, account_id, kind, amount_gnf) values ('shop', '${shop}', 'ajustement', 1000)`);
    expect(await as(db, U.vendeur2, () => q(`select id from ledger_entries where account = 'shop'`))).toEqual([]);
    expect(await as(db, U.vendeur, () => q(`select amount_gnf from ledger_entries where account = 'shop'`))).toEqual([{ amount_gnf: 1000 }]);
    expect(await refused(as(db, U.vendeur2, () => db.query('select fn_shop_member_add($1, $2)', [shop, '620 00 00 01'])))).toMatch(/propriétaire/);
    expect(await refused(as(db, U.vendeur2, () => db.query('select fn_shop_member_remove($1, $2)', [shop, U.vendeur])))).toMatch(/propriétaire/);
  });
  it('le propriétaire retire l’employé (jamais lui-même) ; l’ancien employé n’a plus accès', async () => {
    expect(await refused(as(db, U.vendeur, () => db.query('select fn_shop_member_remove($1, $2)', [shop, U.vendeur])))).toMatch(/introuvable/);
    await as(db, U.vendeur, () => db.query('select fn_shop_member_remove($1, $2)', [shop, U.vendeur2]));
    expect(await as(db, U.vendeur2, () => q('select * from fn_shop_clients($1)', [shop]))).toEqual([]);
  });
});
