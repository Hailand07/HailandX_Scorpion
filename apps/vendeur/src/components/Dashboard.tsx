'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ago, barHeights, formatGnf, periodStats, type SalesDay, shortGnf } from '@hailandx/commerce';
import { browserClient, HAILANDX_URL, Icon, ICONS, mediaUrl, NotificationBell, Screen, Segmented } from '@hailandx/kit';
import type { MyShop } from '@/lib/useMyShop';
import { ShareRow } from './ShareRow';

interface Review { rating: number; comment: string | null; created_at: string }
interface OfferStock { id: string; active: boolean; offer_variants: { stock: number }[] | null; catalog_products: { name: string } | null }
interface Data {
  series: SalesDay[]; prep: { created_at: string }[]; disputes: number; recent: Review[];
  score: { trust: number; rating: number; review_count: number } | null; offers: OfferStock[]; balance: number;
}
type Period = 'jour' | 'semaine' | 'mois';
const DAYS: Record<Period, number> = { jour: 1, semaine: 7, mois: 30 };

/** Ma boutique — tableau de bord (v2) : les ventes, ce qui attend une action, l'argent, la confiance, et six pages rangées. */
export function Dashboard({ shop }: { shop: MyShop }) {
  const [d, setD] = useState<Data | null>(null);
  const [period, setPeriod] = useState<Period>('jour');

  const load = useCallback(async () => {
    const sb = browserClient(); if (!sb) return;
    const week = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const [sales, prep, disputes, recent, score, offers, ledger] = await Promise.all([
      sb.rpc('fn_shop_sales', { p_shop: shop.id, p_days: 60 }),
      sb.from('parcels').select('created_at').eq('shop_id', shop.id).eq('status', 'attente_vendeur').order('created_at'),
      sb.from('parcels').select('id', { count: 'exact', head: true }).eq('shop_id', shop.id).eq('status', 'litige'),
      sb.from('reviews').select('rating,comment,created_at').eq('shop_id', shop.id).gte('created_at', week).order('created_at', { ascending: false }),
      sb.from('shop_scores').select('trust,rating,review_count').eq('shop_id', shop.id).maybeSingle(),
      sb.from('offers').select('id,active,offer_variants(stock),catalog_products(name)').eq('shop_id', shop.id),
      sb.from('ledger_entries').select('amount_gnf').eq('account', 'shop').eq('account_id', shop.id),
    ]);
    setD({
      series: ((sales.data as SalesDay[]) ?? []).map((x) => ({ ...x, revenue_gnf: Number(x.revenue_gnf) })),
      prep: (prep.data as { created_at: string }[]) ?? [],
      disputes: disputes.count ?? 0,
      recent: (recent.data as Review[]) ?? [],
      score: (score.data as Data['score']) ?? null,
      offers: (offers.data as unknown as OfferStock[]) ?? [],
      balance: ((ledger.data as { amount_gnf: number }[]) ?? []).reduce((n, e) => n + e.amount_gnf, 0),
    });
  }, [shop.id]);

  useEffect(() => { void load(); const t = setInterval(load, 30_000); return () => clearInterval(t); }, [load]);

  const stats = d ? periodStats(d.series, DAYS[period]) : null;
  const week = d ? periodStats(d.series, 7) : null;
  const last7 = d ? d.series.slice(-7) : [];
  const heights = barHeights(last7);
  const live = d?.offers.filter((o) => o.active) ?? [];
  const empty = live.filter((o) => (o.offer_variants ?? []).reduce((n, v) => n + v.stock, 0) === 0);
  const rating = d?.score && d.score.review_count > 0 ? Number(d.score.rating).toFixed(1).replace('.', ',') : null;
  const logo = mediaUrl(shop.logo_path);
  const initials = shop.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  const todo: { href: string; badge: React.ReactNode; tone: string; title: string; sub: string }[] = [];
  if (d?.prep.length) todo.push({ href: '/commandes', badge: d.prep.length, tone: 'bg-lime text-ink', title: 'Colis à préparer', sub: `Le plus ancien attend depuis ${ago(d.prep[0]!.created_at).replace('il y a ', '')}` });
  if (d?.disputes) todo.push({ href: '/commandes?onglet=problemes', badge: d.disputes, tone: 'bg-[#fde8e4] text-[#a3321f]', title: d.disputes > 1 ? 'Problèmes signalés' : 'Problème signalé', sub: 'Donnez votre version à l’équipe Hailand' });
  if (d?.recent.length) todo.push({ href: '/avis', badge: d.recent.length, tone: 'bg-blue-soft text-blue', title: d.recent.length > 1 ? 'Nouveaux avis clients' : 'Nouvel avis client', sub: `${'★'.repeat(d.recent[0]!.rating)}${'☆'.repeat(5 - d.recent[0]!.rating)}${d.recent[0]!.comment ? ` « ${d.recent[0]!.comment.slice(0, 40)}${d.recent[0]!.comment.length > 40 ? '…' : ''} »` : ''}` });
  if (empty.length) todo.push({ href: '/produits?filtre=rupture', badge: <Icon name="alert" size={18} stroke={2.2} />, tone: 'bg-[#fff1e6] text-[#c2410c]', title: `${empty.length} produit${empty.length > 1 ? 's' : ''} en rupture`, sub: empty.map((o) => o.catalog_products?.name).filter(Boolean).slice(0, 2).join(', ') + ' · stock 0' });
  if (d && !live.length) todo.push({ href: '/produits/nouveau', badge: <Icon name="plus" size={18} stroke={2.4} />, tone: 'bg-lime text-ink', title: 'Ajoutez votre premier produit', sub: 'Photo, prix, stock : deux minutes' });

  const tiles: { href: string; icon: keyof typeof ICONS; label: string; sub: string }[] = [
    { href: '/commandes', icon: 'box', label: 'Commandes', sub: d ? (d.prep.length ? `${d.prep.length} à préparer` : 'À jour') : '…' },
    { href: '/produits', icon: 'tag', label: 'Produits', sub: d ? `${live.length} en vente` : '…' },
    { href: '/argent', icon: 'wallet', label: 'Argent', sub: d ? `${shortGnf(d.balance)} GNF` : '…' },
    { href: '/statistiques', icon: 'chart', label: 'Statistiques', sub: week?.trendPct != null ? `${week.trendPct > 0 ? '+' : ''}${week.trendPct} % · 7 j` : '7 derniers jours' },
    { href: '/avis', icon: 'star', label: 'Avis', sub: rating ? `${rating} ★ · ${d!.score!.review_count}` : 'Pas encore' },
    { href: '/reglages', icon: 'sliders', label: 'Réglages', sub: 'Logo, WhatsApp' },
  ];

  return (
    <Screen className="gap-3.5">
      <header className="flex items-center gap-3 pt-1">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#f6d8bd] font-display text-[16px] font-bold">
          {logo ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={logo} alt="" className="h-full w-full object-cover" /> : initials}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-display text-[20px] font-semibold tracking-tight">{shop.name}</span>
          <span className="flex items-center gap-1.5 text-[12px] font-bold text-[#0f7a5c]"><span className="h-[7px] w-[7px] rounded-full bg-[#0f7a5c]" />Ouverte · adresse certifiée</span>
        </span>
        <NotificationBell scope="vendeur" />
        <a href={`${HAILANDX_URL}/b/${shop.slug}`} target="_blank" rel="noreferrer" aria-label="Voir ma boutique sur HailandX" className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-line bg-card"><Icon name="eye" /></a>
      </header>

      <section aria-label="Mes ventes" className="flex flex-col gap-3.5 rounded-[24px] bg-ink p-4 text-white">
        <Segmented dark label="Période" value={period} onChange={setPeriod} items={[{ id: 'jour', label: 'Aujourd’hui' }, { id: 'semaine', label: '7 jours' }, { id: 'mois', label: '30 jours' }]} />
        <div className="flex items-end justify-between gap-3">
          <span className="flex flex-col gap-0.5">
            <span className="text-[12px] font-bold text-white/65">Ventes</span>
            <span className="font-display text-[30px] font-semibold tracking-tight">{stats ? formatGnf(stats.revenue, false) : '…'} <span className="text-[14px] text-white/65">GNF</span></span>
            <span className="text-[12.5px] font-bold text-white/75">{stats ? `${stats.parcels} commande${stats.parcels > 1 ? 's' : ''}` : ' '}</span>
          </span>
          {stats?.trendPct != null && <span className="whitespace-nowrap rounded-full bg-lime/15 px-2.5 py-1 text-[12px] font-extrabold text-lime">{stats.trendPct > 0 ? '+' : ''}{stats.trendPct} % {period === 'jour' ? 'vs hier' : 'vs avant'}</span>}
        </div>
        <div role="img" aria-label="Ventes des 7 derniers jours" className="grid h-[54px] grid-cols-7 items-end gap-1.5">
          {last7.map((x, i) => <span key={x.day} className={`block rounded-md ${i === last7.length - 1 ? 'bg-lime' : 'bg-white/20'}`} style={{ height: `${heights[i]}%` }} />)}
        </div>
      </section>

      <section aria-label="À faire" className="overflow-hidden rounded-[22px] border border-line-soft bg-card">
        <h2 className="px-4 pb-1.5 pt-3.5 text-[15px] font-extrabold">À faire maintenant</h2>
        {d && todo.length === 0 && <p className="flex items-center gap-2.5 px-4 pb-4 pt-1 text-[13.5px] font-bold text-[#0f7a5c]"><Icon name="check" size={18} stroke={2.6} />Tout est à jour.</p>}
        {todo.map((t, i) => (
          <Link key={t.title} href={t.href} className={`flex items-center gap-3 px-4 py-2.5 ${i === todo.length - 1 ? 'pb-3.5' : ''}`}>
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] font-display text-[17px] font-bold ${t.tone}`}>{t.badge}</span>
            <span className="flex min-w-0 flex-1 flex-col"><span className="text-[14.5px] font-extrabold">{t.title}</span><span className="truncate text-[12px] font-semibold text-muted">{t.sub}</span></span>
            <Icon name="chevron" size={16} stroke={2} className="text-[#9a9db0]" />
          </Link>
        ))}
      </section>

      <div className="grid grid-cols-2 gap-2.5">
        <Link href="/argent" className="flex flex-col gap-1 rounded-[20px] border border-line-soft bg-card p-3.5">
          <span className="text-[12px] font-bold text-muted">Hailand vous doit</span>
          <span className="font-display text-[19px] font-semibold">{d ? formatGnf(d.balance, false) : '…'}</span>
          <span className="text-[12px] font-extrabold text-blue">GNF · voir</span>
        </Link>
        <Link href="/statistiques" className="flex flex-col gap-1.5 rounded-[20px] border border-line-soft bg-card p-3.5">
          <span className="text-[12px] font-bold text-muted">Indice de confiance</span>
          <span className="font-display text-[19px] font-semibold">{d?.score?.trust ?? '…'}<span className="text-[12px] text-muted"> / 100</span></span>
          <span className="block h-1.5 overflow-hidden rounded-full bg-[#efece4]"><span className="block h-full rounded-full bg-ink" style={{ width: `${d?.score?.trust ?? 0}%` }} /></span>
        </Link>
      </div>

      <section aria-label="Gérer ma boutique" className="flex flex-col gap-2.5">
        <h2 className="mx-1 mt-1 font-display text-[17px] font-semibold">Gérer ma boutique</h2>
        <div className="grid grid-cols-3 gap-2.5">
          {tiles.map((t) => (
            <Link key={t.href} href={t.href} className="flex min-h-[92px] flex-col gap-2 rounded-[18px] border border-line-soft bg-card px-2.5 py-3">
              <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[11px] bg-sand"><Icon name={t.icon} size={18} /></span>
              <span className="flex flex-col"><span className="text-[13.5px] font-extrabold">{t.label}</span><span className="truncate text-[11.5px] font-bold text-muted">{t.sub}</span></span>
            </Link>
          ))}
        </div>
      </section>

      <ShareRow slug={shop.slug} name={shop.name} />
    </Screen>
  );
}
