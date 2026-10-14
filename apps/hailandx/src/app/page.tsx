import Link from 'next/link';
import { Badge, PhotoSlot, Price, VerifiedMark, Wordmark } from '@hailandx/ui';
import { buildFeed, formatGnf, type FeedCandidate } from '@hailandx/commerce';
import { getCatalog, offerKey, trustFor } from '@/lib/catalog';
import { DeliverTo } from '@/components/DeliverTo';
import { NotificationBell } from '@/components/NotificationBell';
import { RueStrip } from '@/components/RueStrip';
import { CartButton } from '@/components/CartButton';

/** Accueil : « la rue commerçante » — un échantillon par boutique et par catégorie (règle validée par le fondateur). */
export default async function Home({ searchParams }: { searchParams: Promise<{ cat?: string; compte?: string }> }) {
  const { cat, compte } = await searchParams;
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
