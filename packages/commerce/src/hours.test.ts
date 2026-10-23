import { describe, expect, it } from 'vitest';
import { hoursSummary, isOpenNow, onVacation, type ShopHours } from './hours';

const week: ShopHours = { lun: ['08:00', '20:00'], mar: ['08:00', '20:00'], mer: ['08:00', '20:00'], jeu: ['08:00', '20:00'], ven: ['08:00', '20:00'], sam: ['08:00', '20:00'], dim: null };

describe('horaires', () => {
  it('ouvert ou fermé selon l’heure de Conakry (UTC)', () => {
    expect(isOpenNow(week, new Date('2026-10-23T10:00:00Z'))).toBe(true); // vendredi
    expect(isOpenNow(week, new Date('2026-10-23T20:30:00Z'))).toBe(false);
    expect(isOpenNow(week, new Date('2026-10-25T10:00:00Z'))).toBe(false); // dimanche
    expect(isOpenNow(null)).toBeNull();
  });
  it('résumé lisible', () => {
    expect(hoursSummary(week)).toBe('Lun–sam 8 h–20 h · dim. fermé');
    expect(hoursSummary({ lun: ['09:30', '18:00'], mer: ['10:00', '14:00'] })).toBe('Lun 9 h 30–18 h · Mer 10 h–14 h');
  });
  it('congés jusqu’au dernier jour inclus', () => {
    expect(onVacation('2026-10-23', new Date('2026-10-23T22:00:00Z'))).toBe(true);
    expect(onVacation('2026-10-22', new Date('2026-10-23T08:00:00Z'))).toBe(false);
  });
});
