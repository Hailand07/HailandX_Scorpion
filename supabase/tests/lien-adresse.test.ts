import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { as, freshDb, refused, U } from './harness';

/** §51 : lien de localisation envoyé au destinataire, et correction du point de remise par le livreur. */
let db: PGlite;
const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;
const one = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await q<T>(sql, params))[0]!;
const SELLER = { lng: -13.6775, lat: 9.5307 };
const BUYER = { lng: -13.6775, lat: 9.5672 };
const NEAR = { lng: BUYER.lng, lat: BUYER.lat + 0.0027 }; // ≈ 300 m : la vraie porte
const FAR = { lng: BUYER.lng, lat: BUYER.lat + 0.012 };   // ≈ 1,3 km

let shopId: string; let offerId: string; let variantId: string; let buyerDecl: string; let parcel: string; let code: string;
const photo = () => `${U.livreur}/${parcel}/preuve.jpg`;
const ping = (who: string, at: { lat: number; lng: number }) => as(db, who, () => db.query('select fn_courier_ping($1, $2)', [at.lat, at.lng]));

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
  const o = (await as(db, U.acheteur, () => one<{ fn_place_order: string }>('select fn_place_order($1::jsonb, $2, $3, $4, $5)', [JSON.stringify([{ offer_id: offerId, variant_id: variantId, qty: 1 }]), buyerDecl, '+224612000001', 'livraison', null]))).fn_place_order;
  parcel = (await one<{ id: string }>('select id from parcels where order_id = $1', [o])).id;
  await as(db, U.vendeur, () => db.query('select fn_parcel_ready($1)', [parcel]));
  await as(db, U.livreur, () => db.query('select fn_courier_accept($1)', [parcel]));
}, 60000);

describe('correction du point de remise par le livreur', () => {
  it('refusée avant le retrait du colis', async () => {
    await ping(U.livreur, NEAR);
    expect(await as(db, U.livreur, () => refused(db.query('select fn_mission_fix_dropoff($1)', [parcel])))).toMatch(/colis en main/);
  });
  it('colis en main, à la vraie porte (300 m du point) : la remise est refusée, puis acceptée après correction', async () => {
    const qr = (await as(db, U.vendeur, () => one<{ fn_parcel_qr: string }>('select fn_parcel_qr($1)', [parcel]))).fn_parcel_qr;
    await ping(U.livreur, SELLER);
    await as(db, U.livreur, () => db.query('select fn_parcel_pickup($1, $2, $3)', [qr, SELLER.lat, SELLER.lng]));
    code = (await as(db, U.acheteur, () => one<{ fn_my_handover_code: string }>('select fn_my_handover_code($1)', [parcel]))).fn_my_handover_code;

    await ping(U.livreur, FAR);
    expect(await as(db, U.livreur, () => refused(db.query('select fn_mission_fix_dropoff($1)', [parcel])))).toMatch(/trop loin/);
    expect(await as(db, U.livreur2, () => refused(db.query('select fn_mission_fix_dropoff($1)', [parcel])))).toMatch(/introuvable/);

    await ping(U.livreur, NEAR);
    expect(await as(db, U.livreur, () => refused(db.query('select fn_parcel_handover_proof($1, $2, $3, $4)', [parcel, 'code', code, photo()])))).toMatch(/n'est pas à l'adresse/);
    const fix = (await as(db, U.livreur, () => one<{ r: { distance_m: number } }>('select fn_mission_fix_dropoff($1) as r', [parcel]))).r;
    expect(fix.distance_m).toBeGreaterThan(250);
    const m = (await as(db, U.livreur, () => one<{ r: { dropoff: { fixed: boolean; lat: number } } }>('select fn_mission_detail($1) as r', [parcel]))).r;
    expect(m.dropoff.fixed).toBe(true);
    expect(m.dropoff.lat).toBeCloseTo(NEAR.lat, 5);
    // La correction ne remplace pas la signature : un mauvais code reste refusé.
    expect((await as(db, U.livreur, () => one<{ r: string }>('select fn_parcel_handover_proof($1, $2, $3, $4) as r', [parcel, 'code', code === '0000' ? '1111' : '0000', photo()]))).r).toBe('refuse');
    expect((await as(db, U.livreur, () => one<{ r: string }>('select fn_parcel_handover_proof($1, $2, $3, $4) as r', [parcel, 'code', code, photo()]))).r).toBe('remis');
  });
});

describe('lien de localisation envoyé au destinataire', () => {
  let token: string;
  it('le client crée un lien ; un visiteur en lit l’état sans rien voir de personnel', async () => {
    await refused(as(db, 'anon', () => db.query(`select fn_address_request_create('Maman')`)));
    token = (await as(db, U.acheteur, () => one<{ t: string }>(`select fn_address_request_create('Maman') as t`))).t;
    expect(token).toMatch(/^[0-9a-f]{24}$/);
    expect((await as(db, 'anon', () => one<{ r: unknown }>('select fn_address_request_info($1) as r', [token]))).r).toEqual({ label: 'Maman', state: 'ouverte' });
    expect((await as(db, 'anon', () => one<{ r: unknown }>(`select fn_address_request_info('nimporte') as r`))).r).toEqual({ state: 'inconnue' });
    expect(await as(db, U.acheteur2, () => q('select id from address_requests'))).toHaveLength(0);
    expect(await as(db, U.acheteur, () => q('select id from address_requests'))).toHaveLength(1);
    await refused(as(db, U.acheteur, () => db.query(`insert into address_requests (requester_id, label) values ('${U.acheteur}', 'x')`)));
  });
  it('le destinataire, sans compte, enregistre l’adresse au compte du demandeur ; le lien ne sert qu’une fois', async () => {
    expect(await as(db, 'anon', () => refused(db.query(`select fn_address_request_fulfil($1, -13.65, 9.60, 8, p_located_by => 'a_distance')`, [token])))).toMatch(/sur place/);
    const r = (await as(db, 'anon', () => one<{ r: { id: string; level: number; located_by: string } }>(`select fn_address_request_fulfil($1, -13.65, 9.60, 8, -13.6501, 9.6001, p_landmark => 'Portail bleu') as r`, [token]))).r;
    expect(r.level).toBe(1);
    expect(r.located_by).toBe('gps');
    const d = await one<{ user_id: string; declared_label: string; declared_landmark: string }>('select user_id, declared_label, declared_landmark from declarations where id = $1', [r.id]);
    expect(d).toEqual({ user_id: U.acheteur, declared_label: 'Autre', declared_landmark: 'Portail bleu' });
    expect((await as(db, U.acheteur, () => one<{ declaration_id: string }>('select declaration_id from address_requests where token = $1', [token]))).declaration_id).toBe(r.id);
    expect(await as(db, 'anon', () => refused(db.query('select fn_address_request_fulfil($1, -13.65, 9.60, 8)', [token])))).toMatch(/déjà servi/);
    expect((await as(db, 'anon', () => one<{ r: { state: string } }>('select fn_address_request_info($1) as r', [token]))).r.state).toBe('faite');
  });
  it('lien expiré : refusé ; dix liens en attente au plus', async () => {
    const t = (await as(db, U.acheteur, () => one<{ t: string }>(`select fn_address_request_create('') as t`))).t;
    await db.exec(`update address_requests set expires_at = now() - interval '1 minute' where token = '${t}'`);
    expect(await as(db, 'anon', () => refused(db.query('select fn_address_request_fulfil($1, -13.65, 9.60, 8)', [t])))).toMatch(/expiré/);
    for (let i = 0; i < 10; i++) await as(db, U.acheteur, () => db.query(`select fn_address_request_create('x')`));
    expect(await as(db, U.acheteur, () => refused(db.query(`select fn_address_request_create('x')`)))).toMatch(/trop de liens/);
  });
});
