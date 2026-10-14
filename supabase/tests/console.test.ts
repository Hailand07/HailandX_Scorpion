import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { as, freshDb, refused, U } from './harness';

/** Hailand Console : rôles, paramètres réservés au fondateur, journal, circuit des certifications (vendeur → console → HailandMap). */
let db: PGlite;
const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;
const one = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await q<T>(sql, params))[0]!;
const OP = U.livreur2; // un opérateur de l'équipe
let decl: string; let shopId: string;

beforeAll(async () => {
  db = await freshDb();
  await db.exec(`update agents set console_role = 'fondateur', full_name = 'Fondateur' where id = '${U.admin}';
    insert into agents (id, full_name, role, console_role) values ('${OP}', 'Opérateur', 'admin', 'operateur');
    update auth.users set phone = '224620000001' where id = '${U.acheteur2}';`);
  decl = (await one<{ id: string }>(`insert into declarations (user_id, gps_point, quartier_id, commune_id, declared_label, gps_accuracy_m) values ($1, point(-13.67, 9.53), 'qtr-coleah', 'cm-matam', 'Autre', 5) returning id`, [U.vendeur])).id;
  shopId = (await as(db, U.vendeur, () => one<{ id: string }>(`insert into shops (slug, name, owner_id, declaration_id) values ('kadi-wax', 'Kadi Wax', $1, $2) returning id`, [U.vendeur, decl]))).id;
}, 60000);

describe('rôles et paramètres', () => {
  it('les administrateurs existants deviennent opérateurs, sauf les comptes du fondateur', async () => {
    expect(await as(db, U.admin, () => one<{ r: string }>('select fn_console_role() r'))).toEqual({ r: 'fondateur' });
    expect(await as(db, OP, () => one<{ r: string }>('select fn_console_role() r'))).toEqual({ r: 'operateur' });
    expect(await as(db, U.vendeur, () => one<{ r: string | null }>('select fn_console_role() r'))).toEqual({ r: null });
  });
  it('un opérateur ne modifie pas la commission ; le fondateur oui, avec un motif, et c’est inscrit au journal', async () => {
    expect(await as(db, OP, () => refused(db.query(`select fn_console_setting_update('commission_bps', '700', 'essai')`)))).toMatch(/réservé au fondateur/);
    expect(await as(db, OP, () => refused(db.query(`update settings set value = '1' where key = 'commission_bps'`)))).toMatch(/réservé au fondateur/);
    expect(await as(db, U.admin, () => refused(db.query(`select fn_console_setting_update('commission_bps', '700', '')`)))).toMatch(/motif/);
    expect(await as(db, U.admin, () => refused(db.query(`select fn_console_setting_update('commission_bps', '20000', 'trop')`)))).toMatch(/hors limites/);
    expect(await as(db, U.admin, () => refused(db.query(`update settings set value = '1' where key = 'commission_bps'`)))).toMatch(/motif obligatoire/);
    await as(db, U.admin, () => db.query(`select fn_console_setting_update('commission_bps', '700', 'lancement à Matam')`));
    expect((await one<{ value: string }>(`select value from settings where key = 'commission_bps'`)).value).toBe('700');
    const j = await as(db, U.admin, () => one<{ action: string; motif: string; detail: { avant: string; apres: string } }>(`select action, motif, detail from fn_console_journal(5) where action = 'parametre_modifie'`));
    expect(j).toMatchObject({ action: 'parametre_modifie', motif: 'lancement à Matam', detail: { avant: '800', apres: '700' } });
  });
});

describe('journal', () => {
  it('seule l’équipe le lit ; personne ne l’écrit à la main', async () => {
    expect(await as(db, U.vendeur, () => refused(db.query('select * from fn_console_journal(10)')))).toMatch(/réservé/);
    expect(await as(db, U.vendeur, () => q('select id from console_journal'))).toHaveLength(0);
    await as(db, U.admin, () => refused(db.query(`insert into console_journal (action, target_type) values ('faux', 'x')`)));
    await as(db, U.admin, () => refused(db.query(`delete from console_journal`)));
  });
  it('une suspension de boutique par l’équipe est inscrite automatiquement', async () => {
    await as(db, OP, () => db.query(`update shops set status = 'suspendue' where id = $1`, [shopId]));
    const j = await as(db, OP, () => one<{ action: string; actor_name: string }>(`select action, actor_name from fn_console_journal(5) where action = 'boutique_statut'`));
    expect(j).toEqual({ action: 'boutique_statut', actor_name: 'Opérateur' });
    await as(db, OP, () => db.query(`update shops set status = 'preparation' where id = $1`, [shopId]));
  });
});

describe('circuit des certifications', () => {
  it('la demande du vendeur attend la console : HailandMap ne la voit pas encore', async () => {
    expect((await as(db, U.vendeur, () => one<{ s: string }>('select fn_request_priority_certification($1) s', [shopId]))).s).toBe('a_verifier');
    expect((await one<{ s: string | null }>('select certification_status s from declarations where id = $1', [decl])).s).toBe(null);
    expect((await as(db, U.vendeur, () => one<{ status: string }>('select status from certification_priorities where shop_id = $1', [shopId]))).status).toBe('a_verifier');
    const rows = await as(db, OP, () => q<{ shop_name: string; commune: string; status: string }>('select shop_name, commune, status from fn_console_certifications()'));
    expect(rows).toEqual([{ shop_name: 'Kadi Wax', commune: 'Matam', status: 'a_verifier' }]);
  });
  it('vendeur : ne décide pas ; refus sans motif : refusé', async () => {
    expect(await as(db, U.vendeur, () => refused(db.query('select fn_console_certification_decide($1, true)', [decl])))).toMatch(/réservé/);
    expect(await as(db, OP, () => refused(db.query('select fn_console_certification_decide($1, false, $2)', [decl, ''])))).toMatch(/motif/);
  });
  it('confirmée par la console : transmise à HailandMap, vendeur prévenu, journal', async () => {
    await as(db, OP, () => db.query('select fn_console_certification_decide($1, true, $2)', [decl, 'ouvert de 9 h à 19 h']));
    expect((await one<{ s: string }>('select certification_status s from declarations where id = $1', [decl])).s).toBe('demandee');
    expect((await one<{ status: string; console_note: string }>('select status, console_note from certification_priorities where declaration_id = $1', [decl]))).toEqual({ status: 'transmise', console_note: 'ouvert de 9 h à 19 h' });
    expect(Number((await one<{ n: string }>(`select count(*) n from notifications where user_id = $1 and kind = 'certification'`, [U.vendeur])).n)).toBe(1);
    expect((await as(db, OP, () => one<{ action: string }>(`select action from fn_console_journal(1)`))).action).toBe('certification_transmise');
    expect(await as(db, OP, () => refused(db.query('select fn_console_certification_decide($1, false, $2)', [decl, 'trop tard'])))).toMatch(/déjà traitée/);
  });
});

describe('équipe et vue d’ensemble', () => {
  it('seul le fondateur ajoute un membre, par son numéro', async () => {
    expect(await as(db, OP, () => refused(db.query(`select fn_console_team_set('620000001', 'Nouvelle', 'operateur')`)))).toMatch(/réservé au fondateur/);
    expect(await as(db, U.admin, () => refused(db.query(`select fn_console_team_set('629999999', 'Personne', 'operateur')`)))).toMatch(/aucun compte/);
    expect(await as(db, U.admin, () => refused(db.query(`select fn_console_team_set('x', 'Moi', 'operateur')`)))).toMatch(/numéro guinéen invalide/);
    await as(db, U.admin, () => db.query(`select fn_console_team_set('620000001', 'Nouvelle', 'operateur')`));
    const team = await as(db, OP, () => q<{ full_name: string; console_role: string }>('select full_name, console_role from fn_console_team() order by full_name'));
    expect(team.map((t) => t.full_name)).toContain('Nouvelle');
  });
  it('vue d’ensemble : équipe seulement', async () => {
    expect(await as(db, U.vendeur, () => refused(db.query('select * from fn_console_overview()')))).toMatch(/réservé/);
    const o = await as(db, OP, () => one<{ certifs_pending: number; shops_open: number }>('select certifs_pending, shops_open from fn_console_overview()'));
    expect(o).toEqual({ certifs_pending: 0, shops_open: 0 });
  });
});
