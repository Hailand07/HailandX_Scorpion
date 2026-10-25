import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { as, freshDb, refused, U } from './harness';

/** Paiement en ligne par Chap Chap Pay (HAILANDX.md §43) : modes, lien de paiement, statuts, confirmation par le serveur. */
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

describe('modes de paiement en ligne', () => {
  it('le fondateur choisit simulation, chapchappay_test ou chapchappay ; « orange_money » n’est plus accepté', async () => {
    await db.exec(`insert into agents (id, full_name, role) values ('${U.admin}', 'Fondateur', 'admin') on conflict (id) do nothing`);
    const founder = await q<{ id: string }>(`select id from agents where id = '${U.admin}'`);
    expect(founder).toHaveLength(1);
    const res = await as(db, U.admin, () => refused(db.query(`select fn_console_setting_update('payment_mode', 'orange_money', 'essai')`)));
    expect(res).toMatch(/inconnu|fondateur/);
  });
  it('en mode chapchappay_test, seul l’équipe démarre un paiement ; le paiement est noté « test »', async () => {
    await setMode('chapchappay_test');
    const o = await order();
    expect(await as(db, U.acheteur, () => refused(db.query('select * from fn_pay_start($1)', [o])))).toMatch(/essai : réservé à l'équipe/);
    await setMode('chapchappay');
    const r = await as(db, U.acheteur, () => one<{ provider: string; amount_gnf: number }>('select * from fn_pay_start($1)', [o]));
    expect(r.provider).toBe('chapchappay');
    expect((await one<{ provider_test: boolean }>('select provider_test from payments where order_id = $1', [o])).provider_test).toBe(false);
  });
});

describe('lien de paiement, statuts et confirmation', () => {
  let o: string;
  it('seul le serveur enregistre le lien de paiement et les statuts', async () => {
    o = await order();
    await as(db, U.acheteur, () => db.query('select * from fn_pay_start($1)', [o]));
    for (const who of [U.acheteur, U.admin]) {
      expect(await as(db, who, () => refused(db.query(`select fn_pay_attach($1, 'op-1', 'https://chapchappay.com/pay/op-1', true)`, [o])))).toMatch(/permission denied|réservé au serveur/);
    }
    await server(() => db.query(`select fn_pay_attach($1, 'op-1', 'https://chapchappay.com/pay/op-1', true)`, [o]));
    const p = await one('select operation_id, checkout_url, provider_status, provider_test from payments where order_id = $1', [o]);
    expect(p).toEqual({ operation_id: 'op-1', checkout_url: 'https://chapchappay.com/pay/op-1', provider_status: 'new', provider_test: true });
  });
  it('un échec ou une annulation ne clôt rien (le client peut réessayer) ; un lien expiré est oublié', async () => {
    await server(() => db.query(`select fn_pay_provider_status($1, 'failed', 'orange_money')`, [o]));
    expect((await one<{ payment_status: string }>('select payment_status from orders where id = $1', [o])).payment_status).toBe('en_attente');
    expect(await server(() => refused(db.query(`select fn_pay_provider_status($1, 'bizarre')`, [o])))).toMatch(/statut inconnu/);
    await server(() => db.query(`select fn_pay_provider_status($1, 'expired')`, [o]));
    expect(await one('select operation_id, checkout_url, provider_status from payments where order_id = $1', [o])).toEqual({ operation_id: null, checkout_url: null, provider_status: 'expired' });
    await server(() => db.query(`select fn_pay_attach($1, 'op-2', 'https://chapchappay.com/pay/op-2', true)`, [o]));
  });
  it('« success » : le serveur confirme avec le bon montant → argent bloqué, une seule fois', async () => {
    const t = await total(o);
    expect(await server(() => refused(db.query(`select fn_payment_confirm($1, 'TXN-1', $2)`, [o, t - 1])))).toMatch(/montant incorrect/);
    await server(() => db.query(`select fn_pay_provider_status($1, 'success', 'mtn_momo')`, [o]));
    await server(() => db.query(`select fn_payment_confirm($1, 'TXN-1', $2)`, [o, t]));
    expect((await one<{ payment_status: string }>('select payment_status from orders where id = $1', [o])).payment_status).toBe('bloque');
    expect(await one('select status, provider, provider_ref, provider_status, provider_method from payments where order_id = $1', [o]))
      .toEqual({ status: 'paye', provider: 'chapchappay', provider_ref: 'TXN-1', provider_status: 'success', provider_method: 'mtn_momo' });
    expect(await server(() => refused(db.query(`select fn_payment_confirm($1, 'TXN-1', $2)`, [o, t])))).toMatch(/déjà payée/);
    // une notification tardive « canceled » ne touche plus un paiement réglé
    await server(() => db.query(`select fn_pay_provider_status($1, 'canceled')`, [o]));
    expect((await one<{ provider_status: string }>('select provider_status from payments where order_id = $1', [o])).provider_status).toBe('success');
    expect(await q(`select 1 from ledger_entries where order_id = $1 and kind = 'paiement'`, [o])).toHaveLength(1);
  });
});

describe('annulation automatique des commandes en ligne impayées (72 h)', () => {
  const run = async () => Number((await one<{ n: number }>('select private.expire_unpaid_online_orders(72) n')).n);
  const stock = async () => Number((await one<{ stock: number }>('select stock from offer_variants where id = $1', [variantId])).stock);
  const age = (o: string, h: number) => db.exec(`update orders set created_at = now() - interval '${h} hours' where id = '${o}'`);
  const status = async (o: string) => (await q<{ status: string }>('select status from parcels where order_id = $1', [o])).map((r) => r.status);

  it('après 72 h sans paiement : colis annulés, stock rendu, acheteur prévenu ; avant 72 h : rien', async () => {
    await setMode('chapchappay');
    const young = await order(); const old = await order();
    await age(young, 10); await age(old, 80);
    const s0 = await stock();
    expect(await run()).toBe(1);
    expect(await status(old)).toEqual(['annule']);
    expect(await status(young)).toEqual(['attente_vendeur']);
    expect(await stock()).toBe(s0 + 1);
    const p = await one<{ cancelled_by: string; cancel_reason: string }>('select cancelled_by, cancel_reason from parcels where order_id = $1', [old]);
    expect(p.cancelled_by).toBe('equipe');
    expect(p.cancel_reason).toMatch(/Paiement non reçu dans les 72 h/);
    expect(await q(`select 1 from notifications where title = 'Colis annulé' and link = $1`, [`/commandes/${old}`])).toHaveLength(1);
    expect(await run()).toBe(0); // une seule fois
    expect(await as(db, U.acheteur, () => refused(db.query('select * from fn_pay_start($1)', [old])))).toMatch(/annulée : rien à payer/);
  });

  it('un lien de paiement de moins de 73 h, ou une commande déjà payée, ne sont pas annulés', async () => {
    const o = await order();
    await as(db, U.acheteur, () => db.query('select * from fn_pay_start($1)', [o]));
    await server(() => db.query(`select fn_pay_attach($1, 'op-recent', 'https://chapchappay.com/pay/op-recent', false)`, [o]));
    await age(o, 80);
    expect(await run()).toBe(0);
    expect(await status(o)).toEqual(['attente_vendeur']);
    await db.exec(`update payments set updated_at = now() - interval '74 hours' where order_id = '${o}'`);
    expect(await run()).toBe(1);
    expect(await one('select operation_id, checkout_url from payments where order_id = $1', [o])).toEqual({ operation_id: null, checkout_url: null });
  });

  it('paiement arrivé après l’annulation : encaissé puis compté à rembourser, séquestre à zéro', async () => {
    const o = await order(); await age(o, 80); await run();
    const t = await total(o);
    await server(() => db.query(`select fn_payment_confirm($1, 'TXN-TARD', $2)`, [o, t]));
    expect((await one<{ payment_status: string }>('select payment_status from orders where id = $1', [o])).payment_status).toBe('rembourse');
    expect(Number((await one<{ s: string }>(`select coalesce(sum(amount_gnf), 0) s from ledger_entries where order_id = $1 and account = 'escrow'`, [o])).s)).toBe(0);
    expect(Number((await one<{ s: string }>(`select coalesce(sum(amount_gnf), 0) s from ledger_entries where order_id = $1 and account = 'buyer'`, [o])).s)).toBe(t);
    expect((await one<{ status: string }>('select status from payments where order_id = $1', [o])).status).toBe('rembourse');
  });
});
