import { describe, expect, it } from 'vitest';
import { gapPercent, groupByProduct, priceHint, rankOffers } from './index';

describe('concurrence par les prix', () => {
  const o = (slug: string, shopSlug: string, priceGnf: number, inStock = true) => ({ slug, shopSlug, priceGnf, inStock });
  it('une carte par produit, au meilleur prix en stock', () => {
    const g = groupByProduct([o('jordan', 'djigo', 1250000), o('miel', 'djigo', 120000), o('jordan', 'hailand', 1190000), o('jordan', 'kadi', 990000, false)]);
    expect(g.map((x) => x.slug)).toEqual(['jordan', 'miel']);
    expect(g[0]!.best.shopSlug).toBe('hailand');
    expect(g[0]!.sellers).toBe(3);
    expect(g[0]!.minPriceGnf).toBe(990000);
    expect(g[1]!.sellers).toBe(1);
  });
  it('écart au meilleur prix', () => {
    expect(gapPercent(1250000, 1190000)).toBe(5);
    expect(gapPercent(100, 100)).toBe(0);
  });
  it('situe le prix du vendeur face au marché', () => {
    expect(priceHint(100000, []).level).toBe('seul');
    expect(priceHint(95000, [100000, 110000]).level).toBe('meilleur');
    expect(priceHint(110000, [100000, 105000]).level).toBe('proche');
    expect(priceHint(125000, [100000, 105000]).level).toBe('cher');
    expect(priceHint(165000, [120000]).level).toBe('tres-cher');
    expect(priceHint(165000, [120000]).vsMinPct).toBe(38);
  });
  it('un prix exagéré perd la recommandation, même chez une boutique plus sûre', () => {
    const off = (id: string, priceGnf: number, shopTrust: number) => ({ id, shopId: id, priceGnf, shopTrust, etaMinutes: 45, inStock: true });
    expect(rankOffers([off('sure-mais-chere', 165000, 85), off('honnete', 120000, 65)])[0]!.id).toBe('honnete');
    expect(rankOffers([off('sure', 125000, 85), off('a-peine-moins-chere', 120000, 65)])[0]!.id).toBe('sure');
  });
});
