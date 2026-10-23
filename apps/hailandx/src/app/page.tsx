import Link from 'next/link';
import { Wordmark } from '@hailandx/ui';
import { brandsOf, buildFeed, formatGnf, matchesFilters, parseFilters, type CatalogFilters, type FeedCandidate } from '@hailandx/commerce';
import { getCatalog, offerKey, trustFor } from '@/lib/catalog';
import { DeliverTo } from '@/components/DeliverTo';
import { LienHailand, NotificationBell, VENDEUR_URL } from '@hailandx/kit';
import { RueStrip } from '@/components/RueStrip';
import { CartButton } from '@/components/CartButton';
import { ProductCard, ProductGrid, type GridItem } from '@/components/ProductGrid';
import { RecentlyViewed } from '@/components/RecentlyViewed';

const TRIS = { pertinence: 'Pertinence', 'prix-croissant': 'Prix croissant', 'prix-decroissant': 'Prix décroissant' } as const;
type Tri = keyof typeof TRIS;

/**
 * Accueil, comme les grandes applications de vente (décision du fondateur, 2026-10-22, HAILANDX.md §34) :
 * TOUS les produits sont en ligne, rangés par catégorie. « Tout » = une rangée par catégorie (la plus fournie d'abord) ;
 * une catégorie choisie = tous ses produits en grille, avec un tri. Le nom de la boutique figure sur chaque carte.
 */
export default async function Home({ searchParams }: { searchParams: Promise<{ cat?: string; compte?: string; tri?: string; marque?: string; min?: string; max?: string; etat?: string }> }) {
  const sp = await searchParams;
  const { cat: catParam, compte, tri: triParam } = sp;
  const { shops: SHOPS, products: PRODUCTS, source } = await getCatalog();
  const counts = new Map<string, number>();
  for (const p of PRODUCTS) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
  const CATEGORIES = [...counts.keys()].sort((a, b) => counts.get(b)! - counts.get(a)! || a.localeCompare(b, 'fr'));
  const cat = catParam && CATEGORIES.includes(catParam) ? catParam : undefined;
  const tri: Tri = triParam && triParam in TRIS ? (triParam as Tri) : 'pertinence';
  const shopBySlug = (slug: string) => SHOPS.find((s) => s.slug === slug);
  const productByKey = (key: string) => PRODUCTS.find((p) => offerKey(p) === key);
  const candidates: FeedCandidate[] = PRODUCTS.map((p) => {
    const shop = shopBySlug(p.shopSlug)!;
    return { id: offerKey(p), shopId: shop.slug, category: p.category, score: p.score, shopTrust: trustFor(shop), shopIsNew: shop.isNew, etaMinutes: p.etaMinutes };
  });
  // Ordre de pertinence (score, confiance, proximité, boutiques intercalées) ; la rotation horaire varie les premiers.
  // Filtres d'une catégorie (marque, prix, état), lus dans l'adresse pour pouvoir partager une recherche filtrée.
  const filters: CatalogFilters = cat ? parseFilters(sp) : {};
  const nFilters = Object.keys(filters).length;
  const brands = cat ? brandsOf(PRODUCTS.filter((p) => p.category === cat)) : [];
  const ranked = (category: string, f: CatalogFilters = {}): GridItem[] =>
    buildFeed(candidates, { category, perGroup: Infinity, rotation: Math.floor(Date.now() / 3_600_000) }).filter((c) => matchesFilters(productByKey(c.id)!, f)).map((c) => {
      const p = productByKey(c.id)!;
      return { key: c.id, href: `/p/${p.slug}?b=${p.shopSlug}`, name: p.name, priceGnf: p.priceGnf, photoUrl: p.photoUrl ?? null, color: p.color, shopName: shopBySlug(p.shopSlug)?.name ?? '', etaMinutes: p.etaMinutes, compareAtGnf: p.compareAtGnf };
    });
  const grid = cat ? ranked(cat, filters) : [];
  const href = (o: Record<string, string | number | undefined>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ cat, tri: tri === 'pertinence' ? undefined : tri, ...filters, ...o })) if (v !== undefined && v !== '') q.set(k, String(v));
    return `/?${q.toString()}`;
  };
  if (tri === 'prix-croissant') grid.sort((a, b) => a.priceGnf - b.priceGnf);
  if (tri === 'prix-decroissant') grid.sort((a, b) => b.priceGnf - a.priceGnf);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 pb-4">
      {compte === 'supprime' && <p role="status" className="mx-5 mt-5 rounded-2xl bg-ok-soft px-4 py-3 text-[13.5px] font-bold text-ok">Votre compte a été supprimé. Vous pouvez recommencer avec le même numéro quand vous voulez.</p>}
      <header className="flex flex-col gap-2.5 px-5 pb-1 pt-5">
        <div className="flex items-center justify-between">
          <Wordmark />
          <span className="flex items-center gap-2"><NotificationBell /><CartButton /></span>
        </div>
        <DeliverTo />
        <Link href="/recherche" className="flex h-[50px] items-center gap-2.5 rounded-2xl border border-line bg-card px-4 text-[14.5px] font-medium text-muted">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#12141c" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          Rechercher un produit, une boutique…
        </Link>
      </header>

      <nav aria-label="Catégories" className="flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
        {['Tout', ...CATEGORIES].map((c) => {
          const active = c === 'Tout' ? !cat || !CATEGORIES.includes(cat) : c === cat;
          return <Link key={c} href={c === 'Tout' ? '/' : `/?cat=${encodeURIComponent(c)}`} aria-current={active ? 'true' : undefined} className={`flex h-9 shrink-0 items-center rounded-full px-3.5 text-[13px] font-bold ${active ? 'bg-ink text-white' : 'border border-line bg-card'}`}>{c}</Link>;
        })}
      </nav>

      <section aria-label="La rue" className="flex flex-col gap-2.5 px-5">
        <div className="flex items-baseline justify-between"><h2 className="font-display text-lg font-semibold tracking-tight">La rue</h2><span className="text-[12.5px] font-semibold text-muted">Livrées en moins d’1 h</span></div>
        <RueStrip shops={SHOPS.map((x) => ({ slug: x.slug, name: x.name, initials: x.initials, color: x.color, logoUrl: x.logoUrl ?? null, isNew: x.isNew }))} real={source === 'base'} />
      </section>

      {cat ? (
        <section aria-label={cat} className="flex flex-col gap-3 px-5">
          <div className="flex items-baseline justify-between"><h2 className="font-display text-lg font-semibold tracking-tight">{cat}</h2><span className="text-[12.5px] font-semibold text-muted">{grid.length} produit{grid.length > 1 ? 's' : ''}</span></div>
          <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
            {(Object.keys(TRIS) as Tri[]).map((t) => (
              <Link key={t} href={href({ tri: t === 'pertinence' ? undefined : t })} aria-current={t === tri ? 'true' : undefined} className={`flex h-8 shrink-0 items-center rounded-full px-3 text-[12.5px] font-bold ${t === tri ? 'bg-blue-soft text-blue-ink' : 'border border-line bg-card text-muted'}`}>{TRIS[t]}</Link>
            ))}
          </div>
          <details open={nFilters > 0} className="rounded-[18px] border border-line-soft bg-card">
            <summary className="flex h-11 cursor-pointer list-none items-center justify-between px-4 text-[13.5px] font-extrabold">
              <span>Filtrer{nFilters > 0 && <span className="ml-2 rounded-full bg-blue-soft px-2 py-0.5 text-[11.5px] text-blue-ink">{nFilters}</span>}</span>
              <span aria-hidden="true" className="text-muted">▾</span>
            </summary>
            <form action="/" method="get" className="flex flex-col gap-3 border-t border-line-soft p-4">
              <input type="hidden" name="cat" value={cat} />
              {tri !== 'pertinence' && <input type="hidden" name="tri" value={tri} />}
              {brands.length > 0 && (
                <label className="flex flex-col gap-1.5 text-[12.5px] font-extrabold">Marque
                  <select name="marque" defaultValue={filters.marque ?? ''} className="h-11 rounded-xl bg-bg px-3 text-[14.5px] font-semibold">
                    <option value="">Toutes les marques</option>
                    {brands.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </label>
              )}
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1.5 text-[12.5px] font-extrabold">Prix min. (GNF)<input name="min" inputMode="numeric" defaultValue={filters.min ?? ''} placeholder="0" className="h-11 min-w-0 rounded-xl bg-bg px-3 text-[14.5px] font-semibold" /></label>
                <label className="flex flex-col gap-1.5 text-[12.5px] font-extrabold">Prix max. (GNF)<input name="max" inputMode="numeric" defaultValue={filters.max ?? ''} placeholder="Sans limite" className="h-11 min-w-0 rounded-xl bg-bg px-3 text-[14.5px] font-semibold" /></label>
              </div>
              <fieldset className="flex flex-col gap-1.5">
                <legend className="text-[12.5px] font-extrabold">État</legend>
                <div className="flex gap-2 pt-1.5">
                  {([['', 'Tous'], ['neuf', 'Neuf'], ['occasion', 'Occasion']] as const).map(([v, l]) => (
                    <label key={v} className="flex h-10 cursor-pointer items-center gap-2 rounded-full border border-line px-3.5 text-[13px] font-bold has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-white">
                      <input type="radio" name="etat" value={v} defaultChecked={(filters.etat ?? '') === v} className="sr-only" />{l}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="flex gap-2">
                <button type="submit" className="h-11 flex-1 rounded-2xl bg-ink text-[14px] font-extrabold text-white">Voir les résultats</button>
                {nFilters > 0 && <Link href={`/?cat=${encodeURIComponent(cat)}${tri === 'pertinence' ? '' : `&tri=${tri}`}`} className="flex h-11 items-center rounded-2xl px-3 text-[13px] font-extrabold text-blue-ink">Effacer</Link>}
              </div>
            </form>
          </details>
          {nFilters > 0 && (
            <p className="text-[12.5px] font-semibold text-muted">
              {[filters.marque, filters.min !== undefined && `à partir de ${formatGnf(filters.min)}`, filters.max !== undefined && `jusqu’à ${formatGnf(filters.max)}`, filters.etat === 'occasion' ? 'occasion' : filters.etat === 'neuf' ? 'neuf' : null].filter(Boolean).join(' · ')}
            </p>
          )}
          {grid.length ? <ProductGrid items={grid} /> : <p className="rounded-[20px] border border-dashed border-line px-4 py-6 text-center text-[13.5px] font-semibold text-muted">Aucun produit ne correspond à ces filtres.</p>}
        </section>
      ) : (
        <>
        <RecentlyViewed known={PRODUCTS.map(offerKey)} />
        {CATEGORIES.map((c) => {
          const row = ranked(c).slice(0, 12);
          return (
            <section key={c} aria-label={c} className="flex flex-col gap-2.5">
              <div className="flex items-baseline justify-between px-5">
                <h2 className="font-display text-lg font-semibold tracking-tight">{c}</h2>
                <Link href={`/?cat=${encodeURIComponent(c)}`} className="text-[12.5px] font-extrabold text-blue-ink">Voir tout ({counts.get(c)})</Link>
              </div>
              <div className="flex snap-x gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">{row.map((p) => <ProductCard key={p.key} p={p} />)}</div>
            </section>
          );
        })}
        </>
      )}

      {source === 'exemple' && (
        <section className="mx-5 flex flex-col gap-2 rounded-[22px] border border-line bg-card p-4">
          <h2 className="font-display text-[16px] font-semibold">Les boutiques ci-dessus sont des exemples</h2>
          <p className="text-[13px] font-medium text-muted">Aucune boutique n’est encore ouverte à la vente. Soyez le premier vendeur de votre quartier.</p>
          <LienHailand app="vendeur" href={VENDEUR_URL} className="mt-1 flex h-12 items-center justify-center rounded-2xl bg-ink text-[14.5px] font-extrabold text-white">Ouvrir ma boutique avec HailandX Vendeur</LienHailand>
        </section>
      )}
    </main>
  );
}
