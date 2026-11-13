'use client';
import { useCallback, useEffect, useState } from 'react';
import { barHeights, formatGnf, periodStats, type SalesDay } from '@hailandx/commerce';
import { BackHeader, browserClient, Chips, Screen, SOURCES } from '@hailandx/kit';
import { SellerGate } from '@/components/SellerGate';

interface Src { source: string; parcels: number; revenue_gnf: number }
interface ShareLink { id: string; code: string; kind: string; source: string | null; clicks: number }
interface Sold { name_snapshot: string; quantity: number; price_gnf_snapshot: number }
const SRC: Record<string, string> = { application: 'HailandX', tiktok: 'TikTok', whatsapp: 'WhatsApp', facebook: 'Facebook', autre: 'Autre' };
type Period = '7' | '30' | '90';

/** Ventes et visites (refonte §51) : ventes par jour, produits les plus vendus, visites des liens partagés et commandes qui en viennent. Rien d'autre. */
export default function StatsPage() {
  return <SellerGate title="Ventes et visites">{({ shop }) => <Stats shopId={shop.id} />}</SellerGate>;
}

function Stats({ shopId }: { shopId: string }) {
  const sb = browserClient();
  const [period, setPeriod] = useState<Period>('7');
  const [series, setSeries] = useState<SalesDay[] | null>(null);
  const [sources, setSources] = useState<Src[]>([]);
  const [sold, setSold] = useState<Sold[]>([]);
  const [links, setLinks] = useState<ShareLink[]>([]);

  const load = useCallback(async () => {
    if (!sb) return;
    const days = Number(period);
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    const [a, b, c, l] = await Promise.all([
      sb.rpc('fn_shop_sales', { p_shop: shopId, p_days: days }), sb.rpc('fn_shop_sources', { p_shop: shopId, p_days: days }),
      sb.from('order_items').select('name_snapshot,quantity,price_gnf_snapshot,parcels!inner(shop_id,status,created_at)').eq('parcels.shop_id', shopId).neq('parcels.status', 'annule').gte('parcels.created_at', since).limit(1000),
      sb.from('share_links').select('id,code,kind,source,clicks').eq('shop_id', shopId),
    ]);
    setSold((c.data as unknown as Sold[]) ?? []);
    setSeries(((a.data as SalesDay[]) ?? []).map((x) => ({ ...x, revenue_gnf: Number(x.revenue_gnf), delivered_gnf: Number(x.delivered_gnf ?? 0) })));
    setSources(((b.data as Src[]) ?? []).map((x) => ({ ...x, revenue_gnf: Number(x.revenue_gnf) })));
    setLinks((l.data as ShareLink[]) ?? []);
  }, [sb, shopId, period]);
  useEffect(() => { void load(); }, [load]);

  const stats = series ? periodStats(series, series.length) : null;
  const heights = barHeights(series ?? []);
  const short = period === '7';
  // Produits les plus vendus sur la période (quantités et chiffre, colis annulés exclus).
  const top = [...sold.reduce((m, i) => { const x = m.get(i.name_snapshot) ?? { qty: 0, gnf: 0 }; m.set(i.name_snapshot, { qty: x.qty + i.quantity, gnf: x.gnf + i.quantity * i.price_gnf_snapshot }); return m; }, new Map<string, { qty: number; gnf: number }>())]
    .sort((x, y) => y[1].gnf - x[1].gnf).slice(0, 5);
  // Du clic à la commande, par réseau : clics des liens suivis (depuis leur création) et commandes de la période.
  const nets = SOURCES.map((n) => ({ n, clicks: links.filter((l) => (l.source ?? 'autre') === n).reduce((t, l) => t + l.clicks, 0), orders: sources.find((x) => x.source === n)?.parcels ?? 0 })).filter((x) => x.clicks || x.orders);

  return (
    <Screen>
      <BackHeader href="/plus" title="Ventes et visites" label="Retour" />
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
        <section aria-label="Visites de vos liens" className="flex flex-col gap-2.5 rounded-[22px] border border-line-soft bg-card p-4">
          <h2 className="text-[14.5px] font-extrabold">Visites de vos liens</h2>
          <p className="-mt-1 text-[12px] font-semibold text-muted">Clics sur vos liens suivis et commandes venues de chaque réseau : le réseau où vos clients achètent le plus mérite vos publications.</p>
          {nets.map((x) => (
            <div key={x.n} className="flex items-center justify-between text-[13px] font-bold">
              <span>{SRC[x.n]}</span>
              <span className="text-muted">{x.clicks} clic{x.clicks > 1 ? 's' : ''} · {x.orders} commande{x.orders > 1 ? 's' : ''}{x.clicks ? ` · ${Math.round((x.orders / x.clicks) * 1000) / 10} %` : ''}</span>
            </div>
          ))}
        </section>
      )}

    </Screen>
  );
}
