'use client';
import Link from 'next/link';
import { cartCount, useCart } from '@/lib/cart';

/** Panier en haut de l'accueil, avec le nombre d'articles. */
export function CartButton() {
  const n = cartCount(useCart());
  return (
    <Link href="/panier" aria-label={n ? `Panier, ${n} article${n > 1 ? 's' : ''}` : 'Panier'} className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-ink">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
      {n > 0 && <span aria-hidden="true" className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-bg bg-lime px-1 text-[11px] font-extrabold text-ink">{n > 9 ? '9+' : n}</span>}
    </Link>
  );
}
