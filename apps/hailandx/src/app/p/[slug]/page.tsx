import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, PhotoSlot, Price, VerifiedMark } from '@hailandx/ui';
import { ago, brandOf, discountPercent, formatGnf, onVacation, keyFacts, rankOffers, readAttributes, specRows, type Offer } from '@hailandx/commerce';
import { badgesOf } from '@/data/sample';
import { getCatalog, trustFor, type Catalog, type ProductView } from '@/lib/catalog';
import { serverClient } from '@hailandx/kit';
import { AskQuestion } from '@/components/AskQuestion';
import { BuyBar } from '@/components/BuyBar';
import { CartButton } from '@/components/CartButton';
import { SuiviCommande } from '@/components/SuiviCommande';
import { ProductGallery, ReadMore } from '@/components/ProductGallery';

interface Question { id: string; question: string; answer: string | null; answered_at: string | null; created_at: string; shops: { name: string } | null }
interface Review { id: string; rating: number; comment: string | null; created_at: string }

/**
 * Questions publiques, avis vérifiés de la boutique et produits de la MÊME boutique souvent achetés ensemble (HAILANDX.md §35, §49).
 * En cas d'échec (base injoignable), la page s'affiche sans.
 */
async function extras(productId: string | undefined, shopSlug: string): Promise<{ questions: Question[]; together: { product_id: string; orders: number }[]; reviews: Review[] }> {
  const sb = serverClient();
  if (!sb || !productId) return { questions: [], together: [], reviews: [] };
  const [qs, bt, rv] = await Promise.all([
    sb.from('product_questions').select('id,question,answer,answered_at,created_at,shops:answer_shop_id(name)').eq('product_id', productId).order('created_at', { ascending: false }).limit(60),
    sb.rpc('fn_bought_together', { p_product: productId, p_limit: 8 }),
    sb.from('reviews').select('id,rating,comment,created_at,shops!inner(slug)').eq('shops.slug', shopSlug).order('created_at', { ascending: false }).limit(3),
  ]);
  return { questions: (qs.data as unknown as Question[]) ?? [], together: (bt.data as { product_id: string; orders: number }[]) ?? [], reviews: (rv.data as unknown as Review[]) ?? [] };
}

type Params = { params: Promise<{ slug: string }>; searchParams: Promise<{ b?: string }> };

/**
 * Offre affichée : celle de la boutique `b` du lien reçu. Sans `b` (ancien lien), la mieux classée (confiance 45 %, prix 40 %, délai 15 %).
 * Phase de lancement (HAILANDX.md §49) : la page ne montre que cette boutique, jamais les offres concurrentes.
 */
function pickOffers(cat: Catalog, slug: string, b?: string) {
  const all = cat.products.filter((x) => x.slug === slug);
  const asOffer = (x: ProductView): Offer => ({ id: x.shopSlug, shopId: x.shopSlug, priceGnf: x.priceGnf, shopTrust: trustFor(cat.shops.find((s) => s.slug === x.shopSlug)!), etaMinutes: x.etaMinutes, inStock: x.inStock !== false });
  const ranked = rankOffers(all.map(asOffer)).map((o) => all.find((x) => x.shopSlug === o.shopId)!);
  return { selected: (b && ranked.find((x) => x.shopSlug === b)) || ranked[0] };
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

/**
 * Page d'un lien partagé (maquettes v9, HAILANDX.md §49) : la fiche riche du produit chez CE vendeur, puis le reste de sa boutique.
 * Pas de comparaison entre vendeurs, pas de produits d'autres boutiques : le client vient du lien du vendeur.
 */
export default async function ProductLinkPage({ params, searchParams }: Params) {
  const { slug } = await params;
  const { b } = await searchParams;
  const cat = await getCatalog();
  const { selected: p } = pickOffers(cat, slug, b);
  if (!p) notFound();
  const shop = cat.shops.find((x) => x.slug === p.shopSlug)!;
  const others = cat.products.filter((o) => o.shopSlug === shop.slug && o.slug !== p.slug).sort((x, y) => Number(!!y.featured) - Number(!!x.featured)).slice(0, 10);
  // Fiche détaillée : marque, « En bref », points forts, tableau des caractéristiques (fiche type de la catégorie).
  const brand = brandOf(p.attributes);
  const facts = keyFacts(p.categoryId, p.attributes);
  const specs = specRows(p.categoryId, p.attributes);
  const points = readAttributes(p.attributes).points;
  const left = (p.variants ?? []).reduce((n, v) => n + Math.max(0, v.stock), 0);
  const stockText = p.inStock === false ? 'Rupture de stock' : left > 0 && left <= 5 ? `Plus que ${left} en stock` : 'En stock';
  const { questions, together: pairs, reviews } = await extras(p.productId, shop.slug);
  // Souvent achetés ensemble : seulement les produits de cette boutique.
  const together = pairs.flatMap((x) => { const o = cat.products.find((c) => c.productId === x.product_id && c.shopSlug === shop.slug); return o ? [{ ...o, orders: x.orders }] : []; });
  const answered = questions.filter((x) => x.answer);
  const pending = questions.filter((x) => !x.answer);
  const rating = shop.stats.reviewCount > 0 ? shop.stats.rating.toFixed(1).replace('.', ',') : null;
  const since = new Date(Date.now() - shop.stats.ageDays * 86_400_000).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 bg-card pb-32">
      <header className="flex items-center justify-between gap-3 px-[18px] py-3">
        <Link href={`/b/${shop.slug}`} className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[13px] bg-ink font-display text-sm font-bold" style={{ color: shop.color }}>{shop.logoUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={shop.logoUrl} alt="" className="h-full w-full object-cover" /> : shop.initials}</span>
          <span className="flex min-w-0 flex-col">
            <span className="flex items-center gap-1.5 truncate text-[14.5px] font-extrabold">{shop.name}<VerifiedMark size={15} /></span>
            <span className="text-[11.5px] font-bold text-blue-ink">Voir la boutique</span>
          </span>
        </Link>
        <span className="flex shrink-0 items-center gap-2"><SuiviCommande /><CartButton /></span>
      </header>

      <div className="px-[18px]">
        <ProductGallery photos={p.photoUrls?.length ? p.photoUrls : p.photoUrl ? [p.photoUrl] : []} color={p.color} label={p.name} />
      </div>

      {/* Titre, marque, prix, état, stock (maquette v9 « Fiche »). */}
      <div className="flex flex-col gap-1.5 px-[18px]">
        {brand && <span className="text-[12.5px] font-extrabold uppercase tracking-[0.06em] text-blue-ink">{brand}</span>}
        <h1 className="font-display text-[22px] font-semibold leading-tight tracking-tight">{p.name}</h1>
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <Price className="text-[22px]">{formatGnf(p.priceGnf)}</Price>
          {discountPercent(p.priceGnf, p.compareAtGnf) && <><span className="text-[14px] font-semibold text-muted line-through">{formatGnf(p.compareAtGnf!)}</span><span className="rounded-full bg-ink px-2 py-0.5 text-[12px] font-extrabold text-lime">−{discountPercent(p.priceGnf, p.compareAtGnf)} %</span></>}
        </div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <Badge tone={p.inStock === false ? 'ink' : 'ok'}>{stockText}</Badge>
          <Badge tone="sand">{p.condition === 'occasion' ? 'Occasion' : 'Neuf'}</Badge>
          <Badge tone="blue">Boutique à adresse certifiée</Badge>
          {rating && <Badge>★ {rating} · avis vérifiés</Badge>}
          {badgesOf(shop).map((x) => <Badge key={x}>{x}</Badge>)}
        </div>
      </div>

      <section aria-label="Livraison" className="mx-[18px] flex flex-col gap-1 rounded-2xl bg-bg px-4 py-3">
        <span className="flex items-baseline justify-between gap-2 text-[13.5px] font-extrabold"><span>Livraison à votre porte</span><span className="text-[12px] font-bold text-muted">calculée à l’adresse</span></span>
        <span className="text-[12.5px] font-semibold leading-snug text-muted">Par la Flotte Hailand, ≈ {p.etaMinutes} min après la préparation. Vous payez en ligne (argent bloqué jusqu’à la remise) ou en espèces au livreur.</span>
      </section>

      {facts.length > 0 && (
        <section aria-labelledby="bref" className="flex flex-col gap-2 px-[18px]">
          <h2 id="bref" className="text-sm font-extrabold">En bref</h2>
          <div className="grid grid-cols-2 gap-2">
            {facts.map((f) => (
              <div key={f.key} className="flex min-w-0 flex-col gap-0.5 rounded-2xl bg-bg px-3.5 py-3">
                <span className="text-[11.5px] font-bold text-muted">{f.label}</span>
                <span className="truncate text-[14.5px] font-extrabold">{f.value}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {p.description && (
        <section aria-labelledby="desc" className="flex flex-col gap-2 px-[18px]">
          <h2 id="desc" className="text-sm font-extrabold">Description</h2>
          <ReadMore text={p.description} />
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

      {/* Ce que garantit Hailand (remise par code, argent bloqué jusqu'à la remise, litige sous 72 h) et la politique de la boutique. */}
      <section aria-labelledby="garanties" className="flex flex-col gap-2 px-[18px]">
        <h2 id="garanties" className="text-sm font-extrabold">Livraison, paiement et retours</h2>
        <dl className="flex flex-col divide-y divide-line-soft rounded-2xl border border-line-soft">
          {[
            ...(shop.place ? [['Expédié depuis', shop.place]] : []),
            ['Livraison', 'À la porte du bâtiment de votre adresse, frais selon la distance, affichés avant de commander.'],
            ['Paiement', 'En ligne, l’argent reste bloqué jusqu’à la remise ; ou en espèces au livreur.'],
            ['Remise', 'Seulement à vous, contre votre code à 4 chiffres, avec une photo de remise.'],
            ['Échange', shop.policy ?? 'Voir avec la boutique avant de commander.'],
          ].map(([t, d]) => (
            <div key={t} className="grid grid-cols-[minmax(0,2fr)_minmax(0,5fr)] gap-3 px-4 py-2.5 text-[13px]"><dt className="font-bold text-muted">{t}</dt><dd className="m-0 whitespace-pre-line font-semibold leading-snug">{d}</dd></div>
          ))}
        </dl>
        <p className="text-[12px] font-semibold text-muted">Un problème à la réception ? Signalez-le dans les 72 h depuis votre commande : l’équipe Hailand tranche, l’argent reste bloqué en attendant.</p>
      </section>

      <section aria-labelledby="avis" className="flex flex-col gap-2.5 px-[18px]">
        <div className="flex items-baseline justify-between">
          <h2 id="avis" className="text-sm font-extrabold">Avis vérifiés sur la boutique{rating ? ` · ★ ${rating}` : ''}</h2>
          {shop.stats.reviewCount > 0 && <span className="text-[12px] font-bold text-muted">{shop.stats.reviewCount} avis sur la boutique</span>}
        </div>
        {reviews.length === 0
          ? <p className="text-[12.5px] font-semibold text-muted">Pas encore d’avis. Seul un acheteur dont la remise est confirmée peut noter la boutique.</p>
          : reviews.map((r) => (
            <article key={r.id} className="flex flex-col gap-1 rounded-2xl border border-line-soft px-4 py-3">
              <span className="text-[12px] font-bold text-muted"><span aria-label={`${r.rating} étoiles sur 5`} className="text-ink">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span> · colis remis par la Flotte · {ago(r.created_at)}</span>
              {r.comment && <p className="whitespace-pre-line text-[13.5px] font-medium leading-relaxed">{r.comment}</p>}
            </article>
          ))}
      </section>

      {p.productId && (
        <section aria-labelledby="questions" className="flex flex-col gap-2.5 px-[18px]">
          <div className="flex items-baseline justify-between">
            <h2 id="questions" className="text-sm font-extrabold">Questions au vendeur</h2>
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

      <section aria-label="Le vendeur" className="mx-[18px] flex items-center gap-3 rounded-2xl border border-line-soft px-4 py-3.5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[13px] bg-ink font-display text-sm font-bold" style={{ color: shop.color }}>{shop.logoUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={shop.logoUrl} alt="" className="h-full w-full object-cover" /> : shop.initials}</span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-1.5 truncate text-[15px] font-extrabold">{shop.name}<VerifiedMark size={15} /></span>
          <span className="text-[12px] font-semibold text-muted">Adresse certifiée · {shop.stats.sales} vente{shop.stats.sales > 1 ? 's' : ''} livrée{shop.stats.sales > 1 ? 's' : ''} · depuis {since} · confiance {trustFor(shop)}/100</span>
        </span>
        <Link href={`/b/${shop.slug}`} className="flex h-10 shrink-0 items-center rounded-full border border-line px-3.5 text-[13px] font-extrabold">Boutique</Link>
      </section>

      {together.length > 0 && (
        <section aria-label="Souvent achetés ensemble" className="flex flex-col gap-2.5 px-[18px]">
          <h2 className="text-sm font-extrabold">Souvent achetés ensemble</h2>
          <div className="flex snap-x gap-2.5 overflow-x-auto [scrollbar-width:none]">
            {together.map((o) => (
              <Link key={o.productId} href={`/p/${o.slug}?b=${o.shopSlug}`} className="flex w-[130px] shrink-0 snap-start flex-col gap-1">
                <PhotoSlot src={o.photoUrl} color={o.color} className="h-[130px] rounded-2xl" label={o.name} />
                <span className="line-clamp-2 text-xs font-bold leading-tight">{o.name}</span>
                <span className="text-[12.5px] font-extrabold">{formatGnf(o.priceGnf)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {others.length > 0 && (
        <section aria-label={`Autres produits de ${shop.name}`} className="flex flex-col gap-2.5 px-[18px]">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-extrabold">Autres produits de {shop.name}</h2>
            <Link href={`/b/${shop.slug}`} className="text-[12.5px] font-extrabold text-blue-ink">Toute la boutique</Link>
          </div>
          <div className="flex snap-x gap-2.5 overflow-x-auto [scrollbar-width:none]">
            {others.map((o) => (
              <Link key={o.slug} href={`/p/${o.slug}?b=${o.shopSlug}`} className="flex w-[120px] shrink-0 snap-start flex-col gap-1.5">
                <PhotoSlot src={o.photoUrl} color={o.color} className="h-[120px] rounded-2xl" label={o.name} />
                <span className="line-clamp-2 text-xs font-bold leading-tight">{o.name}</span>
                <span className="text-[12.5px] font-extrabold">{formatGnf(o.priceGnf)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <BuyBar available={p.inStock !== false && !onVacation(shop.vacationUntil)} closedLabel={onVacation(shop.vacationUntil) ? `Boutique en congé jusqu’au ${new Date(shop.vacationUntil!).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}` : undefined} variants={p.variants ?? []} line={p.offerId ? { offerId: p.offerId, variantId: p.variantId ?? null, slug: p.slug, name: p.name, priceGnf: p.priceGnf, shopSlug: shop.slug, shopName: shop.name, photoUrl: p.photoUrl ?? null } : null} />
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
