'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { addToCart, cartCount, useCart, type CartLine } from '@/lib/cart';

type Line = Omit<CartLine, 'qty'>;

/** Barre d'achat de la fiche produit : ajouter au panier, ou acheter tout de suite. Inactive sur les produits d'exemple. */
export function BuyBar({ line, available }: { line: Line | null; available: boolean }) {
  const router = useRouter();
  const count = cartCount(useCart());
  const [added, setAdded] = useState(false);
  const can = Boolean(line) && available;

  return (
    <div className="fixed inset-x-0 bottom-0 mx-auto flex max-w-md gap-2.5 border-t border-line-soft bg-card px-[18px] pb-[max(26px,env(safe-area-inset-bottom))] pt-3">
      <Link href="/panier" aria-label={`Panier, ${count} article${count > 1 ? 's' : ''}`} className="relative flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-2xl border border-line">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#12141c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
        {count > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue px-1 text-[11px] font-extrabold text-white">{count}</span>}
      </Link>
      {!can ? (
        <span className="flex h-[54px] flex-1 items-center justify-center rounded-2xl bg-sand text-[14px] font-extrabold text-muted">{line ? 'Rupture de stock' : 'Produit d’exemple'}</span>
      ) : (
        <>
          <button type="button" onClick={() => { addToCart(line!); setAdded(true); setTimeout(() => setAdded(false), 2000); }} className="flex h-[54px] flex-1 items-center justify-center rounded-2xl border border-line text-[14.5px] font-extrabold">{added ? 'Ajouté ✓' : 'Ajouter'}</button>
          <button type="button" onClick={() => { addToCart(line!); router.push('/commande'); }} className="flex h-[54px] flex-[1.4] items-center justify-center rounded-2xl bg-ink text-[15px] font-extrabold text-white">Acheter</button>
        </>
      )}
    </div>
  );
}
