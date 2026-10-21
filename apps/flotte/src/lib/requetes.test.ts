import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Garde-fou : une requête Supabase (`sb.rpc(…)`, `sb.from(…)`) n'est envoyée que lorsqu'on l'attend (`await` ou `.then`).
 * Écrite « void sb.rpc(…) » sans `.then`, elle ne part jamais : c'est ce qui empêchait la position du livreur d'arriver au serveur.
 */
const racine = new URL('../', import.meta.url).pathname;
const fichiers = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? fichiers(p) : /\.tsx?$/.test(f) && !/\.test\./.test(f) ? [p] : []; });

describe('requêtes Supabase de Flotte', () => {
  it('aucune requête lancée sans être attendue', () => {
    const fautives = fichiers(racine).flatMap((f) => readFileSync(f, 'utf8').split('\n').map((l, i) => ({ f, i: i + 1, l }))
      .filter(({ l }) => /\bvoid\s+\w+!?\.(rpc|from)\(/.test(l) && !/\.then\(/.test(l)));
    expect(fautives.map(({ f, i }) => `${f.replace(racine, '')}:${i}`)).toEqual([]);
  });
});
