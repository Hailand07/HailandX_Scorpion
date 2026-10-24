import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { as, freshDb, refused, U } from './harness';

/**
 * Paiement numérique : séquestre, règlement à la remise, remboursements, reversements. Chaque `it` reprend l'état du précédent.
 * Taux provisoires : commission 8 % sur les articles ; 80 % des frais de livraison au livreur.
 */
let db: PGlite;
const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;
const one = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await q<T>(sql, params))[0]!;
const sum = async (account: string, id?: string) => Number((await one<{ s: string }>(`select coalesce(sum(amount_gnf), 0) as s from ledger_entries where account = $1 and ($2::uuid is null or account_id = $2)`, [account, id ?? null])).s);

let shopId: string; let sellerDecl: string; let buyerDecl: string; let offerId: string; let variantId: string;
let orderA: string; let parcelA: string; let orderB: string; let parcelB: string; let orderC: string; let parcelC: string;

async function decl(user: string, lng: number, lat: number) {
  return (await one<{ id: string }>(`insert into declarations (user_id, gps_point, quartier_id, gps_accuracy_m) values ($1, point($2, $3), 'qtr-coleah', 5) returning id`, [user, lng, lat])).id;
}
const order = async (payment: 'livraison' | 'orange_money') => {
  const o = (await as(db, U.acheteur, () => one<{ fn_place_order: string }>('select fn_place_order($1::jsonb, $2, $3, $4)', [JSON.stringify([{ offer_id: offerId, variant_id: variantId, qty: 1 }]), buyerDecl, '+224 620 00 00 00', payment]))).fn_place_order;
  const p = await one<{ id: string; subtotal_gnf: number; delivery_fee_gnf: number }>('select id, subtotal_gnf, delivery_fee_gnf from parcels where order_id = $1', [o]);
  return { o, p: p.id, sub: p.subtotal_gnf, fee: p.delivery_fee_gnf };
};

beforeAll(async () => {
  db = await freshDb();
  sellerDecl = await decl(U.vendeur, -13.6775, 9.5307);
  buyerDecl = await decl(U.acheteur, -13.6775, 9.5672);
  await db.exec(`insert into buildings (id, status, is_validated) values ('b-1', 'actif', true); update declarations set certified_building_id = 'b-1' where id = '${sellerDecl}'`);
  shopId = (await as(db, U.vendeur, () => one<{ id: string }>(`insert into shops (slug, name, owner_id, declaration_id) values ('kadi-wax', 'Kadi Wax', $1, $2) returning id`, [U.vendeur, sellerDecl]))).id;
  await as(db, U.vendeur, () => db.query('select fn_shop_open($1)', [shopId]));
  await db.exec(`insert into couriers (user_id, full_name, status) values ('${U.livreur}', 'Livreur Test', 'valide')`);
  const prod = await as(db, U.vendeur, () => one<{ id: string }>(`insert into catalog_products (slug, name, created_by) values ('pagne', 'Pagne', $1) returning id`, [U.vendeur]));
  offerId = (await as(db, U.vendeur, () => one<{ id: string }>(`insert into offers (shop_id, product_id, price_gnf) values ($1, $2, 100000) returning id`, [shopId, prod.id]))).id;
  variantId = (await as(db, U.vendeur, () => one<{ id: string }>(`insert into offer_variants (offer_id, label, stock) values ($1, 'Standard', 20) returning id`, [offerId]))).id;
}, 60000);

describe('paiement d’avance : le colis attend l’argent', () => {
  it('une commande payée par Orange Money ne se prépare pas tant que l’argent n’est pas bloqué', async () => {
    const a = await order('orange_money'); orderA = a.o; parcelA = a.p;
    expect(await as(db, U.vendeur, () => refused(db.query('select fn_parcel_ready($1)', [parcelA])))).toMatch(/paiement en attente/);
    expect((await one<{ payment_status: string }>('select payment_status from orders where id = $1', [orderA])).payment_status).toBe('en_attente');
  });

  it('l’acheteur démarre le paiement (mode simulation par défaut) ; un autre compte ne le peut pas', async () => {
    expect(await as(db, U.acheteur2, () => refused(db.query('select * from fn_pay_start($1)', [orderA])))).toMatch(/introuvable/);
    const r = await as(db, U.acheteur, () => one<{ provider: string; amount_gnf: number }>('select * from fn_pay_start($1)', [orderA]));
    expect(r.provider).toBe('simulation');
    expect(r.amount_gnf).toBeGreaterThan(100000);
    // Relancer ne crée pas un second paiement.
    await as(db, U.acheteur, () => db.query('select * from fn_pay_start($1)', [orderA]));
    expect(await q('select 1 from payments where order_id = $1', [orderA])).toHaveLength(1);
  });

  it('seuls le serveur de paiement ou l’équipe confirment, avec le bon montant, une seule fois', async () => {
    const total = (await one<{ total_gnf: number }>('select total_gnf from orders where id = $1', [orderA])).total_gnf;
    for (const who of [U.acheteur, U.vendeur, U.livreur]) {
      expect(await as(db, who, () => refused(db.query(`select fn_payment_confirm($1, 'OM-1', $2)`, [orderA, total])))).toMatch(/réservée au serveur/);
    }
    expect(await as(db, U.admin, () => refused(db.query(`select fn_payment_confirm($1, 'OM-1', $2)`, [orderA, total - 1])))).toMatch(/montant incorrect/);
    expect((await as(db, U.admin, () => one<{ fn_payment_confirm: string }>(`select fn_payment_confirm($1, 'OM-1', $2)`, [orderA, total]))).fn_payment_confirm).toBe('bloque');
    expect(await as(db, U.admin, () => refused(db.query(`select fn_payment_confirm($1, 'OM-1', $2)`, [orderA, total])))).toMatch(/déjà payée/);
    expect(await sum('escrow')).toBe(total);
    expect((await one<{ status: string; provider_ref: string }>('select status, provider_ref from payments where order_id = $1', [orderA]))).toEqual({ status: 'paye', provider_ref: 'OM-1' });
  });

  it('la clé de service (serveur de paiement) confirme aussi, sans être administrateur', async () => {
    const b = await order('orange_money'); orderB = b.o; parcelB = b.p;
    const total = (await one<{ total_gnf: number }>('select total_gnf from orders where id = $1', [orderB])).total_gnf;
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '', false); select set_config('request.jwt.claims', '{"role":"service_role"}', false)`);
    try { await db.query(`select fn_payment_confirm($1, 'OM-2', $2)`, [orderB, total]); } finally { await db.exec(`reset role; select set_config('request.jwt.claims', '', false)`); }
    expect((await one<{ payment_status: string }>('select payment_status from orders where id = $1', [orderB])).payment_status).toBe('bloque');
  });

  it('une fois l’argent bloqué, le vendeur prépare le colis', async () => {
    expect((await as(db, U.vendeur, () => one<{ fn_parcel_ready: string }>('select fn_parcel_ready($1)', [parcelA]))).fn_parcel_ready).toBe('mission_proposee');
  });
});

describe('règlement à la remise', () => {
  it('à la remise, l’argent sort du séquestre : vendeur (moins 8 %), livreur (80 % des frais), plateforme', async () => {
    const { sub, fee } = await one<{ sub: number; fee: number }>('select subtotal_gnf as sub, delivery_fee_gnf as fee from parcels where id = $1', [parcelA]);
    await db.exec(`update parcels set courier_id = '${U.livreur}', status = 'remis', delivered_at = now() where id = '${parcelA}'`);
    const commission = Math.round(sub * 0.08); const gain = Math.round(fee * 0.8);
    expect(await sum('shop', shopId)).toBe(sub - commission);
    expect(await sum('courier', U.livreur)).toBe(gain);
    expect(await sum('platform')).toBe(commission + fee - gain);
    // Le colis B (payé, non livré) reste seul au séquestre.
    const totalB = (await one<{ total_gnf: number }>('select total_gnf from orders where id = $1', [orderB])).total_gnf;
    expect(await sum('escrow')).toBe(totalB);
    expect((await one<{ payment_status: string }>('select payment_status from orders where id = $1', [orderA])).payment_status).toBe('libere');
    // Rejouer le statut ne règle pas deux fois.
    await db.exec(`update parcels set status = 'litige' where id = '${parcelA}'; update parcels set status = 'remis' where id = '${parcelA}'`);
    expect(await sum('shop', shopId)).toBe(sub - commission);
  });

  it('en espèces à la livraison, le règlement se fait aussi à la remise (le séquestre reste à zéro)', async () => {
    const escrowBefore = await sum('escrow'); const shopBefore = await sum('shop', shopId);
    const c = await order('livraison'); orderC = c.o; parcelC = c.p;
    await db.exec(`update parcels set courier_id = '${U.livreur}', status = 'remis', delivered_at = now() where id = '${parcelC}'`);
    expect(await sum('escrow')).toBe(escrowBefore);
    expect(await sum('shop', shopId)).toBe(shopBefore + c.sub - Math.round(c.sub * 0.08));
    expect((await one<{ payment_status: string }>('select payment_status from orders where id = $1', [orderC])).payment_status).toBe('libere');
  });
});

describe('remboursements', () => {
  it('annulation d’un colis payé d’avance et non livré : l’argent sort du séquestre et revient à l’acheteur', async () => {
    const totalB = (await one<{ total_gnf: number }>('select total_gnf from orders where id = $1', [orderB])).total_gnf;
    await as(db, U.admin, () => db.query('select fn_parcel_cancel($1)', [parcelB]));
    expect(await sum('escrow')).toBe(0);
    expect(await sum('buyer', U.acheteur)).toBe(totalB);
    expect((await one<{ status: string; refunded_gnf: number }>('select status, refunded_gnf from payments where order_id = $1', [orderB]))).toEqual({ status: 'rembourse', refunded_gnf: totalB });
    expect((await one<{ payment_status: string }>('select payment_status from orders where id = $1', [orderB])).payment_status).toBe('rembourse');
  });

  it('litige tranché pour l’acheteur après règlement : la part du vendeur et la commission sont reprises, l’acheteur est remboursé des articles', async () => {
    const { sub } = await one<{ sub: number }>('select subtotal_gnf as sub from parcels where id = $1', [parcelC]);
    const shopBefore = await sum('shop', shopId); const buyerBefore = await sum('buyer', U.acheteur); const platBefore = await sum('platform');
    const commission = Math.round(sub * 0.08);
    await db.exec(`update parcels set status = 'litige' where id = '${parcelC}'; update parcels set status = 'annule' where id = '${parcelC}'`);
    expect(await sum('shop', shopId)).toBe(shopBefore - (sub - commission));
    expect(await sum('platform')).toBe(platBefore - commission);
    expect(await sum('buyer', U.acheteur)).toBe(buyerBefore + sub);
  });

  it('un colis annulé en espèces avant remise ne produit aucun mouvement', async () => {
    const d = await order('livraison');
    const n = (await one<{ n: string }>('select count(*) as n from ledger_entries')).n;
    await as(db, U.acheteur, () => db.query('select fn_parcel_cancel($1)', [d.p]));
    expect((await one<{ n: string }>('select count(*) as n from ledger_entries')).n).toBe(n);
  });
});

describe('reversements et lecture', () => {
  it('l’équipe verse le vendeur dans la limite de son solde ; le remboursement versé à l’acheteur est enregistré', async () => {
    const bal = await sum('shop', shopId);
    expect(bal).toBeGreaterThan(0);
    expect(await as(db, U.vendeur, () => refused(db.query('select fn_shop_payout($1, 1000)', [shopId])))).toMatch(/réservé à l'équipe/);
    expect(await as(db, U.admin, () => refused(db.query('select fn_shop_payout($1, $2)', [shopId, bal + 1])))).toMatch(/solde insuffisant/);
    expect((await as(db, U.admin, () => one<{ fn_shop_payout: number }>('select fn_shop_payout($1, $2)', [shopId, bal]))).fn_shop_payout).toBe(0);
    const owed = await sum('buyer', U.acheteur);
    expect(await as(db, U.vendeur, () => refused(db.query('select * from fn_refunds_due()')))).toMatch(/réservé à l'équipe/);
    expect(await as(db, U.admin, () => q('select buyer_id, amount_gnf, buyer_phone from fn_refunds_due()'))).toEqual([{ buyer_id: U.acheteur, amount_gnf: owed, buyer_phone: '+224 620 00 00 00' }]);
    expect(await as(db, U.acheteur, () => refused(db.query('select fn_refund_paid($1, $2)', [U.acheteur, owed])))).toMatch(/réservé à l'équipe/);
    expect((await as(db, U.admin, () => one<{ fn_refund_paid: number }>('select fn_refund_paid($1, $2)', [U.acheteur, owed]))).fn_refund_paid).toBe(0);
  });

  it('chacun ne lit que ses mouvements ; aucune écriture directe', async () => {
    expect((await as(db, U.vendeur, () => q('select distinct account from ledger_entries'))).map((r) => r.account)).toEqual(['shop']);
    expect((await as(db, U.livreur, () => q('select distinct account from ledger_entries'))).map((r) => r.account)).toEqual(['courier']);
    expect((await as(db, U.acheteur, () => q('select distinct account from ledger_entries'))).map((r) => r.account)).toEqual(['buyer']);
    expect((await as(db, U.vendeur2, () => q('select 1 from ledger_entries')))).toHaveLength(0);
    expect((await as(db, U.admin, () => q('select distinct account from ledger_entries order by 1'))).map((r) => r.account)).toEqual(['buyer', 'courier', 'courier_cash', 'escrow', 'platform', 'shop']);
    expect(await as(db, U.admin, () => refused(db.query(`insert into ledger_entries (account, kind, amount_gnf) values ('platform', 'faux', 1)`)))).toMatch(/permission denied/);
    expect(await as(db, U.acheteur, () => refused(db.query(`update payments set status = 'paye'`)))).toMatch(/permission denied/);
    expect(await as(db, 'anon', () => refused(db.query('select * from payments')))).toMatch(/permission denied/);
  });

  it('les réglages (taux) se lisent connecté ; ni un vendeur ni un simple opérateur ne les modifient (voir console.test.ts)', async () => {
    expect((await as(db, U.acheteur, () => q<{ key: string }>('select key from settings order by key'))).map((r) => r.key)).toEqual(['commission_bps', 'courier_share_bps', 'payment_mode']);
    await as(db, U.vendeur, () => db.query(`update settings set value = '0' where key = 'commission_bps'`));
    expect((await one<{ value: string }>(`select value from settings where key = 'commission_bps'`)).value).toBe('800');
    expect(await as(db, U.admin, () => refused(db.query(`update settings set value = '1000' where key = 'commission_bps'`)))).toMatch(/réservé au fondateur/);
    expect((await one<{ value: string }>(`select value from settings where key = 'commission_bps'`)).value).toBe('800');
  });
});
