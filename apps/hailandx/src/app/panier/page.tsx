'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { PhotoSlot } from '@hailandx/ui';
import { formatGnf } from '@hailandx/commerce';
import { aUnNom, browserClient, Icon, PhoneLoginInline, useSession } from '@hailandx/kit';
import { cartCount, cartSubtotal, keepShop, removeLine, setQty, syncPrices, useCart, type CartLine } from '@/lib/cart';
import { OrderSteps } from '@/components/OrderSteps';

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

/**
 * Étape 1 de la commande (maquette v9 « Panier », HAILANDX.md §49) : les articles d'UNE boutique (un colis), état en direct,
 * puis le numéro du client vérifié par SMS sans quitter la page. Déjà connecté : cette partie est sautée.
 */
export default function CartPage() {
  const lines = useCart();
  const session = useSession();
  const live = useLive(lines);
  // Prix vus avant la mise à jour, pour signaler un changement au client.
  const [before, setBefore] = useState<Map<string, number>>(new Map());
  useEffect(() => {
    if (!live) return;
    const changed = new Map<string, number>();
    for (const l of lines) { const o = live.get(l.offerId); if (o && o.price !== l.priceGnf) changed.set(l.offerId, l.priceGnf); }
    if (changed.size) { setBefore((b) => new Map([...b, ...changed])); syncPrices(new Map([...live].map(([k, v]) => [k, v.price]))); }
  }, [live, lines]);

  const shops = [...new Map(lines.map((l) => [l.shopSlug, l.shopName])).entries()];
  const shop = shops[0];
  const count = cartCount(lines);
  const blocked = lines.some((l) => issueOf(l, live, before.get(l.offerId))?.tone === 'block');
  const ready = aUnNom(session);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-3.5 bg-bg pb-40">
      <header className="sticky top-0 z-20 flex flex-col gap-2.5 border-b border-line-soft bg-bg/95 px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur">
        <div className="flex items-center gap-2">
          <Link href={shop ? `/b/${shop[0]}` : '/'} aria-label="Retour à la boutique" className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full"><Icon name="back" size={22} stroke={2.2} /></Link>
          <h1 className="flex-1 font-display text-[19px] font-semibold">Votre commande</h1>
        </div>
        <OrderSteps current={1} />
      </header>

      {lines.length === 0 || !shop ? (
        <section className="mx-4 flex flex-col items-center gap-3 rounded-[24px] border border-line-soft bg-card px-6 py-10 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-sand"><Icon name="box" size={30} /></span>
          <p className="font-display text-[19px] font-semibold">Votre panier est vide</p>
          <p className="max-w-[260px] text-[13.5px] font-medium leading-relaxed text-muted">Ouvrez le lien du produit que le vendeur vous a envoyé, puis touchez « Commander ».</p>
          <Link href="/commandes" className="mt-1 flex h-12 items-center justify-center rounded-2xl bg-ink px-7 text-[15px] font-extrabold text-white">Mes commandes</Link>
        </section>
      ) : (
        <>
          {shops.length > 1 && (
            <section role="alert" className="mx-4 flex flex-col gap-2 rounded-2xl bg-amber-soft px-4 py-3 text-[13px] font-bold text-[#6b5317]">
              <p>Une commande = une seule boutique. Choisissez celle que vous gardez :</p>
              <div className="flex flex-wrap gap-2">{shops.map(([slug, name]) => <button key={slug} type="button" onClick={() => keepShop(slug)} className="h-10 rounded-xl bg-card px-3.5 text-[13px] font-extrabold text-ink">Garder {name}</button>)}</div>
            </section>
          )}
          {blocked && <p role="alert" className="mx-4 rounded-2xl bg-[#fde8e4] px-4 py-3 text-[13px] font-bold text-[#8a2a1c]">Certains articles ne sont plus disponibles en cette quantité. Corrigez-les pour commander.</p>}
          {shops.map(([slug, name]) => (
            <section key={slug} aria-label={`Colis de ${name}`} className="mx-4 flex flex-col overflow-hidden rounded-[22px] border border-line-soft bg-card">
              <div className="flex items-center gap-2 border-b border-line-soft px-4 py-3">
                <Icon name="shop" size={17} className="shrink-0 text-muted" />
                <span className="truncate text-[13.5px] font-extrabold">Chez <Link href={`/b/${slug}`} className="underline-offset-2 hover:underline">{name}</Link> · un seul colis</span>
              </div>
              <ul className="flex flex-col divide-y divide-line-soft">
                {lines.filter((l) => l.shopSlug === slug).map((l) => <Line key={`${l.offerId}-${l.variantId}`} l={l} issue={issueOf(l, live, before.get(l.offerId))} />)}
              </ul>
              <Link href={`/b/${slug}`} className="border-t border-line-soft px-4 py-3 text-[13px] font-extrabold text-blue-ink">+ Ajouter un autre produit de {name}</Link>
            </section>
          ))}

          {session !== undefined && !ready && <div className="mx-4"><PhoneLoginInline /></div>}
          {ready && session && <p className="mx-4 rounded-2xl bg-card px-4 py-3 text-[12.5px] font-semibold text-muted">Commande au nom de <b className="text-ink">{(session.user.user_metadata as { full_name?: string }).full_name}</b> · suivi et code de remise par SMS.</p>}
        </>
      )}

      {lines.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-md flex-col gap-2 border-t border-line-soft bg-card px-4 pb-[max(18px,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(18,20,28,0.06)]">
          <span className="flex justify-between text-[13.5px] font-bold"><span className="text-muted">Articles ({count})</span><span className="font-display text-[16px] font-semibold">{formatGnf(cartSubtotal(lines))}</span></span>
          {blocked || shops.length > 1
            ? <span className="flex h-[54px] items-center justify-center rounded-2xl bg-sand text-center text-[13.5px] font-extrabold text-muted">Corrigez le panier</span>
            : !ready
              ? <span className="flex h-[54px] items-center justify-center rounded-2xl bg-sand text-center text-[13.5px] font-extrabold text-muted">Vérifiez d’abord votre numéro</span>
              : <Link href="/commande" className="flex h-[54px] items-center justify-center rounded-2xl bg-blue text-[15.5px] font-extrabold text-white">Continuer : où livrer ?</Link>}
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
          <button type="button" onClick={() => removeLine(l.offerId, l.variantId)} className="text-[12.5px] font-extrabold text-muted">Supprimer</button>
        </div>
      </div>
    </li>
  );
}
