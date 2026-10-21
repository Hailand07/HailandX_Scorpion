import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { as, freshDb, U } from './harness';

/** Flotte, navigation : fiche de mission à deux arrêts (livreur attribué seulement), carte des missions (bâtiments exacts et contours), plafond d'espèces. */
let db: PGlite;
const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;
const one = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await q<T>(sql, params))[0]!;
const SELLER = { lng: -13.6775, lat: 9.5307 };
const BUYER = { lng: -13.67612, lat: 9.56788 };
const OUTLINE = '{"type":"Polygon","coordinates":[[[-13.6776,9.5306],[-13.6774,9.5306],[-13.6774,9.5308],[-13.6776,9.5308],[-13.6776,9.5306]]]}';

let parcel: string;
type Detail = { status: string; fee_gnf: number; pickup: Record<string, unknown>; dropoff: Record<string, unknown> };

beforeAll(async () => {
  db = await freshDb();
  await db.exec(`update auth.users set phone = '224620000018' where id = '${U.vendeur}'`);
  const sd = (await one<{ id: string }>(`insert into declarations (user_id, gps_point, quartier_id, commune_id, gps_accuracy_m, hailand_code, declared_landmark) values ($1, point($2, $3), 'qtr-coleah', 'cm-matam', 5, 'GN-CKY-MAT-001', 'Face à la pharmacie') returning id`, [U.vendeur, SELLER.lng, SELLER.lat])).id;
  const bd = (await one<{ id: string }>(`insert into declarations (user_id, gps_point, quartier_id, commune_id, gps_accuracy_m, hailand_code, location_floor, location_door, declared_landmark, osm_polygon_geom) values ($1, point($2, $3), 'qtr-coleah', 'cm-matam', 6, 'GN-CKY-MAT-002', '2', 'bleue', 'Près de la mosquée', $4) returning id`, [U.acheteur, BUYER.lng, BUYER.lat, OUTLINE])).id;
  await db.exec(`insert into buildings (id, status, is_validated, geom_pg) values ('b-1', 'actif', true, '${OUTLINE}'); update declarations set certified_building_id = 'b-1' where id = '${sd}'`);
  const shopId = (await as(db, U.vendeur, () => one<{ id: string }>(`insert into shops (slug, name, owner_id, declaration_id) values ('kadi-wax', 'Kadi Wax', $1, $2) returning id`, [U.vendeur, sd]))).id;
  await as(db, U.vendeur, () => db.query('select fn_shop_open($1)', [shopId]));
  await db.exec(`insert into couriers (user_id, full_name, status, available) values ('${U.livreur}', 'Livreur A', 'valide', true), ('${U.livreur2}', 'Livreur B', 'valide', true)`);
  const prod = await as(db, U.vendeur, () => one<{ id: string }>(`insert into catalog_products (slug, name, created_by) values ('pagne', 'Pagne', $1) returning id`, [U.vendeur]));
  const offerId = (await as(db, U.vendeur, () => one<{ id: string }>(`insert into offers (shop_id, product_id, price_gnf) values ($1, $2, 100000) returning id`, [shopId, prod.id]))).id;
  const variantId = (await as(db, U.vendeur, () => one<{ id: string }>(`insert into offer_variants (offer_id, label, stock) values ($1, 'Standard', 50) returning id`, [offerId]))).id;
  const o = (await as(db, U.acheteur, () => one<{ fn_place_order: string }>('select fn_place_order($1::jsonb, $2, $3, $4, $5)', [JSON.stringify([{ offer_id: offerId, variant_id: variantId, qty: 1 }]), bd, '+224612000001', 'livraison', null]))).fn_place_order;
  parcel = (await one<{ id: string }>('select id from parcels where order_id = $1', [o])).id;
  await as(db, U.vendeur, () => db.query('select fn_parcel_ready($1)', [parcel]));
}, 60000);

describe('carte des missions disponibles', () => {
  it('le livreur disponible voit la mission avec les bâtiments exacts et leurs contours, sans téléphone ni code', async () => {
    const list = (await as(db, U.livreur, () => one<{ m: Record<string, unknown>[] }>('select fn_missions_carte($1, $2, 8) m', [SELLER.lat + 0.01, SELLER.lng]))).m;
    expect(list).toHaveLength(1);
    const m = list[0]!;
    expect(m).toMatchObject({ parcel_id: parcel, from_name: 'Kadi Wax', from_quartier: 'Coleah Domino', from_commune: 'Matam', to_quartier: 'Coleah Domino', to_commune: 'Matam', from_lat: SELLER.lat });
    expect(Math.abs(Number(m.pickup_m) - 1112)).toBeLessThan(20);
    // Décision du fondateur (2026-10-21) : plus d'arrondi du dépôt, le bâtiment certifié est la référence.
    expect([Number(m.to_lat), Number(m.to_lng)]).toEqual([BUYER.lat, BUYER.lng]);
    expect((m.from_outline as { type: string }).type).toBe('Polygon'); // bâtiment certifié du vendeur
    expect((m.to_outline as { type: string }).type).toBe('Polygon');   // contour repéré de l'acheteur
    expect(m).toMatchObject({ from_level: 3 });
    expect(Object.keys(m).some((k) => /phone|code|floor|door|landmark/.test(k))).toBe(false);
  });
  it('hors du rayon, indisponible ou non livreur : rien', async () => {
    expect((await as(db, U.livreur, () => one<{ m: unknown[] }>('select fn_missions_carte($1, $2, 1) m', [SELLER.lat + 0.05, SELLER.lng]))).m).toEqual([]);
    expect((await as(db, U.acheteur, () => one<{ m: unknown[] }>('select fn_missions_carte($1, $2, 8) m', [SELLER.lat, SELLER.lng]))).m).toEqual([]);
    await db.exec(`update couriers set available = false where user_id = '${U.livreur2}'`);
    expect((await as(db, U.livreur2, () => one<{ m: unknown[] }>('select fn_missions_carte($1, $2, 8) m', [SELLER.lat, SELLER.lng]))).m).toEqual([]);
  });
});

describe('fiche de la mission acceptée', () => {
  it('avant l’acceptation, personne ne lit la fiche', async () => {
    expect((await as(db, U.livreur, () => one<{ d: unknown }>('select fn_mission_detail($1) d', [parcel]))).d).toBeNull();
  });
  it('le livreur attribué lit les deux arrêts : quartier, commune, code, repère, téléphone, contour du bâtiment', async () => {
    await as(db, U.livreur, () => db.query('select fn_courier_accept($1)', [parcel]));
    const d = (await as(db, U.livreur, () => one<{ d: Detail }>('select fn_mission_detail($1) d', [parcel]))).d;
    expect(d.status).toBe('accepte');
    expect(d.pickup).toMatchObject({ name: 'Kadi Wax', phone: '224620000018', quartier: 'Coleah Domino', commune: 'Matam', code: 'GN-CKY-MAT-001', landmark: 'Face à la pharmacie', lat: SELLER.lat, lng: SELLER.lng });
    expect(d.dropoff).toMatchObject({ phone: '+224612000001', quartier: 'Coleah Domino', commune: 'Matam', code: 'GN-CKY-MAT-002', floor: '2', door: 'bleue', landmark: 'Près de la mosquée', lat: BUYER.lat, lng: BUYER.lng });
    expect((d.pickup.outline as { type: string }).type).toBe('Polygon');   // bâtiment certifié (HailandMap)
    expect((d.dropoff.outline as { type: string }).type).toBe('Polygon');  // contour repéré à la déclaration
  });
  it('un autre livreur ou l’acheteur : rien', async () => {
    expect((await as(db, U.livreur2, () => one<{ d: unknown }>('select fn_mission_detail($1) d', [parcel]))).d).toBeNull();
    expect((await as(db, U.acheteur, () => one<{ d: unknown }>('select fn_mission_detail($1) d', [parcel]))).d).toBeNull();
  });
  it('le numéro WhatsApp de la boutique passe avant celui du vendeur', async () => {
    await db.exec(`update shops set whatsapp = '+224655001122' where slug = 'kadi-wax'`);
    const d = (await as(db, U.livreur, () => one<{ d: Detail }>('select fn_mission_detail($1) d', [parcel]))).d;
    expect(d.pickup.phone).toBe('+224655001122');
  });
});

describe('plafond d’espèces', () => {
  it('une mission au-delà du plafond est refusée avec un message exact, même sans rien à reverser', async () => {
    await db.exec(`update couriers set available = true, cash_limit_gnf = 50000 where user_id = '${U.livreur2}'`);
    await as(db, U.livreur, () => db.query('select fn_courier_release($1)', [parcel]));
    const err = await as(db, U.livreur2, () => db.query('select fn_courier_accept($1)', [parcel]).then(() => '', (e: Error) => e.message));
    expect(err).toMatch(/demande d'encaisser \d[\d ]* GNF, plus que votre plafond de 50 000 GNF/);
    expect(err).not.toMatch(/reversez/i);
    expect((await one<{ status: string }>('select status from parcels where id = $1', [parcel])).status).toBe('mission_proposee');
  });
  it('le fondateur relève le plafond depuis la console (journalisé) ; un livreur ou un opérateur ne le peut pas', async () => {
    await db.exec(`update agents set console_role = 'fondateur' where id = '${U.admin}'`);
    const refus = (who: string) => as(db, who, () => db.query('select fn_console_courier_cash_limit($1, 2000000, $2)', [U.livreur2, 'gros colis']).then(() => '', (e: Error) => e.message));
    expect(await refus(U.livreur2)).toMatch(/réservé au fondateur/);
    await as(db, U.admin, () => db.query('select fn_console_courier_cash_limit($1, 2000000, $2)', [U.livreur2, 'gros colis']));
    expect((await one<{ l: number }>('select cash_limit_gnf l from couriers where user_id = $1', [U.livreur2])).l).toBe(2000000);
    expect(await one('select action, motif, detail from console_journal order by created_at desc limit 1')).toEqual({ action: 'livreur_plafond', motif: 'gros colis', detail: { avant: 50000, apres: 2000000 } });
    expect(await as(db, U.livreur2, () => one<{ r: string }>('select fn_courier_accept($1) r', [parcel]))).toEqual({ r: 'accepte' });
  });
});
