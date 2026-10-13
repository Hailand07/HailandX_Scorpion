import Link from 'next/link';
import { Badge, PhotoSlot, Price, VerifiedMark, Wordmark } from '@hailandx/ui';
import { formatGnf } from '@hailandx/commerce';
import { getCatalog, norm, offerKey, trustFor } from '@/lib/catalog';

export const metadata = { title: 'Recherche' };

/** Recherche : produits (nom, catégorie) et boutiques (nom, présentation), sans tenir compte des accents ni des majuscules. */
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = '' } = await searchParams;
  const term = norm(q.trim());
  const { shops, products } = await getCatalog();
  const words = term.split(/\s+/).filter(Boolean);
  const hit = (text: string) => words.every((w) => norm(text).includes(w));
  const shopHits = words.length ? shops.filter((s) => hit(`${s.name} ${s.tagline}`)) : [];
  const productHits = words.length ? products.filter((p) => hit(`${p.name} ${p.category} ${shops.find((s) => s.slug === p.shopSlug)?.name ?? ''}`)) : [];

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-5 pb-12 pt-5">
      <div className="flex items-center justify-between"><Link href="/" aria-label="Accueil"><Wordmark /></Link></div>
      <form action="/recherche" role="search" className="flex gap-2">
        <input name="q" defaultValue={q} autoFocus={!q} type="search" inputMode="search" enterKeyHint="search" placeholder="Rechercher un produit, une boutique…" aria-label="Rechercher" className="h-12 min-w-0 flex-1 rounded-2xl border border-line bg-card px-4 text-[16px] font-medium outline-none focus:border-blue" />
        <button type="submit" className="h-12 rounded-2xl bg-ink px-5 text-[14px] font-extrabold text-white">Chercher</button>
      </form>

      {!words.length && <p className="text-[13.5px] font-medium text-muted">Tapez le nom d’un produit ou d’une boutique.</p>}
      {words.length > 0 && shopHits.length === 0 && productHits.length === 0 && <p className="rounded-2xl bg-sand px-4 py-3 text-[13.5px] font-semibold">Aucun résultat pour « {q} ». Essayez un autre mot.</p>}

      {shopHits.length > 0 && (
        <section className="flex flex-col gap-2"><h2 className="text-[13px] font-extrabold text-muted">Boutiques</h2>
          {shopHits.map((s) => (
            <Link key={s.slug} href={`/b/${s.slug}`} className="flex items-center gap-3 rounded-2xl border border-line-soft bg-card px-3.5 py-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-ink font-display text-sm font-bold" style={{ color: s.color }}>{s.logoUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={s.logoUrl} alt="" className="h-full w-full object-cover" /> : s.initials}</span>
              <span className="flex min-w-0 flex-1 flex-col"><span className="flex items-center gap-1.5 truncate text-[14px] font-extrabold">{s.name}<VerifiedMark size={14} /></span><span className="truncate text-[12px] font-semibold text-muted">{s.tagline || 'Boutique certifiée'}</span></span>
              <Badge>{trustFor(s)}/100</Badge>
            </Link>
          ))}
        </section>
      )}

      {productHits.length > 0 && (
        <section className="flex flex-col gap-2"><h2 className="text-[13px] font-extrabold text-muted">Produits ({productHits.length})</h2>
          <div className="grid grid-cols-2 gap-3">
            {productHits.map((p) => {
              const shop = shops.find((s) => s.slug === p.shopSlug);
              return (
                <Link key={offerKey(p)} href={`/p/${p.slug}?b=${p.shopSlug}`} className="flex flex-col overflow-hidden rounded-[18px] border border-line-soft bg-card">
                  <PhotoSlot src={p.photoUrl} color={p.color} className="h-[130px]" label={p.name} />
                  <span className="flex flex-col gap-0.5 px-3 pb-3 pt-2.5"><span className="truncate text-[13px] font-bold">{p.name}</span><Price className="text-[14.5px]">{formatGnf(p.priceGnf)}</Price><span className="truncate text-[11.5px] font-semibold text-muted">{shop?.name}</span></span>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
