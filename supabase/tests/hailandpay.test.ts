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

describe('portefeuille et recharge de test', () => {
  it('le portefeuille est créé à la première visite, vide ; personne ne peut l’écrire directement', async () => {
    expect(await me(U.acheteur)).toMatchObject({ balance: 0, topped_up: 0, topup_cap: 50000000, held: 0, shops: [] });
    expect(await as(db, U.acheteur, () => refused(db.query('update wallets set balance = 999999999')))).toMatch(/permission denied/);
    expect(await as(db, U.acheteur, () => refused(db.query(`insert into wallet_movements (wallet_id, kind, amount, balance_after) select id, 'recharge_test', 5, 5 from wallets`)))).toMatch(/permission denied/);
  });
  it('recharge libre jusqu’à 50 000 000 Syli cumulés, puis refusée', async () => {
    await as(db, U.acheteur, () => db.query('select fn_wallet_topup($1)', [30000000]));
    await as(db, U.acheteur, () => db.query('select fn_wallet_topup($1)', [20000000]));
    expect(await bal(U.acheteur)).toBe(50000000);
    expect(await as(db, U.acheteur, () => refused(db.query('select fn_wallet_topup($1)', [1])))).toMatch(/plafond de recharge de test atteint/);
    expect(await as(db, U.acheteur, () => refused(db.query('select fn_wallet_topup($1)', [-5])))).toMatch(/montant invalide/);
  });
});

describe('envoi entre comptes', () => {
  it('nom masqué avant l’envoi ; envoi immédiat, sans frais ; le destinataire est prévenu', async () => {
    expect(await as(db, U.acheteur, () => one('select * from fn_wallet_lookup($1)', ['620 00 00 02']))).toEqual({ label: 'Mariama B.', phone_masked: '6•• •• 02' });
    expect(await as(db, U.acheteur, () => refused(db.query('select * from fn_wallet_lookup($1)', ['620 00 00 01'])))).toMatch(/propre numéro/);
    expect(await as(db, U.acheteur, () => refused(db.query('select * from fn_wallet_lookup($1)', ['620 55 55 55'])))).toMatch(/aucun compte/);
    await as(db, U.acheteur, () => db.query('select fn_wallet_transfer($1, $2, $3)', ['620 00 00 02', 250000, 'Pour le tissu']));
    expect(await bal(U.acheteur)).toBe(49750000);
    expect(await bal(U.acheteur2)).toBe(250000);
    const recu = await as(db, U.acheteur2, () => one<{ title: string; body: string; link: string }>(`select title, body, link from notifications where kind = 'paiement'`));
    expect(recu).toEqual({ title: 'Vous avez reçu 250 000 Syli', body: 'Aïssatou D. : « Pour le tissu » (argent de test HailandPay)', link: '/compte/hailandpay' });
    const hist = await as(db, U.acheteur2, () => q<{ kind: string; amount: string; counterparty_label: string }>('select kind, amount::int amount, counterparty_label from wallet_movements'));
    expect(hist).toEqual([{ kind: 'reception', amount: 250000, counterparty_label: 'Aïssatou D. · 6•• •• 01' }]);
  });
  it('solde insuffisant : refusé, rien ne bouge ; chacun ne lit que son historique', async () => {
    expect(await as(db, U.acheteur2, () => refused(db.query('select fn_wallet_transfer($1, $2)', ['620 00 00 01', 300000])))).toMatch(/solde HailandPay insuffisant/);
    expect(await bal(U.acheteur2)).toBe(250000);
    expect(await as(db, U.acheteur2, () => q('select 1 from wallet_movements'))).toHaveLength(1);
    expect(await as(db, U.vendeur2, () => q('select 1 from wallets'))).toHaveLength(0);
  });
});

let paid: Awaited<ReturnType<typeof order>>;
describe('payer une commande avec HailandPay', () => {
  it('le portefeuille est débité, l’argent est bloqué ; rien à encaisser pour le livreur', async () => {
    paid = await order('hailandpay');
    expect(paid.cod_amount_gnf).toBe(0);
    expect(await bal(U.acheteur)).toBe(49750000 - paid.total);
    expect(n((await me(U.acheteur)).held)).toBe(paid.total);
    expect(await one('select payment_method, payment_status from orders where id = $1', [paid.o])).toEqual({ payment_method: 'hailandpay', payment_status: 'bloque' });
    expect(await one('select provider, status from payments where order_id = $1', [paid.o])).toEqual({ provider: 'hailandpay', status: 'paye' });
  });
  it('à la remise : la boutique et le livreur sont payés dans leur portefeuille ; aucune espèce', async () => {
    expect(await deliver(paid.id)).toBe('remis');
    const net = paid.subtotal_gnf - Math.round(paid.subtotal_gnf * 0.08);
    const gain = Math.round(paid.delivery_fee_gnf * 0.8);
    expect(await shopBal()).toBe(net);
    expect(await bal(U.livreur)).toBe(gain);
    expect((await one<{ cash_balance_gnf: number }>('select cash_balance_gnf from couriers where user_id = $1', [U.livreur])).cash_balance_gnf).toBe(0);
    // Plus rien à verser à la main : le compte « shop » du grand livre retombe à 0.
    expect(n((await one<{ s: string }>(`select coalesce(sum(amount_gnf), 0) s from ledger_entries where account = 'shop' and account_id = $1`, [shop])).s)).toBe(0);
    expect(n((await me(U.acheteur)).held)).toBe(0);
    const owner = await me(U.vendeur);
    expect(owner.shops).toEqual([expect.objectContaining({ name: 'Kadi Wax', balance: net, pending: 0 })]);
    expect(await imbalanced()).toBe(0);
  });
  it('solde insuffisant : la commande est refusée en entier (rien n’est créé)', async () => {
    const before = n((await one<{ c: string }>('select count(*) c from orders')).c);
    expect(await as(db, U.acheteur2, () => refused(db.query('select fn_place_order($1::jsonb, $2, $3, $4)', [JSON.stringify([{ offer_id: offer, variant_id: variant, qty: 1 }]), buyerDecl, '+224 620 00 00 02', 'hailandpay'])))).toMatch(/introuvable|insuffisant/);
    expect(n((await one<{ c: string }>('select count(*) c from orders')).c)).toBe(before);
  });
});

describe('annulations et litiges : retour immédiat dans le portefeuille', () => {
  it('annulée avant la remise : tout revient à l’acheteur, frais compris', async () => {
    const before = await bal(U.acheteur);
    const o = await order('hailandpay');
    expect(await bal(U.acheteur)).toBe(before - o.total);
    await as(db, U.acheteur, () => db.query('select fn_parcel_cancel($1)', [o.id]));
    expect(await bal(U.acheteur)).toBe(before);
    expect(await imbalanced()).toBe(0);
  });
  it('litige remboursé en partie : l’acheteur reçoit le montant, la boutique le rend (moins la commission)', async () => {
    const o = await order('hailandpay', 2);
    expect(await deliver(o.id)).toBe('remis');
    const shopBefore = await shopBal(); const buyerBefore = await bal(U.acheteur);
    const d = (await as(db, U.acheteur, () => one<{ fn_open_dispute: string }>('select fn_open_dispute($1, $2)', [o.id, 'endommage']))).fn_open_dispute;
    await as(db, U.admin, () => db.query('select fn_resolve_dispute($1, $2, $3, $4)', [d, 'acheteur', 'un pagne abîmé', 100000]));
    expect(await bal(U.acheteur)).toBe(buyerBefore + 100000);
    expect(await shopBal()).toBe(shopBefore - 92000);
    expect(await imbalanced()).toBe(0);
  });
});

describe('boutique, retrait, équipe', () => {
  it('le propriétaire passe l’argent de la boutique vers son portefeuille, puis retire (simulé)', async () => {
    const s = await shopBal();
    expect(await as(db, U.vendeur2, () => refused(db.query('select fn_shop_wallet_to_owner($1, $2)', [shop, 1000])))).toMatch(/propriétaire/);
    await as(db, U.vendeur, () => db.query('select fn_shop_wallet_to_owner($1, $2)', [shop, 300000]));
    expect(await shopBal()).toBe(s - 300000);
    expect(await bal(U.vendeur)).toBe(300000);
    await as(db, U.vendeur, () => db.query('select fn_wallet_withdraw($1, $2, $3)', [100000, 'orange_money', '620 00 00 09']));
    expect(await bal(U.vendeur)).toBe(200000);
    const last = await as(db, U.vendeur, () => one<{ kind: string; note: string }>('select kind, note from wallet_movements order by id desc limit 1'));
    expect(last).toEqual({ kind: 'retrait', note: 'Retrait simulé vers Orange Money · 0009' });
  });
  it('l’équipe crédite et débite avec un motif inscrit au journal ; un compte ordinaire ne le peut pas', async () => {
    expect(await as(db, U.acheteur2, () => refused(db.query('select fn_wallet_admin_adjust($1, $2, $3)', [1000, 'essai', '620 00 00 02'])))).toMatch(/équipe/);
    expect(await as(db, U.admin, () => refused(db.query('select fn_wallet_admin_adjust($1, $2, $3)', [1000, '', '620 00 00 02'])))).toMatch(/motif/);
    await as(db, U.admin, () => db.query('select fn_wallet_admin_adjust($1, $2, $3)', [5000000, 'Essai de la boutique', '620 00 00 02']));
    expect(await bal(U.acheteur2)).toBe(5250000);
    await as(db, U.admin, () => db.query('select fn_wallet_admin_adjust($1, $2, $3, $4)', [-50000, 'Correction', null, shop]));
    const j = await q<{ action: string; motif: string }>(`select action, motif from console_journal where action like 'hailandpay%' order by id`);
    expect(j).toEqual([{ action: 'hailandpay_credit', motif: 'Essai de la boutique' }, { action: 'hailandpay_debit', motif: 'Correction' }]);
  });
  it('la Console voit la masse de Syli et l’équilibre ; un compte ordinaire non', async () => {
    const o = (await as(db, U.admin, () => one<{ fn_hailandpay_overview: Record<string, number> }>('select fn_hailandpay_overview()'))).fn_hailandpay_overview;
    expect(o).toMatchObject({ topups: 50000000, credits: 5000000, debits: 50000, withdrawals: 100000, imbalanced: 0, held: 0 });
    expect(n(o.in_wallets)).toBe(await bal(U.acheteur) + await bal(U.acheteur2) + await bal(U.vendeur) + await bal(U.livreur) + await shopBal());
    expect(await as(db, U.acheteur, () => refused(db.query('select fn_hailandpay_overview()')))).toMatch(/équipe/);
  });
});
