import { rankOffers, type Offer } from '@hailandx/commerce';
import { trustFor, type Catalog, type ProductView } from './catalog';

/**
 * Offre affichée : celle de la boutique `b` du lien reçu. Sans `b` (ancien lien), la mieux classée (confiance 45 %, prix 40 %, délai 15 %).
 * Phase de lancement (HAILANDX.md §49) : la page ne montre que cette boutique, jamais les offres concurrentes.
 */
export function pickOffers(cat: Catalog, slug: string, b?: string) {
  const all = cat.products.filter((x) => x.slug === slug);
  const asOffer = (x: ProductView): Offer => ({ id: x.shopSlug, shopId: x.shopSlug, priceGnf: x.priceGnf, shopTrust: trustFor(cat.shops.find((s) => s.slug === x.shopSlug)!), etaMinutes: x.etaMinutes, inStock: x.inStock !== false });
  const ranked = rankOffers(all.map(asOffer)).map((o) => all.find((x) => x.shopSlug === o.shopId)!);
  return { selected: (b && ranked.find((x) => x.shopSlug === b)) || ranked[0] };
}
