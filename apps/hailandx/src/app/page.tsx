import Link from 'next/link';
import { Badge, PhotoSlot, Price, VerifiedMark, Wordmark } from '@hailandx/ui';
import { buildFeed, formatGnf, type FeedCandidate } from '@hailandx/commerce';
import { getCatalog, offerKey, trustFor } from '@/lib/catalog';
import { DeliverTo } from '@/components/DeliverTo';

/** Accueil : « la rue commerçante » — un échantillon par boutique et par catégorie (règle validée par le fondateur). */
export default async function Home({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const { cat } = await searchParams;
  const { shops: SHOPS, products: PRODUCTS, source } = await getCatalog();
  const CATEGORIES = [...new Set(PRODUCTS.map((p) => p.category))].sort((a, b) => a.localeCompare(b, 'fr'));
  const shopBySlug = (slug: string) => SHOPS.find((s) => s.slug === slug);
  const productByKey = (key: string) => PRODUCTS.find((p) => offerKey(p) === key);
  const candidates: FeedCandidate[] = PRODUCTS.map((p) => {
    const shop = shopBySlug(p.shopSlug)!;
    return { id: offerKey(p), shopId: shop.slug, category: p.category, score: p.score, shopTrust: trustFor(shop), shopIsNew: shop.isNew, etaMinutes: p.etaMinutes };
  });
  // La rotation change l'échantillon retenu toutes les heures.
  const feed = buildFeed(candidates, { rotation: Math.floor(Date.now() / 3_600_000), limit: 12, category: cat && CATEGORIES.includes(cat) ? cat : undefined });

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 pb-4">
      <header className="flex flex-col gap-3.5 px-5 pb-1 pt-5">
        <div className="flex items-center justify-between">
          <Wordmark />
          <Link href="/panier" aria-label="Panier" className="flex h-11 w-11 items-center justify-center rounded-2xl bg-ink">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
          </Link>
        </div>
        <DeliverTo />
        <Link href="/recherche" className="flex h-12 items-center gap-2.5 rounded-2xl border border-line bg-card px-4 text-[14.5px] font-medium text-muted">
          Rechercher un produit, une boutique…
        </Link>
      </header>

      <nav aria-label="Catégories" className="flex gap-2 overflow-x-auto px-5 pb-1">
        {['Tout', ...CATEGORIES].map((c) => {
          const active = c === 'Tout' ? !cat || !CATEGORIES.includes(cat) : c === cat;
          return <Link key={c} href={c === 'Tout' ? '/' : `/?cat=${encodeURIComponent(c)}`} aria-current={active ? 'true' : undefined} className={`flex h-9 shrink-0 items-center rounded-full px-3.5 text-[13px] font-bold ${active ? 'bg-ink text-white' : 'border border-line bg-card'}`}>{c}</Link>;
        })}
      </nav>

      <Link href="/vendeur" className="mx-5 flex items-center gap-3.5 rounded-[22px] bg-night px-4 py-4 text-night-text active:opacity-90">
        <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-lime text-ink"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9h16l-1.4-5H5.4z" /><path d="M5 9v11h14V9" /><path d="M10 20v-5h4v5" /></svg></span>
        <span className="flex flex-1 flex-col"><span className="font-display text-[16px] font-semibold tracking-tight">Vous vendez ? Ouvrez votre boutique</span><span className="text-[12.5px] font-medium text-night-muted">Gratuit, avec votre numéro de téléphone.</span></span>
        <span aria-hidden="true" className="text-[20px] font-bold text-lime">›</span>
      </Link>

      <section aria-label="La rue" className="flex flex-col gap-2.5 px-5">
        <h2 className="font-display text-lg font-semibold tracking-tight">La rue</h2>
        <div className="flex gap-3.5 overflow-x-auto pb-1">
          {SHOPS.map((s) => (
            <Link key={s.slug} href={`/b/${s.slug}`} className="flex w-[58px] shrink-0 flex-col items-center gap-1.5">
              <span className={`flex h-[58px] w-[58px] rounded-[20px] p-[3px] ${s.isNew ? 'bg-blue' : 'bg-line'}`}>
                <span className="flex flex-1 items-center justify-center overflow-hidden rounded-[17px] border-2 border-bg font-display text-[15px] font-bold" style={{ background: s.color }}>{s.logoUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={s.logoUrl} alt="" className="h-full w-full object-cover" /> : s.initials}</span>
              </span>
              <span className="w-[58px] truncate text-center text-[11px] font-semibold">{s.name}</span>
            </Link>
          ))}
        </div>
      </section>

      <section aria-label="Échantillons des boutiques" className="grid grid-cols-2 gap-3 px-5">
        {feed.map((f) => {
          const p = productByKey(f.id)!;
          const shop = shopBySlug(f.shopId)!;
          return (
            <Link key={offerKey(p)} href={`/p/${p.slug}?b=${p.shopSlug}`} className="flex flex-col overflow-hidden rounded-[20px] border border-line-soft bg-card">
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

      {source === 'exemple' && (
        <section className="mx-5 flex flex-col gap-2 rounded-[22px] border border-line bg-card p-4">
          <h2 className="font-display text-[16px] font-semibold">Les boutiques ci-dessus sont des exemples</h2>
          <p className="text-[13px] font-medium text-muted">Aucune boutique n’est encore ouverte à la vente. Soyez le premier vendeur de votre quartier.</p>
          <Link href="/vendeur" className="mt-1 flex h-12 items-center justify-center rounded-2xl bg-ink text-[14.5px] font-extrabold text-white">Ouvrir ma boutique</Link>
        </section>
      )}
    </main>
  );
}
