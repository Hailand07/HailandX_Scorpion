import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { as, freshDb, U } from './harness';

/**
 * Script de remise à zéro des comptes (supabase/maintenance/2026-10-22_reinitialisation_comptes.sql), exécuté par le fondateur :
 * on le rejoue ici sur une base remplie (boutique, commande, livreur, notifications…) pour vérifier qu'il passe d'un bloc,
 * sauvegarde avant d'effacer, garde les comptes agents et le cadastre, et refuse une seconde exécution.
 */
let db: PGlite;
const one = async <T = Record<string, unknown>>(sql: string) => (await db.query<T>(sql)).rows[0]!;
const SCRIPT = readFileSync(new URL('../maintenance/2026-10-22_reinitialisation_comptes.sql', import.meta.url), 'utf8');

beforeAll(async () => {
  db = await freshDb();
  // Tables d'authentification et colonne du cadastre présentes en production, absentes du banc.
  await db.exec(`create table if not exists auth.identities (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users (id) on delete cascade);
    create table if not exists auth.sessions (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users (id) on delete cascade);
    alter table public.buildings add column if not exists claimed_by text;
    insert into public.buildings (id, status, is_validated, claimed_by) values ('b-cad', 'actif', true, '${U.vendeur}');
    insert into auth.sessions (user_id) select id from auth.users;`);
  const sd = (await one<{ id: string }>(`insert into declarations (user_id, gps_point) values ('${U.vendeur}', point(-13.67, 9.53)) returning id`)).id;
  await db.exec(`insert into declarations (user_id, gps_point) values ('${U.admin}', point(-13.66, 9.54)), ('${U.acheteur}', point(-13.65, 9.55))`);
  await as(db, U.vendeur, () => db.query(`insert into shops (slug, name, owner_id, declaration_id) values ('kadi', 'Kadi', $1, $2)`, [U.vendeur, sd]));
  await db.exec(`insert into couriers (user_id, full_name, status) values ('${U.livreur}', 'Livreur', 'valide');
    insert into notifications (user_id, kind, title) values ('${U.admin}', 'x', 'test'), ('${U.acheteur}', 'x', 'test');`);
}, 60000);

describe('remise à zéro des comptes', () => {
  it('passe d’un bloc : données vidées, comptes agents gardés, cadastre intact, sessions fermées, sauvegarde faite', async () => {
    const agents = Number((await one<{ n: number }>('select count(*)::int n from agents')).n);
    const before = await one<{ d: number; s: number; n: number }>('select (select count(*)::int from declarations) d, (select count(*)::int from shops) s, (select count(*)::int from notifications) n');
    await db.exec(SCRIPT);
    expect(await one(`select (select count(*)::int from auth.users) users, (select count(*)::int from declarations) d, (select count(*)::int from shops) s,
      (select count(*)::int from couriers) c, (select count(*)::int from notifications) n, (select count(*)::int from auth.sessions) sess,
      (select count(*)::int from buildings) b, (select count(*)::int from buildings where claimed_by is not null) claimed`))
      .toEqual({ users: agents, d: 0, s: 0, c: 0, n: 0, sess: 0, b: 1, claimed: 0 });
    // Les comptes gardés sont exactement ceux de la table agents (l'administrateur du banc en fait partie).
    expect((await one<{ ok: boolean }>(`select bool_and(exists (select 1 from agents a where a.id = u.id)) ok from auth.users u`)).ok).toBe(true);
    expect((await one<{ n: number }>(`select count(*)::int n from auth.users where id = '${U.admin}'`)).n).toBe(1);
    // Sauvegarde complète de ce qui a été effacé.
    expect(await one(`select (select count(*)::int from sauvegarde_20261022.declarations) d, (select count(*)::int from sauvegarde_20261022.shops) s,
      (select count(*)::int from sauvegarde_20261022.notifications) n, (select count(*)::int from sauvegarde_20261022.buildings_claimed) bc`))
      .toEqual({ d: before.d, s: before.s, n: before.n, bc: 1 });
  });
  it('refuse une seconde exécution sans rien modifier', async () => {
    await expect(db.exec(SCRIPT)).rejects.toThrow(/déjà été exécutée/);
    await db.exec('rollback').catch(() => undefined);
    expect((await one<{ n: number }>('select count(*)::int n from sauvegarde_20261022.declarations')).n).toBeGreaterThan(0);
  });
});
