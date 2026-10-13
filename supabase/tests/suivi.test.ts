import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { as, freshDb, refused, U } from './harness';

/** Suivi sur carte (acheteur) et ventes par jour et par source (vendeur). */
let db: PGlite;
const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;
const one = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await q<T>(sql, params))[0]!;
const SELLER = { lng: -13.6775, lat: 9.5307 };
const BUYER = { lng: -13.6775, lat: 9.5672 };

let shopId: string; let offerId: string; let variantId: string; let buyerDecl: string; let parcel: string; let qr: string;
const place = async (src: string | null) => {
  const o = (await as(db, U.acheteur, () => one<{ fn_place_order: string }>('select fn_place_order($1::jsonb, $2, $3, $4, $5)', [JSON.stringify([{ offer_id: offerId, variant_id: variantId, qty: 1 }]), buyerDecl, '+224612000001', 'livraison', src]))).fn_place_order;
  return (await one<{ id: string }>('select id from parcels where order_id = $1', [o])).id;
};

beforeAll(async () => {
  db = await freshDb();
  const sd = (await one<{ id: string }>(`insert into declarations (user_id, gps_point, quartier_id, gps_accuracy_m) values ($1, point($2, $3), 'qtr-coleah', 5) returning id`, [U.vendeur, SELLER.lng, SELLER.lat])).id;
  buyerDecl = (await one<{ id: string }>(`insert into declarations (user_id, gps_point, quartier_id, gps_accuracy_m) values ($1, point($2, $3), 'qtr-coleah', 5) returning id`, [U.acheteur, BUYER.lng, BUYER.lat])).id;
  await db.exec(`insert into buildings (id, status, is_validated) values ('b-1', 'actif', true); update declarations set certified_building_id = 'b-1' where id = '${sd}'`);
  shopId = (await as(db, U.vendeur, () => one<{ id: string }>(`insert into shops (slug, name, owner_id, declaration_id) values ('kadi-wax', 'Kadi Wax', $1, $2) returning id`, [U.vendeur, sd]))).id;
  await as(db, U.vendeur, () => db.query('select fn_shop_open($1)', [shopId]));
  await db.exec(`insert into couriers (user_id, full_name, status, available) values ('${U.livreur}', 'Livreur Test', 'valide', true)`);
  const prod = await as(db, U.vendeur, () => one<{ id: string }>(`insert into catalog_products (slug, name, created_by) values ('pagne', 'Pagne', $1) returning id`, [U.vendeur]));
  offerId = (await as(db, U.vendeur, () => one<{ id: string }>(`insert into offers (shop_id, product_id, price_gnf) values ($1, $2, 100000) returning id`, [shopId, prod.id]))).id;
  variantId = (await as(db, U.vendeur, () => one<{ id: string }>(`insert into offer_variants (offer_id, label, stock) values ($1, 'Standard', 50) returning id`, [offerId]))).id;
  parcel = await place('tiktok');
}, 60000);

describe('suivi du colis', () => {
  it('l’acheteur voit la boutique et sa destination, pas de livreur avant le retrait', async () => {
    const r = await as(db, U.acheteur, () => one<Record<string, unknown>>('select * from fn_parcel_tracking($1)', [parcel]));
    expect(r).toMatchObject({ status: 'attente_vendeur', courier_lng: null, courier_lat: null });
    expect(Number(r.dest_lat)).toBeCloseTo(BUYER.lat, 3);
    expect(Number(r.shop_lat)).toBeCloseTo(SELLER.lat, 3);
  });
  it('un autre compte, un visiteur et le vendeur n’obtiennent rien', async () => {
    expect(await as(db, U.acheteur2, () => q('select * from fn_parcel_tracking($1)', [parcel]))).toHaveLength(0);
    expect(await as(db, U.vendeur, () => q('select * from fn_parcel_tracking($1)', [parcel]))).toHaveLength(0);
    await refused(as(db, 'anon', () => db.query('select * from fn_parcel_tracking($1)', [parcel])));
  });
  it('colis retiré : la position récente du livreur apparaît ; périmée, elle disparaît', async () => {
    await as(db, U.vendeur, () => db.query('select fn_parcel_ready($1)', [parcel]));
    await as(db, U.livreur, () => db.query('select fn_courier_accept($1)', [parcel]));
    qr = (await as(db, U.vendeur, () => one<{ fn_parcel_qr: string }>('select fn_parcel_qr($1)', [parcel]))).fn_parcel_qr;
    await as(db, U.livreur, () => db.query('select fn_courier_ping($1, $2)', [9.55, -13.677]));
    await as(db, U.livreur, () => db.query('select fn_parcel_pickup($1, $2, $3)', [qr, SELLER.lat, SELLER.lng]));
    const r = await as(db, U.acheteur, () => one<Record<string, unknown>>('select * from fn_parcel_tracking($1)', [parcel]));
    expect(r.status).toBe('retire');
    expect(Number(r.courier_lat)).toBeCloseTo(9.55, 3);
    await db.exec(`update couriers set last_seen_at = now() - interval '30 minutes' where user_id = '${U.livreur}'`);
    expect((await as(db, U.acheteur, () => one<Record<string, unknown>>('select * from fn_parcel_tracking($1)', [parcel]))).courier_lat).toBeNull();
  });
});

describe('ventes du vendeur', () => {
  it('ventes par jour : une ligne par jour, les colis annulés ne comptent pas', async () => {
    const p2 = await place('whatsapp');
    await as(db, U.vendeur, () => db.query('select fn_parcel_cancel($1)', [p2]));
    const rows = await as(db, U.vendeur, () => q<{ parcels: number; revenue_gnf: string }>('select * from fn_shop_sales($1, 7)', [shopId]));
    expect(rows).toHaveLength(7);
    const today = rows[rows.length - 1]!;
    expect(today.parcels).toBe(1);
    expect(Number(today.revenue_gnf)).toBe(100000);
  });
  it('ventes par source : TikTok compte, le colis annulé WhatsApp non', async () => {
    await place(null);
    const rows = await as(db, U.vendeur, () => q<{ source: string; parcels: number }>('select * from fn_shop_sources($1, 30)', [shopId]));
    expect(rows.map((r) => [r.source, r.parcels]).sort()).toEqual([['application', 1], ['tiktok', 1]]);
  });
  it('un autre vendeur ou un acheteur ne lit pas ces ventes ; l’équipe oui', async () => {
    await refused(as(db, U.vendeur2, () => db.query('select * from fn_shop_sales($1, 7)', [shopId])));
    await refused(as(db, U.acheteur, () => db.query('select * from fn_shop_sources($1, 7)', [shopId])));
    await db.exec(`insert into agents (id, role) values ('${U.admin}', 'admin') on conflict do nothing`);
    expect(await as(db, U.admin, () => q('select * from fn_shop_sales($1, 3)', [shopId]))).toHaveLength(3);
  });
});
