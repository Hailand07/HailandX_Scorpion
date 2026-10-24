import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { as, freshDb, refused, U } from './harness';

/** Compléments : certification prioritaire, favoris, modération des avis, messages de litige, notifications, boutiques proches. */
let db: PGlite;
const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;
const one = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await q<T>(sql, params))[0]!;
const SELLER = { lng: -13.6775, lat: 9.5307 };
const BUYER = { lng: -13.6775, lat: 9.5672 };

let shopId: string; let offerId: string; let variantId: string; let sellerDecl: string; let buyerDecl: string; let productId: string;
let parcel: string; let order: string; let review: string; let report: string; let dispute: string;

async function newParcel() {
  const o = (await as(db, U.acheteur, () => one<{ fn_place_order: string }>('select fn_place_order($1::jsonb, $2, $3, $4, $5)', [JSON.stringify([{ offer_id: offerId, variant_id: variantId, qty: 1 }]), buyerDecl, '+224612000001', 'livraison', null]))).fn_place_order;
  const p = (await one<{ id: string }>('select id from parcels where order_id = $1', [o])).id;
  return { o, p };
}
async function deliver(p: string) {
  await as(db, U.vendeur, () => db.query('select fn_parcel_ready($1)', [p]));
  await as(db, U.livreur, () => db.query('select fn_courier_accept($1)', [p]));
  const qr = (await as(db, U.vendeur, () => one<{ fn_parcel_qr: string }>('select fn_parcel_qr($1)', [p]))).fn_parcel_qr;
  await as(db, U.livreur, () => db.query('select fn_courier_ping($1, $2)', [SELLER.lat, SELLER.lng]));
  await as(db, U.livreur, () => db.query('select fn_parcel_pickup($1, $2, $3)', [qr, SELLER.lat, SELLER.lng]));
}

beforeAll(async () => {
  db = await freshDb();
  sellerDecl = (await one<{ id: string }>(`insert into declarations (user_id, gps_point, quartier_id, gps_accuracy_m) values ($1, point($2, $3), 'qtr-coleah', 5) returning id`, [U.vendeur, SELLER.lng, SELLER.lat])).id;
  buyerDecl = (await one<{ id: string }>(`insert into declarations (user_id, gps_point, quartier_id, gps_accuracy_m) values ($1, point($2, $3), 'qtr-coleah', 5) returning id`, [U.acheteur, BUYER.lng, BUYER.lat])).id;
  shopId = (await as(db, U.vendeur, () => one<{ id: string }>(`insert into shops (slug, name, owner_id, declaration_id) values ('kadi-wax', 'Kadi Wax', $1, $2) returning id`, [U.vendeur, sellerDecl]))).id;
  await db.exec(`insert into couriers (user_id, full_name, status, available) values ('${U.livreur}', 'Livreur Test', 'valide', true)`);
  productId = (await as(db, U.vendeur, () => one<{ id: string }>(`insert into catalog_products (slug, name, created_by) values ('pagne', 'Pagne', $1) returning id`, [U.vendeur]))).id;
  // Le vendeur ne peut ajouter de produit qu'une fois la boutique ouverte : la certification vient plus tard dans ce scénario, l'offre est donc posée directement.
  offerId = (await one<{ id: string }>(`insert into offers (shop_id, product_id, price_gnf) values ($1, $2, 100000) returning id`, [shopId, productId])).id;
  variantId = (await as(db, U.vendeur, () => one<{ id: string }>(`insert into offer_variants (offer_id, label, stock) values ($1, 'Standard', 50) returning id`, [offerId]))).id;
}, 60000);

describe('certification prioritaire', () => {
  it('le vendeur demande la certification : l’équipe vérifie d’abord (console), puis la demande remonte à HailandMap', async () => {
    await refused(as(db, U.acheteur, () => db.query('select fn_request_priority_certification($1)', [shopId])));
    expect((await as(db, U.vendeur, () => one<{ fn_request_priority_certification: string }>('select fn_request_priority_certification($1)', [shopId]))).fn_request_priority_certification).toBe('a_verifier');
    // Tant que la console n'a pas confirmé, HailandMap ne voit rien.
    expect((await one<{ certification_status: string | null }>('select certification_status from declarations where id = $1', [sellerDecl])).certification_status).not.toBe('demandee');
    expect(await q('select shop_id, status from certification_priorities where declaration_id = $1', [sellerDecl])).toEqual([{ shop_id: shopId, status: 'a_verifier' }]);
    expect((await as(db, U.admin, () => one<{ r: string }>('select fn_console_certification_decide($1, true) r', [sellerDecl]))).r).toBe('transmise');
    const d = await one<{ certification_status: string; certification_requested_at: string | null }>('select certification_status, certification_requested_at from declarations where id = $1', [sellerDecl]);
    expect(d.certification_status).toBe('demandee');
    expect(d.certification_requested_at).not.toBeNull();
  });
  it('l’équipe voit la priorité, un autre compte non ; on ne s’accorde pas la priorité soi-même', async () => {
    expect(await as(db, U.admin, () => q('select 1 from certification_priorities'))).toHaveLength(1);
    expect(await as(db, U.acheteur, () => q('select 1 from certification_priorities'))).toHaveLength(0);
    await refused(as(db, U.vendeur, () => db.query(`insert into certification_priorities (declaration_id, shop_id, requested_by) values ($1, $2, $3)`, [buyerDecl, shopId, U.vendeur])));
  });
  it('une adresse déjà certifiée ne se redemande pas', async () => {
    await db.exec(`insert into buildings (id, status, is_validated) values ('b-1', 'actif', true); update declarations set certified_building_id = 'b-1' where id = '${sellerDecl}'`);
    expect(await as(db, U.vendeur, () => refused(db.query('select fn_request_priority_certification($1)', [shopId])))).toMatch(/déjà certifiée/);
    await as(db, U.vendeur, () => db.query('select fn_shop_open($1)', [shopId]));
  });
});

describe('boutiques proches', () => {
  it('distance arrondie à 0,1 km, boutiques ouvertes seulement, jamais de coordonnées ; ouvert aux visiteurs', async () => {
    const rows = await as(db, 'anon', () => q<{ slug: string; distance_km: string }>('select * from fn_shops_nearby($1, $2)', [BUYER.lat, BUYER.lng]));
    expect(rows.map((r) => r.slug)).toEqual(['kadi-wax']);
    expect(Number(rows[0]!.distance_km)).toBeGreaterThan(3.5);
    expect(Number(rows[0]!.distance_km)).toBeLessThan(4.5);
    expect(Object.keys(rows[0]!)).toEqual(['slug', 'distance_km']);
  });
});

describe('favoris', () => {
  it('un visiteur ne peut pas ; un acheteur ajoute et retire ; chacun ne voit que les siens', async () => {
    await refused(as(db, 'anon', () => db.query('select fn_toggle_favorite($1, true)', [productId])));
    await as(db, U.acheteur, () => db.query('select fn_toggle_favorite($1, true)', [productId]));
    await as(db, U.acheteur, () => db.query('select fn_toggle_favorite($1, true)', [productId])); // idempotent
    await as(db, U.acheteur2, () => db.query('select fn_toggle_favorite($1, true)', [productId]));
    expect(await as(db, U.acheteur, () => q('select user_id from product_favorites'))).toEqual([{ user_id: U.acheteur }]);
    await as(db, U.acheteur, () => db.query('select fn_toggle_favorite($1, false)', [productId]));
    expect(await as(db, U.acheteur, () => q('select 1 from product_favorites'))).toHaveLength(0);
    await refused(as(db, U.acheteur, () => db.query(`insert into product_favorites (user_id, product_id) values ($1, $2)`, [U.acheteur2, productId])));
  });
});

describe('notifications', () => {
  it('une commande prévient le vendeur ; un livreur qui retire prévient l’acheteur', async () => {
    const n = await newParcel(); parcel = n.p; order = n.o;
    const sellerNotes = await as(db, U.vendeur, () => q<{ title: string; link: string }>(`select title, link from notifications where kind <> 'certification' order by id`));
    expect(sellerNotes).toHaveLength(1);
    expect(sellerNotes[0]!.title).toMatch(/^Nouvelle commande · [\d  ]+ GNF$/);
    expect(sellerNotes[0]!.link).toBe(`/vendeur/commandes/${parcel}`);
    await deliver(parcel);
    expect((await as(db, U.acheteur, () => q<{ title: string; link: string }>('select title, link from notifications order by id'))).map((r) => r.title)).toEqual(['Un livreur a accepté votre colis', 'Votre colis est en route']);
    expect((await as(db, U.acheteur, () => one<{ link: string }>('select link from notifications order by id limit 1'))).link).toBe(`/commandes/${order}`);
  });
  it('chacun ne lit que ses notifications ; on les marque lues', async () => {
    expect(await as(db, U.acheteur2, () => q('select 1 from notifications'))).toHaveLength(0);
    expect((await as(db, U.acheteur, () => one<{ fn_notifications_read: number }>('select fn_notifications_read(null)'))).fn_notifications_read).toBe(2);
    expect((await as(db, U.acheteur, () => one<{ fn_notifications_read: number }>('select fn_notifications_read(null)'))).fn_notifications_read).toBe(0);
    await refused(as(db, U.acheteur, () => db.query(`insert into notifications (user_id, kind, title) values ($1, 'x', 'faux')`, [U.acheteur])));
  });
});

describe('messages de litige', () => {
  it('l’acheteur ouvre un litige ; vendeur, acheteur et équipe échangent ; les autres sont exclus', async () => {
    dispute = (await as(db, U.acheteur, () => one<{ fn_open_dispute: string }>(`select fn_open_dispute($1, 'non_recu', 'rien reçu')`, [parcel]))).fn_open_dispute;
    await as(db, U.acheteur, () => db.query(`select fn_dispute_post($1, 'Je n''ai rien reçu')`, [dispute]));
    await as(db, U.vendeur, () => db.query(`select fn_dispute_post($1, 'Le livreur a pourtant déposé le colis')`, [dispute]));
    await as(db, U.admin, () => db.query(`select fn_dispute_post($1, 'Nous examinons')`, [dispute]));
    await refused(as(db, U.acheteur2, () => db.query(`select fn_dispute_post($1, 'intrus')`, [dispute])));
    await refused(as(db, U.acheteur, () => db.query(`select fn_dispute_post($1, '   ')`, [dispute])));
    expect((await as(db, U.vendeur, () => q<{ author_role: string }>('select author_role from dispute_messages order by created_at, id'))).map((m) => m.author_role).sort()).toEqual(['acheteur', 'equipe', 'vendeur']);
    expect(await as(db, U.acheteur2, () => q('select 1 from dispute_messages'))).toHaveLength(0);
    await refused(as(db, U.acheteur, () => db.query(`insert into dispute_messages (dispute_id, author_id, author_role, body) values ($1, $2, 'equipe', 'faux')`, [dispute, U.acheteur])));
  });
  it('chaque message prévient les autres parties ; la décision prévient acheteur et vendeur ; litige tranché : échanges fermés', async () => {
    const titles = async (u: string) => (await as(db, u, () => q<{ title: string }>('select title from notifications where kind = $1 order by id', ['litige']))).map((r) => r.title);
    expect(await titles(U.acheteur)).toContain('Nouveau message dans votre litige');
    expect(await titles(U.vendeur)).toContain('Nouveau message dans un litige');
    expect(await titles(U.admin)).toContain('Litige à traiter');
    await as(db, U.admin, () => db.query(`select fn_resolve_dispute($1, 'vendeur', 'colis bien remis')`, [dispute]));
    expect(await titles(U.acheteur)).toContain('Litige tranché en faveur du vendeur');
    expect(await titles(U.vendeur)).toContain('Litige tranché en votre faveur');
    expect(await as(db, U.acheteur, () => refused(db.query(`select fn_dispute_post($1, 'encore')`, [dispute])))).toMatch(/tranché/);
  });
});

describe('modération des avis', () => {
  it('le vendeur signale un avis ; l’équipe le masque : il disparaît de la lecture publique et sort de l’indice', async () => {
    await as(db, U.acheteur, () => db.query('select fn_submit_review($1, 1, $2)', [parcel, 'arnaque']));
    review = (await one<{ id: string }>('select id from reviews where parcel_id = $1', [parcel])).id;
    const before = await one<{ trust: number; review_count: number }>('select trust, review_count from shop_scores where shop_id = $1', [shopId]);
    expect(before.review_count).toBe(1);
    await refused(as(db, U.acheteur, () => db.query(`select fn_report_review($1, 'faux')`, [review])));
    report = (await as(db, U.vendeur, () => one<{ fn_report_review: string }>(`select fn_report_review($1, 'faux', 'cette personne n''a rien commandé')`, [review]))).fn_report_review;
    await refused(as(db, U.vendeur, () => db.query(`select fn_report_review($1, 'faux')`, [review]))); // un seul signalement
    expect(await as(db, U.admin, () => q('select 1 from notifications where title = $1', ['Avis signalé par un vendeur']))).toHaveLength(1);
    await refused(as(db, U.vendeur, () => db.query('select fn_moderate_review($1, true, null)', [report])));
    await as(db, U.admin, () => db.query(`select fn_moderate_review($1, true, 'avis contraire aux règles')`, [report]));
    expect(await as(db, 'anon', () => q('select 1 from reviews'))).toHaveLength(0);
    expect(await as(db, U.vendeur, () => q('select 1 from reviews'))).toHaveLength(1); // le vendeur et l'auteur voient toujours l'avis
    const after = await one<{ trust: number; review_count: number }>('select trust, review_count from shop_scores where shop_id = $1', [shopId]);
    expect(after.review_count).toBe(0);
    expect(after.trust).toBeGreaterThan(before.trust);
    expect((await as(db, U.vendeur, () => one<{ title: string }>(`select title from notifications where kind = 'avis' order by id desc limit 1`))).title).toBe('Avis masqué');
  });
  it('un signalement traité ne se retraite pas', async () => {
    await refused(as(db, U.admin, () => db.query('select fn_moderate_review($1, false, null)', [report])));
  });
});
