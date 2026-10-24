'use client';
import { useCallback, useEffect, useState } from 'react';
import { barHeights, formatGnf, periodStats, type SalesDay } from '@hailandx/commerce';
import { BackHeader, browserClient, Chips, errText, HAILANDX_URL, Notice, Screen, SOURCES } from '@hailandx/kit';
import { SellerGate } from '@/components/SellerGate';

interface Src { source: string; parcels: number; revenue_gnf: number }
interface ShareLink { id: string; code: string; kind: string; source: string | null; clicks: number }
interface Score { trust: number; rating: number; review_count: number; reliability: number; prep_minutes: number | null }
interface Sold { name_snapshot: string; quantity: number; price_gnf_snapshot: number }
interface OfferLite { id: string; photo_paths: string[] | null; catalog_products: { name: string } | null }
const SRC: Record<string, string> = { application: 'HailandX', tiktok: 'TikTok', whatsapp: 'WhatsApp', facebook: 'Facebook', autre: 'Autre' };
type Period = '7' | '30' | '90';

/** Statistiques (v2) : ventes par jour, d'où elles viennent, liens suivis par réseau, indice de confiance et comment le faire monter. */
export default function StatsPage() {
  return <SellerGate title="Statistiques">{({ shop }) => <Stats shopId={shop.id} certified />}</SellerGate>;
}

function Stats({ shopId, certified }: { shopId: string; certified: boolean }) {
  const sb = browserClient();
  const [period, setPeriod] = useState<Period>('7');
  const [series, setSeries] = useState<SalesDay[] | null>(null);
  const [sources, setSources] = useState<Src[]>([]);
  const [sold, setSold] = useState<Sold[]>([]);
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [score, setScore] = useState<Score | null>(null);
  const [offers, setOffers] = useState<OfferLite[]>([]);
  const [net, setNet] = useState<string>('tiktok');
  const [target, setTarget] = useState('');
  const origin = HAILANDX_URL;
  const [copied, setCopied] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  const loadSales = useCallback(async () => {
    if (!sb) return;
    const days = Number(period);
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    const [a, b, c] = await Promise.all([
      sb.rpc('fn_shop_sales', { p_shop: shopId, p_days: days }), sb.rpc('fn_shop_sources', { p_shop: shopId, p_days: days }),
      sb.from('order_items').select('name_snapshot,quantity,price_gnf_snapshot,parcels!inner(shop_id,status,created_at)').eq('parcels.shop_id', shopId).neq('parcels.status', 'annule').gte('parcels.created_at', since).limit(1000),
    ]);
    setSold((c.data as unknown as Sold[]) ?? []);
    setSeries(((a.data as SalesDay[]) ?? []).map((x) => ({ ...x, revenue_gnf: Number(x.revenue_gnf), delivered_gnf: Number(x.delivered_gnf ?? 0) })));
    setSources(((b.data as Src[]) ?? []).map((x) => ({ ...x, revenue_gnf: Number(x.revenue_gnf) })));
  }, [sb, shopId, period]);
  const loadRest = useCallback(async () => {
    if (!sb) return;
    const [l, s, o] = await Promise.all([
      sb.from('share_links').select('id,code,kind,source,clicks').eq('shop_id', shopId).order('created_at', { ascending: false }),
      sb.from('shop_scores').select('trust,rating,review_count,reliability,prep_minutes').eq('shop_id', shopId).maybeSingle(),
      sb.from('offers').select('id,photo_paths,catalog_products(name)').eq('shop_id', shopId).eq('active', true),
    ]);
    setLinks((l.data as ShareLink[]) ?? []);
    setScore((s.data as Score | null) ?? null);
    setOffers((o.data as unknown as OfferLite[]) ?? []);
  }, [sb, shopId]);
  useEffect(() => { void loadSales(); }, [loadSales]);
  useEffect(() => { void loadRest(); }, [loadRest]);

  async function createLink() {
    const code = `${net.slice(0, 2)}${Math.random().toString(36).slice(2, 8)}`;
    const { error } = await sb!.from('share_links').insert({ code, shop_id: shopId, kind: target ? 'produit' : 'boutique', offer_ids: target ? [target] : [], source: net });
    setMsg(error ? { tone: 'err', text: errText(error) } : { tone: 'ok', text: 'Lien créé : copiez-le et collez-le sur votre réseau.' });
    await loadRest();
  }
  async function copy(code: string) {
    try { await navigator.clipboard.writeText(`${origin}/s/${code}`); setCopied(code); setTimeout(() => setCopied(null), 1800); } catch { /* copie refusée */ }
  }

  const stats = series ? periodStats(series, series.length) : null;
  const heights = barHeights(series ?? []);
  const short = period === '7';
  const best = Math.max(1, ...sources.map((s) => s.revenue_gnf));
  const noPhoto = offers.filter((o) => !(o.photo_paths ?? []).length).length;
  const tip = noPhoto ? `Pour monter : ajoutez une photo réelle à ${noPhoto} produit${noPhoto > 1 ? 's' : ''}.` : score && score.review_count < 5 ? 'Pour monter : vos clients notent après la remise ; préparez vite et emballez bien.' : null;
  // Produits les plus vendus sur la période (quantités et chiffre, colis annulés exclus).
  const top = [...sold.reduce((m, i) => { const x = m.get(i.name_snapshot) ?? { qty: 0, gnf: 0 }; m.set(i.name_snapshot, { qty: x.qty + i.quantity, gnf: x.gnf + i.quantity * i.price_gnf_snapshot }); return m; }, new Map<string, { qty: number; gnf: number }>())]
    .sort((x, y) => y[1].gnf - x[1].gnf).slice(0, 5);
  // Du clic à la commande, par réseau : clics des liens suivis (depuis leur création) et commandes de la période.
  const nets = SOURCES.map((n) => ({ n, clicks: links.filter((l) => (l.source ?? 'autre') === n).reduce((t, l) => t + l.clicks, 0), orders: sources.find((x) => x.source === n)?.parcels ?? 0 })).filter((x) => x.clicks || x.orders);
  const rating = score && score.review_count > 0 ? Number(score.rating).toFixed(1).replace('.', ',') : null;

  return (
    <Screen>
      <BackHeader href="/plus" title="Statistiques" label="Retour" />
      <Chips label="Période" value={period} onChange={setPeriod} items={[{ id: '7', label: '7 jours' }, { id: '30', label: '30 jours' }, { id: '90', label: '90 jours' }]} />

      <section aria-label="Ventes par jour" className="flex flex-col gap-3 rounded-[22px] border border-line-soft bg-card p-4">
        <div className="flex items-baseline justify-between gap-3"><h2 className="text-[14.5px] font-extrabold">Ventes par jour</h2><span className="flex flex-col items-end"><span className="font-display text-[15px] font-semibold">{stats ? formatGnf(stats.revenue) : '…'}</span>{stats && <span className="text-[11.5px] font-bold text-muted">commandé · {formatGnf(stats.delivered)} encaissés</span>}</span></div>
        <div role="img" aria-label={`Ventes par jour sur ${period} jours`} className={`grid h-[110px] items-end ${short ? 'gap-2' : 'gap-[2px]'}`} style={{ gridTemplateColumns: `repeat(${Math.max(1, (series ?? []).length)}, minmax(0, 1fr))` }}>
          {(series ?? []).map((d, i) => <span key={d.day} title={`${new Date(d.day).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} : ${formatGnf(d.revenue_gnf)}`} className={`block ${short ? 'rounded-md' : 'rounded-t-[3px]'} ${i === (series ?? []).length - 1 ? 'bg-blue' : d.revenue_gnf ? 'bg-[#d9defc]' : 'bg-line'}`} style={{ height: `${heights[i]}%` }} />)}
        </div>
        {series && series.length > 0 && (short
          ? <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-bold text-muted">{series.map((d) => <span key={d.day}>{new Date(d.day).toLocaleDateString('fr-FR', { weekday: 'short' })}</span>)}</div>
          : <div className="flex justify-between text-[11px] font-bold text-muted"><span>{new Date(series[0]!.day).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span><span>Aujourd’hui</span></div>)}
        {stats && <p className="text-[12.5px] font-semibold text-muted">{stats.parcels} commande{stats.parcels > 1 ? 's' : ''} sur la période.</p>}
      </section>

      <section aria-label="D’où viennent vos ventes" className="flex flex-col gap-2.5 rounded-[22px] border border-line-soft bg-card p-4">
        <h2 className="text-[14.5px] font-extrabold">D’où viennent vos ventes</h2>
        {sources.length === 0 && <p className="text-[13px] font-semibold text-muted">Pas encore de vente à analyser.</p>}
        {sources.map((s) => (
          <div key={s.source} className="grid grid-cols-[78px_1fr_auto] items-center gap-2.5 text-[12.5px] font-bold">
            <span>{SRC[s.source] ?? s.source}</span>
            <span className="block h-2.5 overflow-hidden rounded-full bg-[#efece4]"><span className="block h-full rounded-full bg-blue" style={{ width: `${Math.max(4, (s.revenue_gnf / best) * 100)}%` }} /></span>
            <span className="text-right">{s.parcels}</span>
          </div>
        ))}
      </section>

      <section aria-label="Produits les plus vendus" className="flex flex-col gap-2.5 rounded-[22px] border border-line-soft bg-card p-4">
        <h2 className="text-[14.5px] font-extrabold">Produits les plus vendus</h2>
        {top.length === 0 && <p className="text-[13px] font-semibold text-muted">Pas encore de vente sur la période.</p>}
        {top.map(([name, x], i) => (
          <div key={name} className="flex items-center gap-2.5 text-[13px] font-bold">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sand text-[12px] font-extrabold">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate">{name}</span>
            <span className="shrink-0 text-muted">{x.qty} vendu{x.qty > 1 ? 's' : ''}</span>
            <span className="shrink-0 font-extrabold">{formatGnf(x.gnf)}</span>
          </div>
        ))}
      </section>

      {nets.length > 0 && (
        <section aria-label="Du clic à la commande" className="flex flex-col gap-2.5 rounded-[22px] border border-line-soft bg-card p-4">
          <h2 className="text-[14.5px] font-extrabold">Du clic à la commande</h2>
          <p className="-mt-1 text-[12px] font-semibold text-muted">Clics sur vos liens suivis et commandes venues de chaque réseau : le réseau où vos clients achètent le plus mérite vos publications.</p>
          {nets.map((x) => (
            <div key={x.n} className="flex items-center justify-between text-[13px] font-bold">
              <span>{SRC[x.n]}</span>
              <span className="text-muted">{x.clicks} clic{x.clicks > 1 ? 's' : ''} · {x.orders} commande{x.orders > 1 ? 's' : ''}{x.clicks ? ` · ${Math.round((x.orders / x.clicks) * 1000) / 10} %` : ''}</span>
            </div>
          ))}
        </section>
      )}

      <section id="liens" aria-label="Liens suivis" className="flex scroll-mt-4 flex-col gap-2.5 rounded-[22px] border border-line-soft bg-card p-4">
        <h2 className="text-[14.5px] font-extrabold">Liens suivis</h2>
        <p className="text-[12px] font-semibold leading-snug text-muted">Un lien par réseau : vous voyez combien de personnes cliquent, et d’où viennent vos commandes.</p>
        <div className="flex flex-wrap gap-1.5">{SOURCES.map((s) => <button key={s} type="button" aria-pressed={net === s} onClick={() => setNet(s)} className={`h-9 rounded-full px-3 text-[12.5px] font-extrabold ${net === s ? 'bg-ink text-white' : 'border border-line'}`}>{SRC[s]}</button>)}</div>
        <select value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Page visée" className="h-11 rounded-xl border border-line bg-card px-3 text-[15px] font-semibold"><option value="">Toute la boutique</option>{offers.map((o) => <option key={o.id} value={o.id}>{o.catalog_products?.name}</option>)}</select>
        <button type="button" onClick={createLink} className="h-11 rounded-xl bg-ink text-[13.5px] font-extrabold text-white">+ Créer un lien</button>
        <Notice msg={msg} />
        {links.map((l) => (
          <div key={l.id} className="flex items-center gap-2.5 rounded-[14px] bg-bg px-3 py-2.5">
            <span className="flex min-w-0 flex-1 flex-col"><span className="truncate text-[13.5px] font-extrabold">{SRC[l.source ?? 'autre'] ?? 'Autre'} · {l.kind === 'produit' ? 'un produit' : 'toute la boutique'}</span><span className="truncate text-[11.5px] font-semibold text-muted">{origin.replace(/^https?:\/\//, '')}/s/{l.code} · {l.clicks} clic{l.clicks > 1 ? 's' : ''}</span></span>
            <button type="button" onClick={() => copy(l.code)} className="h-9 shrink-0 rounded-full border border-line bg-card px-3 text-[12px] font-extrabold">{copied === l.code ? 'Copié ✓' : 'Copier'}</button>
          </div>
        ))}
      </section>

      <section aria-label="Indice de confiance" className="flex flex-col gap-2.5 rounded-[22px] border border-line-soft bg-card p-4">
        <div className="flex items-center justify-between"><h2 className="text-[14.5px] font-extrabold">Indice de confiance</h2><span className="font-display text-[18px] font-semibold">{score?.trust ?? '…'}<span className="text-[12px] text-muted"> / 100</span></span></div>
        <div className="flex flex-wrap gap-1.5">
          {score && score.reliability > 0 && <span className="rounded-full bg-sand px-2.5 py-1 text-[11.5px] font-bold">{Math.round(Number(score.reliability) * 100)} % remis</span>}
          {rating && <span className="rounded-full bg-sand px-2.5 py-1 text-[11.5px] font-bold">{rating} ★</span>}
          {certified && <span className="rounded-full bg-sand px-2.5 py-1 text-[11.5px] font-bold">Adresse certifiée</span>}
          {score?.prep_minutes ? <span className="rounded-full bg-sand px-2.5 py-1 text-[11.5px] font-bold">Prépare en {score.prep_minutes} min</span> : null}
        </div>
        {tip && <p className="text-[12.5px] font-bold text-blue-ink">{tip}</p>}
      </section>
    </Screen>
  );
}
