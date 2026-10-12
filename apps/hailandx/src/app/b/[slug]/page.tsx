import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, PhotoSlot, Price, VerifiedMark } from '@hailandx/ui';
import { formatGnf } from '@hailandx/commerce';
import { PRODUCTS, SHOPS, badgesOf, shopBySlug, trustOf } from '@/data/sample';

type Params = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return SHOPS.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const s = shopBySlug((await params).slug);
  if (!s) return { title: 'Boutique introuvable' };
  const description = `${s.tagline} · ${s.place}. Vendeur certifié Hailand, livré par la Flotte Hailand.`;
  return { title: s.name, description, openGraph: { title: s.name, description, type: 'website', siteName: 'HailandX', locale: 'fr_GN' } };
}

/** Boutique d'un vendeur : tous ses produits, comme si l'on entrait dans sa boutique depuis la rue. */
export default async function ShopPage({ params }: Params) {
  const s = shopBySlug((await params).slug);
  if (!s) notFound();
  const products = PRODUCTS.filter((p) => p.shopSlug === s.slug);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-3 pb-10">
      <div className="h-[132px]" style={{ background: s.color }} />
      <section className="-mt-9 flex flex-col gap-3 px-5">
        <span className="flex h-[76px] w-[76px] items-center justify-center rounded-3xl border-4 border-bg bg-ink font-display text-2xl font-bold" style={{ color: s.color }}>{s.initials}</span>
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 font-display text-[22px] font-semibold tracking-tight">{s.name}<VerifiedMark size={20} /></h1>
          <span className="text-[13px] font-semibold text-muted">{s.tagline} · {s.place}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-line-soft bg-card px-3 py-2.5"><div className="font-display text-[17px] font-semibold">★ {s.stats.rating.toFixed(1).replace('.', ',')}</div><div className="text-[11.5px] font-semibold text-muted">{s.stats.reviewCount} avis vérifiés</div></div>
          <div className="rounded-2xl border border-line-soft bg-card px-3 py-2.5"><div className="font-display text-[17px] font-semibold">{Math.round(s.stats.reliability * 100)} %</div><div className="text-[11.5px] font-semibold text-muted">livrés sans litige</div></div>
          <div className="rounded-2xl border border-line-soft bg-card px-3 py-2.5"><div className="font-display text-[17px] font-semibold">{trustOf(s)}</div><div className="text-[11.5px] font-semibold text-muted">indice de confiance</div></div>
        </div>
        <div className="flex flex-wrap gap-1.5">{badgesOf(s).map((b) => <Badge key={b}>{b}</Badge>)}</div>
      </section>

      <section aria-label="Produits" className="grid grid-cols-2 gap-3 px-5 pt-2">
        {products.map((p) => (
          <Link key={p.slug} href={`/p/${p.slug}`} className="flex flex-col overflow-hidden rounded-[18px] border border-line-soft bg-card">
            <PhotoSlot color={p.color} className="h-[120px]" label={p.name} />
            <span className="flex flex-col gap-0.5 px-3 pb-3 pt-2.5">
              <span className="truncate text-[13px] font-bold">{p.name}</span>
              <Price className="text-[14.5px]">{formatGnf(p.priceGnf)}</Price>
            </span>
          </Link>
        ))}
      </section>
    </main>
  );
}
