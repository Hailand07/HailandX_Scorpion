/**
 * Marketing du vendeur (HAILANDX.md §37) : codes promo, prix barré, motifs d'annulation.
 * Mêmes règles que la base (`private.promo_for`, `fn_parcel_cancel`) ; la base décide, ce module sert à l'affichage.
 */
export type PromoKind = 'pourcentage' | 'montant';
export interface PromoRule { kind: PromoKind; value: number; min_subtotal_gnf: number }

/** Code saisi par le vendeur : majuscules et chiffres, 3 à 20 caractères (« KADI10 »). */
export const normalizePromoCode = (raw: string): string => raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
export const isPromoCode = (code: string): boolean => /^[A-Z0-9]{3,20}$/.test(code);

/** Réduction en GNF sur un sous-total (0 si l'achat minimum n'est pas atteint). Jamais plus que le sous-total. */
export function promoDiscount(rule: PromoRule, subtotal: number): number {
  if (subtotal < rule.min_subtotal_gnf) return 0;
  return Math.min(subtotal, rule.kind === 'pourcentage' ? Math.round((subtotal * rule.value) / 100) : rule.value);
}

/** Phrase courte du code, pour la liste du vendeur et l'aperçu client : « −10 % dès 150 000 GNF ». */
export function promoLabel(rule: PromoRule): string {
  const fmt = (n: number) => n.toLocaleString('fr-FR').replace(/[  ]/g, ' ');
  const off = rule.kind === 'pourcentage' ? `−${rule.value} %` : `−${fmt(rule.value)} GNF`;
  return rule.min_subtotal_gnf > 0 ? `${off} dès ${fmt(rule.min_subtotal_gnf)} GNF d’achat` : `${off} sur la commande`;
}

/** Prix barré valable : l'ancien prix doit dépasser le prix de vente. Renvoie le pourcentage de baisse arrondi, ou null. */
export function discountPercent(price: number, compareAt: number | null | undefined): number | null {
  if (!compareAt || compareAt <= price || price <= 0) return null;
  return Math.round((1 - price / compareAt) * 100);
}

/** Ce que le vendeur reçoit d'un colis : sous-total (déjà réduit) moins la commission Hailand. */
export function sellerNet(subtotal: number, commissionBps: number): { commission: number; net: number } {
  const commission = Math.round((subtotal * commissionBps) / 10000);
  return { commission, net: subtotal - commission };
}

/** Motifs proposés au vendeur quand il annule ; le client les lit dans sa notification. */
export const CANCEL_REASONS = [
  'Rupture de stock',
  'Prix ou produit affiché par erreur',
  'Boutique fermée temporairement',
  'Commande en double',
] as const;
