'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { addToCart, cartCount, cartShop, useCart, type CartLine } from '@/lib/cart';

type Line = Omit<CartLine, 'qty'>;

/**
 * Barre d'achat de la fiche produit : ajouter au panier, ou commander tout de suite. Inactive sur les produits d'exemple.
 * Un panier = une boutique (§49) : un produit d'une autre boutique demande de vider le panier, après confirmation.
 */
export function BuyBar({ line, available, variants = [], closedLabel }: { line: Line | null; available: boolean; variants?: { id: string; label: string; stock: number }[]; closedLabel?: string }) {
  const router = useRouter();
  const cart = useCart();
  const count = cartCount(cart);
  const [added, setAdded] = useState(false);
  // Article en attente quand le panier vient d'une autre boutique : « vider et ajouter » ou garder le panier.
  const [conflict, setConflict] = useState<{ go: boolean } | null>(null);
  const other = cartShop(cart);
  const choosable = variants.length > 1 || (variants.length === 1 && variants[0]!.label.toLowerCase() !== 'standard');
  const [picked, setPicked] = useState<string | null>(null);
  const current = variants.find((v) => v.id === picked) ?? variants.find((v) => v.stock > 0) ?? variants[0];
  const chosen: Line | null = line ? { ...line, variantId: current?.id ?? line.variantId, variantLabel: choosable ? current?.label ?? null : null } : null;
  const can = Boolean(chosen) && available && (!current || current.stock > 0);

  return (
    <div className="fixed inset-x-0 bottom-0 mx-auto flex max-w-md flex-wrap gap-2.5 border-t border-line-soft bg-card px-[18px] pb-[max(26px,env(safe-area-inset-bottom))] pt-3">
      {conflict && other && chosen && (
        <div role="alertdialog" aria-label="Panier d’une autre boutique" className="flex w-full flex-col gap-2.5 rounded-2xl bg-bg p-3.5">
          <p className="text-[13.5px] font-bold leading-snug">Votre panier contient des produits de <b>{other.name}</b>. Une commande = une seule boutique.</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setConflict(null)} className="h-11 flex-1 rounded-xl border border-line bg-card text-[13.5px] font-extrabold">Garder mon panier</button>
            <button type="button" onClick={() => { addToCart(chosen, 1, true); const go = conflict.go; setConflict(null); if (go) router.push('/panier'); else { setAdded(true); setTimeout(() => setAdded(false), 2000); } }} className="h-11 flex-[1.3] rounded-xl bg-ink text-[13.5px] font-extrabold text-white">Vider et commander ici</button>
          </div>
        </div>
      )}
      {choosable && (
        <div role="radiogroup" aria-label="Variante" className="flex w-full gap-2 overflow-x-auto pb-0.5">
          {variants.map((v) => (
            <button key={v.id} type="button" role="radio" aria-checked={current?.id === v.id} disabled={v.stock <= 0} onClick={() => setPicked(v.id)}
              className={`flex h-10 shrink-0 items-center rounded-full px-4 text-[13.5px] font-bold ${current?.id === v.id ? 'bg-ink text-white' : 'border border-line'} ${v.stock <= 0 ? 'text-muted line-through opacity-50' : ''}`}>{v.label}</button>
          ))}
        </div>
      )}
      <Link href="/panier" aria-label={`Panier, ${count} article${count > 1 ? 's' : ''}`} className="relative flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-2xl border border-line">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#12141c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
        {count > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue px-1 text-[11px] font-extrabold text-white">{count}</span>}
      </Link>
      {!can ? (
        <span className="flex h-[54px] flex-1 items-center justify-center rounded-2xl bg-sand text-[14px] font-extrabold text-muted">{closedLabel ?? (chosen ? 'Rupture de stock' : 'Produit d’exemple')}</span>
      ) : (
        <>
          <button type="button" onClick={() => { if (!addToCart(chosen!)) return setConflict({ go: false }); setAdded(true); setTimeout(() => setAdded(false), 2000); }} className="flex h-[54px] flex-1 items-center justify-center rounded-2xl border border-line text-[14.5px] font-extrabold">{added ? 'Ajouté ✓' : 'Ajouter'}</button>
          <button type="button" onClick={() => { if (!addToCart(chosen!)) return setConflict({ go: true }); router.push('/panier'); }} className="flex h-[54px] flex-[1.4] items-center justify-center rounded-2xl bg-ink text-[15px] font-extrabold text-white">Commander</button>
        </>
      )}
    </div>
  );
}
