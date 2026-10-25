import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { as, freshDb, refused, U } from './harness';

/** Tarifs de livraison réglables dans la Console (HAILANDX.md §44). Repère du fondateur : rond-point T8 → Samatran Plateau, 2,88 km à vol d'oiseau, moto-taxi 7 000 GNF. */
let db: PGlite;
const one = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0]!;
const fee = async (km: number) => (await as(db, U.acheteur, () => one<{ f: number }>('select fn_delivery_fee_preview($1) f', [km]))).f;
const set = (key: string, v: string) => as(db, U.admin, () => db.query(`select fn_console_setting_update($1, $2, 'calage sur le moto-taxi')`, [key, v]));
let shop: string; let buyerDecl: string; let offer: string;

beforeAll(async () => {
  db = await freshDb();
  await db.exec(`insert into agents (id, full_name, role) values ('${U.admin}', 'Fondateur', 'admin') on conflict (id) do nothing; update agents set console_role = 'fondateur' where id = '${U.admin}'`);
  const decl = async (u: string, lng: number, lat: number) => (await one<{ id: string }>(`insert into declarations (user_id, gps_point, quartier_id, gps_accuracy_m) values ($1, point($2, $3), 'qtr-coleah', 5) returning id`, [u, lng, lat])).id;
  // boutique au rond-point T8, acheteur à Samatran Plateau (coordonnées réelles)
  const d = await decl(U.vendeur, -13.543619, 9.677143); buyerDecl = await decl(U.acheteur, -13.5643684, 9.692995);
  await db.exec(`insert into buildings (id, status, is_validated) values ('b-1', 'actif', true); update declarations set certified_building_id = 'b-1' where id = '${d}'`);
  shop = (await as(db, U.vendeur, () => one<{ id: string }>(`insert into shops (slug, name, owner_id, declaration_id) values ('t8-shop', 'T8 Shop', $1, $2) returning id`, [U.vendeur, d]))).id;
  await as(db, U.vendeur, () => db.query('select fn_shop_open($1)', [shop]));
  const prod = await as(db, U.vendeur, () => one<{ id: string }>(`insert into catalog_products (slug, name, created_by) values ('riz', 'Riz', $1) returning id`, [U.vendeur]));
  offer = (await as(db, U.vendeur, () => one<{ id: string }>(`insert into offers (shop_id, product_id, price_gnf) values ($1, $2, 50000) returning id`, [shop, prod.id]))).id;
}, 60000);

describe('frais de livraison réglables', () => {
  it('valeurs de départ inchangées : 6 000 + 2 100/km, minimum 8 000 (T8 → Samatran : 12 000)', async () => {
    expect(await fee(2.88)).toBe(12000);
    expect(await fee(0)).toBe(8000);
    const q = await as(db, U.acheteur, () => one<{ distance_km: string; fee_gnf: number }>('select distance_km, fee_gnf from fn_delivery_quote($1, $2)', [buyerDecl, [offer]]));
    expect(Number(q.distance_km)).toBeCloseTo(2.88, 2);
    expect(q.fee_gnf).toBe(12000);
  });
  it('seul le fondateur change les tarifs, avec des valeurs plausibles ; le devis et la commande suivent', async () => {
    expect(await as(db, U.acheteur, () => refused(db.query(`select fn_console_setting_update('delivery_base_gnf', '4000', 'essai')`)))).toMatch(/fondateur/);
    expect(await as(db, U.admin, () => refused(db.query(`select fn_console_setting_update('delivery_per_km_gnf', '-5', 'essai')`)))).toMatch(/hors limites/);
    expect(await as(db, U.admin, () => refused(db.query(`select fn_console_setting_update('delivery_min_gnf', '5000000', 'essai')`)))).toMatch(/hors limites/);
    await set('delivery_base_gnf', '4000'); await set('delivery_per_km_gnf', '1100'); await set('delivery_min_gnf', '6000');
    expect(await fee(2.88)).toBe(7000); // = le moto-taxi du fondateur
    expect(await fee(0.5)).toBe(6000);
    const o = (await as(db, U.acheteur, () => one<{ id: string }>('select fn_place_order($1::jsonb, $2, $3, $4) id', [JSON.stringify([{ offer_id: offer, qty: 1 }]), buyerDecl, '+224 620 00 00 00', 'livraison']))).id;
    expect((await one<{ delivery_fee_gnf: number }>('select delivery_fee_gnf from orders where id = $1', [o])).delivery_fee_gnf).toBe(7000);
    const j = await one<{ n: number }>(`select count(*)::int n from console_journal where action = 'parametre_modifie' and target_id like 'delivery_%'`);
    expect(j.n).toBe(3);
  });
});
