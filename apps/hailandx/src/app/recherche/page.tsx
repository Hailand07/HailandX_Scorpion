import Link from 'next/link';
import { Badge, PhotoSlot, VerifiedMark } from '@hailandx/ui';
import { formatGnf } from '@hailandx/commerce';
import { getCatalog, norm, offerKey, trustFor } from '@/lib/catalog';
import { RecentSearches, RememberSearch } from '@/components/RecentSearches';

export const metadata = { title: 'Recherche' };
const field = 'h-12 w-full rounded-2xl border border-line bg-card px-4 text-[16px] font-medium outline-none focus:border-blue';
const TILE = ['#f6d8bd', '#f3d3e0', '#d9e1fb', '#d3edd9', '#ece5d8', '#fde2c8', '#dbe4ff', '#e3f6e9'];

/**
 * Recherche (v2) : elle s'ouvre depuis la barre de l'accueil, sans onglet à part. Produits (nom, catégorie) et boutiques
 * (nom, présentation), sans tenir compte des accents ni des majuscules ; filtres en puces, filtres détaillés repliés.
 */
type Tri = 'pertinence' | 'prix_asc' | 'prix_desc' | 'delai';
const DELAIS = [30, 45, 60];
type Params = { q?: string; cat?: string; min?: string; max?: string; delai?: string; confiance?: string; tri?: string };

export default async function SearchPage({ searchParams }: { searchParams: Promise<Params> }) {
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
  const filtered = Boolean(cat || min || max || delai || confiance || tri !== 'pertinence');
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
  const total = shopHits.length + productHits.length;

  /** Adresse de la recherche avec un paramètre changé (les puces s'activent et se désactivent d'un geste). */
  const withParam = (patch: Partial<Params>) => {
    const u = new URLSearchParams();
    const merged: Params = { q: q || undefined, cat, min: min ? String(min) : undefined, max: max ? String(max) : undefined, delai: delai ? String(delai) : undefined, confiance: confiance ? '1' : undefined, tri: tri !== 'pertinence' ? tri : undefined, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) u.set(k, v);
    const s = u.toString();
    return s ? `/recherche?${s}` : '/recherche';
  };
  const chip = (on: boolean) => `flex h-[34px] shrink-0 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-extrabold ${on ? 'bg-ink text-white' : 'border border-line bg-card'}`;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-5 pb-8 pt-4">
      <RememberSearch q={q} />
      <div className="flex items-center gap-2.5">
        <form id="f" action="/recherche" role="search" className="flex h-[50px] min-w-0 flex-1 items-center gap-2.5 rounded-2xl border-2 border-blue bg-card px-3.5">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#12141c" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input name="q" defaultValue={q} autoFocus={!q} type="search" inputMode="search" enterKeyHint="search" placeholder="Produit, boutique…" aria-label="Rechercher" className="h-full min-w-0 flex-1 bg-transparent text-[16px] font-semibold outline-none" />
        </form>
        <Link href="/" className="flex h-11 items-center px-1 text-[14px] font-extrabold text-blue">Annuler</Link>
      </div>

      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none]" aria-label="Filtres rapides">
        <Link href={withParam({ tri: tri === 'prix_asc' ? undefined : 'prix_asc' })} className={chip(tri === 'prix_asc')}>Prix croissant</Link>
        <Link href={withParam({ delai: delai === 60 ? undefined : '60' })} className={chip(delai === 60)}>Livré en moins d’1 h</Link>
        <Link href={withParam({ confiance: confiance ? undefined : '1' })} className={chip(confiance)}>Certifié et fiable</Link>
        {cat && <Link href={withParam({ cat: undefined })} aria-label={`Retirer la catégorie ${cat}`} className={chip(true)}>{cat} ✕</Link>}
      </div>

      <details open={Boolean(min || max || (delai && delai !== 60) || tri === 'prix_desc' || tri === 'delai')} className="rounded-2xl border border-line-soft bg-card">
        <summary className="flex h-12 cursor-pointer list-none items-center justify-between px-4 text-[14px] font-extrabold">Plus de filtres{filtered && <Badge tone="blue">actifs</Badge>}</summary>
        <div className="flex flex-col gap-3 px-4 pb-4">
          <select name="cat" form="f" defaultValue={cat ?? ''} aria-label="Catégorie" className={field}><option value="">Toutes les catégories</option>{categories.map((c) => <option key={c} value={c}>{c}</option>)}</select>
          <div className="grid grid-cols-2 gap-2"><input name="min" form="f" inputMode="numeric" defaultValue={min ?? ''} placeholder="Prix min (GNF)" aria-label="Prix minimum" className={field} /><input name="max" form="f" inputMode="numeric" defaultValue={max ?? ''} placeholder="Prix max (GNF)" aria-label="Prix maximum" className={field} /></div>
          <select name="delai" form="f" defaultValue={delai ?? ''} aria-label="Délai" className={field}><option value="">Tous les délais</option>{DELAIS.map((d) => <option key={d} value={d}>Livré en {d} min ou moins</option>)}</select>
          <label className="flex items-center gap-2 text-[13.5px] font-bold"><input type="checkbox" name="confiance" form="f" value="1" defaultChecked={confiance} className="h-5 w-5" /> Vendeurs à confiance élevée (70 et plus)</label>
          <select name="tri" form="f" defaultValue={tri} aria-label="Trier par" className={field}><option value="pertinence">Trier : confiance du vendeur</option><option value="prix_asc">Prix croissant</option><option value="prix_desc">Prix décroissant</option><option value="delai">Délai le plus court</option></select>
          <div className="flex gap-2"><button type="submit" form="f" className="h-12 flex-1 rounded-2xl bg-ink text-[14px] font-extrabold text-white">Appliquer</button><Link href={q ? `/recherche?q=${encodeURIComponent(q)}` : '/recherche'} className="flex h-12 items-center rounded-2xl border border-line px-4 text-[14px] font-bold">Effacer</Link></div>
        </div>
      </details>

      {!searching && (
        <>
          <RecentSearches />
          <section className="flex flex-col gap-2.5">
            <h2 className="text-[13px] font-extrabold text-muted">Parcourir</h2>
            <div className="grid grid-cols-2 gap-2.5">
              {categories.map((c, i) => <Link key={c} href={`/recherche?cat=${encodeURIComponent(c)}`} className="flex h-16 items-start rounded-[18px] px-3.5 py-3 text-[14px] font-extrabold" style={{ background: TILE[i % TILE.length] }}>{c}</Link>)}
            </div>
          </section>
        </>
      )}

      {searching && <p className="text-[13px] font-bold text-muted">{total ? `${total} résultat${total > 1 ? 's' : ''}` : <>Aucun résultat{q ? <> pour « {q} »</> : null}. Essayez un autre mot ou retirez un filtre.</>}</p>}

      {shopHits.length > 0 && (
        <section className="flex flex-col gap-2"><h2 className="text-[13px] font-extrabold text-muted">Boutiques</h2>
          {shopHits.map((s) => (
            <Link key={s.slug} href={`/b/${s.slug}`} className="flex items-center gap-3 rounded-[18px] border border-line-soft bg-card px-3 py-2.5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-ink font-display text-sm font-bold" style={{ color: s.color }}>{s.logoUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={s.logoUrl} alt="" className="h-full w-full object-cover" /> : s.initials}</span>
              <span className="flex min-w-0 flex-1 flex-col"><span className="flex items-center gap-1.5 truncate text-[14px] font-extrabold">{s.name}<VerifiedMark size={14} /></span><span className="truncate text-[12px] font-semibold text-muted">{s.tagline || 'Boutique certifiée'}</span></span>
              <Badge>{trustFor(s)}/100</Badge>
            </Link>
          ))}
        </section>
      )}

      {productHits.length > 0 && (
        <section className="flex flex-col gap-2"><h2 className="text-[13px] font-extrabold text-muted">Produits</h2>
          {productHits.map((p) => {
            const shop = shops.find((s) => s.slug === p.shopSlug);
            return (
              <Link key={offerKey(p)} href={`/p/${p.slug}?b=${p.shopSlug}`} className="flex items-center gap-3 rounded-[18px] border border-line-soft bg-card p-2.5">
                <span className="block h-14 w-14 shrink-0 overflow-hidden rounded-[14px]"><PhotoSlot src={p.photoUrl} color={p.color} className="h-14" label={p.name} /></span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5"><span className="truncate text-[14px] font-extrabold">{p.name}</span><span className="truncate text-[12px] font-semibold text-muted">{shop?.name} · ≈ {p.etaMinutes} min</span></span>
                <span className="shrink-0 font-display text-[14px] font-semibold">{formatGnf(p.priceGnf)}</span>
              </Link>
            );
          })}
        </section>
      )}
    </main>
  );
}
