import { describe, expect, it } from 'vitest';
import { discountPercent, isPromoCode, normalizePromoCode, promoDiscount, promoLabel, sellerNet } from './promo';

describe('codes promo', () => {
  it('normalise et valide le code', () => {
    expect(normalizePromoCode(' kadi-10 ')).toBe('KADI10');
    expect(isPromoCode('KADI10')).toBe(true);
    expect(isPromoCode('KA')).toBe(false);
  });
  it('calcule la réduction comme la base', () => {
    const pct = { kind: 'pourcentage' as const, value: 10, min_subtotal_gnf: 150000 };
    expect(promoDiscount(pct, 200000)).toBe(20000);
    expect(promoDiscount(pct, 100000)).toBe(0);
    expect(promoDiscount({ kind: 'montant', value: 50000, min_subtotal_gnf: 0 }, 30000)).toBe(30000);
  });
  it('décrit le code en une phrase', () => {
    expect(promoLabel({ kind: 'pourcentage', value: 10, min_subtotal_gnf: 150000 })).toBe('−10 % dès 150 000 GNF d’achat');
    expect(promoLabel({ kind: 'montant', value: 20000, min_subtotal_gnf: 0 })).toBe('−20 000 GNF sur la commande');
  });
});

describe('prix barré et part du vendeur', () => {
  it('pourcentage de baisse seulement si l’ancien prix est plus haut', () => {
    expect(discountPercent(185000, 210000)).toBe(12);
    expect(discountPercent(185000, 185000)).toBeNull();
    expect(discountPercent(185000, null)).toBeNull();
  });
  it('commission calculée après réduction', () => {
    expect(sellerNet(180000, 800)).toEqual({ commission: 14400, net: 165600 });
  });
});
