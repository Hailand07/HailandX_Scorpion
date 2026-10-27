/**
 * Parcours d'adresse sur place (écrans React + carte Mapbox), recopié de NavigationX (HAILANDX.md §49) et partagé par
 * HailandX (adresse de livraison) et HailandX Vendeur (adresse de la boutique). Importé à part (`@hailandx/scorpion/parcours`)
 * pour que le reste du paquet reste sans React ni mapbox-gl ; à charger côté navigateur seulement (`next/dynamic`, `ssr: false`).
 */
export * from './AdresseSurPlace';
export * from './declarations';
export { LevelBadge } from './ui';
