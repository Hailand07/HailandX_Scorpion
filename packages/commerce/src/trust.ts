/**
 * Indice de confiance d'une boutique (0 à 100) et badges. Composition proposée au fondateur (HAILANDX.md §3.3), à ajuster avec les données réelles :
 * avis vérifiés 35 % · fiabilité 30 % · expérience 15 % · qualité de la boutique 10 % · prix 10 %.
 */
export interface TrustInputs {
  /** Note moyenne des avis vérifiés par la Flotte, de 0 à 5, et leur nombre. */
  rating: number;
  reviewCount: number;
  /** Part de commandes préparées à temps, remises sans litige, non annulées (0 à 1). */
  reliability: number;
  /** Nombre de ventes réussies et ancienneté en jours. */
  sales: number;
  ageDays: number;
  /** Complétude de la boutique : photos réelles, descriptions, rapidité de réponse (0 à 1). */
  quality: number;
  /** Compétitivité du prix par rapport aux autres offres des mêmes produits (0 à 1). */
  priceScore: number;
}

export const TRUST_WEIGHTS = { reviews: 35, reliability: 30, experience: 15, quality: 10, price: 10 } as const;
const clamp01 = (x: number) => Math.min(1, Math.max(0, Number.isFinite(x) ? x : 0));

export function trustScore(i: TrustInputs): number {
  // Peu d'avis = note peu fiable : on tire vers la moyenne (3,5) tant qu'il y a moins de 20 avis (lissage bayésien simple).
  const k = 20;
  const smoothed = (i.rating * i.reviewCount + 3.5 * k) / (i.reviewCount + k);
  const reviews = clamp01((smoothed - 1) / 4);
  const experience = clamp01(0.6 * Math.min(1, i.sales / 500) + 0.4 * Math.min(1, i.ageDays / 365));
  const total =
    TRUST_WEIGHTS.reviews * reviews +
    TRUST_WEIGHTS.reliability * clamp01(i.reliability) +
    TRUST_WEIGHTS.experience * experience +
    TRUST_WEIGHTS.quality * clamp01(i.quality) +
    TRUST_WEIGHTS.price * clamp01(i.priceScore);
  return Math.round(total);
}

export interface ShopStats extends TrustInputs {
  /** Temps moyen de préparation, en minutes. */
  prepMinutes: number;
}

/** Badges lisibles par l'acheteur (le détail du calcul reste interne). */
export function badgesFor(s: ShopStats): string[] {
  const out: string[] = [];
  const score = trustScore(s);
  if (score >= 85 && s.reviewCount >= 50) out.push('Top vendeur');
  if (s.reliability >= 0.97 && s.sales >= 30) out.push(`${Math.round(s.reliability * 100)} % livrés`);
  if (s.prepMinutes <= 30 && s.sales >= 10) out.push(`Prépare en ${Math.max(5, Math.round(s.prepMinutes / 5) * 5)} min`);
  if (s.sales < 30 || s.ageDays < 60) out.push('Nouveau vendeur');
  return out;
}
