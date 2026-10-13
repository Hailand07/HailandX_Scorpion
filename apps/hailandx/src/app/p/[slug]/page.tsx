import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, PhotoSlot, Price, VerifiedMark, Wordmark } from '@hailandx/ui';
import { formatGnf } from '@hailandx/commerce';
import { badgesOf } from '@/data/sample';
import { getCatalog, trustFor } from '@/lib/catalog';
import { BuyBar } from '@/components/BuyBar';

type Params = { params: Promise<{ slug: string }> };

export const revalidate = 60;

/**
 * Aperçu riche (titre, description, image) lu par WhatsApp, TikTok et Facebook quand un vendeur partage ce lien :
 * c'est la raison d'être du rendu côté serveur (HAILANDX.md §7).
 */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const cat = await getCatalog();
  const p = cat.products.find((x) => x.slug === slug);
  if (!p) return { title: 'Produit introuvable' };
  const shop = cat.shops.find((x) => x.slug === p.shopSlug)!;
  const title = `${p.name} — ${formatGnf(p.priceGnf)}`;
  const description = `Vendu par ${shop.name}, vendeur certifié Hailand. Livré à votre porte en ≈ ${p.etaMinutes} min.`;
  return { title, description, openGraph: { title, description, type: 'website', siteName: 'HailandX', locale: 'fr_GN', ...(p.photoUrl ? { images: [p.photoUrl] } : {}) }, twitter: { card: 'summary_large_image', title, description, ...(p.photoUrl ? { images: [p.photoUrl] } : {}) } };
}

/** Page d'un lien partagé : le produit mis en avant, puis le reste de la boutique (jamais un cul-de-sac). */
export default async function ProductLinkPage({ params }: Params) {
  const { slug } = await params;
  const cat = await getCatalog();
  const p = cat.products.find((x) => x.slug === slug);
  if (!p) notFound();
  const shop = cat.shops.find((x) => x.slug === p.shopSlug)!;
  const others = cat.products.filter((o) => o.shopSlug === shop.slug && o.slug !== p.slug);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 bg-card pb-32">
      <header className="flex items-center justify-between px-[18px] py-3">
        <Link href={`/b/${shop.slug}`} className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-[13px] bg-ink font-display text-sm font-bold" style={{ color: shop.color }}>{shop.logoUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={shop.logoUrl} alt="" className="h-full w-full object-cover" /> : shop.initials}</span>
          <span className="flex flex-col">
            <span className="flex items-center gap-1.5 text-[14.5px] font-extrabold">{shop.name}<VerifiedMark size={15} /></span>
            <span className="text-[11.5px] font-bold text-blue-ink">Vendeur certifié Hailand · {trustFor(shop)}/100</span>
          </span>
        </Link>
        <Link href="/" aria-label="HailandX"><Wordmark className="!text-[15px] text-muted" /></Link>
      </header>

      <div className="px-[18px]">
        <PhotoSlot src={p.photoUrl} color={p.color} className="h-[300px] rounded-3xl" label={p.name} />
      </div>
      <div className="flex flex-col gap-1 px-[18px]">
        <h1 className="font-display text-[22px] font-semibold leading-tight tracking-tight">{p.name}</h1>
        <div className="flex items-baseline gap-2.5">
          <Price className="text-xl">{formatGnf(p.priceGnf)}</Price>
          <span className="text-[12.5px] font-semibold text-muted">livré à votre porte ≈ {p.etaMinutes} min</span>
        </div>
        <div className="mt-1 flex flex-wrap gap-1.5">{badgesOf(shop).map((b) => <Badge key={b}>{b}</Badge>)}</div>
      </div>

      {others.length > 0 && (
        <section aria-label="Autres produits de la boutique" className="flex flex-col gap-2.5 px-[18px]">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-extrabold">Aussi chez {shop.name}</h2>
            <Link href={`/b/${shop.slug}`} className="text-[12.5px] font-extrabold text-blue-ink">Toute la boutique</Link>
          </div>
          <div className="flex gap-2.5 overflow-x-auto">
            {others.map((o) => (
              <Link key={o.slug} href={`/p/${o.slug}`} className="flex w-[110px] shrink-0 flex-col gap-1.5">
                <PhotoSlot src={o.photoUrl} color={o.color} className="h-[110px] rounded-2xl" label={o.name} />
                <span className="truncate text-xs font-bold">{o.name}</span>
                <span className="text-[12.5px] font-extrabold">{formatGnf(o.priceGnf)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <BuyBar available={p.inStock !== false} line={p.offerId ? { offerId: p.offerId, variantId: p.variantId ?? null, slug: p.slug, name: p.name, priceGnf: p.priceGnf, shopSlug: shop.slug, shopName: shop.name, photoUrl: p.photoUrl ?? null } : null} />
    </main>
  );
}
