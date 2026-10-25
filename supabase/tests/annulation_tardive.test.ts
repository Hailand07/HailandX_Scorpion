import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { as, freshDb, refused, U } from './harness';

/** Annulation tardive (HAILANDX.md §45) : après le départ du livreur, l'acheteur est remboursé moins ce que l'annulation a coûté au livreur et à Hailand. */
let db: PGlite;
const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;
const one = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await q<T>(sql, params))[0]!;
let buyerDecl: string; let offer: string; let variant: string;

async function server<T>(fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '', false); select set_config('request.jwt.claims', '{"role":"service_role"}', false)`);
  try { return await fn(); } finally { await db.exec(`reset role; select set_config('request.jwt.claims', '', false)`); }
}
const place = async (payment: string) => (await as(db, U.acheteur, () => one<{ id: string }>('select fn_place_order($1::jsonb, $2, $3, $4) id', [JSON.stringify([{ offer_id: offer, variant_id: variant, qty: 1 }]), buyerDecl, '+224 620 00 00 00', payment]))).id;
const parcelOf = async (o: string) => one<{ id: string; delivery_fee_gnf: number; subtotal_gnf: number }>('select id, delivery_fee_gnf, subtotal_gnf from parcels where order_id = $1', [o]);
/** Commande payée, puis amenée au stade voulu (accepte = livreur parti vers la boutique, retire = colis en route). */
async function upTo(o: string, stage: 'mission_proposee' | 'accepte' | 'retire') {
  const p = await parcelOf(o);
  await as(db, U.vendeur, () => db.query('select fn_parcel_ready($1)', [p.id]));
  if (stage === 'mission_proposee') return p;
  await as(db, U.livreur, () => db.query('select fn_courier_accept($1)', [p.id]));
  if (stage === 'accepte') return p;
  const qr = (await as(db, U.vendeur, () => one<{ fn_parcel_qr: string }>('select fn_parcel_qr($1)', [p.id]))).fn_parcel_qr;
  await as(db, U.livreur, () => db.query('select fn_parcel_pickup($1)', [qr]));
  return p;
}
const ledger = async (parcel: string) => Object.fromEntries((await q<{ k: string; a: number }>(`select account || ':' || kind k, sum(amount_gnf)::int a from ledger_entries where parcel_id = $1 group by 1`, [parcel])).map((r) => [r.k, r.a]));
const wallet = async (u: string) => Number((await one<{ balance: string }>('select balance from wallets where user_id = $1', [u])).balance);
const quote = async (parcel: string) => as(db, U.acheteur, () => one<{ status: string; courier_gnf: number; provider_gnf: number; refund_gnf: number; prepaid: boolean; cash_suspended_until: string | null }>('select * from fn_parcel_cancel_quote($1)', [parcel]));
const cancel = (who: string, parcel: string, reason: string | null = null) => as(db, who, () => db.query('select fn_parcel_cancel($1, $2)', [parcel, reason]));

beforeAll(async () => {
  db = await freshDb();
  const decl = async (u: string, lng: number, lat: number) => (await one<{ id: string }>(`insert into declarations (user_id, gps_point, quartier_id, gps_accuracy_m) values ($1, point($2, $3), 'qtr-coleah', 5) returning id`, [u, lng, lat])).id;
  // boutique au rond-point T8, acheteur à Samatran Plateau (2,88 km)
  const d = await decl(U.vendeur, -13.543619, 9.677143); buyerDecl = await decl(U.acheteur, -13.5643684, 9.692995);
  await db.exec(`insert into buildings (id, status, is_validated) values ('b-1', 'actif', true); update declarations set certified_building_id = 'b-1' where id = '${d}'`);
  const shop = (await as(db, U.vendeur, () => one<{ id: string }>(`insert into shops (slug, name, owner_id, declaration_id) values ('t8-shop', 'T8 Shop', $1, $2) returning id`, [U.vendeur, d]))).id;
  await as(db, U.vendeur, () => db.query('select fn_shop_open($1)', [shop]));
  const prod = await as(db, U.vendeur, () => one<{ id: string }>(`insert into catalog_products (slug, name, created_by) values ('riz', 'Riz', $1) returning id`, [U.vendeur]));
  offer = (await as(db, U.vendeur, () => one<{ id: string }>(`insert into offers (shop_id, product_id, price_gnf) values ($1, $2, 55000) returning id`, [shop, prod.id]))).id;
  variant = (await as(db, U.vendeur, () => one<{ id: string }>(`insert into offer_variants (offer_id, label, stock) values ($1, 'Sac 25 kg', 50) returning id`, [offer]))).id;
  await db.exec(`insert into couriers (user_id, full_name, status, available) values ('${U.livreur}', 'Livreur Test', 'valide', true)`);
  // grille du fondateur : 4 500 + 1 500/km, minimum 6 000 → T8 → Samatran = 9 000
  await db.exec(`update settings set value = '4500' where key = 'delivery_base_gnf'; update settings set value = '1500' where key = 'delivery_per_km_gnf'; update settings set value = '6000' where key = 'delivery_min_gnf'; update settings set value = 'chapchappay' where key = 'payment_mode'`);
  await as(db, U.acheteur, () => db.query('select fn_wallet_topup($1)', [5000000]));
}, 60000);

describe('annulation par l’acheteur selon le stade', () => {
  it('avant qu’un livreur accepte : gratuit, tout est rendu', async () => {
    const o = await place('hailandpay');
    const p = await upTo(o, 'mission_proposee');
    expect(p.delivery_fee_gnf).toBe(9000);
    expect(await quote(p.id)).toMatchObject({ courier_gnf: 0, provider_gnf: 0, refund_gnf: 64000, prepaid: true });
    const before = await wallet(U.acheteur);
    await cancel(U.acheteur, p.id);
    expect(await wallet(U.acheteur)).toBe(before + 64000);
  });

  it('livreur parti vers la boutique (HailandPay) : la moitié des frais de livraison va au livreur, le reste est rendu', async () => {
    const o = await place('hailandpay');
    const p = await upTo(o, 'accepte');
    expect(await quote(p.id)).toMatchObject({ status: 'accepte', courier_gnf: 4500, provider_gnf: 0, refund_gnf: 59500 });
    const [b, c] = [await wallet(U.acheteur), await wallet(U.livreur).catch(() => 0)];
    await cancel(U.acheteur, p.id);
    expect(await wallet(U.acheteur)).toBe(b + 59500);
    expect(await wallet(U.livreur)).toBe(c + 4500);
    expect(await ledger(p.id)).toMatchObject({ 'escrow:remboursement_escrow': -64000, 'buyer:remboursement': 59500, 'courier:gain_livreur': 4500 });
    expect((await ledger(p.id))['platform:commission']).toBeUndefined(); // aucune commission sur un colis annulé
  });

  it('colis en route, payé par Chap Chap Pay : tous les frais de livraison au livreur + les frais réels de paiement, colis à rapporter', async () => {
    const o = await place('orange_money');
    const total = (await one<{ total_gnf: number }>('select total_gnf from orders where id = $1', [o])).total_gnf;
    await as(db, U.acheteur, () => db.query('select * from fn_pay_start($1)', [o]));
    await server(() => db.query(`select fn_pay_attach($1, 'op-9', 'https://chapchappay.com/pay/op-9', true)`, [o]));
    await server(() => db.query(`select fn_pay_provider_status($1, 'success', 'orange_money')`, [o]));
    await server(() => db.query(`select fn_payment_confirm($1, 'TXN-9', $2)`, [o, total]));
    const p = await upTo(o, 'retire');
    // 2 % de 64 000 = 1 280 + 200 → 1 480 ; livreur : 9 000
    expect(await quote(p.id)).toMatchObject({ status: 'retire', courier_gnf: 9000, provider_gnf: 1480, refund_gnf: 53520 });
    await cancel(U.acheteur, p.id);
    expect(await ledger(p.id)).toMatchObject({ 'escrow:remboursement_escrow': -64000, 'buyer:remboursement': 53520, 'courier:gain_livreur': 9000, 'platform:frais_paiement_annulation': 1480 });
    expect(await one('select refunded_gnf, status from payments where order_id = $1', [o])).toEqual({ refunded_gnf: 53520, status: 'rembourse' });
    // le livreur doit rapporter le colis : il le voit, le confirme, la boutique est prévenue
    const r = await as(db, U.livreur, () => q<{ parcel_id: string; courier_gnf: number }>('select parcel_id, courier_gnf from fn_my_returns()'));
    expect(r).toEqual([{ parcel_id: p.id, courier_gnf: 9000 }]);
    expect(await as(db, U.acheteur, () => refused(db.query('select fn_parcel_returned($1)', [p.id])))).toMatch(/aucun retour/);
    expect((await as(db, U.livreur, () => one<{ r: string }>('select fn_parcel_returned($1) r', [p.id]))).r).toBe('rendu');
    expect(await as(db, U.livreur, () => q('select * from fn_my_returns()'))).toEqual([]);
    expect((await one<{ n: number }>(`select count(*)::int n from notifications where user_id = $1 and title = 'Mission annulée'`, [U.livreur])).n).toBeGreaterThan(0);
  });

  it('commande en espèces : rien à retenir, Hailand paie le livreur, et le paiement à la livraison est suspendu 30 jours', async () => {
    const o = await place('livraison');
    const p = await upTo(o, 'accepte');
    const qt = await quote(p.id);
    expect(qt).toMatchObject({ courier_gnf: 4500, refund_gnf: 0, prepaid: false });
    expect(qt.cash_suspended_until).not.toBeNull();
    await cancel(U.acheteur, p.id);
    expect(await ledger(p.id)).toEqual({ 'courier:gain_livreur': 4500, 'platform:indemnite_livreur': -4500 });
    expect(await as(db, U.acheteur, () => refused(place('livraison')))).toMatch(/paiement à la livraison indisponible jusqu'au/);
    await place('hailandpay'); // les autres moyens restent ouverts
  });
});

describe('annulation par la boutique ou l’équipe', () => {
  it('la boutique annule après l’acceptation : l’acheteur est remboursé en entier, l’indemnité du livreur est reprise à la boutique', async () => {
    const o = await place('hailandpay');
    const p = await upTo(o, 'accepte');
    await cancel(U.vendeur, p.id, 'Rupture de stock');
    expect(await ledger(p.id)).toMatchObject({ 'buyer:remboursement': 64000, 'courier:gain_livreur': 4500, 'shop:annulation_vendeur': -4500 });
  });
  it('l’acheteur ne peut plus annuler après la remise ; les taux d’indemnité se règlent dans la Console', async () => {
    expect(await as(db, U.admin, () => refused(db.query(`select fn_console_setting_update('cancel_fee_accepte_bps', '20000', 'essai')`)))).toMatch(/hors limites|fondateur/);
    await db.exec(`insert into agents (id, full_name, role) values ('${U.admin}', 'Fondateur', 'admin') on conflict (id) do nothing; update agents set console_role = 'fondateur' where id = '${U.admin}'`);
    await as(db, U.admin, () => db.query(`select fn_console_setting_update('cancel_fee_accepte_bps', '3000', 'essai')`));
    const o = await place('hailandpay');
    const p = await upTo(o, 'accepte');
    expect((await quote(p.id)).courier_gnf).toBe(2700);
  });
});
