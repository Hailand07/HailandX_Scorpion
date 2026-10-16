import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Contrôle automatique de BASE_DE_DONNEES.md : toute table (ou vue) du schéma `public` créée par une migration doit être décrite
 * dans le fichier (nom entre accents graves). Ajouter une table sans la documenter fait échouer ce test.
 */
const DOSSIER = new URL('../migrations/', import.meta.url);
const DOC = readFileSync(new URL('../../BASE_DE_DONNEES.md', import.meta.url), 'utf8');
// Tables créées puis supprimées par une migration ultérieure, ou purement techniques.
const IGNOREES = new Set<string>([]);

function objetsCrees(): string[] {
  const noms = new Set<string>();
  for (const f of readdirSync(DOSSIER).filter((x) => x.endsWith('.sql'))) {
    const sql = readFileSync(new URL(f, DOSSIER), 'utf8').replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of sql.matchAll(/create\s+(?:or\s+replace\s+)?(?:table|view)\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z_][a-z0-9_]*)"?\s*(?:\(|as\b)/gi)) noms.add(m[1]!.toLowerCase());
    for (const m of sql.matchAll(/drop\s+(?:table|view)\s+(?:if\s+exists\s+)?(?:public\.)?"?([a-z_][a-z0-9_]*)"?/gi)) noms.delete(m[1]!.toLowerCase());
  }
  return [...noms].filter((n) => !IGNOREES.has(n)).sort();
}

describe('BASE_DE_DONNEES.md', () => {
  it('décrit toutes les tables et vues créées par les migrations', () => {
    const manquantes = objetsCrees().filter((n) => !DOC.includes('`' + n + '`'));
    expect(manquantes, `À ajouter dans BASE_DE_DONNEES.md : ${manquantes.join(', ')}`).toEqual([]);
  });
  it('porte une révision', () => {
    expect(DOC).toMatch(/Révision\s*:?\s*\**\s*\d+/i);
  });
});
