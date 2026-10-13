import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { as, freshDb, refused, U } from './harness';

/** Photo de remise exigée : remise par code avec preuve, lecture des preuves par les parties, droits d'écriture. */
let db: PGlite;
const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;
const one = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await q<T>(sql, params))[0]!;
const SELLER = { lng: -13.6775, lat: 9.5307 };
const BUYER = { lng: -13.6775, lat: 9.5672 };

let shopId: string; let offerId: string; let variantId: string; let buyerDecl: string; let parcel: string; let code: string; let qr: string;
const place = async () => {
  const o = (await as(db, U.acheteur, () => one<{ fn_place_order: string }>('select fn_place_order($1::jsonb, $2, $3, $4, $5)', [JSON.stringify([{ offer_id: offerId, variant_id: variantId, qty: 1 }]), buyerDecl, '+224612000001', 'livraison', null]))).fn_place_order;
  return (await one<{ id: string }>('select id from parcels where order_id = $1', [o])).id;
};
const photo = (courier = U.livreur, p = () => parcel) => `${courier}/${p()}/preuve.jpg`;

beforeAll(async () => {
  db = await freshDb();
  const sd = (await one<{ id: string }>(`insert into declarations (user_id, gps_point, quartier_id, gps_accuracy_m) values ($1, point($2, $3), 'qtr-coleah', 5) returning id`, [U.vendeur, SELLER.lng, SELLER.lat])).id;
  buyerDecl = (await one<{ id: string }>(`insert into declarations (user_id, gps_point, quartier_id, gps_accuracy_m) values ($1, point($2, $3), 'qtr-coleah', 5) returning id`, [U.acheteur, BUYER.lng, BUYER.lat])).id;
  await db.exec(`insert into buildings (id, status, is_validated) values ('b-1', 'actif', true); update declarations set certified_building_id = 'b-1' where id = '${sd}'`);
  shopId = (await as(db, U.vendeur, () => one<{ id: string }>(`insert into shops (slug, name, owner_id, declaration_id) values ('kadi-wax', 'Kadi Wax', $1, $2) returning id`, [U.vendeur, sd]))).id;
  await as(db, U.vendeur, () => db.query('select fn_shop_open($1)', [shopId]));
  await db.exec(`insert into couriers (user_id, full_name, status, available) values ('${U.livreur}', 'Livreur A', 'valide', true), ('${U.livreur2}', 'Livreur B', 'valide', true)`);
  const prod = await as(db, U.vendeur, () => one<{ id: string }>(`insert into catalog_products (slug, name, created_by) values ('pagne', 'Pagne', $1) returning id`, [U.vendeur]));
  offerId = (await as(db, U.vendeur, () => one<{ id: string }>(`insert into offers (shop_id, product_id, price_gnf) values ($1, $2, 100000) returning id`, [shopId, prod.id]))).id;
  variantId = (await as(db, U.vendeur, () => one<{ id: string }>(`insert into offer_variants (offer_id, label, stock) values ($1, 'Standard', 50) returning id`, [offerId]))).id;
  parcel = await place();
  await as(db, U.vendeur, () => db.query('select fn_parcel_ready($1)', [parcel]));
  await as(db, U.livreur, () => db.query('select fn_courier_accept($1)', [parcel]));
  qr = (await as(db, U.vendeur, () => one<{ fn_parcel_qr: string }>('select fn_parcel_qr($1)', [parcel]))).fn_parcel_qr;
  await as(db, U.livreur, () => db.query('select fn_courier_ping($1, $2)', [SELLER.lat, SELLER.lng]));
  await as(db, U.livreur, () => db.query('select fn_parcel_pickup($1, $2, $3)', [qr, SELLER.lat, SELLER.lng]));
  code = (await as(db, U.acheteur, () => one<{ fn_my_handover_code: string }>('select fn_my_handover_code($1)', [parcel]))).fn_my_handover_code;
  await as(db, U.livreur, () => db.query('select fn_courier_ping($1, $2)', [BUYER.lat, BUYER.lng]));
}, 60000);

describe('remise par code : photo obligatoire', () => {
  it('sans photo, ou avec la photo d’un autre colis ou d’un autre livreur : refus, et le code n’est pas consommé', async () => {
    const call = (p: string | null, who = U.livreur) => as(db, who, () => refused(db.query('select fn_parcel_handover_proof($1, $2, $3, $4)', [parcel, 'code', code, p])));
    expect(await call(null)).toMatch(/photo de remise obligatoire/);
    expect(await call('n-importe-quoi.jpg')).toMatch(/photo de remise obligatoire/);
    expect(await call(`${U.livreur}/${'00000000-0000-4000-8000-000000000000'}/preuve.jpg`)).toMatch(/photo de remise obligatoire/);
    expect(await call(photo(U.livreur2))).toMatch(/photo de remise obligatoire/);
    expect((await one<{ handover_failures: number; status: string }>('select handover_failures, status from parcels where id = $1', [parcel]))).toEqual({ handover_failures: 0, status: 'retire' });
  });
  it('la fonction d’origine n’est plus appelable directement', async () => {
    await refused(as(db, U.livreur, () => db.query('select fn_parcel_handover($1, $2, $3)', [parcel, 'code', code])));
  });
  it('avec la photo du bon chemin, la remise aboutit et la photo est rattachée à l’événement « remis »', async () => {
    const r = await as(db, U.livreur, () => one<{ fn_parcel_handover_proof: string }>('select fn_parcel_handover_proof($1, $2, $3, $4)', [parcel, 'code', code, photo()]));
    expect(r.fn_parcel_handover_proof).toBe('remis');
    expect((await one<{ photo_path: string }>(`select photo_path from delivery_events where parcel_id = $1 and kind = 'remis'`, [parcel])).photo_path).toBe(photo());
  });
});

describe('remise par scan de l’acheteur : sans photo', () => {
  it('l’acheteur confirme par scan sans photo', async () => {
    const p2 = await place();
    await as(db, U.vendeur, () => db.query('select fn_parcel_ready($1)', [p2]));
    await as(db, U.livreur, () => db.query('select fn_courier_accept($1)', [p2]));
    const qr2 = (await as(db, U.vendeur, () => one<{ fn_parcel_qr: string }>('select fn_parcel_qr($1)', [p2]))).fn_parcel_qr;
    await as(db, U.livreur, () => db.query('select fn_courier_ping($1, $2)', [SELLER.lat, SELLER.lng]));
    await as(db, U.livreur, () => db.query('select fn_parcel_pickup($1, $2, $3)', [qr2, SELLER.lat, SELLER.lng]));
    await as(db, U.livreur, () => db.query('select fn_courier_ping($1, $2)', [BUYER.lat, BUYER.lng]));
    expect((await as(db, U.acheteur, () => one<{ fn_parcel_handover_proof: string }>('select fn_parcel_handover_proof($1, $2, $3)', [p2, 'scan', qr2]))).fn_parcel_handover_proof).toBe('remis');
    expect((await one<{ photo_path: string | null }>(`select photo_path from delivery_events where parcel_id = $1 and kind = 'remis'`, [p2])).photo_path).toBeNull();
  });
});

describe('droits sur les preuves (règles du stockage privé)', () => {
  it('lecture : livreur, acheteur, vendeur et équipe ; pas un autre compte, pas un visiteur', async () => {
    const readable = (who: string | 'anon') => as(db, who, () => one<{ ok: boolean }>('select fn_proof_readable($1) as ok', [photo()])).then((r) => r.ok);
    expect(await readable(U.livreur)).toBe(true);
    expect(await readable(U.acheteur)).toBe(true);
    expect(await readable(U.vendeur)).toBe(true);
    expect(await readable(U.admin)).toBe(true);
    expect(await readable(U.acheteur2)).toBe(false);
    expect(await readable(U.vendeur2)).toBe(false);
    await refused(as(db, 'anon', () => db.query('select fn_proof_readable($1)', [photo()])));
  });
  it('écriture : seulement le livreur attribué, colis retiré, dans son dossier', async () => {
    const p3 = await place();
    await as(db, U.vendeur, () => db.query('select fn_parcel_ready($1)', [p3]));
    await as(db, U.livreur, () => db.query('select fn_courier_accept($1)', [p3]));
    const w = (who: string, path: string) => as(db, who, () => one<{ ok: boolean }>('select fn_proof_writable($1) as ok', [path])).then((r) => r.ok);
    expect(await w(U.livreur, `${U.livreur}/${p3}/a.jpg`)).toBe(false); // pas encore retiré
    const qr3 = (await as(db, U.vendeur, () => one<{ fn_parcel_qr: string }>('select fn_parcel_qr($1)', [p3]))).fn_parcel_qr;
    await as(db, U.livreur, () => db.query('select fn_courier_ping($1, $2)', [SELLER.lat, SELLER.lng]));
    await as(db, U.livreur, () => db.query('select fn_parcel_pickup($1, $2, $3)', [qr3, SELLER.lat, SELLER.lng]));
    expect(await w(U.livreur, `${U.livreur}/${p3}/a.jpg`)).toBe(true);
    expect(await w(U.livreur2, `${U.livreur2}/${p3}/a.jpg`)).toBe(false); // pas son colis
    expect(await w(U.livreur2, `${U.livreur}/${p3}/a.jpg`)).toBe(false); // pas son dossier
    expect(await w(U.acheteur, `${U.acheteur}/${p3}/a.jpg`)).toBe(false);
  });
});
