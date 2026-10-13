import { type ShopStats } from '@hailandx/commerce';
import { PRODUCTS as SAMPLE_PRODUCTS, SHOPS as SAMPLE_SHOPS, type SampleProduct, type SampleShop } from '@/data/sample';
import { serverClient } from './supabase';

export type ShopView = SampleShop;
export type ProductView = SampleProduct & { offerId?: string };

export interface Catalog {
  shops: ShopView[];
  products: ProductView[];
  /** « base » = données réelles ; « exemple » = aucune boutique ouverte pour l'instant. */
  source: 'base' | 'exemple';
}

const PALETTE = ['#f6d8bd', '#dbe4ff', '#f9d6e3', '#d7f0dc', '#e8dcf5', '#fbeec1', '#d3edd9', '#f3d3e0'];
/** Couleur stable dérivée du nom (en attendant les vraies photos). */
export const colorOf = (key: string): string => {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
};
export const initialsOf = (name: string): string =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?';

const DAY = 86_400_000;

interface ShopRow {
  slug: string; name: string; tagline: string | null; created_at: string;
  shop_scores: { rating: number; review_count: number; reliability: number; sales: number; prep_minutes: number | null } | null;
}
interface OfferRow {
  id: string; price_gnf: number;
  catalog_products: { slug: string; name: string; category_id: string | null; categories: { name: string } | null } | null;
  shops: { slug: string; status: string } | null;
}

function shopFromRow(r: ShopRow): ShopView {
  const sc = r.shop_scores;
  const ageDays = Math.floor((Date.now() - new Date(r.created_at).getTime()) / DAY);
  const stats: ShopStats = {
    rating: Number(sc?.rating ?? 0), reviewCount: sc?.review_count ?? 0, reliability: Number(sc?.reliability ?? 0),
    sales: sc?.sales ?? 0, ageDays, quality: 0.7, priceScore: 0.6, prepMinutes: sc?.prep_minutes ?? 30,
  };
  return { slug: r.slug, name: r.name, initials: initialsOf(r.name), color: colorOf(r.slug), place: '', tagline: r.tagline ?? '', stats, isNew: ageDays < 30 };
}

/** Lit la vitrine : boutiques ouvertes à la vente et leurs offres actives. Repli sur les exemples si la base est vide ou injoignable. */
export async function getCatalog(): Promise<Catalog> {
  const sb = serverClient();
  if (!sb) return { shops: SAMPLE_SHOPS, products: SAMPLE_PRODUCTS, source: 'exemple' };
  try {
    const [s, o] = await Promise.all([
      sb.from('shops').select('slug,name,tagline,created_at,shop_scores(rating,review_count,reliability,sales,prep_minutes)').eq('status', 'ouverte').order('created_at', { ascending: false }).limit(60),
      sb.from('offers').select('id,price_gnf,catalog_products(slug,name,category_id,categories(name)),shops!inner(slug,status)').eq('active', true).eq('shops.status', 'ouverte').limit(300),
    ]);
    if (s.error || o.error) throw s.error ?? o.error;
    const shops = (s.data as unknown as ShopRow[]).map(shopFromRow);
    if (shops.length === 0) return { shops: SAMPLE_SHOPS, products: SAMPLE_PRODUCTS, source: 'exemple' };
    const products: ProductView[] = [];
    for (const r of o.data as unknown as OfferRow[]) {
      if (!r.catalog_products || !r.shops) continue;
      products.push({
        slug: r.catalog_products.slug, offerId: r.id, name: r.catalog_products.name, shopSlug: r.shops.slug,
        category: r.catalog_products.categories?.name ?? 'Autres', priceGnf: r.price_gnf,
        color: colorOf(r.catalog_products.slug), score: 0.5, etaMinutes: 40,
      });
    }
    return { shops, products, source: 'base' };
  } catch {
    return { shops: SAMPLE_SHOPS, products: SAMPLE_PRODUCTS, source: 'exemple' };
  }
}
