'use client';
import { useState } from 'react';
import Link from 'next/link';
import { PhotoSlot, Price } from '@hailandx/ui';
import { formatGnf } from '@hailandx/commerce';

export interface ShopProduct { slug: string; name: string; priceGnf: number; color: string; photoUrl?: string | null; sectionId?: string | null }
export interface Section { id: string; name: string }

/** Produits de la boutique, filtrables par rayon (« Tout », « Boubous », « Chaussures »…). */
export function ShopProducts({ shopSlug, products, sections }: { shopSlug: string; products: ShopProduct[]; sections: Section[] }) {
  const used = sections.filter((s) => products.some((p) => p.sectionId === s.id));
  const [active, setActive] = useState<string>('all');
  const shown = active === 'all' ? products : products.filter((p) => p.sectionId === active);
  return (
    <>
      {used.length > 0 && (
        <nav aria-label="Rayons" className="flex gap-2 overflow-x-auto px-5">
          {[{ id: 'all', name: 'Tout' }, ...used].map((s) => (
            <button key={s.id} type="button" aria-pressed={active === s.id} onClick={() => setActive(s.id)} className={`flex h-9 shrink-0 items-center rounded-full px-3.5 text-[13px] font-bold ${active === s.id ? 'bg-ink text-white' : 'border border-line bg-card'}`}>{s.name}</button>
          ))}
        </nav>
      )}
      <section aria-label="Produits" className="grid grid-cols-2 gap-3 px-5 pt-2">
        {shown.map((p) => (
          <Link key={p.slug} href={`/p/${p.slug}?b=${shopSlug}`} className="flex flex-col overflow-hidden rounded-[18px] border border-line-soft bg-card">
            <PhotoSlot src={p.photoUrl} color={p.color} className="h-[120px]" label={p.name} />
            <span className="flex flex-col gap-0.5 px-3 pb-3 pt-2.5">
              <span className="truncate text-[13px] font-bold">{p.name}</span>
              <Price className="text-[14.5px]">{formatGnf(p.priceGnf)}</Price>
            </span>
          </Link>
        ))}
        {shown.length === 0 && <p className="col-span-2 text-[13.5px] font-medium text-muted">Aucun produit dans ce rayon pour l’instant.</p>}
      </section>
    </>
  );
}
