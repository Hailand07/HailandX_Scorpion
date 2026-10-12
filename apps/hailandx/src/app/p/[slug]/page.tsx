import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, PhotoSlot, Price, VerifiedMark, Wordmark } from '@hailandx/ui';
import { formatGnf } from '@hailandx/commerce';
import { PRODUCTS, badgesOf, productBySlug, shopBySlug, trustOf } from '@/data/sample';

type Params = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return PRODUCTS.map((p) => ({ slug: p.slug }));
}

/**
 * Aperçu riche (titre, description, image) lu par WhatsApp, TikTok et Facebook quand un vendeur partage ce lien :
 * c'est la raison d'être du rendu côté serveur (HAILANDX.md §7).
 */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const p = productBySlug((await params).slug);
  if (!p) return { title: 'Produit introuvable' };
  const shop = shopBySlug(p.shopSlug)!;
  const title = `${p.name} — ${formatGnf(p.priceGnf)}`;
  const description = `Vendu par ${shop.name}, vendeur certifié Hailand. Livré à votre porte en ≈ ${p.etaMinutes} min.`;
  return { title, description, openGraph: { title, description, type: 'website', siteName: 'HailandX', locale: 'fr_GN' }, twitter: { card: 'summary_large_image', title, description } };
}

/** Page d'un lien partagé : le produit mis en avant, puis le reste de la boutique (jamais un cul-de-sac). */
export default async function ProductLinkPage({ params }: Params) {
  const p = productBySlug((await params).slug);
  if (!p) notFound();
  const shop = shopBySlug(p.shopSlug)!;
  const others = PRODUCTS.filter((o) => o.shopSlug === shop.slug && o.slug !== p.slug);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 bg-card pb-32">
      <header className="flex items-center justify-between px-[18px] py-3">
        <Link href={`/b/${shop.slug}`} className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-ink font-display text-sm font-bold" style={{ color: shop.color }}>{shop.initials}</span>
          <span className="flex flex-col">
            <span className="flex items-center gap-1.5 text-[14.5px] font-extrabold">{shop.name}<VerifiedMark size={15} /></span>
            <span className="text-[11.5px] font-bold text-blue-ink">Vendeur certifié Hailand · {trustOf(shop)}/100</span>
          </span>
        </Link>
        <Link href="/" aria-label="HailandX"><Wordmark className="!text-[15px] text-muted" /></Link>
      </header>

      <div className="px-[18px]">
        <PhotoSlot color={p.color} className="h-[300px] rounded-3xl" label={p.name} />
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
                <PhotoSlot color={o.color} className="h-[110px] rounded-2xl" label={o.name} />
                <span className="truncate text-xs font-bold">{o.name}</span>
                <span className="text-[12.5px] font-extrabold">{formatGnf(o.priceGnf)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="fixed inset-x-0 bottom-0 mx-auto flex max-w-md gap-2.5 border-t border-line-soft bg-card px-[18px] pb-[max(26px,env(safe-area-inset-bottom))] pt-3">
        <Link href="/panier" aria-label="Ajouter au panier" className="flex h-[54px] w-[54px] items-center justify-center rounded-2xl border border-line">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#12141c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
        </Link>
        <Link href="/commande" className="flex h-[54px] flex-1 items-center justify-center rounded-2xl bg-ink text-[15.5px] font-extrabold text-white">Acheter maintenant</Link>
      </div>
    </main>
  );
}
