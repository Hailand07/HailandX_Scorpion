import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { as, freshDb, refused, U } from './harness';

/** Phase 5 : livreurs ajoutés par la console (plus de candidature publique) ; notification « adresse certifiée ». */
let db: PGlite;
const one = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0]!;

beforeAll(async () => {
  db = await freshDb();
  await db.exec(`update agents set console_role = 'fondateur' where id = '${U.admin}';
    update auth.users set phone = '224622000011' where id = '${U.livreur}';
    update auth.users set phone = '224655001107' where id = '${U.livreur2}';`);
}, 60000);

describe('livreurs recrutés par l’équipe', () => {
  it('candidature publique fermée', async () => {
    expect(await refused(as(db, U.acheteur, () => db.query(`insert into couriers (user_id, full_name) values ($1, 'Moi')`, [U.acheteur])))).toMatch(/row-level security|violates/);
  });
  it('seule l’équipe ajoute un livreur', async () => {
    expect(await refused(as(db, U.acheteur, () => db.query("select fn_console_courier_add('622000011', 'X', 'moto')")))).toMatch(/Réservé à l'équipe/);
    expect(await refused(as(db, U.admin, () => db.query("select fn_console_courier_add('12345', 'Mamadou', 'moto')")))).toMatch(/Numéro guinéen invalide/);
  });
  it('compte existant : livreur validé tout de suite, inscrit au journal', async () => {
    const r = await as(db, U.admin, () => one<{ r: string }>("select fn_console_courier_add('+224 622 00 00 11', 'Mamadou Camara', 'moto') r"));
    expect(r.r).toBe('valide');
    expect(await one(`select status, phone, vehicle from couriers where user_id = '${U.livreur}'`)).toEqual({ status: 'valide', phone: '+224622000011', vehicle: 'moto' });
    expect((await one<{ n: number }>("select count(*)::int n from console_journal where action = 'livreur_ajoute'")).n).toBe(1);
    expect(await as(db, U.livreur, () => one<{ s: string }>('select fn_flotte_rejoindre() s'))).toEqual({ s: 'valide' });
  });
  it('numéro sans compte : invitation en attente, puis livreur validé à sa première connexion à Flotte', async () => {
    // Le compte existe déjà dans le banc : on simule « pas encore de compte » en retirant le numéro, puis on le rend.
    await db.exec(`update auth.users set phone = null where id = '${U.livreur2}'`);
    const r = await as(db, U.admin, () => one<{ r: string }>("select fn_console_courier_add('655001107', 'Ibrahima Sow', 'velo') r"));
    expect(r.r).toBe('invitation');
    expect(await as(db, U.admin, () => one(`select full_name, accepted_at from courier_invitations where phone = '224655001107'`))).toEqual({ full_name: 'Ibrahima Sow', accepted_at: null });
    await db.exec(`update auth.users set phone = '224655001107' where id = '${U.livreur2}'`);
    expect(await as(db, U.livreur2, () => one<{ s: string }>('select fn_flotte_rejoindre() s'))).toEqual({ s: 'valide' });
    expect(await one(`select status, vehicle from couriers where user_id = '${U.livreur2}'`)).toEqual({ status: 'valide', vehicle: 'velo' });
    expect((await one<{ a: string | null }>(`select accepted_at::text a from courier_invitations where phone = '224655001107'`)).a).not.toBeNull();
  });
  it('numéro non enregistré : rien ; les invitations ne sont lisibles que par l’équipe', async () => {
    expect(await as(db, U.acheteur, () => one<{ s: string | null }>('select fn_flotte_rejoindre() s'))).toEqual({ s: null });
    expect((await as(db, U.acheteur, () => db.query('select * from courier_invitations'))).rows).toEqual([]);
    expect((await as(db, U.admin, () => db.query('select * from courier_invitations'))).rows.length).toBe(2);
  });
});

describe('notification « adresse certifiée »', () => {
  it('le vendeur dont la boutique attend est prévenu quand le bâtiment de son adresse est certifié', async () => {
    const d = (await one<{ id: string }>(`insert into declarations (user_id, gps_point, detected_level) values ('${U.vendeur}', point(-13.6, 9.5), 2) returning id`)).id;
    await as(db, U.vendeur, () => db.query("insert into shops (slug, name, owner_id, declaration_id) values ('kadi', 'Kadi Wax', $1, $2)", [U.vendeur, d]));
    const autre = (await one<{ id: string }>(`insert into declarations (user_id, gps_point, detected_level) values ('${U.acheteur}', point(-13.6, 9.5), 2) returning id`)).id;
    await db.exec(`insert into buildings (id, status, is_validated) values ('b-9', 'actif', true);
      update declarations set certified_building_id = 'b-9' where id in ('${d}', '${autre}')`);
    const n = await as(db, U.vendeur, () => db.query<{ kind: string; title: string; link: string }>("select kind, title, link from notifications where kind = 'certification'"));
    expect(n.rows).toEqual([{ kind: 'certification', title: 'Adresse certifiée : vous pouvez ouvrir la vente', link: '/vendeur/ouvrir' }]);
    expect((await one<{ n: number }>(`select count(*)::int n from notifications where kind = 'certification' and user_id = '${U.acheteur}'`)).n).toBe(0);
    await db.exec(`update declarations set certified_building_id = 'b-9' where id = '${d}'`);
    expect((await one<{ n: number }>("select count(*)::int n from notifications where kind = 'certification'")).n).toBe(1);
  });
});
