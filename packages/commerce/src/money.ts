/** Montants en francs guinéens (GNF), toujours des entiers. */

/** « 185000 » → « 185 000 GNF ». Insère une espace insécable fine entre les milliers (stable d'un navigateur à l'autre). */
export function formatGnf(amount: number, withUnit = true): string {
  const n = Math.round(Number.isFinite(amount) ? amount : 0);
  const sign = n < 0 ? '-' : '';
  const digits = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${sign}${digits}${withUnit ? ' GNF' : ''}`;
}

/** Tarif de livraison de la Flotte : base + prix au kilomètre, arrondi à 500 GNF. ⚠️ Valeurs provisoires, à fixer avec le fondateur. */
export interface FeeConfig {
  baseGnf: number;
  perKmGnf: number;
  roundToGnf: number;
  minGnf: number;
}
export const DEFAULT_FEE: FeeConfig = { baseGnf: 6000, perKmGnf: 2100, roundToGnf: 500, minGnf: 8000 };

export function deliveryFeeGnf(distanceKm: number, cfg: FeeConfig = DEFAULT_FEE): number {
  const km = Math.max(0, Number.isFinite(distanceKm) ? distanceKm : 0);
  const raw = cfg.baseGnf + cfg.perKmGnf * km;
  const rounded = Math.round(raw / cfg.roundToGnf) * cfg.roundToGnf;
  return Math.max(cfg.minGnf, rounded);
}
