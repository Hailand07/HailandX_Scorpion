import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { as, freshDb, refused, U } from './harness';

/** Compte Hailand unique : passage de session à usage unique entre applications, résumé du compte après le code SMS. */
let db: PGlite;
const one = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0]!;

/** Consommation par la fonction serveur (clé de service). */
async function consommer(code: string, cible: string): Promise<string | null> {
  await db.exec('set role service_role');
  try {
    return (await one<{ u: string | null }>('select public.fn_passage_consommer($1, $2) u', [code, cible])).u;
  } finally {
    await db.exec('reset role');
  }
}
const creer = (who: string, cible: string) => as(db, who, () => one<{ c: string }>('select fn_passage_creer($1) c', [cible])).then((r) => r.c);

beforeAll(async () => {
  db = await freshDb();
}, 60000);

describe('passage de session', () => {
  it('le code est remis une fois, à l’application prévue, et donne le bon compte', async () => {
    const code = await creer(U.vendeur, 'navigationx');
    expect(code).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(await consommer(code, 'vendeur')).toBeNull();            // autre application : refusé…
    expect(await consommer(code, 'navigationx')).toBe(U.vendeur);   // …sans consommer le code
    expect(await consommer(code, 'navigationx')).toBeNull();        // une seule fois
  });
  it('le code n’est jamais stocké en clair', async () => {
    const code = await creer(U.acheteur, 'hailandx');
    const n = await one<{ n: number }>('select count(*)::int n from account_passages where code_hash = $1', [code]);
    expect(n.n).toBe(0);
  });
  it('au-delà de 2 minutes, le code est expiré', async () => {
    const code = await creer(U.acheteur2, 'vendeur');
    await db.exec(`update account_passages set expire_le = now() - interval '1 second' where user_id = '${U.acheteur2}'`);
    expect(await consommer(code, 'vendeur')).toBeNull();
  });
  it('visiteur, session anonyme ou application inconnue : refusé', async () => {
    expect(await refused(as(db, 'anon', () => db.query("select fn_passage_creer('vendeur')")))).toMatch(/permission denied|Connexion requise/);
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${U.livreur}', false); select set_config('request.jwt.claims', '{"is_anonymous": true}', false)`);
    expect(await refused(db.query("select fn_passage_creer('vendeur')"))).toMatch(/Connexion requise/);
    await db.exec("reset role; select set_config('request.jwt.claims', '', false); select set_config('request.jwt.claim.sub', '', false)");
    expect(await refused(creer(U.livreur, 'ailleurs'))).toMatch(/inconnue/);
  });
  it('une application ne lit pas la table et ne consomme pas elle-même un code', async () => {
    const code = await creer(U.vendeur2, 'console');
    expect(await refused(as(db, U.vendeur2, () => db.query('select * from account_passages')))).toMatch(/permission denied/);
    expect(await refused(as(db, U.vendeur2, () => db.query("select fn_passage_consommer($1, 'console')", [code])))).toMatch(/permission denied/);
    expect(await refused(as(db, 'anon', () => db.query("select fn_passage_consommer($1, 'console')", [code])))).toMatch(/permission denied/);
  });
  it('au plus 10 passages en attente par compte ; les codes usés sont nettoyés', async () => {
    for (let i = 0; i < 10; i++) await creer(U.livreur2, 'flotte');
    expect(await refused(creer(U.livreur2, 'flotte'))).toMatch(/Trop de passages/);
    await db.exec(`update account_passages set utilise_le = now() where user_id = '${U.livreur2}'`);
    await creer(U.livreur2, 'flotte');
    expect((await one<{ n: number }>(`select count(*)::int n from account_passages where user_id = '${U.livreur2}'`)).n).toBe(1);
  });
});

describe('résumé du compte', () => {
  it('compte vide : rien', async () => {
    const r = (await as(db, U.acheteur, () => one<{ r: Record<string, unknown> }>('select fn_compte_resume() r'))).r;
    expect(r).toEqual({ adresses: 0, niveau: null, boutique: null, livreur: false, equipe: false });
  });
  it('adresses actives et meilleur niveau, boutique, livreur, équipe — seulement pour soi', async () => {
    await db.exec(`insert into declarations (user_id, gps_point, detected_level) values ('${U.vendeur}', point(-13.6, 9.5), 2), ('${U.vendeur}', point(-13.6, 9.5), 1);
      insert into declarations (user_id, gps_point, detected_level, status) values ('${U.vendeur}', point(-13.6, 9.5), 2, 'archived');
      insert into couriers (user_id, full_name, status) values ('${U.livreur}', 'Livreur', 'valide')`);
    await as(db, U.vendeur, () => db.query("insert into shops (slug, name, owner_id) values ('kadi', 'Kadi Wax', $1)", [U.vendeur]));
    const r = (await as(db, U.vendeur, () => one<{ r: Record<string, unknown> }>('select fn_compte_resume() r'))).r;
    expect(r).toEqual({ adresses: 2, niveau: 2, boutique: 'Kadi Wax', livreur: false, equipe: false });
    expect((await as(db, U.livreur, () => one<{ r: { livreur: boolean } }>('select fn_compte_resume() r'))).r.livreur).toBe(true);
    expect((await as(db, U.admin, () => one<{ r: { equipe: boolean; adresses: number } }>('select fn_compte_resume() r'))).r).toMatchObject({ equipe: true, adresses: 0 });
    expect((await as(db, 'anon', () => refused(db.query('select fn_compte_resume() r'))))).toMatch(/permission denied/);
  });
});
