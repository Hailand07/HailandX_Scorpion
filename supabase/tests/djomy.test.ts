import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { as, freshDb, refused, U } from './harness';

/** Paiement en ligne par Djomy (HAILANDX.md §47) : modes, fournisseur du paiement, frais réels, annulation tardive. */
let db: PGlite;
const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;
const one = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await q<T>(sql, params))[0]!;
let buyerDecl: string; let offerId: string; let variantId: string;

const order = async () => (await as(db, U.acheteur, () => one<{ id: string }>('select fn_place_order($1::jsonb, $2, $3, $4) id', [JSON.stringify([{ offer_id: offerId, variant_id: variantId, qty: 1 }]), buyerDecl, '+224 620 00 00 00', 'orange_money']))).id;
const total = async (o: string) => (await one<{ total_gnf: number }>('select total_gnf from orders where id = $1', [o])).total_gnf;
/** Le serveur de HailandX (clé de service). */
async function server<T>(fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '', false); select set_config('request.jwt.claims', '{"role":"service_role"}', false)`);
  try { return await fn(); } finally { await db.exec(`reset role; select set_config('request.jwt.claims', '', false)`); }
}
const setMode = (m: string) => db.exec(`update settings set value = '${m}' where key = 'payment_mode'`);

beforeAll(async () => {
  db = await freshDb();
  const decl = async (u: string, lng: number, lat: number) => (await one<{ id: string }>(`insert into declarations (user_id, gps_point, quartier_id, gps_accuracy_m) values ($1, point($2, $3), 'qtr-coleah', 5) returning id`, [u, lng, lat])).id;
  const d = await decl(U.vendeur, -13.6775, 9.5307); buyerDecl = await decl(U.acheteur, -13.6775, 9.5672);
  await db.exec(`insert into buildings (id, status, is_validated) values ('b-1', 'actif', true); update declarations set certified_building_id = 'b-1' where id = '${d}'`);
  const shop = (await as(db, U.vendeur, () => one<{ id: string }>(`insert into shops (slug, name, owner_id, declaration_id) values ('kadi-wax', 'Kadi Wax', $1, $2) returning id`, [U.vendeur, d]))).id;
  await as(db, U.vendeur, () => db.query('select fn_shop_open($1)', [shop]));
  const prod = await as(db, U.vendeur, () => one<{ id: string }>(`insert into catalog_products (slug, name, created_by) values ('pagne', 'Pagne', $1) returning id`, [U.vendeur]));
  offerId = (await as(db, U.vendeur, () => one<{ id: string }>(`insert into offers (shop_id, product_id, price_gnf) values ($1, $2, 100000) returning id`, [shop, prod.id]))).id;
  variantId = (await as(db, U.vendeur, () => one<{ id: string }>(`insert into offer_variants (offer_id, label, stock) values ($1, 'Standard', 20) returning id`, [offerId]))).id;
}, 60000);

describe('Djomy, à côté de Chap Chap Pay', () => {
  it('le fondateur choisit djomy_test ou djomy ; en djomy_test seule l’équipe paie', async () => {
    await db.exec(`insert into agents (id, full_name, role) values ('${U.admin}', 'Fondateur', 'admin') on conflict (id) do nothing; update agents set console_role = 'fondateur' where id = '${U.admin}'`);
    await as(db, U.admin, () => db.query(`select fn_console_setting_update('payment_mode', 'djomy_test', 'essai Djomy')`));
    const o = await order();
    expect(await as(db, U.acheteur, () => refused(db.query('select * from fn_pay_start($1)', [o])))).toMatch(/essai : réservé à l'équipe/);
    expect(await as(db, U.admin, () => refused(db.query(`select fn_console_setting_update('payment_mode', 'djomi', 'faute')`)))).toMatch(/inconnu/);
  });
  it('mode djomy : le paiement est noté « djomy », confirmé par le serveur, frais réels gardés', async () => {
    await setMode('djomy');
    const o = await order();
    const r = await as(db, U.acheteur, () => one<{ provider: string }>('select * from fn_pay_start($1)', [o]));
    expect(r.provider).toBe('djomy');
    await server(() => db.query(`select fn_pay_attach($1, 'tx-1', 'https://portal.djomy.africa/tx-1', false)`, [o]));
    await server(() => db.query(`select fn_pay_provider_status($1, 'success', 'om')`, [o]));
    await server(() => db.query(`select fn_pay_provider_fee($1, 3000)`, [o]));
    const t1 = await total(o);
    await server(() => db.query(`select fn_payment_confirm($1, 'tx-1', $2)`, [o, t1]));
    expect(await one('select provider, status, provider_fee_gnf, provider_test from payments where order_id = $1', [o])).toEqual({ provider: 'djomy', status: 'paye', provider_fee_gnf: 3000, provider_test: false });
    expect(await as(db, U.acheteur, () => refused(db.query(`select fn_pay_provider_fee($1, 1)`, [o])))).toMatch(/réservé au serveur/);
  });
  it('les frais réels Djomy sont retenus à une annulation tardive (au prorata du colis)', async () => {
    const o = await order();
    await as(db, U.acheteur, () => db.query('select * from fn_pay_start($1)', [o]));
    await server(() => db.query(`select fn_pay_attach($1, 'tx-2', 'https://portal.djomy.africa/tx-2', false)`, [o]));
    await server(() => db.query(`select fn_pay_provider_fee($1, 2500)`, [o]));
    const t2 = await total(o);
    await server(() => db.query(`select fn_payment_confirm($1, 'tx-2', $2)`, [o, t2]));
    const fee = await one<{ f: number }>('select private.provider_fee_gnf($1, (select total_gnf from orders where id = $1)) f', [o]);
    expect(fee.f).toBe(2500);
    await setMode('chapchappay');
    expect((await one<{ provider: string }>('select provider from payments where order_id = $1', [o])).provider).toBe('djomy'); // un paiement garde son fournisseur
  });
});
