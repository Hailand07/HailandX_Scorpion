import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { as, freshDb, refused, U } from './harness';

/** Retraits à la demande (HAILANDX.md §62). Chaque `it` reprend l'état du précédent. */
let db: PGlite;
const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;
const one = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await q<T>(sql, params))[0]!;
const n = (v: unknown) => Number(v);

const SELLER = { lng: -13.6775, lat: 9.5307 };
const BUYER = { lng: -13.6775, lat: 9.5672 };
let shop: string; let buyerDecl: string; let offer: string; let variant: string;

const me = async (who: string) => (await as(db, who, () => one<{ fn_wallet_me: Record<string, unknown> }>('select fn_wallet_me()'))).fn_wallet_me;
const bal = async (who: string) => n((await me(who)).balance);
const shopBal = async () => n((await one<{ balance: string }>('select balance from wallets where shop_id = $1', [shop])).balance);
const order = async (payment: string, qty = 1) => {
  const o = (await as(db, U.acheteur, () => one<{ id: string }>('select fn_place_order($1::jsonb, $2, $3, $4) id', [JSON.stringify([{ offer_id: offer, variant_id: variant, qty }]), buyerDecl, '+224 620 00 00 00', payment]))).id;
  const p = await one<{ id: string; subtotal_gnf: number; delivery_fee_gnf: number; cod_amount_gnf: number }>('select id, subtotal_gnf, delivery_fee_gnf, cod_amount_gnf from parcels where order_id = $1', [o]);
  return { o, ...p, total: p.subtotal_gnf + p.delivery_fee_gnf };
};
async function deliver(parcel: string) {
  await as(db, U.vendeur, () => db.query('select fn_parcel_ready($1)', [parcel]));
  await as(db, U.livreur, () => db.query('select fn_courier_accept($1)', [parcel]));
  const qr = (await as(db, U.vendeur, () => one<{ fn_parcel_qr: string }>('select fn_parcel_qr($1)', [parcel]))).fn_parcel_qr;
  await as(db, U.livreur, () => db.query('select fn_parcel_pickup($1)', [qr]));
  await as(db, U.livreur, () => db.query('select fn_courier_ping($1, $2)', [BUYER.lat, BUYER.lng]));
  const code = (await as(db, U.acheteur, () => one<{ fn_my_handover_code: string }>('select fn_my_handover_code($1)', [parcel]))).fn_my_handover_code;
  return (await as(db, U.livreur, () => one<{ r: string }>('select fn_parcel_handover_proof($1, $2, $3, $4) r', [parcel, 'code', code, `${U.livreur}/${parcel}/preuve.jpg`]))).r;
}
/** Chaque portefeuille : solde = somme de ses écritures au grand livre. */
const imbalanced = async () => n((await as(db, U.admin, () => one<{ fn_hailandpay_overview: { imbalanced: number } }>('select fn_hailandpay_overview()'))).fn_hailandpay_overview.imbalanced);

beforeAll(async () => {
  db = await freshDb();
  await db.exec(`update auth.users set phone = '224620000001' where id = '${U.acheteur}'; update auth.users set phone = '224620000002' where id = '${U.acheteur2}'; update auth.users set phone = '224620000009' where id = '${U.vendeur}'`);
  await db.exec(`insert into profiles (id, full_name) values ('${U.acheteur}', 'Aïssatou Diallo'), ('${U.acheteur2}', 'Mariama Bah Barry')`);
  const decl = async (u: string, p: { lng: number; lat: number }) => (await one<{ id: string }>(`insert into declarations (user_id, gps_point, quartier_id, gps_accuracy_m) values ($1, point($2, $3), 'qtr-coleah', 5) returning id`, [u, p.lng, p.lat])).id;
  const d = await decl(U.vendeur, SELLER); buyerDecl = await decl(U.acheteur, BUYER);
  await db.exec(`insert into buildings (id, status, is_validated) values ('b-1', 'actif', true); update declarations set certified_building_id = 'b-1' where id = '${d}'`);
  shop = (await as(db, U.vendeur, () => one<{ id: string }>(`insert into shops (slug, name, owner_id, declaration_id) values ('kadi-wax', 'Kadi Wax', $1, $2) returning id`, [U.vendeur, d]))).id;
  await as(db, U.vendeur, () => db.query('select fn_shop_open($1)', [shop]));
  const prod = (await as(db, U.vendeur, () => one<{ id: string }>(`insert into catalog_products (slug, name, created_by) values ('pagne', 'Pagne wax', $1) returning id`, [U.vendeur]))).id;
  offer = (await as(db, U.vendeur, () => one<{ id: string }>(`insert into offers (shop_id, product_id, price_gnf) values ($1, $2, 400000) returning id`, [shop, prod]))).id;
  variant = (await as(db, U.vendeur, () => one<{ id: string }>(`insert into offer_variants (offer_id, label, stock) values ($1, 'Bleu', 50) returning id`, [offer]))).id;
  await db.exec(`insert into couriers (user_id, full_name, status, available) values ('${U.livreur}', 'Livreur Test', 'valide', true)`);
}, 60000);


/** Payé en ligne (Chap Chap Pay/Djomy) : le serveur confirme le paiement. */
async function payOnline(o: string, total: number) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '', false); select set_config('request.jwt.claims', '{"role":"service_role"}', false)`);
  try { await db.query(`select fn_payment_confirm($1, 'TX', $2)`, [o, total]); } finally { await db.exec(`reset role; select set_config('request.jwt.claims', '', false)`); }
}
const ledger = async (parcel: string) => Object.fromEntries((await db.query<{ k: string; a: number }>(`select account || ':' || kind k, sum(amount_gnf)::int a from ledger_entries where parcel_id = $1 group by 1`, [parcel])).rows.map((r) => [r.k, r.a]));
const summary = async (who: string, s: string | null) => as(db, who, () => one<{ balance_gnf: number; payable_gnf: number; waiting_gnf: number; method: string | null; account_number: string | null; usable_from: string | null }>('select * from fn_my_payout_summary($1)', [s]));
const age = () => db.exec(`update ledger_entries set created_at = now() - interval '3 days'`); // toutes les remises ont plus de 48 h


type Balance = { balance_gnf: number; payable_gnf: number; waiting_gnf: number; pending_gnf: number; withdrawable_gnf: number; next_release_at: string | null; next_release_gnf: number | null; min_gnf: number; method: string | null };
const balance = async () => as(db, U.vendeur, () => one<Balance>('select * from fn_my_balance($1)', [shop]));
const ask = (amount: number) => as(db, U.vendeur, () => one<{ id: string }>('select fn_withdraw_request($1, $2) id', [shop, amount]));

describe('retraits à la demande (§62)', () => {
  it('solde, disponible après 48 h, en attente avec sa date de déblocage', async () => {
    await db.exec(`insert into agents (id, full_name, role) values ('${U.admin}', 'Équipe', 'admin') on conflict (id) do nothing`);
    const p = await order('orange_money');
    await payOnline(p.o, p.total);
    expect(await deliver(p.id)).toBe('remis');
    const b = await balance();
    expect(b.balance_gnf).toBeGreaterThan(0);
    expect(b.payable_gnf).toBe(0);
    expect(b.waiting_gnf).toBe(b.balance_gnf);
    expect(b.min_gnf).toBe(10000);
    expect(new Date(b.next_release_at!).getTime()).toBeGreaterThan(Date.now() + 47 * 3600e3);
    expect(b.next_release_gnf).toBe(b.balance_gnf);
    expect(await as(db, U.acheteur, () => refused(db.query('select * from fn_my_balance($1)', [shop])))).toMatch(/propriétaire/);
  });

  it('refuse sans moyen de versement, sous le minimum, au-delà du disponible', async () => {
    expect(await as(db, U.vendeur, () => refused(db.query('select fn_withdraw_request($1, 20000)', [shop])))).toMatch(/où recevoir/);
    await as(db, U.vendeur, () => db.query(`select fn_payout_method_set($1, 'orange_money', '620 00 00 09', 'Kadiatou Barry')`, [shop]));
    expect(await as(db, U.vendeur, () => refused(db.query('select fn_withdraw_request($1, 20000)', [shop])))).toMatch(/supérieur à votre disponible/);
    await age();
    const b = await balance();
    expect(b.withdrawable_gnf).toBe(b.balance_gnf);
    expect(await as(db, U.vendeur, () => refused(db.query('select fn_withdraw_request($1, 9000)', [shop])))).toMatch(/minimum est de 10/);
    expect(await as(db, U.vendeur, () => refused(db.query('select fn_withdraw_request($1, $2)', [shop, b.withdrawable_gnf + 1])))).toMatch(/supérieur/);
    expect(await as(db, U.acheteur, () => refused(db.query('select fn_withdraw_request($1, 20000)', [shop])))).toMatch(/propriétaire/);
  });

  it('une demande à la fois ; elle réserve l’argent ; annulable', async () => {
    const r = await ask(50000);
    expect((await balance()).pending_gnf).toBe(50000);
    expect(await as(db, U.vendeur, () => refused(db.query('select fn_withdraw_request($1, 10000)', [shop])))).toMatch(/déjà en cours/);
    expect((await one<{ n: number }>(`select count(*)::int n from notifications where title = 'Demande de retrait'`)).n).toBeGreaterThan(0);
    await as(db, U.vendeur, () => db.query('select fn_withdraw_cancel($1)', [r.id]));
    expect((await balance()).pending_gnf).toBe(0);
    expect(await as(db, U.vendeur, () => refused(db.query('select fn_withdraw_cancel($1)', [r.id])))).toMatch(/déjà traitée/);
  });

  it('l’équipe envoie : versement au grand livre, solde diminué, vendeur prévenu ; ou refuse avec un motif', async () => {
    const before = await balance();
    const r = await ask(60000);
    expect(await as(db, U.vendeur, () => refused(db.query('select * from fn_withdraw_requests()')))).toMatch(/équipe/);
    const list = (await as(db, U.admin, () => db.query<{ id: string; amount_gnf: number; account_number: string }>('select * from fn_withdraw_requests()'))).rows;
    expect(list).toHaveLength(1); expect(list[0]!.amount_gnf).toBe(60000); expect(list[0]!.account_number).toBe('224620000009');
    await as(db, U.admin, () => db.query(`select fn_withdraw_done($1, 'CCP-42')`, [r.id]));
    const after = await balance();
    expect(after.balance_gnf).toBe(before.balance_gnf - 60000);
    expect(after.pending_gnf).toBe(0);
    expect(await as(db, U.vendeur, () => one('select status, (payout_id is not null) payee from payout_requests where id = $1', [r.id]))).toEqual({ status: 'envoye', payee: true });
    expect((await one<{ n: number }>(`select count(*)::int n from notifications where title = 'Versement envoyé'`)).n).toBeGreaterThan(0);
    expect(await as(db, U.admin, () => refused(db.query('select fn_withdraw_done($1)', [r.id])))).toMatch(/déjà traitée/);
    const r2 = await ask(10000);
    expect(await as(db, U.admin, () => refused(db.query(`select fn_withdraw_refuse($1, '')`, [r2.id])))).toMatch(/motif/);
    await as(db, U.admin, () => db.query(`select fn_withdraw_refuse($1, 'Numéro Orange Money injoignable')`, [r2.id]));
    expect((await balance()).pending_gnf).toBe(0);
    expect(await as(db, U.acheteur, () => db.query('select * from payout_requests'))).toMatchObject({ rows: [] });
  });
});
