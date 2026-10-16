import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { freshDb } from './harness';

/**
 * Ménage des tables inutilisées (supabase/maintenance/2026-10-16_menage_tables_inutilisees.sql), exécuté par le fondateur :
 * on crée ici les huit tables d'anciens prototypes avec quelques lignes, on rejoue le script et on vérifie « copie puis suppression ».
 */
const SCRIPT = readFileSync(new URL('../maintenance/2026-10-16_menage_tables_inutilisees.sql', import.meta.url), 'utf8');
const TABLES = ['admin_pays', 'admin_capitals', 'admin_points', 'admin_lines', 'populated_places', 'concessions', 'deliveries', 'facades'];
let db: PGlite;
const n = async (sql: string) => Number((await db.query<{ n: number }>(sql)).rows[0]!.n);

beforeAll(async () => {
  db = await freshDb();
  for (const t of TABLES) await db.exec(`create table public.${t} (id serial primary key, nom text); insert into public.${t} (nom) values ('a'), ('b');`);
}, 60000);

describe('ménage des tables inutilisées', () => {
  it('sauvegarde chaque table puis la supprime', async () => {
    await db.exec(SCRIPT);
    for (const t of TABLES) {
      expect(await n(`select count(*)::int n from sauvegarde_menage_20261016.${t}`)).toBe(2);
      expect((await db.query(`select to_regclass('public.${t}') r`)).rows[0]).toEqual({ r: null });
    }
  });
  it('est rejouable sans erreur et sans écraser la sauvegarde', async () => {
    await db.exec(SCRIPT);
    expect(await n('select count(*)::int n from sauvegarde_menage_20261016.facades')).toBe(2);
  });
  it('ne touche à aucune table utile', async () => {
    expect(await n(`select count(*)::int n from pg_tables where schemaname = 'public' and tablename in ('buildings', 'declarations', 'parcels')`)).toBe(3);
  });
});
