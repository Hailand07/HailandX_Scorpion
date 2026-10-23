'use client';
import { useEffect, useState } from 'react';
import { formatGnf, priceHint, PRICE_WARN_PCT } from '@hailandx/commerce';
import { browserClient } from '@hailandx/kit';

/**
 * Repère de prix (HAILANDX.md §39) : quand d'autres boutiques vendent le même produit (même fiche), le vendeur voit le
 * meilleur prix et le prix habituel du marché, et où se situe le sien. Sur HailandX, le client voit d'abord le moins cher.
 */
export function PriceCompare({ productId, shopId, price }: { productId: string | null | undefined; shopId: string; price: number }) {
  const sb = browserClient();
  const [others, setOthers] = useState<number[] | null>(null);
  useEffect(() => {
    if (!sb || !productId) { setOthers(null); return; }
    sb.from('offers').select('price_gnf,shops!inner(status)').eq('product_id', productId).eq('active', true).neq('shop_id', shopId).eq('shops.status', 'ouverte')
      .then(({ data }) => setOthers(((data as { price_gnf: number }[] | null) ?? []).map((x) => x.price_gnf)));
  }, [sb, productId, shopId]);
  if (!others || others.length === 0) return null;
  const h = priceHint(price, others);
  const n = `${h.others} autre${h.others > 1 ? 's' : ''} vendeur${h.others > 1 ? 's' : ''}`;
  const tone = h.level === 'tres-cher' ? 'bg-[#fde8e4] text-[#9a2b16]' : h.level === 'cher' ? 'bg-sand text-ink' : 'bg-ok-soft text-ok';
  const text =
    h.level === 'seul' ? `Indiquez votre prix pour le comparer aux ${n}.`
    : h.level === 'meilleur' ? 'Vous avez le meilleur prix : votre offre s’affiche en premier sur HailandX.'
    : h.level === 'proche' ? `Prix dans le marché. Le meilleur prix est ${formatGnf(h.minGnf!)} : en dessous, votre offre passe en premier.`
    : h.level === 'cher' ? `Plus cher que le marché (+${h.vsMedianPct} %). Les clients voient d’abord l’offre à ${formatGnf(h.minGnf!)}.`
    : `Bien trop cher (+${h.vsMedianPct} % au-dessus du marché). Votre offre passe en dernier et se vendra difficilement.`;
  return (
    <div role="status" className={`flex flex-col gap-1 rounded-[14px] px-3 py-2.5 text-[12.5px] font-bold leading-snug ${tone}`}>
      <span className="font-extrabold">Ce produit est vendu par {n} sur HailandX</span>
      <span>Meilleur prix {formatGnf(h.minGnf!)} · prix habituel {formatGnf(h.medianGnf!)}</span>
      <span>{text}</span>
      {(h.level === 'cher' || h.level === 'tres-cher') && <span className="text-[11.5px] font-semibold opacity-80">Au-delà de {PRICE_WARN_PCT} % au-dessus du prix habituel, l’écart est signalé ici. Sur HailandX, vos clients voient l’écart avec le meilleur prix et le lien vers la boutique moins chère.</span>}
    </div>
  );
}
