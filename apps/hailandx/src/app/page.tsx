import Link from 'next/link';
import { Badge, PhotoSlot, Price, VerifiedMark, Wordmark } from '@hailandx/ui';
import { buildFeed, formatGnf, type FeedCandidate } from '@hailandx/commerce';
import { trustOf } from '@/data/sample';
import { getCatalog } from '@/lib/catalog';

const CATEGORIES = ['Tout', 'Mode', 'Beauté', 'Téléphones', 'Maison', 'Alimentation'];

/** Accueil : « la rue commerçante » — un échantillon par boutique et par catégorie (règle validée par le fondateur). */
export const revalidate = 60;

export default async function Home() {
  const { shops: SHOPS, products: PRODUCTS, source } = await getCatalog();
  const shopBySlug = (slug: string) => SHOPS.find((s) => s.slug === slug);
  const productBySlug = (slug: string) => PRODUCTS.find((p) => p.slug === slug);
  const candidates: FeedCandidate[] = PRODUCTS.map((p) => {
    const shop = shopBySlug(p.shopSlug)!;
    return { id: p.slug, shopId: shop.slug, category: p.category, score: p.score, shopTrust: trustOf(shop), shopIsNew: shop.isNew, etaMinutes: p.etaMinutes };
  });
  // La rotation change l'échantillon retenu toutes les heures.
  const feed = buildFeed(candidates, { rotation: Math.floor(Date.now() / 3_600_000), limit: 12 });

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 pb-28">
      <header className="flex flex-col gap-3.5 px-5 pb-1 pt-5">
        <div className="flex items-center justify-between">
          <Wordmark />
          <Link href="/panier" aria-label="Panier" className="flex h-11 w-11 items-center justify-center rounded-2xl bg-ink">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
          </Link>
        </div>
        <Link href="/recherche" className="flex h-12 items-center gap-2.5 rounded-2xl border border-line bg-card px-4 text-[14.5px] font-medium text-muted">
          Rechercher un produit, une boutique…
        </Link>
      </header>

      <nav aria-label="Catégories" className="flex gap-2 overflow-x-auto px-5 pb-1">
        {CATEGORIES.map((c, i) => (
          <span key={c} className={`flex h-9 shrink-0 items-center rounded-full px-3.5 text-[13px] font-bold ${i === 0 ? 'bg-ink text-white' : 'border border-line bg-card'}`}>{c}</span>
        ))}
      </nav>

      <section aria-label="La rue" className="flex flex-col gap-2.5 px-5">
        <h2 className="font-display text-lg font-semibold tracking-tight">La rue</h2>
        <div className="flex gap-3.5 overflow-x-auto pb-1">
          {SHOPS.map((s) => (
            <Link key={s.slug} href={`/b/${s.slug}`} className="flex w-[58px] shrink-0 flex-col items-center gap-1.5">
              <span className={`flex h-[58px] w-[58px] rounded-[20px] p-[3px] ${s.isNew ? 'bg-blue' : 'bg-line'}`}>
                <span className="flex flex-1 items-center justify-center rounded-[17px] border-2 border-bg font-display text-[15px] font-bold" style={{ background: s.color }}>{s.initials}</span>
              </span>
              <span className="w-[58px] truncate text-center text-[11px] font-semibold">{s.name}</span>
            </Link>
          ))}
        </div>
      </section>

      <section aria-label="Échantillons des boutiques" className="grid grid-cols-2 gap-3 px-5">
        {feed.map((f) => {
          const p = productBySlug(f.id)!;
          const shop = shopBySlug(f.shopId)!;
          return (
            <Link key={p.slug} href={`/p/${p.slug}`} className="flex flex-col overflow-hidden rounded-[20px] border border-line-soft bg-card">
              <span className="relative block">
                <PhotoSlot src={p.photoUrl} color={p.color} className="h-[150px]" label={p.name} />
                <span className="absolute bottom-2.5 right-2.5 rounded-full bg-white/90 px-2 py-1 text-[10.5px] font-bold">≈ {p.etaMinutes} min</span>
                {shop.isNew && <span className="absolute left-2.5 top-2.5"><Badge tone="ink">Nouveau</Badge></span>}
              </span>
              <span className="flex flex-col gap-0.5 px-3 pb-3 pt-2.5">
                <span className="truncate text-[13.5px] font-bold">{p.name}</span>
                <Price className="text-[15px]">{formatGnf(p.priceGnf)}</Price>
                <span className="flex items-center gap-1 text-[11.5px] font-semibold text-muted"><VerifiedMark size={13} />{shop.name}</span>
              </span>
            </Link>
          );
        })}
      </section>

      {source === 'exemple' && <p className="px-5 text-center text-[11.5px] font-semibold text-muted">Boutiques d’exemple : aucune boutique n’est encore ouverte à la vente.</p>}
    </main>
  );
}
