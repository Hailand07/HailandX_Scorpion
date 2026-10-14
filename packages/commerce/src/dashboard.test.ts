import { describe, expect, it } from 'vitest';
import { ago, barHeights, isOrderActive, maskPhone, orderStep, periodStats, sellerTab, shortGnf, type SalesDay } from './dashboard';

const days = (values: number[]): SalesDay[] => values.map((v, i) => ({ day: `2026-10-${String(i + 1).padStart(2, '0')}`, parcels: v ? 1 : 0, revenue_gnf: v }));

describe('ventes du vendeur', () => {
  it('somme la période et la compare à la précédente', () => {
    const s = periodStats(days([100, 100, 200, 100]), 2);
    expect(s.revenue).toBe(300);
    expect(s.previous).toBe(200);
    expect(s.trendPct).toBe(50);
    expect(s.parcels).toBe(2);
  });
  it('pas de tendance sans période précédente complète ou vide', () => {
    expect(periodStats(days([0, 0, 500]), 1).trendPct).toBe(null);
    expect(periodStats(days([300]), 1).trendPct).toBe(null);
  });
  it('barres : relatives au meilleur jour, jamais invisibles', () => {
    expect(barHeights(days([0, 50, 100]))).toEqual([3, 50, 100]);
    expect(barHeights(days([1, 1000]))[0]).toBe(6);
  });
  it('montants courts', () => {
    expect(shortGnf(1_250_000)).toBe('1,25 M');
    expect(shortGnf(2_000_000)).toBe('2 M');
    expect(shortGnf(740_000)).toBe('740 k');
    expect(shortGnf(9_500)).toBe('9500');
  });
});

describe('colis du vendeur', () => {
  it('reste « à préparer » tant que le livreur ne l’a pas retiré', () => {
    expect(sellerTab('attente_vendeur')).toBe('preparer');
    expect(sellerTab('mission_proposee')).toBe('preparer');
    expect(sellerTab('accepte')).toBe('preparer');
    expect(sellerTab('retire')).toBe('route');
    expect(sellerTab('remis')).toBe('terminees');
    expect(sellerTab('annule')).toBe('terminees');
    expect(sellerTab('litige')).toBe('problemes');
  });
  it('durées lisibles', () => {
    const now = Date.parse('2026-10-14T12:00:00Z');
    expect(ago('2026-10-14T11:42:00Z', now)).toBe('il y a 18 min');
    expect(ago('2026-10-14T09:00:00Z', now)).toBe('il y a 3 h');
    expect(ago('2026-10-11T12:00:00Z', now)).toBe('il y a 3 j');
  });
});

describe('commandes de l’acheteur', () => {
  it('en cours tant qu’un colis n’est ni remis ni annulé', () => {
    expect(isOrderActive(['remis', 'annule'])).toBe(false);
    expect(isOrderActive(['remis', 'retire'])).toBe(true);
    expect(isOrderActive(['litige'])).toBe(true);
  });
  it('étape du colis le moins avancé', () => {
    expect(orderStep(['retire', 'attente_vendeur'])).toEqual({ index: 0, litige: false });
    expect(orderStep(['retire', 'remis'])).toEqual({ index: 2, litige: false });
    expect(orderStep(['litige', 'retire']).litige).toBe(true);
  });
  it('masque le numéro', () => {
    expect(maskPhone('224612746342')).toBe('+224 612 •• •• 42');
    expect(maskPhone('+224 620 00 00 18')).toBe('+224 620 •• •• 18');
    expect(maskPhone(null)).toBe('Compte HailandX');
  });
});
