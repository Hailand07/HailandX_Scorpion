import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { as, freshDb, U } from './harness';

/** §54 : une boutique choisit plusieurs catégories (voire toutes) ; la catégorie principale reste la première. */
let db: PGlite;
let decl: string;
const one = async <T,>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0]!;

beforeAll(async () => {
  db = await freshDb();
  // Catégories de départ (production : migration 2026-10-13_hailandx_categories, non rejouée par le banc).
  await db.exec(`insert into categories (id, name, position) values ('mode', 'Mode', 1), ('beaute', 'Beauté', 2) on conflict do nothing`);
  decl = (await one<{ id: string }>(`insert into declarations (user_id, gps_point, quartier_id, gps_accuracy_m) values ($1, point(-13.67, 9.53), 'qtr-coleah', 5) returning id`, [U.vendeur])).id;
}, 60000);

describe('catégories multiples d’une boutique', () => {
  it('les nouvelles catégories existent', async () => {
    const n = await one<{ n: number }>(`select count(*)::int n from categories where id in ('tissus-pagnes', 'chaussures', 'meches-perruques', 'informatique')`);
    expect(n.n).toBe(4);
  });
  it('plusieurs catégories : ordre gardé, doublons et inconnues écartés, principale = la première', async () => {
    const s = await as(db, U.vendeur, () => one<{ category_id: string; category_ids: string[] }>(
      `insert into shops (slug, name, owner_id, declaration_id, category_ids) values ('multi', 'Multi', $1, $2, $3) returning category_id, category_ids`,
      [U.vendeur, decl, ['chaussures', 'mode', 'inconnue', 'chaussures', 'tissus-pagnes']]));
    expect(s.category_ids).toEqual(['chaussures', 'mode', 'tissus-pagnes']);
    expect(s.category_id).toBe('chaussures');
  });
  it('ancienne écriture (une seule catégorie) : la liste suit', async () => {
    const s = await as(db, U.vendeur, () => one<{ category_ids: string[] }>(`update shops set category_id = 'beaute' where slug = 'multi' returning category_ids`));
    expect(s.category_ids[0]).toBe('beaute');
    expect(s.category_ids).toContain('chaussures');
  });
});
