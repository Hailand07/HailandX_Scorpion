import { describe, expect, it } from 'vitest';
import { brandOf, cleanAttributes, ficheCompleteness, ficheOf, FICHES, keyFacts, readAttributes, specRows } from './fiche';

describe('fiches produit par catégorie', () => {
  it('chaque catégorie de la base a sa fiche, avec des clés uniques', () => {
    for (const id of ['mode', 'beaute', 'telephones', 'maison', 'alimentation', 'electronique', 'enfants', 'sante', 'auto-moto', 'autres']) {
      const keys = FICHES[id]!.fields.map((f) => f.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
    expect(ficheOf('inconnue')).toBe(FICHES.autres);
    expect(ficheOf(null)).toBe(FICHES.autres);
  });
  it('nettoie la saisie : clés de la fiche seulement, vides retirés, nombres et oui/non normalisés, 5 points forts au plus', () => {
    const a = cleanAttributes('telephones', {
      values: { marque: '  Samsung ', modele: 'Galaxy A15', stockage: '128 Go', double_sim: 'Oui', ecran: '6,5', pirate: 'x', couleur: '   ' },
      points: ['Grande batterie', '', 'Double SIM', 'a', 'b', 'c', 'd'],
    });
    expect(a).toEqual({ marque: 'Samsung', modele: 'Galaxy A15', stockage: '128', ecran: '6.5', double_sim: 'oui', points_forts: ['Grande batterie', 'Double SIM', 'a', 'b', 'c'] });
  });
  it('affichage : tableau dans l’ordre de la fiche, unités, « En bref » sans la marque', () => {
    const a = cleanAttributes('telephones', { values: { marque: 'Samsung', modele: 'Galaxy A15', stockage: '128', ecran: '6.5', double_sim: 'oui', garantie: '1 an' } });
    expect(specRows('telephones', a).map((r) => `${r.label} : ${r.value}`)).toEqual(['Marque : Samsung', 'Modèle : Galaxy A15', 'Stockage : 128 Go', 'Écran : 6,5 pouces', 'Double SIM : Oui', 'Garantie : 1 an']);
    expect(keyFacts('telephones', a).map((r) => r.label)).toEqual(['Modèle', 'Stockage', 'Garantie']);
    expect(brandOf(a)).toBe('Samsung');
    expect(readAttributes(a).values.modele).toBe('Galaxy A15');
  });
  it('complétude : photos, description, points forts et caractéristiques', () => {
    expect(ficheCompleteness('mode', '', {}, 0)).toBe(0);
    const full = cleanAttributes('autres', { values: { marque: 'X', type: 'Y', matiere: 'Z', dimensions: '1', couleur: 'R', garantie: '1 an' }, points: ['a', 'b', 'c'] });
    expect(ficheCompleteness('autres', 'x'.repeat(80), full, 3)).toBe(100);
  });
});
