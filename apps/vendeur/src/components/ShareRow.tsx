'use client';
import { useState } from 'react';
import Link from 'next/link';
import { HAILANDX_URL } from '@hailandx/kit';
import type { MyShop } from '@/lib/useMyShop';
import { ShareSheet } from './ShareSheet';

/** Partager ma boutique (lien suivi par réseau) ; chaque produit se partage aussi depuis la liste Produits. */
export function ShareRow({ shop }: { shop: MyShop }) {
  const [open, setOpen] = useState(false);
  const url = `${HAILANDX_URL}/b/${shop.slug}`;
  return (
    <section aria-label="Partager" className="flex flex-col gap-3 rounded-[22px] border border-line-soft bg-card px-4 py-3.5">
      <div className="flex items-center justify-between gap-2.5">
        <span className="flex min-w-0 flex-col"><span className="text-[14.5px] font-extrabold">Partager ma boutique</span><span className="truncate text-[12px] font-semibold text-muted">{url.replace(/^https?:\/\//, '')}</span></span>
        <Link href="/statistiques#liens" className="shrink-0 text-[12.5px] font-extrabold text-blue">Liens suivis</Link>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setOpen(true)} className="h-11 rounded-[14px] bg-ink text-[13px] font-extrabold text-white">Partager la boutique</button>
        <Link href="/produits" className="flex h-11 items-center justify-center rounded-[14px] border border-line text-[13px] font-extrabold">Partager un produit</Link>
      </div>
      {open && <ShareSheet target={{ shopId: shop.id, shopSlug: shop.slug, shopName: shop.name }} onClose={() => setOpen(false)} />}
    </section>
  );
}
