import { describe, expect, it } from 'vitest';
import { estNouveau, lignesResume, origineTexte, telMasque } from './compte';

describe('Compte Hailand : écran après le code', () => {
  it('nouveau seulement dans les 10 minutes qui suivent la création', () => {
    const now = Date.parse('2026-10-14T20:00:00Z');
    expect(estNouveau('2026-10-14T19:55:00Z', now)).toBe(true);
    expect(estNouveau('2026-10-14T19:40:00Z', now)).toBe(false);
    expect(estNouveau(undefined, now)).toBe(false);
  });
  it('numéro masqué', () => {
    expect(telMasque('224622112233')).toBe('+224 622 •• •• 33');
    expect(telMasque('+224622112233')).toBe('+224 622 •• •• 33');
    expect(telMasque(null)).toBe('');
  });
  it('lignes « Déjà sur ce compte »', () => {
    expect(lignesResume({ adresses: 0, niveau: null, boutique: null, livreur: false, equipe: false })).toEqual([]);
    expect(lignesResume({ adresses: 1, niveau: 2, boutique: 'Kadi Wax', livreur: true, equipe: false }).map((x) => x.texte))
      .toEqual(['1 adresse enregistrée · niveau 2', 'Boutique « Kadi Wax »', 'Livreur de la Flotte Hailand']);
    expect(lignesResume({ adresses: 3, niveau: 3, boutique: null, livreur: false, equipe: true }).map((x) => x.texte))
      .toEqual(['3 adresses enregistrées · niveau 3', 'Équipe Hailand']);
  });
  it('origine', () => {
    expect(origineTexte('navigationx')).toBe('compte créé dans NavigationX');
    expect(origineTexte('ailleurs')).toBe('');
  });
});
