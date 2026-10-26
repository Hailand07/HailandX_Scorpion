import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { as, freshDb, refused, U } from './harness';

/** HailandPay et le Syli, argent de test (HAILANDX.md §42). Chaque `it` reprend l'état du précédent. */
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

describe('moyens de versement (§48)', () => {
  it('le propriétaire enregistre son moyen ; numéro normalisé ; un changement attend 48 h et prévient', async () => {
    expect(await as(db, U.vendeur, () => refused(db.query(`select fn_payout_method_set($1, 'orange_money', '12', 'Kadi')`, [shop])))).toMatch(/numéro invalide/);
    expect(await as(db, U.acheteur, () => refused(db.query(`select fn_payout_method_set($1, 'orange_money', '620000009', 'Intrus')`, [shop])))).toMatch(/propriétaire/);
    await as(db, U.vendeur, () => db.query(`select fn_payout_method_set($1, 'orange_money', '+224 620 00 00 09', 'Kadiatou Barry')`, [shop]));
    let s = await summary(U.vendeur, shop);
    expect(s.method).toBe('orange_money'); expect(s.account_number).toBe('224620000009');
    expect(new Date(s.usable_from!).getTime()).toBeLessThanOrEqual(Date.now() + 1000);
    await as(db, U.vendeur, () => db.query(`select fn_payout_method_set($1, 'kulu', '620 11 11 11', 'Kadiatou Barry')`, [shop]));
    s = await summary(U.vendeur, shop);
    expect(s.method).toBe('kulu');
    expect(new Date(s.usable_from!).getTime()).toBeGreaterThan(Date.now() + 47 * 3600e3);
    expect((await one<{ n: number }>(`select count(*)::int n from notifications where title = 'Moyen de versement modifié'`)).n).toBeGreaterThan(0);
    expect(await as(db, U.livreur, () => refused(db.query(`select fn_payout_method_set(null, 'orange_money', '12', 'X')`)))).toMatch(/numéro invalide/);
    await as(db, U.livreur, () => db.query(`select fn_payout_method_set(null, 'mtn_momo', '660 00 00 01', 'Livreur Test')`));
    expect((await summary(U.livreur, null)).method).toBe('mtn_momo');
  });
});

describe('espèces : le livreur garde son gain (§48)', () => {
  it('il ne reverse que le montant encaissé moins son gain ; rien ne lui reste dû', async () => {
    const before = (await one<{ c: number }>('select cash_balance_gnf c from couriers where user_id = $1', [U.livreur])).c;
    const p = await order('livraison');
    expect(await deliver(p.id)).toBe('remis');
    const gain = Math.round(p.delivery_fee_gnf * 0.8); // réglage du banc : 80 %
    expect((await one<{ c: number }>('select cash_balance_gnf c from couriers where user_id = $1', [U.livreur])).c).toBe(before + p.total - gain);
    const l = await ledger(p.id);
    expect(l['courier:gain_livreur']).toBe(gain); expect(l['courier:gain_garde_especes']).toBe(-gain);
    expect(l['courier_cash:gain_garde_especes']).toBe(-gain);
  });
});

describe('versements de la semaine (§48)', () => {
  it('disponible 48 h après la remise ; l’équipe verse sur le moyen en vigueur, jamais plus que le disponible', async () => {
    const p = await order('orange_money');
    await payOnline(p.o, p.total);
    expect(await deliver(p.id)).toBe('remis');
    const net = p.subtotal_gnf - Math.round(p.subtotal_gnf * 0.08);
    let s = await summary(U.vendeur, shop);
    expect(s.waiting_gnf).toBeGreaterThanOrEqual(net);
    const due = async () => (await as(db, U.admin, () => db.query<{ kind: string; target_id: string; payable_gnf: number }>('select * from fn_payouts_due()'))).rows;
    await db.exec(`insert into agents (id, full_name, role) values ('${U.admin}', 'Équipe', 'admin') on conflict (id) do nothing`);
    expect(await as(db, U.vendeur, () => refused(db.query('select * from fn_payouts_due()')))).toMatch(/équipe/);
    // moyen changé il y a moins de 48 h : versement refusé
    expect(await as(db, U.admin, () => refused(db.query(`select fn_payout_record('boutique', $1, 1000)`, [shop])))).toMatch(/modifié récemment/);
    await db.exec(`update payout_methods set usable_from = now() - interval '1 hour'`);
    expect(await as(db, U.admin, () => refused(db.query(`select fn_payout_record('boutique', $1, $2)`, [shop, s.balance_gnf])))).toMatch(/supérieur au disponible/);
    await age();
    s = await summary(U.vendeur, shop);
    expect(s.payable_gnf).toBe(s.balance_gnf);
    const row = (await due()).find((r) => r.target_id === shop)!;
    expect(row.payable_gnf).toBe(s.balance_gnf);
    await as(db, U.admin, () => db.query(`select fn_payout_record('boutique', $1, $2, 'OM-123')`, [shop, s.payable_gnf]));
    expect((await summary(U.vendeur, shop)).balance_gnf).toBe(0);
    expect(await as(db, U.vendeur, () => one('select method, account_number, amount_gnf, provider_ref from payouts where shop_id = $1', [shop]))).toEqual({ method: 'kulu', account_number: '224620111111', amount_gnf: s.payable_gnf, provider_ref: 'OM-123' });
    // le livreur : gain d'une commande payée en ligne, versé sur son MTN
    const c = await summary(U.livreur, null);
    expect(c.payable_gnf).toBeGreaterThan(0);
    await as(db, U.admin, () => db.query(`select fn_payout_record('livreur', $1, $2)`, [U.livreur, c.payable_gnf]));
    expect((await summary(U.livreur, null)).payable_gnf).toBe(0);
    expect(await as(db, U.acheteur, () => db.query('select * from payouts'))).toMatchObject({ rows: [] });
  });
});
