/**
 * Fil « la rue commerçante » : pour chaque boutique, UN échantillon par catégorie ; le meilleur candidat tourne dans le temps ;
 * on évite deux échantillons d'une même boutique à la suite ; les nouvelles boutiques reçoivent un coup de pouce temporaire.
 */
export interface FeedCandidate {
  id: string;
  shopId: string;
  category: string;
  /** Score du produit (ventes, avis, fraîcheur), de 0 à 1. */
  score: number;
  /** Indice de confiance de la boutique (0 à 100). */
  shopTrust: number;
  /** La boutique est nouvelle : mise en avant temporaire. */
  shopIsNew?: boolean;
  /** Délai de livraison estimé vers l'acheteur, en minutes (proximité). */
  etaMinutes?: number;
}

export interface FeedOptions {
  /** Graine de rotation (ex. numéro de l'heure) : change périodiquement l'échantillon retenu. */
  rotation?: number;
  /** Nombre d'éléments maximum. */
  limit?: number;
  /** Catégorie demandée (« tout » si absente). */
  category?: string;
  /** Éléments gardés par (boutique, catégorie) : 1 = l'échantillon de la rue (défaut) ; `Infinity` = tout le catalogue, même ordre et même intercalage. */
  perGroup?: number;
}

const rank = (c: FeedCandidate): number => {
  const trust = c.shopTrust / 100;
  const boost = c.shopIsNew ? 0.12 : 0;
  const near = c.etaMinutes === undefined ? 0 : Math.max(0, 1 - c.etaMinutes / 120) * 0.1;
  return 0.5 * c.score + 0.35 * trust + boost + near;
};

export function buildFeed(candidates: FeedCandidate[], opts: FeedOptions = {}): FeedCandidate[] {
  const rotation = opts.rotation ?? 0;
  const pool = opts.category && opts.category !== 'tout' ? candidates.filter((c) => c.category === opts.category) : candidates;

  // Un échantillon par (boutique, catégorie) : parmi les 3 meilleurs, celui désigné par la rotation.
  const groups = new Map<string, FeedCandidate[]>();
  for (const c of pool) {
    const key = `${c.shopId}|${c.category}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(c);
  }
  const samples: FeedCandidate[] = [];
  const perGroup = opts.perGroup ?? 1;
  for (const list of groups.values()) {
    const sorted = [...list].sort((a, b) => rank(b) - rank(a) || a.id.localeCompare(b.id));
    if (perGroup > 1) { samples.push(...sorted.slice(0, perGroup)); continue; }
    const top = sorted.slice(0, 3);
    samples.push(top[Math.abs(rotation) % top.length]);
  }

  // Tri par rang, puis intercalage : jamais deux échantillons de la même boutique à la suite si on peut l'éviter.
  const sorted = samples.sort((a, b) => rank(b) - rank(a) || a.id.localeCompare(b.id));
  const out: FeedCandidate[] = [];
  const rest = [...sorted];
  while (rest.length) {
    const last = out[out.length - 1];
    let idx = rest.findIndex((c) => !last || c.shopId !== last.shopId);
    if (idx === -1) idx = 0;
    out.push(rest.splice(idx, 1)[0]);
  }
  return opts.limit ? out.slice(0, opts.limit) : out;
}

/** Offre d'un vendeur sur une fiche produit commune. */
export interface Offer {
  id: string;
  shopId: string;
  priceGnf: number;
  shopTrust: number;
  etaMinutes: number;
  inStock: boolean;
}

/**
 * Classe les offres d'une même fiche : confiance (45 %), prix (40 %), délai (15 %). L'offre recommandée est la première en stock.
 * Le prix compte en proportion du meilleur prix (meilleur ÷ prix) : 10 % plus cher coûte peu, 50 % plus cher coûte autant
 * que 30 points de confiance — exagérer sur le prix fait perdre la recommandation (HAILANDX.md §39).
 */
export function rankOffers(offers: Offer[]): Offer[] {
  const avail = offers.filter((o) => o.inStock);
  if (avail.length === 0) return [...offers];
  const prices = avail.map((o) => o.priceGnf);
  const minP = Math.min(...prices);
  const etas = avail.map((o) => o.etaMinutes);
  const minE = Math.min(...etas);
  const maxE = Math.max(...etas);
  const norm = (v: number, lo: number, hi: number) => (hi === lo ? 1 : 1 - (v - lo) / (hi - lo));
  const score = (o: Offer) => 0.45 * (o.shopTrust / 100) + 0.4 * (minP / o.priceGnf) + 0.15 * norm(o.etaMinutes, minE, maxE);
  const out = offers.filter((o) => o.inStock).sort((a, b) => score(b) - score(a) || a.priceGnf - b.priceGnf);
  return [...out, ...offers.filter((o) => !o.inStock)];
}

/** Un produit vu par les recommandations (« Produits similaires » en bas d'une fiche). */
export interface SimilarCandidate { key: string; categoryId?: string | null; priceGnf: number; attributes?: Record<string, unknown> | null; shopTrust?: number }

const norm = (v: unknown): string => (typeof v === 'string' ? v.trim().toLowerCase() : '');

/**
 * Produits de même catégorie (toutes boutiques), du plus proche au moins proche : même type d'article (+3),
 * même marque (+2), prix voisin (jusqu'à +1,5), confiance de la boutique (jusqu'à +0,5). Le produit lui-même est exclu.
 */
export function similarProducts<T extends SimilarCandidate>(current: SimilarCandidate, all: T[], limit = 12): T[] {
  if (!current.categoryId) return [];
  const type = norm(current.attributes?.type);
  const brand = norm(current.attributes?.marque);
  const score = (c: T): number => {
    const t = norm(c.attributes?.type);
    const ratio = Math.min(c.priceGnf, current.priceGnf) / Math.max(c.priceGnf, current.priceGnf, 1);
    return (type && t === type ? 3 : 0) + (brand && norm(c.attributes?.marque) === brand ? 2 : 0) + 1.5 * ratio + 0.5 * ((c.shopTrust ?? 50) / 100);
  };
  return all
    .filter((c) => c.key !== current.key && c.categoryId === current.categoryId)
    .map((c) => ({ c, s: score(c) }))
    .sort((a, b) => b.s - a.s || a.c.key.localeCompare(b.c.key))
    .slice(0, limit)
    .map((x) => x.c);
}
