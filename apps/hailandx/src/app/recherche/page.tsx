import Link from 'next/link';
import { Badge, PhotoSlot, Price, VerifiedMark, Wordmark } from '@hailandx/ui';
import { formatGnf } from '@hailandx/commerce';
import { getCatalog, norm, offerKey, trustFor } from '@/lib/catalog';

export const metadata = { title: 'Recherche' };
const field = 'h-12 w-full rounded-2xl border border-line bg-card px-4 text-[16px] font-medium outline-none focus:border-blue';

/** Recherche : produits (nom, catégorie) et boutiques (nom, présentation), sans tenir compte des accents ni des majuscules. */
type Tri = 'pertinence' | 'prix_asc' | 'prix_desc' | 'delai';
const DELAIS = [30, 45, 60];

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; cat?: string; min?: string; max?: string; delai?: string; confiance?: string; tri?: string }> }) {
  const sp = await searchParams;
  const { q = '' } = sp;
  const num = (v?: string) => { const n = Number((v ?? '').replace(/\s/g, '')); return Number.isFinite(n) && n > 0 ? n : undefined; };
  const min = num(sp.min); const max = num(sp.max); const delai = DELAIS.includes(Number(sp.delai)) ? Number(sp.delai) : undefined;
  const tri: Tri = (['prix_asc', 'prix_desc', 'delai'] as const).find((t) => t === sp.tri) ?? 'pertinence';
  const confiance = sp.confiance === '1';
  const term = norm(q.trim());
  const { shops, products } = await getCatalog();
  const categories = [...new Set(products.map((p) => p.category))].sort((a, b) => a.localeCompare(b, 'fr'));
  const cat = sp.cat && categories.includes(sp.cat) ? sp.cat : undefined;
  const filtered = Boolean(cat || min || max || delai || confiance);
  const words = term.split(/\s+/).filter(Boolean);
  const hit = (text: string) => words.every((w) => norm(text).includes(w));
  const shopHits = words.length ? shops.filter((s) => hit(`${s.name} ${s.tagline}`)) : [];
  const trustOf = (slug: string) => { const sh = shops.find((x) => x.slug === slug); return sh ? trustFor(sh) : 0; };
  let productHits = words.length || filtered ? products.filter((p) => (!words.length || hit(`${p.name} ${p.category} ${shops.find((s) => s.slug === p.shopSlug)?.name ?? ''}`))
    && (!cat || p.category === cat) && (!min || p.priceGnf >= min) && (!max || p.priceGnf <= max) && (!delai || p.etaMinutes <= delai) && (!confiance || trustOf(p.shopSlug) >= 70)) : [];
  if (tri === 'prix_asc') productHits = [...productHits].sort((a, b) => a.priceGnf - b.priceGnf);
  else if (tri === 'prix_desc') productHits = [...productHits].sort((a, b) => b.priceGnf - a.priceGnf);
  else if (tri === 'delai') productHits = [...productHits].sort((a, b) => a.etaMinutes - b.etaMinutes);
  else productHits = [...productHits].sort((a, b) => trustOf(b.shopSlug) - trustOf(a.shopSlug));
  const searching = words.length > 0 || filtered;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-5 pb-12 pt-5">
      <div className="flex items-center justify-between"><Link href="/" aria-label="Accueil"><Wordmark /></Link></div>
      <form id="f" action="/recherche" role="search" className="flex gap-2">
        <input name="q" defaultValue={q} autoFocus={!q} type="search" inputMode="search" enterKeyHint="search" placeholder="Rechercher un produit, une boutique…" aria-label="Rechercher" className="h-12 min-w-0 flex-1 rounded-2xl border border-line bg-card px-4 text-[16px] font-medium outline-none focus:border-blue" />
        <button type="submit" className="h-12 rounded-2xl bg-ink px-5 text-[14px] font-extrabold text-white">Chercher</button>
      </form>


      <details open={filtered} className="rounded-2xl border border-line-soft bg-card">
        <summary className="flex h-12 cursor-pointer list-none items-center justify-between px-4 text-[14px] font-extrabold">Filtres et tri{filtered && <Badge tone="blue">actifs</Badge>}</summary>
        <div className="flex flex-col gap-3 px-4 pb-4">
          <select name="cat" form="f" defaultValue={cat ?? ''} aria-label="Catégorie" className={field}><option value="">Toutes les catégories</option>{categories.map((c) => <option key={c} value={c}>{c}</option>)}</select>
          <div className="grid grid-cols-2 gap-2"><input name="min" form="f" inputMode="numeric" defaultValue={min ?? ''} placeholder="Prix min (GNF)" aria-label="Prix minimum" className={field} /><input name="max" form="f" inputMode="numeric" defaultValue={max ?? ''} placeholder="Prix max (GNF)" aria-label="Prix maximum" className={field} /></div>
          <select name="delai" form="f" defaultValue={delai ?? ''} aria-label="Délai" className={field}><option value="">Tous les délais</option>{DELAIS.map((d) => <option key={d} value={d}>Livré en {d} min ou moins</option>)}</select>
          <label className="flex items-center gap-2 text-[13.5px] font-bold"><input type="checkbox" name="confiance" form="f" value="1" defaultChecked={confiance} className="h-5 w-5" /> Vendeurs à confiance élevée (indice 70 et plus)</label>
          <select name="tri" form="f" defaultValue={tri} aria-label="Trier par" className={field}><option value="pertinence">Trier : confiance du vendeur</option><option value="prix_asc">Prix croissant</option><option value="prix_desc">Prix décroissant</option><option value="delai">Délai le plus court</option></select>
          <div className="flex gap-2"><button type="submit" form="f" className="h-12 flex-1 rounded-2xl bg-ink text-[14px] font-extrabold text-white">Appliquer</button><Link href={q ? `/recherche?q=${encodeURIComponent(q)}` : '/recherche'} className="flex h-12 items-center rounded-2xl border border-line px-4 text-[14px] font-bold">Réinitialiser</Link></div>
        </div>
      </details>

      {!searching && <p className="text-[13.5px] font-medium text-muted">Tapez le nom d’un produit ou d’une boutique.</p>}
      {searching && shopHits.length === 0 && productHits.length === 0 && <p className="rounded-2xl bg-sand px-4 py-3 text-[13.5px] font-semibold">Aucun résultat{q ? <> pour « {q} »</> : null}. Essayez un autre mot ou retirez un filtre.</p>}

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
