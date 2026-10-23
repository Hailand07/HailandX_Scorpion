import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, PhotoSlot, Price, VerifiedMark, Wordmark } from '@hailandx/ui';
import { ago, brandOf, discountPercent, formatGnf, keyFacts, rankOffers, readAttributes, specRows, type Offer, similarProducts } from '@hailandx/commerce';
import { badgesOf } from '@/data/sample';
import { getCatalog, offerKey, trustFor, type Catalog, type ProductView } from '@/lib/catalog';
import { serverClient } from '@hailandx/kit';
import { AskQuestion } from '@/components/AskQuestion';
import { RecordView } from '@/components/RecentlyViewed';
import { BuyBar } from '@/components/BuyBar';
import { FavoriteButton } from '@/components/FavoriteButton';
import { ProductGallery, ReadMore } from '@/components/ProductGallery';

interface Question { id: string; question: string; answer: string | null; answered_at: string | null; created_at: string; shops: { name: string } | null }

/** Questions publiques et produits souvent achetés ensemble (HAILANDX.md §35). En cas d'échec (base injoignable), la page s'affiche sans. */
async function extras(productId: string | undefined): Promise<{ questions: Question[]; together: { product_id: string; orders: number }[] }> {
  const sb = serverClient();
  if (!sb || !productId) return { questions: [], together: [] };
  const [qs, bt] = await Promise.all([
    sb.from('product_questions').select('id,question,answer,answered_at,created_at,shops:answer_shop_id(name)').eq('product_id', productId).order('created_at', { ascending: false }).limit(60),
    sb.rpc('fn_bought_together', { p_product: productId, p_limit: 8 }),
  ]);
  return { questions: (qs.data as unknown as Question[]) ?? [], together: (bt.data as { product_id: string; orders: number }[]) ?? [] };
}

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
  const intro = (p.description ?? '').replace(/\s+/g, ' ').trim().slice(0, 140);
  const description = `${intro ? intro + ' · ' : ''}Vendu par ${shop.name}, vendeur certifié Hailand. Livré à votre porte en ≈ ${p.etaMinutes} min.`;
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
  const others = cat.products.filter((o) => o.shopSlug === shop.slug && o.slug !== p.slug).slice(0, 10);
  // « Produits similaires » : même catégorie, toutes boutiques, même type / marque / gamme de prix d'abord (HAILANDX.md §34).
  const trustOf = new Map(cat.shops.map((x) => [x.slug, trustFor(x)]));
  const similar = similarProducts(
    { key: `${p.slug}|${p.shopSlug}`, categoryId: p.categoryId ?? p.category, priceGnf: p.priceGnf, attributes: p.attributes },
    cat.products.filter((o) => o.slug !== p.slug).map((o) => ({ ...o, key: `${o.slug}|${o.shopSlug}`, categoryId: o.categoryId ?? o.category, shopTrust: trustOf.get(o.shopSlug) })),
  );
  const sellers = ranked.filter((o) => o.shopSlug !== p.shopSlug);
  // Fiche détaillée : marque, « En bref », points forts, tableau des caractéristiques (fiche type de la catégorie).
  const brand = brandOf(p.attributes);
  const facts = keyFacts(p.categoryId, p.attributes);
  const specs = specRows(p.categoryId, p.attributes);
  const points = readAttributes(p.attributes).points;
  const left = (p.variants ?? []).reduce((n, v) => n + Math.max(0, v.stock), 0);
  const stockText = p.inStock === false ? 'Rupture de stock' : left > 0 && left <= 5 ? `Plus que ${left} en stock` : 'En stock';
  const { questions, together: pairs } = await extras(p.productId);
  // Meilleure offre en vente de chaque produit souvent acheté avec celui-ci.
  const together = pairs.flatMap((x) => { const o = cat.products.find((c) => c.productId === x.product_id); return o ? [{ ...o, orders: x.orders }] : []; });
  const answered = questions.filter((x) => x.answer);
  const pending = questions.filter((x) => !x.answer);
  const viewed = { key: offerKey(p), href: `/p/${p.slug}?b=${shop.slug}`, name: p.name, priceGnf: p.priceGnf, photoUrl: p.photoUrl ?? null, color: p.color, shopName: shop.name, etaMinutes: p.etaMinutes, compareAtGnf: p.compareAtGnf };

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
        <ProductGallery photos={p.photoUrls?.length ? p.photoUrls : p.photoUrl ? [p.photoUrl] : []} color={p.color} label={p.name} />
      </div>

      {/* Titre, marque, prix, état, stock, délai (maquette « fiche produit et offres », enrichie le 2026-10-22). */}
      <div className="flex flex-col gap-1.5 px-[18px]">
        {brand && <span className="text-[12.5px] font-extrabold uppercase tracking-[0.06em] text-blue-ink">{brand}</span>}
        <h1 className="font-display text-[22px] font-semibold leading-tight tracking-tight">{p.name}</h1>
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <Price className="text-[22px]">{formatGnf(p.priceGnf)}</Price>
          {discountPercent(p.priceGnf, p.compareAtGnf) && <><span className="text-[14px] font-semibold text-muted line-through">{formatGnf(p.compareAtGnf!)}</span><span className="rounded-full bg-ink px-2 py-0.5 text-[12px] font-extrabold text-lime">−{discountPercent(p.priceGnf, p.compareAtGnf)} %</span></>}
          <span className="text-[12.5px] font-semibold text-muted">livré à votre porte ≈ {p.etaMinutes} min</span>
        </div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <Badge tone={p.condition === 'occasion' ? 'sand' : 'ok'}>{p.condition === 'occasion' ? 'Occasion' : 'Neuf'}</Badge>
          <Badge tone={p.inStock === false ? 'ink' : 'sand'}>{stockText}</Badge>
          {p.category && <Badge>{p.category}</Badge>}
          {ranked.length > 1 && p.shopSlug === recommended?.shopSlug && <Badge tone="lime">Offre recommandée</Badge>}
          {ranked.length > 1 && <Badge tone="blue">Proposé par {ranked.length} vendeurs</Badge>}
          {badgesOf(shop).map((x) => <Badge key={x}>{x}</Badge>)}
        </div>
      </div>

      {facts.length > 0 && (
        <section aria-label="En bref" className="mx-[18px] grid grid-cols-2 gap-2">
          {facts.map((f) => (
            <div key={f.key} className="flex min-w-0 flex-col gap-0.5 rounded-2xl bg-bg px-3.5 py-3">
              <span className="text-[11.5px] font-bold text-muted">{f.label}</span>
              <span className="truncate text-[14.5px] font-extrabold">{f.value}</span>
            </div>
          ))}
        </section>
      )}

      {points.length > 0 && (
        <section aria-labelledby="pf" className="flex flex-col gap-2 px-[18px]">
          <h2 id="pf" className="text-sm font-extrabold">Points forts</h2>
          <ul className="flex flex-col gap-1.5">
            {points.map((x) => <li key={x} className="flex gap-2.5 text-[14px] font-semibold leading-snug"><span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-ink" />{x}</li>)}
          </ul>
        </section>
      )}

      {p.description && (
        <section aria-labelledby="desc" className="flex flex-col gap-2 px-[18px]">
          <h2 id="desc" className="text-sm font-extrabold">Description</h2>
          <ReadMore text={p.description} />
        </section>
      )}

      {specs.length > 0 && (
        <section aria-labelledby="carac" className="flex flex-col gap-2 px-[18px]">
          <h2 id="carac" className="text-sm font-extrabold">Caractéristiques</h2>
          <dl className="overflow-hidden rounded-2xl border border-line-soft">
            {specs.map((r, i) => (
              <div key={r.key} className={`grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 px-3.5 py-2.5 text-[13.5px] ${i % 2 ? 'bg-card' : 'bg-bg'}`}>
                <dt className="font-bold text-muted">{r.label}</dt>
                <dd className="m-0 whitespace-pre-line font-semibold [overflow-wrap:anywhere]">{r.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {!p.description && specs.length === 0 && points.length === 0 && (
        <p className="mx-[18px] rounded-2xl bg-bg px-4 py-3 text-[13px] font-semibold text-muted">Le vendeur n’a pas encore détaillé ce produit. Une question ? Posez-la plus bas : la boutique vous répond.</p>
      )}

      {p.offerNote && (
        <section aria-labelledby="note" className="mx-[18px] flex flex-col gap-1.5 rounded-2xl border border-line-soft px-4 py-3">
          <h2 id="note" className="text-[13px] font-extrabold">Le mot du vendeur</h2>
          <p className="whitespace-pre-line text-[14px] font-medium leading-relaxed">{p.offerNote}</p>
        </section>
      )}

      {p.productId && (
        <section aria-labelledby="questions" className="flex flex-col gap-2.5 px-[18px]">
          <div className="flex items-baseline justify-between">
            <h2 id="questions" className="text-sm font-extrabold">Questions et réponses</h2>
            {questions.length > 0 && <span className="text-[12px] font-bold text-muted">{questions.length} question{questions.length > 1 ? 's' : ''}</span>}
          </div>
          {questions.length === 0 && <p className="text-[12.5px] font-semibold text-muted">Aucune question pour l’instant. Posez la vôtre : la boutique répond ici, pour tout le monde.</p>}
          {[...answered.slice(0, 4), ...pending.slice(0, 2)].map((x) => <QA key={x.id} x={x} />)}
          {answered.length + pending.length > 6 && (
            <details className="flex flex-col gap-2.5">
              <summary className="cursor-pointer list-none text-[13px] font-extrabold text-blue-ink">Voir toutes les questions ({questions.length})</summary>
              <div className="mt-2.5 flex flex-col gap-2.5">{[...answered.slice(4), ...pending.slice(2)].map((x) => <QA key={x.id} x={x} />)}</div>
            </details>
          )}
          <AskQuestion productId={p.productId} next={`/p/${p.slug}?b=${shop.slug}`} />
        </section>
      )}

      {/* Ce que garantit Hailand, quel que soit le vendeur (règles de la base : remise par code, litige sous 72 h). */}
      <section aria-labelledby="garanties" className="flex flex-col gap-2 px-[18px]">
        <h2 id="garanties" className="text-sm font-extrabold">Livraison, paiement et garanties</h2>
        <ul className="flex flex-col divide-y divide-line-soft rounded-2xl border border-line-soft">
          {[
            ['Livré au bâtiment de votre adresse Hailand', `Par la Flotte Hailand, ≈ ${p.etaMinutes} min après la préparation. Frais selon la distance, affichés avant de commander.`],
            ['Remis seulement à vous', 'Le livreur remet le colis contre votre code à 4 chiffres, avec une photo de remise.'],
            ['Paiement à la livraison', 'En espèces, à la remise. Orange Money quand il est proposé à la commande.'],
            ['Un problème ?', 'Signalez-le dans les 72 h après la remise depuis votre commande : l’équipe Hailand tranche.'],
          ].map(([t, d]) => (
            <li key={t} className="flex flex-col gap-0.5 px-4 py-3"><span className="text-[13.5px] font-extrabold">{t}</span><span className="text-[12.5px] font-semibold leading-snug text-muted">{d}</span></li>
          ))}
        </ul>
      </section>

      {/* Vendeur : confiance, note, ventes. */}
      <section aria-labelledby="vendeur" className="mx-[18px] flex flex-col gap-2.5 rounded-2xl border border-line-soft px-4 py-3.5">
        <h2 id="vendeur" className="text-[13px] font-extrabold">Vendu par</h2>
        <Link href={`/b/${shop.slug}`} className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 flex-col"><span className="flex items-center gap-1.5 truncate text-[15px] font-extrabold">{shop.name}<VerifiedMark size={15} /></span>{shop.tagline && <span className="truncate text-[12.5px] font-semibold text-muted">{shop.tagline}</span>}</span>
          <span className="shrink-0 text-[12.5px] font-extrabold text-blue-ink">Voir la boutique</span>
        </Link>
        <div className="grid grid-cols-3 gap-2 text-center">
          <span className="flex flex-col rounded-xl bg-bg py-2"><span className="font-display text-[16px] font-semibold">{trustFor(shop)}/100</span><span className="text-[11px] font-bold text-muted">confiance</span></span>
          <span className="flex flex-col rounded-xl bg-bg py-2"><span className="font-display text-[16px] font-semibold">{shop.stats.reviewCount > 0 ? `${shop.stats.rating.toFixed(1).replace('.', ',')} ★` : '–'}</span><span className="text-[11px] font-bold text-muted">{shop.stats.reviewCount} avis</span></span>
          <span className="flex flex-col rounded-xl bg-bg py-2"><span className="font-display text-[16px] font-semibold">{shop.stats.sales}</span><span className="text-[11px] font-bold text-muted">ventes</span></span>
        </div>
      </section>

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

      {together.length > 0 && (
        <section aria-label="Souvent achetés ensemble" className="flex flex-col gap-2.5 px-[18px]">
          <h2 className="text-sm font-extrabold">Souvent achetés ensemble</h2>
          <div className="flex snap-x gap-2.5 overflow-x-auto [scrollbar-width:none]">
            {together.map((o) => (
              <Link key={o.productId} href={`/p/${o.slug}?b=${o.shopSlug}`} className="flex w-[130px] shrink-0 snap-start flex-col gap-1">
                <PhotoSlot src={o.photoUrl} color={o.color} className="h-[130px] rounded-2xl" label={o.name} />
                <span className="line-clamp-2 text-xs font-bold leading-tight">{o.name}</span>
                <span className="text-[12.5px] font-extrabold">{formatGnf(o.priceGnf)}</span>
                <span className="text-[11px] font-semibold text-muted">Pris ensemble {o.orders} fois</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {similar.length > 0 && (
        <section aria-label="Produits similaires" className="flex flex-col gap-2.5 px-[18px]">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-extrabold">Produits similaires</h2>
            {p.category && <Link href={`/?cat=${encodeURIComponent(p.category)}`} className="text-[12.5px] font-extrabold text-blue-ink">Tout {p.category.toLowerCase()}</Link>}
          </div>
          <div className="flex snap-x gap-2.5 overflow-x-auto [scrollbar-width:none]">
            {similar.map((o) => (
              <Link key={o.key} href={`/p/${o.slug}?b=${o.shopSlug}`} className="flex w-[130px] shrink-0 snap-start flex-col gap-1">
                <PhotoSlot src={o.photoUrl} color={o.color} className="h-[130px] rounded-2xl" label={o.name} />
                <span className="line-clamp-2 text-xs font-bold leading-tight">{o.name}</span>
                <span className="text-[12.5px] font-extrabold">{formatGnf(o.priceGnf)}</span>
                <span className="truncate text-[11px] font-semibold text-muted">{cat.shops.find((x) => x.slug === o.shopSlug)?.name}</span>
              </Link>
            ))}
          </div>
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
              <Link key={o.slug} href={`/p/${o.slug}?b=${o.shopSlug}`} className="flex w-[110px] shrink-0 flex-col gap-1.5">
                <PhotoSlot src={o.photoUrl} color={o.color} className="h-[110px] rounded-2xl" label={o.name} />
                <span className="truncate text-xs font-bold">{o.name}</span>
                <span className="text-[12.5px] font-extrabold">{formatGnf(o.priceGnf)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <RecordView item={viewed} />
      <BuyBar available={p.inStock !== false} variants={p.variants ?? []} line={p.offerId ? { offerId: p.offerId, variantId: p.variantId ?? null, slug: p.slug, name: p.name, priceGnf: p.priceGnf, shopSlug: shop.slug, shopName: shop.name, photoUrl: p.photoUrl ?? null } : null} />
    </main>
  );
}

/** Une question et sa réponse (ou « en attente »). */
function QA({ x }: { x: Question }) {
  return (
    <article className="flex flex-col gap-1.5 rounded-2xl border border-line-soft px-4 py-3">
      <p className="text-[13.5px] font-extrabold leading-snug"><span className="mr-1.5 text-blue-ink">Q.</span>{x.question}</p>
      {x.answer ? (
        <>
          <p className="whitespace-pre-line text-[13.5px] font-medium leading-relaxed"><span className="mr-1.5 font-extrabold text-ok">R.</span>{x.answer}</p>
          <span className="text-[11.5px] font-semibold text-muted">{x.shops?.name ?? 'La boutique'}{x.answered_at ? ` · ${ago(x.answered_at)}` : ''}</span>
        </>
      ) : (
        <span className="text-[12px] font-semibold text-muted">En attente de la réponse du vendeur · posée {ago(x.created_at)}</span>
      )}
    </article>
  );
}
