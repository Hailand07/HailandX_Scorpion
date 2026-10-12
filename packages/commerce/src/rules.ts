import type { AddressLevel } from '@hailandx/scorpion';

export type { AddressLevel };

/** Un vendeur ne peut VENDRE qu'avec un emplacement certifié (niveau 3). Il peut préparer sa boutique avant. */
export const canSell = (level: AddressLevel | null | undefined): boolean => level === 3;

/** Un acheteur doit avoir au moins le niveau 1 pour qu'une livraison soit possible. */
export const canDeliverTo = (level: AddressLevel | null | undefined): boolean => level === 1 || level === 2 || level === 3;

export type ShopState = 'preparation' | 'bientot' | 'ouverte' | 'suspendue';

/** État d'une boutique selon la certification de son emplacement et une éventuelle suspension. */
export function shopState(level: AddressLevel | null | undefined, hasProducts: boolean, suspended = false): ShopState {
  if (suspended) return 'suspendue';
  if (canSell(level)) return 'ouverte';
  return hasProducts ? 'bientot' : 'preparation';
}

/** Précision attendue à la porte, affichée au livreur selon le niveau de l'adresse. */
export function doorPrecision(level: AddressLevel): 'portail' | 'batiment' | 'zone' {
  return level === 3 ? 'portail' : level === 2 ? 'batiment' : 'zone';
}
