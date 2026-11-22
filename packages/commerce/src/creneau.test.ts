import { describe, expect, it } from 'vitest';
import { communesTexte, creneauTexte, heureTexte, joursTexte, jourTexte } from './creneau';

describe('créneau de livraison (§64)', () => {
  const lundi = new Date('2026-11-23T10:00:00Z');
  it('heures', () => {
    expect(heureTexte('14:00')).toBe('14 h');
    expect(heureTexte('09:30')).toBe('9 h 30');
  });
  it('jour promis', () => {
    expect(jourTexte('2026-11-23', lundi)).toBe('aujourd’hui');
    expect(jourTexte('2026-11-24', lundi)).toBe('demain');
    expect(jourTexte('2026-11-26', lundi)).toBe('jeudi 26 novembre');
    expect(creneauTexte('2026-11-23', '14:00', '18:00', lundi)).toBe('aujourd’hui entre 14 h et 18 h');
  });
  it('jours et communes', () => {
    expect(joursTexte('1,2,3,4,5,6')).toBe('du lundi au samedi');
    expect(joursTexte('1,3,5')).toBe('lundi, mercredi et vendredi');
    expect(joursTexte('1,2,3,4,5,6,7')).toBe('tous les jours');
    expect(communesTexte(['Ratoma'])).toBe('Ratoma');
    expect(communesTexte(['Dixinn', 'Matam', 'Ratoma'])).toBe('Dixinn, Matam et Ratoma');
  });
});
