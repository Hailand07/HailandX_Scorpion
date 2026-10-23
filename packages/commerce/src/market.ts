/**
 * Concurrence par les prix (HAILANDX.md §39) : un même produit (même fiche commune) vendu par plusieurs boutiques
 * n'apparaît qu'UNE fois dans les rangées, au meilleur prix, avec le nombre de vendeurs ; le vendeur voit où se situe
 * son prix face au marché. Le client compare d'un coup d'œil : exagérer sur le prix fait perdre la vitrine.
 */

/** Une offre vue par le regroupement : fiche (`slug`), boutique, prix, disponibilité. */
export interface MarketOffer { slug: string; shopSlug: string; priceGnf: number; inStock?: boolean }

export interface ProductGroup<T extends MarketOffer> {
  slug: string;
  /** Offre affichée sur la carte : la moins chère en stock (sinon la moins chère tout court). */
  best: T;
  offers: T[];
  /** Nombre de boutiques qui proposent ce produit. */
  sellers: number;
  minPriceGnf: number;
  maxPriceGnf: number;
}

const cheaper = <T extends MarketOffer>(a: T, b: T): number =>
  Number(b.inStock !== false) - Number(a.inStock !== false) || a.priceGnf - b.priceGnf || a.shopSlug.localeCompare(b.shopSlug);

/** Regroupe les offres par fiche, dans l'ordre de première apparition. */
export function groupByProduct<T extends MarketOffer>(offers: T[]): ProductGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const o of offers) (map.get(o.slug) ?? map.set(o.slug, []).get(o.slug)!).push(o);
  return [...map.entries()].map(([slug, list]) => {
    const sorted = [...list].sort(cheaper);
    const prices = list.map((o) => o.priceGnf);
    return { slug, best: sorted[0]!, offers: sorted, sellers: new Set(list.map((o) => o.shopSlug)).size, minPriceGnf: Math.min(...prices), maxPriceGnf: Math.max(...prices) };
  });
}

/** Écart d'un prix au meilleur prix, en pour cent arrondi (0 si c'est le meilleur). */
export const gapPercent = (price: number, best: number): number => (best > 0 && price > best ? Math.round(((price - best) / best) * 100) : 0);

export type PriceLevel = 'seul' | 'meilleur' | 'proche' | 'cher' | 'tres-cher';

export interface PriceHint {
  level: PriceLevel;
  /** Nombre d'autres vendeurs comparés. */
  others: number;
  minGnf: number | null;
  medianGnf: number | null;
  /** Écart au prix médian des autres vendeurs, en pour cent (négatif = moins cher). */
  vsMedianPct: number | null;
  /** Écart au meilleur prix des autres vendeurs, en pour cent (négatif = moins cher). */
  vsMinPct: number | null;
}

/** Au-delà de ce dépassement du prix médian, le prix est signalé « plus cher que le marché » ; au double, « bien trop cher ». */
export const PRICE_WARN_PCT = 15;

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : Math.round((s[m - 1]! + s[m]!) / 2);
};

/** Où se situe un prix face aux autres vendeurs du même produit. */
export function priceHint(myPrice: number, otherPrices: number[]): PriceHint {
  const xs = otherPrices.filter((x) => x > 0);
  if (xs.length === 0 || !(myPrice > 0)) return { level: 'seul', others: xs.length, minGnf: xs.length ? Math.min(...xs) : null, medianGnf: xs.length ? median(xs) : null, vsMedianPct: null, vsMinPct: null };
  const minGnf = Math.min(...xs);
  const medianGnf = median(xs);
  const vsMedianPct = Math.round(((myPrice - medianGnf) / medianGnf) * 100);
  const vsMinPct = Math.round(((myPrice - minGnf) / minGnf) * 100);
  const level: PriceLevel = myPrice <= minGnf ? 'meilleur' : vsMedianPct > 2 * PRICE_WARN_PCT ? 'tres-cher' : vsMedianPct > PRICE_WARN_PCT ? 'cher' : 'proche';
  return { level, others: xs.length, minGnf, medianGnf, vsMedianPct, vsMinPct };
}
