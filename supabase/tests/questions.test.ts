import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { as, freshDb, refused, U } from './harness';

/** Questions-réponses sur les produits et « souvent achetés ensemble » (HAILANDX.md §35). */
let db: PGlite;
const one = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0]!;
const q = async (sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows;
let shopA: string; let shopB: string; let pagne: string; let sac: string; let fil: string; let buyerDecl: string;
const offerOf: Record<string, string> = {};

beforeAll(async () => {
  db = await freshDb();
  const decl = async (u: string) => (await one<{ id: string }>(`insert into declarations (user_id, gps_point, quartier_id, gps_accuracy_m) values ($1, point(-13.6775, 9.5307), 'qtr-coleah', 5) returning id`, [u])).id;
  const dA = await decl(U.vendeur); const dB = await decl(U.vendeur2); buyerDecl = await decl(U.acheteur);
  shopA = (await as(db, U.vendeur, () => one<{ id: string }>(`insert into shops (slug, name, owner_id, declaration_id) values ('kadi-wax', 'Kadi Wax', $1, $2) returning id`, [U.vendeur, dA]))).id;
  shopB = (await as(db, U.vendeur2, () => one<{ id: string }>(`insert into shops (slug, name, owner_id, declaration_id) values ('awa-mode', 'Awa Mode', $1, $2) returning id`, [U.vendeur2, dB]))).id;
  await db.exec(`update shops set status = 'ouverte'`);
  const prod = async (slug: string) => (await one<{ id: string }>(`insert into catalog_products (slug, name, created_by) values ($1, $1, $2) returning id`, [slug, U.vendeur])).id;
  pagne = await prod('pagne'); sac = await prod('sac'); fil = await prod('fil');
  for (const [p, s] of [[pagne, shopA], [sac, shopA], [fil, shopA]] as const) {
    offerOf[p] = (await one<{ id: string }>(`insert into offers (shop_id, product_id, price_gnf) values ($1, $2, 10000) returning id`, [s, p])).id;
  }
}, 60000);

describe('questions-réponses', () => {
  let qid: string;
  it('un compte connecté pose une question ; un visiteur ne peut pas ; la boutique qui vend le produit est prévenue', async () => {
    await refused(db.query('select fn_ask_question($1, $2)', [pagne, 'Le tissu déteint-il ?']));
    qid = (await as(db, U.acheteur, () => one<{ id: string }>('select fn_ask_question($1, $2) id', [pagne, '  Le tissu déteint-il au lavage ?  ']))).id;
    expect(await one('select question, answer from product_questions where id = $1', [qid])).toEqual({ question: 'Le tissu déteint-il au lavage ?', answer: null });
    expect(await q(`select user_id, kind, link from notifications where kind = 'question'`)).toEqual([{ user_id: U.vendeur, kind: 'question', link: '/vendeur/questions' }]);
    await refused(as(db, U.acheteur, () => db.query('select fn_ask_question($1, $2)', [pagne, 'ok'])));
  });
  it('la question est publique, sans l’identité de son auteur ; personne n’écrit directement dans la table', async () => {
    const pub = await as(db, 'anon', () => q('select question from product_questions where product_id = $1', [pagne]));
    expect(pub).toEqual([{ question: 'Le tissu déteint-il au lavage ?' }]);
    await refused(as(db, 'anon', () => db.query('select author_id from product_questions')));
    await refused(as(db, U.acheteur, () => db.query(`insert into product_questions (product_id, author_id, question) values ($1, $2, 'directe ?')`, [pagne, U.acheteur])));
    await refused(as(db, U.vendeur, () => db.query(`update product_questions set answer = 'pirate'`)));
  });
  it('seule une boutique qui vend le produit répond ; l’auteur est prévenu ; une autre boutique ne peut pas écraser la réponse', async () => {
    await refused(as(db, U.vendeur2, () => db.query('select fn_answer_question($1, $2)', [qid, 'Non jamais'])));
    await as(db, U.vendeur, () => db.query('select fn_answer_question($1, $2)', [qid, 'Non, couleurs garanties grand teint.']));
    expect(await one('select answer, answer_shop_id from product_questions where id = $1', [qid])).toEqual({ answer: 'Non, couleurs garanties grand teint.', answer_shop_id: shopA });
    expect(await q(`select user_id, link from notifications where kind = 'reponse'`)).toEqual([{ user_id: U.acheteur, link: '/p/pagne' }]);
    // Awa Mode ajoute une offre sur le même produit : elle peut répondre aux questions sans réponse, pas remplacer celle de Kadi Wax.
    await db.query(`insert into offers (shop_id, product_id, price_gnf) values ($1, $2, 9000)`, [shopB, pagne]);
    expect((await refused(as(db, U.vendeur2, () => db.query('select fn_answer_question($1, $2)', [qid, 'Autre avis']))))).toMatch(/autre boutique a déjà répondu/);
    // La boutique corrige sa propre réponse sans renvoyer de notification.
    await as(db, U.vendeur, () => db.query('select fn_answer_question($1, $2)', [qid, 'Non : grand teint, lavage à 30 °C.']));
    expect((await one<{ n: number }>(`select count(*)::int n from notifications where kind = 'reponse'`)).n).toBe(1);
  });
  it('l’espace vendeur liste les questions de ses produits, les questions sans réponse d’abord', async () => {
    const qid2 = (await as(db, U.acheteur2, () => one<{ id: string }>('select fn_ask_question($1, $2) id', [sac, 'Il ferme avec une fermeture éclair ?']))).id;
    const rows = await as(db, U.vendeur, () => q('select id, product_slug, answered_by_me from fn_shop_questions($1)', [shopA]));
    expect(rows).toEqual([{ id: qid2, product_slug: 'sac', answered_by_me: null }, { id: qid, product_slug: 'pagne', answered_by_me: true }]);
    expect(await as(db, U.vendeur2, () => q('select id from fn_shop_questions($1)', [shopA]))).toEqual([]);
  });
  it('limite de 5 questions par jour et par compte', async () => {
    for (let i = 0; i < 3; i++) await as(db, U.acheteur, () => db.query('select fn_ask_question($1, $2)', [fil, `Question numéro ${i + 2} ?`]));
    await as(db, U.acheteur, () => db.query('select fn_ask_question($1, $2)', [fil, 'Cinquième question ?']));
    expect(await refused(as(db, U.acheteur, () => db.query('select fn_ask_question($1, $2)', [fil, 'Sixième question ?'])))).toMatch(/5 questions par jour/);
  });
  it('l’équipe masque une question (inscrite au journal) ; elle disparaît du public ; les autres ne peuvent pas modérer', async () => {
    await refused(as(db, U.vendeur, () => db.query('select fn_moderate_question($1, true)', [qid])));
    await as(db, U.admin, () => db.query('select fn_moderate_question($1, true, $2)', [qid, 'propos hors sujet']));
    expect(await as(db, 'anon', () => q('select id from product_questions where id = $1', [qid]))).toEqual([]);
    expect(await q(`select action from console_journal where target_id = $1`, [qid])).toEqual([{ action: 'question_masquee' }]);
  });
});

describe('souvent achetés ensemble', () => {
  let n = 0;
  async function order(products: string[], status = 'remis') {
    const o = (await one<{ id: string }>(`insert into orders (buyer_id, delivery_declaration_id, buyer_phone, payment_method, subtotal_gnf, delivery_fee_gnf, total_gnf) values ($1, $2, '+224620000000', 'livraison', 10000, 8000, 18000) returning id`, [U.acheteur, buyerDecl])).id;
    const p = (await one<{ id: string }>(`insert into parcels (order_id, shop_id, status, subtotal_gnf, delivery_fee_gnf) values ($1, $2, $3, 10000, 8000) returning id`, [o, shopA, status])).id;
    for (const pr of products) await db.query(`insert into order_items (order_id, parcel_id, offer_id, name_snapshot, price_gnf_snapshot, quantity) values ($1, $2, $3, 'x', 10000, 1)`, [o, p, offerOf[pr]]);
    n++;
  }
  it('rien tant qu’une paire n’a pas été commandée dans au moins 2 commandes (aucune commande isolée devinable)', async () => {
    await order([pagne, fil]);
    expect(await as(db, 'anon', () => q('select * from fn_bought_together($1)', [pagne]))).toEqual([]);
  });
  it('à partir de 2 commandes, les produits associés remontent, les plus fréquents d’abord ; les colis annulés ne comptent pas', async () => {
    await order([pagne, fil]); await order([pagne, sac]); await order([pagne, sac]); await order([pagne, sac]);
    await order([pagne, fil, sac], 'annule');
    expect(await as(db, 'anon', () => q('select product_id, orders::int from fn_bought_together($1)', [pagne]))).toEqual([{ product_id: sac, orders: 3 }, { product_id: fil, orders: 2 }]);
    expect(n).toBe(6);
  });
  it('les commandes elles-mêmes restent invisibles au public', async () => {
    expect(await as(db, 'anon', () => db.query('select * from order_items').then((r) => r.rows, () => []))).toEqual([]);
  });
});
