import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { as, freshDb, refused, U } from './harness';

/** Corrections issues de la simulation complète du 2026-10-23 (HAILANDX.md §40, §41). Chaque `it` reprend l'état du précédent. */
let db: PGlite;
const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;
const one = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await q<T>(sql, params))[0]!;
const sum = async (account: string, id?: string) => Number((await one<{ s: string }>(`select coalesce(sum(amount_gnf), 0) as s from ledger_entries where account = $1 and ($2::uuid is null or account_id = $2)`, [account, id ?? null])).s);

const SELLER = { lng: -13.6775, lat: 9.5307 };
const BUYER = { lng: -13.6775, lat: 9.5672 };
let shop: string; let buyerDecl: string; let offer: string; let variant: string;

async function decl(user: string, p: { lng: number; lat: number }, accuracy = 5) {
  return (await one<{ id: string }>(`insert into declarations (user_id, gps_point, quartier_id, gps_accuracy_m) values ($1, point($2, $3), 'qtr-coleah', $4) returning id`, [user, p.lng, p.lat, accuracy])).id;
}
const order = async (who: string = U.acheteur, qty = 1) => {
  const o = (await as(db, who, () => one<{ id: string }>('select fn_place_order($1::jsonb, $2, $3, $4) id', [JSON.stringify([{ offer_id: offer, variant_id: variant, qty }]), buyerDecl, '+224 620 00 00 00', 'livraison']))).id;
  return (await one<{ id: string; subtotal_gnf: number; cod_amount_gnf: number; delivery_fee_gnf: number }>('select id, subtotal_gnf, cod_amount_gnf, delivery_fee_gnf from parcels where order_id = $1', [o]));
};
const stock = async () => (await one<{ stock: number }>('select stock from offer_variants where id = $1', [variant])).stock;
const notes = async (user: string) => q<{ kind: string; title: string; body: string | null; link: string | null }>('select kind, title, body, link from notifications where user_id = $1 order by id', [user]);

/** Prépare, fait accepter, retirer et remettre un colis (livreur à l'adresse). */
async function deliver(parcel: string) {
  await as(db, U.vendeur, () => db.query('select fn_parcel_ready($1)', [parcel]));
  await as(db, U.livreur, () => db.query('select fn_courier_accept($1)', [parcel]));
  const qr = (await as(db, U.vendeur, () => one<{ fn_parcel_qr: string }>('select fn_parcel_qr($1)', [parcel]))).fn_parcel_qr;
  await as(db, U.livreur, () => db.query('select fn_parcel_pickup($1)', [qr]));
  await as(db, U.livreur, () => db.query('select fn_courier_ping($1, $2)', [BUYER.lat, BUYER.lng]));
  const code = (await as(db, U.acheteur, () => one<{ fn_my_handover_code: string }>('select fn_my_handover_code($1)', [parcel]))).fn_my_handover_code;
  return (await as(db, U.livreur, () => one<{ r: string }>('select fn_parcel_handover_proof($1, $2, $3, $4) r', [parcel, 'code', code, `${U.livreur}/${parcel}/preuve.jpg`]))).r;
}

beforeAll(async () => {
  db = await freshDb();
  const d = await decl(U.vendeur, SELLER);
  buyerDecl = await decl(U.acheteur, BUYER);
  await db.exec(`insert into buildings (id, status, is_validated) values ('b-1', 'actif', true); update declarations set certified_building_id = 'b-1' where id = '${d}'`);
  shop = (await as(db, U.vendeur, () => one<{ id: string }>(`insert into shops (slug, name, owner_id, declaration_id) values ('kadi-wax', 'Kadi Wax', $1, $2) returning id`, [U.vendeur, d]))).id;
  await as(db, U.vendeur, () => db.query('select fn_shop_open($1)', [shop]));
  const prod = (await as(db, U.vendeur, () => one<{ id: string }>(`insert into catalog_products (slug, name, created_by) values ('pagne', 'Pagne wax', $1) returning id`, [U.vendeur]))).id;
  offer = (await as(db, U.vendeur, () => one<{ id: string }>(`insert into offers (shop_id, product_id, price_gnf) values ($1, $2, 400000) returning id`, [shop, prod]))).id;
  variant = (await as(db, U.vendeur, () => one<{ id: string }>(`insert into offer_variants (offer_id, label, stock) values ($1, 'Bleu', 50) returning id`, [offer]))).id;
  await db.exec(`insert into couriers (user_id, full_name, status, available) values ('${U.livreur}', 'Livreur Test', 'valide', true)`);
  // Comme pendant la simulation : le vendeur et l'acheteur sont aussi administrateurs.
  await db.exec(`insert into agents (id, role) values ('${U.vendeur}', 'admin'), ('${U.acheteur}', 'admin')`);
}, 60000);

describe('A1 + A6 : annulation selon le rôle réel, stock au choix du vendeur', () => {
  it('un vendeur administrateur annule « en vendeur » : motif exigé ; « rupture » ne remet pas le stock', async () => {
    const p = await order();
    expect(await stock()).toBe(49);
    expect(await as(db, U.vendeur, () => refused(db.query('select fn_parcel_cancel($1)', [p.id])))).toMatch(/motif/);
    await as(db, U.vendeur, () => db.query('select fn_parcel_cancel($1, $2, $3)', [p.id, 'Rupture de stock', false]));
    expect(await one('select cancelled_by, cancel_reason from parcels where id = $1', [p.id])).toEqual({ cancelled_by: 'vendeur', cancel_reason: 'Rupture de stock' });
    expect(await stock()).toBe(49);
  });
  it('un acheteur administrateur annule « en acheteur » ; le stock revient ; le vendeur est prévenu avec le bon lien', async () => {
    const p = await order();
    expect(await stock()).toBe(48);
    await as(db, U.acheteur, () => db.query('select fn_parcel_cancel($1)', [p.id]));
    expect((await one<{ cancelled_by: string }>('select cancelled_by from parcels where id = $1', [p.id])).cancelled_by).toBe('acheteur');
    expect(await stock()).toBe(49);
    const n = (await notes(U.vendeur)).filter((x) => x.title === 'Commande annulée par le client');
    expect(n).toHaveLength(1);
    expect(n[0]!.link).toBe(`/vendeur/commandes/${p.id}`);
    const orderId = (await one<{ order_id: string }>('select order_id from parcels where id = $1', [p.id])).order_id;
    expect((await notes(U.acheteur)).some((x) => x.title === 'Colis annulé' && x.link === `/commandes/${orderId}`)).toBe(false);
  });
});

describe('A8 : nouvelle commande avec article, montant et quartier', () => {
  it('le vendeur reçoit le détail, avec un lien vers la commande', async () => {
    const p = await order(U.acheteur, 2);
    const n = (await notes(U.vendeur)).filter((x) => x.title.startsWith('Nouvelle commande')).at(-1)!;
    expect(n.title).toBe('Nouvelle commande · 800 000 GNF');
    expect(n.body).toBe('Pagne wax (Bleu) ×2 · Coleah Domino. À préparer.');
    expect(n.link).toBe(`/vendeur/commandes/${p.id}`);
    await as(db, U.acheteur, () => db.query('select fn_parcel_cancel($1)', [p.id]));
  });
});

describe('A4 : le plafond compte les missions en cours', () => {
  it('deux missions de 414 500 (articles et frais) dépassent un plafond de 800 000 même sans espèces en main', async () => {
    expect((await one<{ cash_limit_gnf: number }>('select cash_limit_gnf from couriers where user_id = $1', [U.livreur])).cash_limit_gnf).toBe(15000000);
    await db.exec(`update couriers set cash_limit_gnf = 800000 where user_id = '${U.livreur}'`);
    const a = await order(); const b = await order();
    await as(db, U.vendeur, () => db.query('select fn_parcel_ready($1)', [a.id]));
    await as(db, U.vendeur, () => db.query('select fn_parcel_ready($1)', [b.id]));
    await as(db, U.livreur, () => db.query('select fn_courier_accept($1)', [a.id]));
    expect(await as(db, U.livreur, () => refused(db.query('select fn_courier_accept($1)', [b.id])))).toMatch(/missions en cours/);
    await db.exec(`update couriers set cash_limit_gnf = 15000000 where user_id = '${U.livreur}'`);
    await db.exec(`update parcels set status = 'annule', courier_id = null where id in ('${a.id}', '${b.id}')`);
  });
});

let delivered: { id: string; subtotal_gnf: number; cod_amount_gnf: number; delivery_fee_gnf: number };
describe('A5 + A10 : remise, solde du vendeur, espèces du livreur', () => {
  it('le vendeur est prévenu de la somme ajoutée ; les espèces entrent au compte du livreur puis en sortent au reversement', async () => {
    delivered = await order();
    expect(await deliver(delivered.id)).toBe('remis');
    const n = (await notes(U.vendeur)).find((x) => x.title === 'Colis remis au client')!;
    expect(n.body).toBe('368 000 GNF ajoutés à votre solde (commission Hailand déduite).');
    expect(n.link).toBe(`/vendeur/commandes/${delivered.id}`);
    // §48 : le livreur garde son gain (80 % des frais de livraison) sur les espèces encaissées.
    const due = delivered.cod_amount_gnf - Math.round(delivered.delivery_fee_gnf * 0.8);
    expect(await sum('courier_cash', U.livreur)).toBe(due);
    await as(db, U.admin, () => db.query('select fn_courier_cash_settle($1, $2)', [U.livreur, 100000]));
    expect(await sum('courier_cash', U.livreur)).toBe(due - 100000);
    expect((await one<{ cash_balance_gnf: number }>('select cash_balance_gnf from couriers where user_id = $1', [U.livreur])).cash_balance_gnf).toBe(due - 100000);
  });
  it('commandé et encaissé sont distingués dans les ventes du jour', async () => {
    const today = (await as(db, U.vendeur, () => q<{ revenue_gnf: string; delivered_gnf: string }>('select revenue_gnf, delivered_gnf from fn_shop_sales($1, 1)', [shop])))[0]!;
    expect(Number(today.delivered_gnf)).toBe(400000);
    expect(Number(today.revenue_gnf)).toBeGreaterThanOrEqual(400000);
  });
});

describe('A2 + A7 : litige, liens du vendeur, remboursement partiel', () => {
  it('les notifications du litige arrivent dans HailandX Vendeur (vendeur) et la Console (équipe)', async () => {
    const id = (await as(db, U.acheteur, () => one<{ fn_open_dispute: string }>('select fn_open_dispute($1, $2, $3)', [delivered.id, 'endommage', 'Un pagne est déchiré']))).fn_open_dispute;
    await as(db, U.acheteur, () => db.query('select fn_dispute_post($1, $2)', [id, 'Photo envoyée']));
    const seller = (await notes(U.vendeur)).filter((x) => x.kind === 'litige' && x.link !== '/console/litiges'); // (le vendeur du test est aussi de l'équipe)
    expect(seller.length).toBeGreaterThanOrEqual(2);
    expect(seller.every((x) => x.link === `/vendeur/commandes/${delivered.id}`)).toBe(true);
    expect((await notes(U.admin)).filter((x) => x.kind === 'litige').every((x) => x.link === '/console/litiges')).toBe(true);
  });
  it('remboursement partiel : le colis reste remis, la boutique rend sa part, l’acheteur est crédité', async () => {
    const id = (await one<{ id: string }>('select id from disputes where parcel_id = $1', [delivered.id])).id;
    const shopBefore = await sum('shop', shop);
    expect(await as(db, U.admin, () => one<{ r: string }>('select fn_resolve_dispute($1, $2, $3, $4) r', [id, 'acheteur', 'Un pagne sur deux abîmé', 100000]))).toEqual({ r: 'remis' });
    expect((await one<{ status: string }>('select status from parcels where id = $1', [delivered.id])).status).toBe('remis');
    expect(await sum('shop', shop)).toBe(shopBefore - 92000);
    expect(await sum('buyer', U.acheteur)).toBe(100000);
    expect((await one<{ refund_gnf: number }>('select refund_gnf from disputes where id = $1', [id])).refund_gnf).toBe(100000);
    const b = (await notes(U.acheteur)).at(-1)!;
    expect(b.title).toBe('Litige tranché en votre faveur');
    expect(b.body).toBe('100 000 GNF vous seront remboursés (remboursement partiel).');
    // La sortie du litige ne renvoie pas « Colis remis » une seconde fois.
    expect((await notes(U.vendeur)).filter((x) => x.title === 'Colis remis au client')).toHaveLength(1);
  });
});

describe('A9 : frais de livraison avant de commander', () => {
  it('le devis donne un frais par boutique, calculé comme la commande ; seulement pour sa propre adresse', async () => {
    const quote = await as(db, U.acheteur, () => q<{ shop_name: string; fee_gnf: number }>('select shop_name, fee_gnf from fn_delivery_quote($1, $2)', [buyerDecl, [offer]]));
    expect(quote).toHaveLength(1);
    expect(quote[0]!.fee_gnf).toBe((await one<{ delivery_fee_gnf: number }>('select delivery_fee_gnf from parcels where id = $1', [delivered.id])).delivery_fee_gnf);
    expect(await as(db, U.acheteur2, () => refused(db.query('select * from fn_delivery_quote($1, $2)', [buyerDecl, [offer]])))).toMatch(/introuvable/);
  });
});

describe('A11 : tolérance de remise plafonnée', () => {
  it('une adresse à ±500 m ne permet pas de remettre à 400 m', async () => {
    const far = await decl(U.acheteur2, BUYER, 500);
    const o = (await as(db, U.acheteur2, () => one<{ id: string }>('select fn_place_order($1::jsonb, $2, $3, $4) id', [JSON.stringify([{ offer_id: offer, variant_id: variant, qty: 1 }]), far, '+224 620 00 00 01', 'livraison']))).id;
    const p = (await one<{ id: string }>('select id from parcels where order_id = $1', [o])).id;
    await as(db, U.vendeur, () => db.query('select fn_parcel_ready($1)', [p]));
    await as(db, U.livreur, () => db.query('select fn_courier_accept($1)', [p]));
    const qr = (await as(db, U.vendeur, () => one<{ fn_parcel_qr: string }>('select fn_parcel_qr($1)', [p]))).fn_parcel_qr;
    await as(db, U.livreur, () => db.query('select fn_parcel_pickup($1)', [qr]));
    await as(db, U.livreur, () => db.query('select fn_courier_ping($1, $2)', [BUYER.lat + 0.0036, BUYER.lng])); // ≈ 400 m
    const code = (await as(db, U.acheteur2, () => one<{ fn_my_handover_code: string }>('select fn_my_handover_code($1)', [p]))).fn_my_handover_code;
    expect(await as(db, U.livreur, () => refused(db.query('select fn_parcel_handover_proof($1, $2, $3, $4)', [p, 'code', code, `${U.livreur}/${p}/preuve.jpg`])))).toMatch(/pas à l'adresse/);
  });
});
