'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { PhotoSlot, Price, VerifiedMark } from '@hailandx/ui';
import { discountPercent, formatGnf } from '@hailandx/commerce';

export interface GridItem { key: string; href: string; name: string; priceGnf: number; photoUrl: string | null; color: string; shopName: string; etaMinutes: number; compareAtGnf?: number | null;
  /** Nombre de boutiques qui vendent ce produit : à partir de 2, la carte annonce « dès … » et « N vendeurs » au lieu de la boutique. */
  sellers?: number }

const PAGE = 16;

/** Carte produit commune (grille et rangées) : photo, nom, prix, boutique (ou nombre de vendeurs quand plusieurs boutiques le proposent). */
export function ProductCard({ p, wide = false }: { p: GridItem; wide?: boolean }) {
  const pct = discountPercent(p.priceGnf, p.compareAtGnf);
  const many = (p.sellers ?? 1) > 1;
  return (
    <Link href={p.href} className={`flex flex-col overflow-hidden rounded-[20px] border border-line-soft bg-card ${wide ? '' : 'w-[150px] shrink-0 snap-start'}`}>
      <span className="relative block">
        <PhotoSlot src={p.photoUrl} color={p.color} className={wide ? 'h-[150px]' : 'h-[130px]'} label={p.name} />
        <span className="absolute bottom-2 right-2 rounded-full bg-white/90 px-2 py-1 text-[10.5px] font-bold">≈ {p.etaMinutes} min</span>
        {pct && <span className="absolute left-2 top-2 rounded-full bg-ink px-2 py-1 text-[11px] font-extrabold text-lime">−{pct} %</span>}
      </span>
      <span className="flex flex-col gap-0.5 px-3 pb-3 pt-2.5">
        <span className="line-clamp-2 min-h-[2.4em] text-[13px] font-bold leading-tight">{p.name}</span>
        <span className="flex flex-wrap items-baseline gap-x-1.5">{many && <span className="text-[11px] font-bold text-muted">dès</span>}<Price className="text-[15px]">{formatGnf(p.priceGnf)}</Price>{pct && <span className="text-[11.5px] font-semibold text-muted line-through">{formatGnf(p.compareAtGnf!)}</span>}</span>
        {many
          ? <span className="flex min-w-0 items-center gap-1 text-[11.5px] font-extrabold text-blue-ink"><span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue" /><span className="truncate">{p.sellers} vendeurs · comparez</span></span>
          : <span className="flex min-w-0 items-center gap-1 text-[11.5px] font-semibold text-muted"><VerifiedMark size={13} /><span className="truncate">{p.shopName}</span></span>}
      </span>
    </Link>
  );
}

/** Tous les produits d'une catégorie, en grille ; les cartes s'ajoutent au fil du défilement (pas de bouton). */
export function ProductGrid({ items }: { items: GridItem[] }) {
  const [shown, setShown] = useState(PAGE);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => setShown(PAGE), [items]);
  useEffect(() => {
    const el = end.current;
    if (!el || shown >= items.length) return;
    const io = new IntersectionObserver((e) => { if (e[0]?.isIntersecting) setShown((n) => Math.min(items.length, n + PAGE)); }, { rootMargin: '800px' });
    io.observe(el);
    return () => io.disconnect();
  }, [shown, items.length]);
  return (
    <>
      <div className="grid grid-cols-2 gap-3">{items.slice(0, shown).map((p) => <ProductCard key={p.key} p={p} wide />)}</div>
      {shown < items.length && <div ref={end} aria-hidden="true" className="h-10" />}
    </>
  );
}
