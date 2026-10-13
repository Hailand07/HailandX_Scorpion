import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { as, freshDb, refused, U } from './harness';

/** Parcours vendeur (produits seulement boutique ouverte) et suppression de compte. */
let db: PGlite;
const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;
const one = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await q<T>(sql, params))[0]!;
const SELLER = { lng: -13.6775, lat: 9.5307 };
const BUYER = { lng: -13.6775, lat: 9.5672 };
const count = async (sql: string, p: unknown[] = []) => Number((await one<{ n: string }>(sql, p)).n);

let sellerDecl: string; let buyerDecl: string; let shopId: string; let productId: string;

beforeAll(async () => {
  db = await freshDb();
  sellerDecl = (await one<{ id: string }>(`insert into declarations (user_id, gps_point, quartier_id, gps_accuracy_m) values ($1, point($2, $3), 'qtr-coleah', 5) returning id`, [U.vendeur, SELLER.lng, SELLER.lat])).id;
  buyerDecl = (await one<{ id: string }>(`insert into declarations (user_id, gps_point, quartier_id, gps_accuracy_m) values ($1, point($2, $3), 'qtr-coleah', 5) returning id`, [U.acheteur, BUYER.lng, BUYER.lat])).id;
  await db.exec(`insert into buildings (id, status, is_validated) values ('b-1', 'actif', true)`);
  shopId = (await as(db, U.vendeur, () => one<{ id: string }>(`insert into shops (slug, name, owner_id, declaration_id) values ('kadi-wax', 'Kadi Wax', $1, $2) returning id`, [U.vendeur, sellerDecl]))).id;
  productId = (await as(db, U.vendeur, () => one<{ id: string }>(`insert into catalog_products (slug, name, created_by) values ('pagne', 'Pagne', $1) returning id`, [U.vendeur]))).id;
}, 60000);

describe('produits : seulement une fois la vente ouverte', () => {
  it('boutique en préparation : le vendeur ne peut pas ajouter de produit', async () => {
    expect(await as(db, U.vendeur, () => refused(db.query(`insert into offers (shop_id, product_id, price_gnf) values ($1, $2, 100000)`, [shopId, productId])))).toMatch(/doit être ouverte/);
  });
  it('boutique ouverte (adresse certifiée) : l’ajout est possible ; l’équipe peut toujours intervenir', async () => {
    await db.exec(`update declarations set certified_building_id = 'b-1' where id = '${sellerDecl}'`);
    await as(db, U.vendeur, () => db.query('select fn_shop_open($1)', [shopId]));
    await as(db, U.vendeur, () => db.query(`insert into offers (shop_id, product_id, price_gnf) values ($1, $2, 100000)`, [shopId, productId]));
    expect(await count('select count(*) n from offers where shop_id = $1', [shopId])).toBe(1);
  });
});

describe('suppression de compte : vérifications', () => {
  it('visiteur : refusé ; mauvaise confirmation : refusée', async () => {
    await refused(as(db, 'anon', () => db.query('select * from fn_account_delete_check()')));
    expect(await as(db, U.acheteur2, () => refused(db.query(`select fn_delete_my_account('oui')`)))).toMatch(/tapez SUPPRIMER/);
  });
  it('commande en cours : bloque, avec la raison affichable avant confirmation', async () => {
    const vid = (await as(db, U.vendeur, () => one<{ id: string }>(`insert into offer_variants (offer_id, label, stock) values ((select id from offers limit 1), 'Standard', 10) returning id`))).id;
    const offer = (await one<{ id: string }>('select id from offers limit 1')).id;
    await as(db, U.acheteur, () => db.query('select fn_place_order($1::jsonb, $2, $3, $4, $5)', [JSON.stringify([{ offer_id: offer, variant_id: vid, qty: 1 }]), buyerDecl, '+224612000001', 'livraison', null]));
    const reasons = await as(db, U.acheteur, () => q<{ code: string }>('select code from fn_account_delete_check()'));
    expect(reasons.map((r) => r.code)).toEqual(['commande_en_cours']);
    expect(await as(db, U.acheteur, () => refused(db.query(`select fn_delete_my_account('SUPPRIMER')`)))).toMatch(/suppression impossible.*en cours/);
    expect(await count('select count(*) n from auth.users where id = $1', [U.acheteur])).toBe(1);
  });
  it('la boutique qui a des commandes de clients : bloquée', async () => {
    expect((await as(db, U.vendeur, () => q<{ code: string }>('select code from fn_account_delete_check()'))).map((r) => r.code)).toContain('boutique_commandes');
  });
  it('dernier administrateur : bloqué ; avec un autre administrateur actif : autorisé à vérifier', async () => {
    expect((await as(db, U.admin, () => q<{ code: string }>('select code from fn_account_delete_check()'))).map((r) => r.code)).toEqual(['dernier_admin']);
    await db.exec(`insert into agents (id, role) values ('${U.livreur2}', 'admin')`);
    expect(await as(db, U.admin, () => q('select * from fn_account_delete_check()'))).toHaveLength(0);
    await db.exec(`delete from agents where id = '${U.livreur2}'`);
  });
});

describe('suppression de compte : purge', () => {
  it('l’acheteur annule sa commande puis supprime son compte : tout ce qui le concerne disparaît, rien d’autre', async () => {
    const parcel = (await one<{ id: string }>('select id from parcels limit 1')).id;
    await as(db, U.vendeur, () => db.query('select fn_parcel_cancel($1)', [parcel]));
    await as(db, U.acheteur, () => db.query('select fn_toggle_favorite($1, true)', [productId]));
    await as(db, U.acheteur, () => db.query('select fn_follow_shop($1, true)', [shopId]));
    await db.exec(`insert into profiles (id, full_name, phone) values ('${U.acheteur}', 'Acheteur', '224600000000'), ('${U.vendeur}', 'Vendeur', '224611111111')`);
    // Une commande annulée n'a rien d'engageant : plus de blocage.
    expect(await as(db, U.acheteur, () => q('select * from fn_account_delete_check()'))).toHaveLength(0);
    await as(db, U.acheteur, () => db.query(`select fn_delete_my_account('SUPPRIMER')`));
    expect(await count('select count(*) n from auth.users where id = $1', [U.acheteur])).toBe(0);
    for (const t of ['orders where buyer_id', 'declarations where user_id', 'product_favorites where user_id', 'shop_follows where user_id', 'notifications where user_id']) {
      expect(await count(`select count(*) n from ${t} = $1`, [U.acheteur]), t).toBe(0);
    }
    expect(await count(`select count(*) n from profiles where id = $1`, [U.acheteur])).toBe(0);
    // Les autres comptes et la boutique restent intacts.
    expect(await count('select count(*) n from auth.users where id = $1', [U.vendeur])).toBe(1);
    expect(await count('select count(*) n from shops where id = $1', [shopId])).toBe(1);
    expect(await count('select count(*) n from profiles where id = $1', [U.vendeur])).toBe(1);
  });
  it('le vendeur sans commande de client supprime son compte : boutique, produits et adresse partent avec lui ; un produit utilisé par une autre boutique reste', async () => {
    // Le colis annulé de l'acheteur supprimé a disparu avec lui : plus d'historique de client sur la boutique.
    expect(await as(db, U.vendeur, () => q('select * from fn_account_delete_check()'))).toHaveLength(0);
    // Un second vendeur propose le même produit : la fiche commune doit survivre.
    const s2Decl = (await one<{ id: string }>(`insert into declarations (user_id, gps_point, quartier_id, gps_accuracy_m) values ($1, point($2, $3), 'qtr-coleah', 5) returning id`, [U.vendeur2, SELLER.lng, SELLER.lat + 0.001])).id;
    const shop2 = (await as(db, U.vendeur2, () => one<{ id: string }>(`insert into shops (slug, name, owner_id, declaration_id) values ('tech-kaloum', 'Tech Kaloum', $1, $2) returning id`, [U.vendeur2, s2Decl]))).id;
    await db.exec(`insert into offers (shop_id, product_id, price_gnf) values ('${shop2}', '${productId}', 90000)`);
    await as(db, U.vendeur, () => db.query(`select fn_delete_my_account('SUPPRIMER')`));
    expect(await count('select count(*) n from shops where id = $1', [shopId])).toBe(0);
    expect(await count('select count(*) n from offers where shop_id = $1', [shopId])).toBe(0);
    expect(await count('select count(*) n from declarations where id = $1', [sellerDecl])).toBe(0);
    expect(await count('select count(*) n from auth.users where id = $1', [U.vendeur])).toBe(0);
    const p = await one<{ created_by: string | null }>('select created_by from catalog_products where id = $1', [productId]);
    expect(p.created_by).toBeNull(); // fiche gardée pour l'autre vendeur, sans lien avec le compte supprimé
    expect(await count('select count(*) n from shops where id = $1', [shop2])).toBe(1);
  });
  it('un administrateur supprimé perd aussi ses droits d’équipe', async () => {
    await db.exec(`insert into agents (id, role) values ('${U.livreur2}', 'admin')`);
    await as(db, U.admin, () => db.query(`select fn_delete_my_account('SUPPRIMER')`));
    expect(await count('select count(*) n from agents where id = $1', [U.admin])).toBe(0);
    expect(await count('select count(*) n from auth.users where id = $1', [U.admin])).toBe(0);
  });
});
