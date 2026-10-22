'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { PhotoSlot } from '@hailandx/ui';
import { formatGnf } from '@hailandx/commerce';
import { browserClient, Icon } from '@hailandx/kit';
import { cartCount, cartSubtotal, moveToCart, removeLater, removeLine, saveForLater, setQty, syncPrices, useCart, useLater, type CartLine } from '@/lib/cart';
import { RecentlyViewed } from '@/components/RecentlyViewed';

/** État en direct d'une offre du panier : prix du moment, offre active, stock de chaque variante, boutique ouverte. */
interface Live { price: number; active: boolean; open: boolean; stock: Map<string, number> }
type Issue = { tone: 'info' | 'warn' | 'block'; text: string } | null;

/** Relit les offres du panier dans la base (prix, stock, retrait) : le panier ne promet jamais ce qui n'est plus vrai. */
function useLive(lines: CartLine[]) {
  const ids = useMemo(() => [...new Set(lines.map((l) => l.offerId))].sort().join(','), [lines]);
  const [live, setLive] = useState<Map<string, Live> | null>(null);
  useEffect(() => {
    const sb = browserClient();
    if (!sb || !ids) { setLive(new Map()); return; }
    void sb.from('offers').select('id,price_gnf,active,offer_variants(id,stock),shops(status)').in('id', ids.split(',')).then(({ data, error }) => {
      if (error) return; // hors ligne : on garde l'affichage tel quel
      const m = new Map<string, Live>();
      for (const o of (data as unknown as { id: string; price_gnf: number; active: boolean; offer_variants: { id: string; stock: number }[] | null; shops: { status: string } | null }[]) ?? []) {
        m.set(o.id, { price: o.price_gnf, active: o.active, open: o.shops?.status === 'ouverte', stock: new Map((o.offer_variants ?? []).map((v) => [v.id, v.stock])) });
      }
      setLive(m);
    });
  }, [ids]);
  return live;
}

function issueOf(l: CartLine, live: Map<string, Live> | null, before?: number): Issue {
  if (!live) return null;
  const o = live.get(l.offerId);
  if (!o || !o.active || !o.open) return { tone: 'block', text: 'N’est plus en vente' };
  const stock = l.variantId ? o.stock.get(l.variantId) : [...o.stock.values()].reduce((n, s) => n + s, 0);
  if (stock !== undefined && stock <= 0) return { tone: 'block', text: 'Épuisé' };
  if (stock !== undefined && stock < l.qty) return { tone: 'block', text: `Plus que ${stock} en stock : réduisez la quantité` };
  if (before !== undefined && before !== o.price) return { tone: 'info', text: `Prix mis à jour (était ${formatGnf(before)})` };
  if (stock !== undefined && stock <= 3) return { tone: 'warn', text: `Plus que ${stock} en stock` };
  return null;
}

/** Panier (v2, inspiré des grandes applications de vente) : un colis par boutique, état en direct, « mis de côté », récapitulatif clair. */
export default function CartPage() {
  const lines = useCart();
  const later = useLater();
  const live = useLive(lines);
  // Prix vus avant la mise à jour, pour signaler un changement au client.
  const [before, setBefore] = useState<Map<string, number>>(new Map());
  useEffect(() => {
    if (!live) return;
    const changed = new Map<string, number>();
    for (const l of lines) { const o = live.get(l.offerId); if (o && o.price !== l.priceGnf) changed.set(l.offerId, l.priceGnf); }
    if (changed.size) { setBefore((b) => new Map([...b, ...changed])); syncPrices(new Map([...live].map(([k, v]) => [k, v.price]))); }
  }, [live, lines]);

  const shops = [...new Set(lines.map((l) => l.shopSlug))];
  const count = cartCount(lines);
  const blocked = lines.some((l) => issueOf(l, live, before.get(l.offerId))?.tone === 'block');

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-3.5 bg-bg pb-40">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-line-soft bg-bg/95 px-3 pb-2.5 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur">
        <Link href="/" aria-label="Continuer mes achats" className="flex h-11 w-11 items-center justify-center rounded-full"><Icon name="back" size={22} stroke={2.2} /></Link>
        <h1 className="flex-1 font-display text-[19px] font-semibold">Panier{count ? <span className="font-sans text-[14px] font-bold text-muted"> · {count} article{count > 1 ? 's' : ''}</span> : null}</h1>
      </header>

      {lines.length === 0 ? (
        <section className="mx-4 flex flex-col items-center gap-3 rounded-[24px] border border-line-soft bg-card px-6 py-10 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-sand"><Icon name="box" size={30} /></span>
          <p className="font-display text-[19px] font-semibold">Votre panier est vide</p>
          <p className="max-w-[260px] text-[13.5px] font-medium leading-relaxed text-muted">Ajoutez des produits depuis la rue : ils vous attendront ici, même si vous fermez l’application.</p>
          <Link href="/" className="mt-1 flex h-12 items-center justify-center rounded-2xl bg-ink px-7 text-[15px] font-extrabold text-white">Découvrir les produits</Link>
        </section>
      ) : (
        <>
          {blocked && <p role="alert" className="mx-4 rounded-2xl bg-[#fde8e4] px-4 py-3 text-[13px] font-bold text-[#8a2a1c]">Certains articles ne sont plus disponibles en cette quantité. Corrigez-les pour commander.</p>}
          {shops.map((s, i) => {
            const mine = lines.filter((l) => l.shopSlug === s);
            const sub = cartSubtotal(mine);
            return (
              <section key={s} aria-label={`Colis de ${mine[0]!.shopName}`} className="mx-4 flex flex-col overflow-hidden rounded-[22px] border border-line-soft bg-card">
                <div className="flex items-center justify-between gap-2 border-b border-line-soft px-4 py-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <Icon name="shop" size={17} className="shrink-0 text-muted" />
                    <span className="truncate text-[13.5px] font-extrabold">{shops.length > 1 ? `Colis ${i + 1} · ` : ''}<Link href={`/b/${s}`} className="underline-offset-2 hover:underline">{mine[0]!.shopName}</Link></span>
                  </span>
                  <span className="shrink-0 text-[11.5px] font-bold text-ok">Vendeur certifié</span>
                </div>
                <ul className="flex flex-col divide-y divide-line-soft">
                  {mine.map((l) => <Line key={`${l.offerId}-${l.variantId}`} l={l} issue={issueOf(l, live, before.get(l.offerId))} />)}
                </ul>
                <div className="flex items-center justify-between bg-[#faf9f5] px-4 py-2.5 text-[12.5px] font-bold text-muted">
                  <span>Sous-total du colis</span><span className="font-display text-[14px] font-semibold text-ink">{formatGnf(sub)}</span>
                </div>
              </section>
            );
          })}

          <section aria-label="Récapitulatif" className="mx-4 flex flex-col gap-2 rounded-[22px] border border-line-soft bg-card px-4 py-3.5">
            <h2 className="text-[14px] font-extrabold">Récapitulatif</h2>
            <p className="flex justify-between text-[13.5px] font-semibold"><span>Articles ({count})</span><span>{formatGnf(cartSubtotal(lines))}</span></p>
            <p className="flex justify-between gap-3 text-[13.5px] font-semibold"><span>Livraison{shops.length > 1 ? ` (${shops.length} colis)` : ''}</span><span className="text-right text-muted">calculée selon votre adresse</span></p>
            <p className="flex justify-between border-t border-line-soft pt-2 font-display text-[16px] font-semibold"><span>Total des articles</span><span>{formatGnf(cartSubtotal(lines))}</span></p>
            <p className="text-[11.5px] font-semibold leading-snug text-muted">{shops.length > 1 ? 'Une boutique = un colis, livré séparément au bâtiment de votre adresse Hailand. ' : ''}Les frais de livraison s’affichent à l’étape suivante, avant de confirmer.</p>
          </section>

          <ul aria-label="Garanties" className="mx-4 grid grid-cols-3 gap-2 text-center">
            {([['shield', 'Payé à la remise ou Orange Money'], ['check', 'Remis contre votre code'], ['alert', '72 h pour signaler un problème']] as const).map(([icon, t]) => (
              <li key={t} className="flex flex-col items-center gap-1.5 rounded-2xl bg-card px-2 py-3 text-[11px] font-bold leading-tight text-muted"><Icon name={icon} size={18} className="text-ink" />{t}</li>
            ))}
          </ul>
        </>
      )}

      {later.length > 0 && (
        <section aria-label="Mis de côté" className="mx-4 flex flex-col overflow-hidden rounded-[22px] border border-line-soft bg-card">
          <h2 className="border-b border-line-soft px-4 py-3 text-[13.5px] font-extrabold">Mis de côté ({later.length})</h2>
          <ul className="flex flex-col divide-y divide-line-soft">
            {later.map((l) => (
              <li key={`${l.offerId}-${l.variantId}`} className="flex gap-3 px-4 py-3">
                <Link href={`/p/${l.slug}?b=${l.shopSlug}`} className="block h-[64px] w-[64px] shrink-0 overflow-hidden rounded-2xl"><PhotoSlot src={l.photoUrl} color="#f2f0ea" className="h-full" label={l.name} /></Link>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <Link href={`/p/${l.slug}?b=${l.shopSlug}`} className="line-clamp-2 text-[13.5px] font-bold leading-snug">{l.name}</Link>
                  <span className="font-display text-[14px] font-semibold">{formatGnf(l.priceGnf)}</span>
                  <span className="flex gap-4 text-[12.5px] font-extrabold">
                    <button type="button" onClick={() => moveToCart(l.offerId, l.variantId)} className="text-blue-ink">Remettre au panier</button>
                    <button type="button" onClick={() => removeLater(l.offerId, l.variantId)} className="text-muted">Supprimer</button>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <RecentlyViewed title={lines.length ? 'Vous avez aussi regardé' : 'Vus récemment'} />

      {lines.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-md items-center gap-3 border-t border-line-soft bg-card px-4 pb-[max(18px,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(18,20,28,0.06)]">
          <span className="flex min-w-0 flex-col"><span className="text-[11.5px] font-bold text-muted">Total ({count} article{count > 1 ? 's' : ''})</span><span className="font-display text-[19px] font-semibold">{formatGnf(cartSubtotal(lines))}</span><span className="text-[10.5px] font-semibold text-muted">+ livraison</span></span>
          {blocked
            ? <span className="flex h-[54px] flex-1 items-center justify-center rounded-2xl bg-sand text-center text-[13.5px] font-extrabold text-muted">Corrigez le panier</span>
            : <Link href="/commande" className="flex h-[54px] flex-1 items-center justify-center rounded-2xl bg-ink text-[15.5px] font-extrabold text-white">Commander</Link>}
        </div>
      )}
    </main>
  );
}

/** Un article : photo, nom (lien vers le produit), variante, prix, état, quantité, mettre de côté, supprimer. */
function Line({ l, issue }: { l: CartLine; issue: Issue }) {
  const href = `/p/${l.slug}?b=${l.shopSlug}`;
  const tone = issue?.tone === 'block' ? 'bg-[#fde8e4] text-[#8a2a1c]' : issue?.tone === 'warn' ? 'bg-amber-soft text-[#6b5317]' : 'bg-blue-soft text-blue-ink';
  return (
    <li className="flex gap-3 px-4 py-3.5">
      <Link href={href} className="block h-[88px] w-[88px] shrink-0 overflow-hidden rounded-2xl bg-[#f2f0ea]"><PhotoSlot src={l.photoUrl} color="#f2f0ea" className="h-full" label={l.name} /></Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Link href={href} className="line-clamp-2 text-[14px] font-bold leading-snug">{l.name}</Link>
        {l.variantLabel && <span className="text-[12px] font-semibold text-muted">{l.variantLabel}</span>}
        <span className="font-display text-[15.5px] font-semibold">{formatGnf(l.priceGnf)}{l.qty > 1 && <span className="font-sans text-[11.5px] font-bold text-muted"> · {formatGnf(l.priceGnf * l.qty)} pour {l.qty}</span>}</span>
        {issue && <span className={`self-start rounded-full px-2.5 py-0.5 text-[11.5px] font-extrabold ${tone}`}>{issue.text}</span>}
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="flex items-center rounded-full border border-line">
            <button type="button" aria-label={l.qty > 1 ? 'Retirer un' : 'Supprimer l’article'} onClick={() => (l.qty > 1 ? setQty(l.offerId, l.variantId, l.qty - 1) : removeLine(l.offerId, l.variantId))} className="flex h-9 w-10 items-center justify-center text-[18px] font-bold">
              {l.qty > 1 ? '−' : <Icon name="close" size={15} stroke={2.2} />}
            </button>
            <span className="w-7 text-center text-[14px] font-extrabold" aria-live="polite" aria-label={`Quantité ${l.qty}`}>{l.qty}</span>
            <button type="button" aria-label="Ajouter un" onClick={() => setQty(l.offerId, l.variantId, l.qty + 1)} className="flex h-9 w-10 items-center justify-center text-[18px] font-bold">+</button>
          </span>
          <button type="button" onClick={() => saveForLater(l.offerId, l.variantId)} className="text-[12.5px] font-extrabold text-blue-ink">Mettre de côté</button>
          <button type="button" onClick={() => removeLine(l.offerId, l.variantId)} className="text-[12.5px] font-extrabold text-muted">Supprimer</button>
        </div>
      </div>
    </li>
  );
}
