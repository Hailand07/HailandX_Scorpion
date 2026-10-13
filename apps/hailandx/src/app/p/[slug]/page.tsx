import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, PhotoSlot, Price, VerifiedMark, Wordmark } from '@hailandx/ui';
import { formatGnf, rankOffers, type Offer } from '@hailandx/commerce';
import { badgesOf } from '@/data/sample';
import { getCatalog, trustFor, type Catalog, type ProductView } from '@/lib/catalog';
import { BuyBar } from '@/components/BuyBar';
import { FavoriteButton } from '@/components/FavoriteButton';

type Params = { params: Promise<{ slug: string }>; searchParams: Promise<{ b?: string }> };

/** Offres d'une même fiche produit, classées (confiance 60 %, prix 25 %, délai 15 %) ; `b` choisit la boutique mise en avant (lien reçu). */
function pickOffers(cat: Catalog, slug: string, b?: string) {
  const all = cat.products.filter((x) => x.slug === slug);
  const asOffer = (x: ProductView): Offer => ({ id: x.shopSlug, shopId: x.shopSlug, priceGnf: x.priceGnf, shopTrust: trustFor(cat.shops.find((s) => s.slug === x.shopSlug)!), etaMinutes: x.etaMinutes, inStock: x.inStock !== false });
  const ranked = rankOffers(all.map(asOffer)).map((o) => all.find((x) => x.shopSlug === o.shopId)!);
  const recommended = ranked[0];
  const selected = (b && ranked.find((x) => x.shopSlug === b)) || recommended;
  return { ranked, recommended, selected };
}

/**
 * Aperçu riche (titre, description, image) lu par WhatsApp, TikTok et Facebook quand un vendeur partage ce lien :
 * c'est la raison d'être du rendu côté serveur (HAILANDX.md §7).
 */
export async function generateMetadata({ params, searchParams }: Params): Promise<Metadata> {
  const { slug } = await params;
  const { b } = await searchParams;
  const cat = await getCatalog();
  const p = pickOffers(cat, slug, b).selected;
  if (!p) return { title: 'Produit introuvable' };
  const shop = cat.shops.find((x) => x.slug === p.shopSlug)!;
  const title = `${p.name} — ${formatGnf(p.priceGnf)}`;
  const description = `Vendu par ${shop.name}, vendeur certifié Hailand. Livré à votre porte en ≈ ${p.etaMinutes} min.`;
  return { title, description, openGraph: { title, description, type: 'website', siteName: 'HailandX', locale: 'fr_GN', ...(p.photoUrl ? { images: [p.photoUrl] } : {}) }, twitter: { card: 'summary_large_image', title, description, ...(p.photoUrl ? { images: [p.photoUrl] } : {}) } };
}

/** Page d'un lien partagé : le produit mis en avant, puis le reste de la boutique (jamais un cul-de-sac). */
export default async function ProductLinkPage({ params, searchParams }: Params) {
  const { slug } = await params;
  const { b } = await searchParams;
  const cat = await getCatalog();
  const { ranked, recommended, selected: p } = pickOffers(cat, slug, b);
  if (!p) notFound();
  const shop = cat.shops.find((x) => x.slug === p.shopSlug)!;
  const others = cat.products.filter((o) => o.shopSlug === shop.slug && o.slug !== p.slug);
  const sellers = ranked.filter((o) => o.shopSlug !== p.shopSlug);

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
        <span className="flex items-center gap-2">{p.productId && <FavoriteButton productId={p.productId} next={`/p/${p.slug}?b=${shop.slug}`} />}<Link href="/" aria-label="HailandX"><Wordmark className="!text-[15px] text-muted" /></Link></span>
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
        <div className="mt-1 flex flex-wrap gap-1.5">{ranked.length > 1 && p.shopSlug === recommended?.shopSlug && <Badge tone="lime">Offre recommandée</Badge>}{ranked.length > 1 && <Badge tone="blue">Proposé par {ranked.length} vendeurs</Badge>}{badgesOf(shop).map((x) => <Badge key={x}>{x}</Badge>)}</div>
      </div>

      {sellers.length > 0 && (
        <section aria-label="Autres vendeurs de ce produit" className="flex flex-col gap-2.5 px-[18px]">
          <h2 className="text-sm font-extrabold">Proposé par {ranked.length} vendeurs</h2>
          {p.shopSlug === recommended?.shopSlug && <p className="text-[12px] font-semibold text-muted">Vous voyez l’offre recommandée : meilleur équilibre confiance, prix et délai.</p>}
          {sellers.map((o) => {
            const s = cat.shops.find((x) => x.slug === o.shopSlug)!;
            return (
              <Link key={o.shopSlug} href={`/p/${slug}?b=${o.shopSlug}`} className="flex items-center justify-between gap-3 rounded-2xl border border-line-soft bg-card px-3.5 py-3">
                <span className="flex min-w-0 flex-col"><span className="flex items-center gap-1.5 truncate text-[13.5px] font-extrabold">{s.name}<VerifiedMark size={14} /></span><span className="text-[11.5px] font-semibold text-muted">Confiance {trustFor(s)}/100 · ≈ {o.etaMinutes} min{o.inStock === false ? ' · rupture' : ''}</span></span>
                <span className="flex shrink-0 flex-col items-end gap-1"><Price className="text-[14.5px]">{formatGnf(o.priceGnf)}</Price>{o.shopSlug === recommended?.shopSlug && <Badge tone="lime">Recommandée</Badge>}</span>
              </Link>
            );
          })}
        </section>
      )}

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

      <BuyBar available={p.inStock !== false} variants={p.variants ?? []} line={p.offerId ? { offerId: p.offerId, variantId: p.variantId ?? null, slug: p.slug, name: p.name, priceGnf: p.priceGnf, shopSlug: shop.slug, shopName: shop.name, photoUrl: p.photoUrl ?? null } : null} />
    </main>
  );
}
