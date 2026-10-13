'use client';
import Link from 'next/link';
import { Button, PhotoSlot, Wordmark } from '@hailandx/ui';
import { formatGnf } from '@hailandx/commerce';
import { cartSubtotal, removeLine, setQty, useCart } from '@/lib/cart';

/** Panier multi-vendeurs : un colis par boutique ; les frais de livraison se calculent avec l'adresse, à la commande. */
export default function CartPage() {
  const lines = useCart();
  const shops = [...new Set(lines.map((l) => l.shopSlug))];

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-5 pb-36 pt-6">
      <div className="flex items-center justify-between"><Link href="/" aria-label="Accueil"><Wordmark /></Link><h1 className="font-display text-[20px] font-semibold">Panier</h1></div>

      {lines.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[22px] border border-line-soft bg-card px-6 py-10 text-center">
          <p className="font-display text-lg font-semibold">Votre panier est vide</p>
          <p className="text-[13.5px] font-medium text-muted">Parcourez la rue et ajoutez ce qui vous plaît.</p>
          <Link href="/" className="inline-flex h-[54px] items-center justify-center rounded-2xl bg-ink px-7 text-[15px] font-extrabold text-white">Voir les boutiques</Link>
        </div>
      ) : (
        <>
          {shops.map((s) => {
            const mine = lines.filter((l) => l.shopSlug === s);
            return (
              <section key={s} className="flex flex-col gap-2.5 rounded-[22px] border border-line-soft bg-card p-4">
                <h2 className="text-[13px] font-extrabold text-muted">Colis de <Link href={`/b/${s}`} className="text-ink">{mine[0]!.shopName}</Link></h2>
                {mine.map((l) => (
                  <div key={`${l.offerId}-${l.variantId}`} className="flex gap-3">
                    <PhotoSlot src={l.photoUrl} color="#f2f0ea" className="h-[68px] w-[68px] shrink-0 rounded-2xl" label={l.name} />
                    <div className="flex min-w-0 flex-1 flex-col justify-between">
                      <span className="truncate text-[14px] font-bold">{l.name}</span>
                      <div className="flex items-center justify-between">
                        <span className="font-display text-[14.5px] font-semibold">{formatGnf(l.priceGnf * l.qty)}</span>
                        <span className="flex items-center gap-1">
                          <button type="button" aria-label="Retirer un" onClick={() => (l.qty > 1 ? setQty(l.offerId, l.variantId, l.qty - 1) : removeLine(l.offerId, l.variantId))} className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-lg font-bold">−</button>
                          <span className="w-6 text-center text-[14px] font-extrabold" aria-live="polite">{l.qty}</span>
                          <button type="button" aria-label="Ajouter un" onClick={() => setQty(l.offerId, l.variantId, l.qty + 1)} className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-lg font-bold">+</button>
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </section>
            );
          })}
          <p className="text-[12.5px] font-semibold text-muted">{shops.length > 1 ? `${shops.length} boutiques = ${shops.length} colis, livrés chacun à votre porte. ` : ''}Les frais de livraison sont calculés selon la distance, à l’étape suivante.</p>
          <div className="fixed inset-x-0 bottom-0 mx-auto flex max-w-md items-center gap-3 border-t border-line-soft bg-card px-5 pb-[max(22px,env(safe-area-inset-bottom))] pt-3">
            <div className="flex flex-col"><span className="text-[11.5px] font-bold text-muted">Sous-total</span><span className="font-display text-[18px] font-semibold">{formatGnf(cartSubtotal(lines))}</span></div>
            <Link href="/commande" className="flex-1"><Button className="w-full">Commander</Button></Link>
          </div>
        </>
      )}
    </main>
  );
}
