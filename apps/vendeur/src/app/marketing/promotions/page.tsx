'use client';
import { useCallback, useEffect, useState } from 'react';
import { discountPercent, formatGnf } from '@hailandx/commerce';
import { BackHeader, browserClient, errText, Icon, mediaUrl, Notice, Screen } from '@hailandx/kit';
import { SellerGate } from '@/components/SellerGate';
import { Chargement } from '@hailandx/ui';

interface Offer { id: string; price_gnf: number; compare_at_gnf: number | null; photo_paths: string[] | null; catalog_products: { name: string; photo_paths: string[] | null } | null }
const PCTS = [5, 10, 15, 20, 30];
/** Prix promo arrondi à 500 GNF, comme les prix affichés en boutique. */
const promoPrice = (base: number, pct: number) => Math.max(500, Math.round((base * (1 - pct / 100)) / 500) * 500);

/** Promotions (prix barrés) : le client voit l'ancien prix barré et le pourcentage ; « Arrêter » remet l'ancien prix. */
export default function PromotionsPage() {
  return <SellerGate title="Promotions">{({ shop }) => <Promotions shopId={shop.id} />}</SellerGate>;
}

function Promotions({ shopId }: { shopId: string }) {
  const sb = browserClient();
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  const load = useCallback(async () => {
    if (!sb) return;
    const { data } = await sb.from('offers').select('id,price_gnf,compare_at_gnf,photo_paths,catalog_products(name,photo_paths)').eq('shop_id', shopId).eq('active', true).order('updated_at', { ascending: false });
    setOffers((data as unknown as Offer[]) ?? []);
  }, [sb, shopId]);
  useEffect(() => { void load(); }, [load]);

  async function apply(o: Offer, patch: { price_gnf: number; compare_at_gnf: number | null }, ok: string) {
    setMsg(null);
    const { error } = await sb!.from('offers').update(patch).eq('id', o.id);
    setMsg(error ? { tone: 'err', text: errText(error) } : { tone: 'ok', text: ok });
    setOpen(null);
    await load();
  }

  const list = [...(offers ?? [])].sort((a, b) => Number(!!b.compare_at_gnf) - Number(!!a.compare_at_gnf));
  return (
    <Screen>
      <BackHeader href="/marketing" title="Promotions" />
      <p className="text-[13px] font-semibold leading-relaxed text-muted">Baissez un prix : l’ancien reste affiché barré sur HailandX avec le pourcentage. Sur l’honneur : l’ancien prix doit être celui que vous pratiquiez vraiment.</p>
      <Notice msg={msg} />
      {offers === null && <Chargement />}
      {offers?.length === 0 && <p className="rounded-[20px] border border-dashed border-line px-4 py-6 text-center text-[13.5px] font-bold text-muted">Aucun produit en vente.</p>}
      {list.map((o) => {
        const base = o.compare_at_gnf ?? o.price_gnf;
        const pct = discountPercent(o.price_gnf, o.compare_at_gnf);
        const photo = mediaUrl(o.photo_paths?.[0] ?? o.catalog_products?.photo_paths?.[0]);
        return (
          <article key={o.id} className={`flex flex-col gap-3 rounded-[20px] border bg-card p-3 ${pct ? 'border-[#f3c7a6]' : 'border-line-soft'}`}>
            <div className="flex items-center gap-3">
              {photo
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={photo} alt="" className="h-14 w-14 shrink-0 rounded-[14px] bg-sand object-cover" />
                : <span aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[14px] bg-sand text-muted"><Icon name="image" /></span>}
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[14px] font-extrabold">{o.catalog_products?.name}</span>
                <span className="text-[13px] font-bold"><span className="font-display font-semibold">{formatGnf(o.price_gnf)}</span>{pct && <> <span className="font-semibold text-muted line-through">{formatGnf(o.compare_at_gnf!)}</span> <span className="rounded-full bg-[#fff1e6] px-1.5 py-0.5 text-[11px] font-extrabold text-[#c2410c]">−{pct} %</span></>}</span>
              </span>
              {pct
                ? <button type="button" onClick={() => apply(o, { price_gnf: o.compare_at_gnf!, compare_at_gnf: null }, 'Promotion arrêtée : l’ancien prix est rétabli.')} className="h-10 shrink-0 rounded-full border border-line px-3 text-[12.5px] font-extrabold">Arrêter</button>
                : <button type="button" aria-expanded={open === o.id} onClick={() => setOpen(open === o.id ? null : o.id)} className="h-10 shrink-0 rounded-full bg-ink px-3 text-[12.5px] font-extrabold text-white">Promo −%</button>}
            </div>
            {open === o.id && (
              <div className="flex flex-wrap gap-1.5">
                {PCTS.map((p) => {
                  const np = promoPrice(base, p);
                  return <button key={p} type="button" disabled={np >= base} onClick={() => apply(o, { price_gnf: np, compare_at_gnf: base }, `Promotion −${p} % : ${formatGnf(np)} au lieu de ${formatGnf(base)}.`)} className="flex h-12 flex-col items-center justify-center rounded-xl border border-line px-3 disabled:opacity-40"><span className="text-[13px] font-extrabold">−{p} %</span><span className="text-[11px] font-bold text-muted">{formatGnf(np)}</span></button>;
                })}
              </div>
            )}
          </article>
        );
      })}
    </Screen>
  );
}
