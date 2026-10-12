/**
 * DONNÉES D'EXEMPLE (fictives) pour montrer les écrans avant que la base de commerce n'existe.
 * Elles seront remplacées par la lecture de la base (tables `shops`, `catalog_products`, `offers`).
 */
import { badgesFor, trustScore, type ShopStats } from '@hailandx/commerce';

export interface SampleShop {
  slug: string;
  name: string;
  initials: string;
  color: string;
  place: string;
  tagline: string;
  stats: ShopStats;
  isNew: boolean;
}

export interface SampleProduct {
  slug: string;
  name: string;
  shopSlug: string;
  category: string;
  priceGnf: number;
  color: string;
  score: number;
  etaMinutes: number;
}

const stats = (o: Partial<ShopStats>): ShopStats => ({ rating: 4.8, reviewCount: 200, reliability: 0.98, sales: 800, ageDays: 500, quality: 0.85, priceScore: 0.7, prepMinutes: 25, ...o });

export const SHOPS: SampleShop[] = [
  { slug: 'kadi-wax', name: 'Kadi Wax', initials: 'KW', color: '#f6d8bd', place: 'Marché Niger, Kaloum', tagline: 'Pagnes, tissus et couture', stats: stats({ rating: 4.9, reviewCount: 412, reliability: 0.99, prepMinutes: 20 }), isNew: false },
  { slug: 'tech-kaloum', name: 'Tech Kaloum', initials: 'TK', color: '#dbe4ff', place: 'Kaloum', tagline: 'Téléphones et accessoires', stats: stats({ rating: 4.7, reviewCount: 160 }), isNew: true },
  { slug: 'beaute-nafi', name: 'Beauté Nafi', initials: 'BN', color: '#f9d6e3', place: 'Ratoma', tagline: 'Soins et cosmétiques naturels', stats: stats({ rating: 4.8, reviewCount: 120 }), isNew: false },
  { slug: 'marche-fraicheur', name: 'Marché Fraîcheur', initials: 'MF', color: '#d7f0dc', place: 'Matam', tagline: 'Légumes et produits frais', stats: stats({ rating: 4.6, reviewCount: 30, sales: 40, ageDays: 40 }), isNew: true },
];

export const PRODUCTS: SampleProduct[] = [
  { slug: 'pagne-wax-hirondelles', name: 'Pagne wax 6 yards «\u00a0Hirondelles\u00a0»', shopSlug: 'kadi-wax', category: 'Mode', priceGnf: 185000, color: '#f6d8bd', score: 0.92, etaMinutes: 35 },
  { slug: 'bazin-riche-brode', name: 'Bazin riche brodé', shopSlug: 'kadi-wax', category: 'Mode', priceGnf: 420000, color: '#e8dcf5', score: 0.7, etaMinutes: 35 },
  { slug: 'ecouteurs-sans-fil', name: 'Écouteurs sans fil', shopSlug: 'tech-kaloum', category: 'Téléphones', priceGnf: 120000, color: '#d9e1fb', score: 0.85, etaMinutes: 50 },
  { slug: 'beurre-de-karite', name: 'Beurre de karité pur', shopSlug: 'beaute-nafi', category: 'Beauté', priceGnf: 45000, color: '#f3d3e0', score: 0.8, etaMinutes: 25 },
  { slug: 'panier-legumes', name: 'Panier de légumes frais', shopSlug: 'marche-fraicheur', category: 'Alimentation', priceGnf: 60000, color: '#d3edd9', score: 0.6, etaMinutes: 40 },
];

export const shopBySlug = (slug: string) => SHOPS.find((s) => s.slug === slug);
export const productBySlug = (slug: string) => PRODUCTS.find((p) => p.slug === slug);
export const trustOf = (s: SampleShop) => trustScore(s.stats);
export const badgesOf = (s: SampleShop) => badgesFor(s.stats);
