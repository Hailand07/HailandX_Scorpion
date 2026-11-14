'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ago, barHeights, formatGnf, onVacation, periodStats, type SalesDay } from '@hailandx/commerce';
import { browserClient, HAILANDX_URL, Icon, LienHailand, mediaUrl, NotificationBell, Screen, Segmented } from '@hailandx/kit';
import type { MyShop } from '@/lib/useMyShop';
import { ShareSheet } from './ShareSheet';
import { btn } from './ui';

interface Review { rating: number; comment: string | null; created_at: string }
interface OfferStock { id: string; active: boolean; photo_paths: string[] | null; compare_at_gnf: number | null; offer_variants: { stock: number }[] | null; catalog_products: { name: string } | null }
interface Data {
  series: SalesDay[]; prep: { created_at: string }[]; disputes: number; recent: Review[];
  offers: OfferStock[]; balance: number; questions: number; shares: number;
}
type Period = 'jour' | 'semaine' | 'mois';
const DAYS: Record<Period, number> = { jour: 1, semaine: 7, mois: 30 };

/**
 * Accueil (design §52), dans l'ordre de ce qui compte : ce qu'il faut faire maintenant (colis à préparer d'abord), les deux gestes
 * qui font vendre (ajouter un produit, partager), puis les ventes et l'argent. Le reste est dans l'onglet Boutique.
 */
export function Dashboard({ shop }: { shop: MyShop }) {
  const [d, setD] = useState<Data | null>(null);
  const [period, setPeriod] = useState<Period>('jour');
  const [sharing, setSharing] = useState(false);

  const load = useCallback(async () => {
    const sb = browserClient(); if (!sb) return;
    const week = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const [sales, prep, disputes, recent, offers, ledger, questions, shares] = await Promise.all([
      sb.rpc('fn_shop_sales', { p_shop: shop.id, p_days: 60 }),
      sb.from('parcels').select('created_at').eq('shop_id', shop.id).eq('status', 'attente_vendeur').order('created_at'),
      sb.from('parcels').select('id', { count: 'exact', head: true }).eq('shop_id', shop.id).eq('status', 'litige'),
      sb.from('reviews').select('rating,comment,created_at').eq('shop_id', shop.id).gte('created_at', week).order('created_at', { ascending: false }),
      sb.from('offers').select('id,active,photo_paths,compare_at_gnf,offer_variants(stock),catalog_products(name)').eq('shop_id', shop.id),
      sb.from('ledger_entries').select('amount_gnf').eq('account', 'shop').eq('account_id', shop.id),
      sb.rpc('fn_shop_questions', { p_shop: shop.id }),
      sb.from('share_links').select('id', { count: 'exact', head: true }).eq('shop_id', shop.id),
    ]);
    setD({
      series: ((sales.data as SalesDay[]) ?? []).map((x) => ({ ...x, revenue_gnf: Number(x.revenue_gnf), delivered_gnf: Number(x.delivered_gnf ?? 0) })),
      prep: (prep.data as { created_at: string }[]) ?? [],
      disputes: disputes.count ?? 0,
      recent: (recent.data as Review[]) ?? [],
      offers: (offers.data as unknown as OfferStock[]) ?? [],
      balance: ((ledger.data as { amount_gnf: number }[]) ?? []).reduce((n, e) => n + e.amount_gnf, 0),
      questions: ((questions.data as { answer: string | null }[]) ?? []).filter((q) => !q.answer).length,
      shares: shares.count ?? 0,
    });
  }, [shop.id]);

  useEffect(() => { void load(); const t = setInterval(load, 30_000); return () => clearInterval(t); }, [load]);

  const stats = d ? periodStats(d.series, DAYS[period]) : null;
  const last7 = d ? d.series.slice(-7) : [];
  const heights = barHeights(last7);
  const live = d?.offers.filter((o) => o.active) ?? [];
  const empty = live.filter((o) => (o.offer_variants ?? []).reduce((n, v) => n + v.stock, 0) === 0);
  const logo = mediaUrl(shop.logo_path);
  const initials = shop.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  const todo: { href: string; badge: React.ReactNode; tone: string; title: string; sub: string }[] = [];
  if (d?.prep.length) todo.push({ href: '/commandes', badge: d.prep.length, tone: 'bg-lime text-ink', title: 'Colis à préparer', sub: `Le plus ancien attend depuis ${ago(d.prep[0]!.created_at).replace('il y a ', '')}` });
  if (d?.disputes) todo.push({ href: '/commandes?onglet=problemes', badge: d.disputes, tone: 'bg-danger-soft text-danger', title: d.disputes > 1 ? 'Problèmes signalés' : 'Problème signalé', sub: 'Donnez votre version à l’équipe Hailand' });
  if (d?.recent.length) todo.push({ href: '/avis', badge: d.recent.length, tone: 'bg-blue-soft text-blue', title: d.recent.length > 1 ? 'Nouveaux avis clients' : 'Nouvel avis client', sub: `${'★'.repeat(d.recent[0]!.rating)}${'☆'.repeat(5 - d.recent[0]!.rating)}${d.recent[0]!.comment ? ` « ${d.recent[0]!.comment.slice(0, 40)}${d.recent[0]!.comment.length > 40 ? '…' : ''} »` : ''}` });
  if (d?.questions) todo.push({ href: '/questions', badge: d.questions, tone: 'bg-blue-soft text-blue', title: d.questions > 1 ? 'Questions de clients sans réponse' : 'Question de client sans réponse', sub: 'Une réponse rapide fait vendre' });
  if (empty.length) todo.push({ href: '/produits?filtre=rupture', badge: <Icon name="alert" size={18} stroke={2.2} />, tone: 'bg-warn-soft text-warn', title: `${empty.length} produit${empty.length > 1 ? 's' : ''} en rupture`, sub: empty.map((o) => o.catalog_products?.name).filter(Boolean).slice(0, 2).join(', ') + ' · stock 0' });

  // Un colis à préparer (ou, à défaut, un litige) passe en carte pleine ; le reste suit en liste.
  const urgent = todo.find((t) => t.href.startsWith('/commandes')) ?? null;
  const rest = todo.filter((t) => t !== urgent);

  // « Bien démarrer » (maquette v6 A1) : disparaît quand tout est fait.
  const owner = shop.role === 'proprietaire';
  const steps: { done: boolean; label: string; href: string }[] = d ? [
    { done: live.length > 0, label: 'Mettre un premier produit en vente', href: '/produits/nouveau' },
    { done: d.shares > 0, label: 'Partager le lien d’un produit (WhatsApp, TikTok…)', href: '/produits' },
    { done: !!shop.logo_path, label: 'Ajouter mon logo', href: '/reglages' },
  ].filter((x) => owner || x.href !== '/reglages') : [];
  const doneCount = steps.filter((x) => x.done).length;

  return (
    <Screen className="gap-3.5">
      <header className="flex items-center gap-3 pt-1">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#f6d8bd] font-display text-[16px] font-bold">
          {logo ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={logo} alt="" className="h-full w-full object-cover" /> : initials}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-display text-[20px] font-semibold tracking-tight">{shop.name}</span>
          {onVacation(shop.vacation_until)
            ? <Link href={owner ? '/boutique' : '/'} className="flex items-center gap-1.5 text-[12px] font-bold text-warn"><span className="h-[7px] w-[7px] rounded-full bg-warn" />En congé · commandes fermées</Link>
            : <span className="flex items-center gap-1.5 text-[12px] font-bold text-ok"><span className="h-[7px] w-[7px] rounded-full bg-ok" />Ouverte{owner ? '' : ' · employé'}</span>}
        </span>
        <NotificationBell scope="vendeur" />
        <LienHailand app="hailandx" href={`${HAILANDX_URL}/b/${shop.slug}`} target="_blank" aria-label="Voir ma boutique sur HailandX" className="flex h-11 w-11 items-center justify-center rounded-2xl border border-line bg-card"><Icon name="eye" /></LienHailand>
      </header>

      {/* 1. Ce qui attend le vendeur. Un colis à préparer passe avant tout : carte pleine, en tête. */}
      {urgent && (
        <Link href={urgent.href} className="flex items-center gap-3.5 rounded-[20px] bg-lime p-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-ink font-display text-[20px] font-bold text-lime">{urgent.badge}</span>
          <span className="flex min-w-0 flex-1 flex-col"><span className="text-[16px] font-extrabold">{urgent.title}</span><span className="truncate text-[13px] font-bold text-ink/70">{urgent.sub}</span></span>
          <Icon name="chevron" size={18} stroke={2.4} />
        </Link>
      )}
      {rest.length > 0 && (
        <section aria-label="À faire" className="overflow-hidden rounded-[20px] border border-line-soft bg-card">
          {rest.map((t, i) => (
            <Link key={t.title} href={t.href} className={`flex items-center gap-3 px-4 py-3 ${i ? 'border-t border-line-soft' : ''}`}>
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] font-display text-[16px] font-bold ${t.tone}`}>{t.badge}</span>
              <span className="flex min-w-0 flex-1 flex-col"><span className="text-[15px] font-extrabold">{t.title}</span><span className="truncate text-[12px] font-semibold text-muted">{t.sub}</span></span>
              <Icon name="chevron" size={16} stroke={2} className="text-faint" />
            </Link>
          ))}
        </section>
      )}
      {d && todo.length === 0 && <p className="flex items-center gap-2.5 rounded-[20px] border border-line-soft bg-card px-4 py-3.5 text-[14px] font-bold text-ok"><Icon name="check" size={18} stroke={2.6} />Tout est à jour : aucune commande n’attend.</p>}

      {/* 2. Les deux gestes qui font vendre, sous le pouce. */}
      <div className="grid grid-cols-2 gap-2.5">
        <Link href="/produits/nouveau" className={`${btn('primary', 'lg')} whitespace-nowrap !px-3`}><Icon name="plus" size={18} stroke={2.4} />Nouveau produit</Link>
        <button type="button" onClick={() => setSharing(true)} className={btn('secondary', 'lg')}><Icon name="share" size={18} stroke={2} />Partager</button>
      </div>
      {sharing && <ShareSheet target={{ shopId: shop.id, shopSlug: shop.slug, shopName: shop.name }} onClose={() => setSharing(false)} />}

      {d && doneCount < steps.length && (
        <section aria-label="Bien démarrer" className="flex flex-col gap-1 rounded-[20px] border border-line-soft bg-card px-4 pb-2 pt-3.5">
          <div className="flex items-baseline justify-between"><h2 className="text-[15px] font-extrabold">Bien démarrer</h2><span className="text-[12px] font-extrabold text-ok">{doneCount} sur {steps.length}</span></div>
          <span className="my-1.5 block h-1.5 overflow-hidden rounded-full bg-sand"><span className="block h-full rounded-full bg-ok" style={{ width: `${(doneCount / steps.length) * 100}%` }} /></span>
          {steps.map((x) => x.done
            ? <span key={x.label} className="flex items-center gap-2.5 py-1.5 text-[14px] font-bold text-muted line-through"><span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-ok text-white"><Icon name="check" size={13} stroke={3} /></span>{x.label}</span>
            : <Link key={x.label} href={x.href} className="flex items-center gap-2.5 py-1.5 text-[14px] font-extrabold"><span aria-hidden="true" className="h-[22px] w-[22px] shrink-0 rounded-full border-2 border-line" /><span className="flex-1">{x.label}</span><Icon name="chevron" size={15} stroke={2} className="text-faint" /></Link>)}
        </section>
      )}

      {/* 3. Les chiffres : ventes, puis l'argent dû. */}
      <section aria-label="Mes ventes" className="flex flex-col gap-3.5 rounded-[24px] bg-ink p-4 text-white">
        <Segmented dark label="Période" value={period} onChange={setPeriod} items={[{ id: 'jour', label: 'Aujourd’hui' }, { id: 'semaine', label: '7 jours' }, { id: 'mois', label: '30 jours' }]} />
        <div className="flex items-end justify-between gap-3">
          <span className="flex flex-col gap-0.5">
            <span className="text-[12px] font-bold text-white/65">Commandé</span>
            <span className="font-display text-[30px] font-semibold tracking-tight">{stats ? formatGnf(stats.revenue, false) : '…'} <span className="text-[14px] text-white/65">GNF</span></span>
            <span className="text-[13px] font-bold text-white/75">{stats ? `${stats.parcels} commande${stats.parcels > 1 ? 's' : ''} · dont ${formatGnf(stats.delivered)} encaissés` : ' '}</span>
          </span>
          {stats?.trendPct != null && stats.revenue > 0 && <span className="whitespace-nowrap rounded-full bg-lime/15 px-2.5 py-1 text-[12px] font-extrabold text-lime">{stats.trendPct > 0 ? '+' : ''}{stats.trendPct} % {period === 'jour' ? 'vs hier' : 'vs avant'}</span>}
        </div>
        <div role="img" aria-label="Ventes des 7 derniers jours" className="grid h-[54px] grid-cols-7 items-end gap-1.5">
          {last7.map((x, i) => <span key={x.day} className={`block rounded-md ${i === last7.length - 1 ? 'bg-lime' : 'bg-white/20'}`} style={{ height: `${heights[i]}%` }} />)}
        </div>
        <Link href="/statistiques" className="flex h-10 items-center justify-center rounded-full bg-white/10 text-[13px] font-extrabold">Voir le détail des ventes</Link>
      </section>

      {owner && (
        <Link href="/argent" className="flex items-center justify-between gap-3 rounded-[20px] border border-line-soft bg-card p-4">
          <span className="flex flex-col gap-0.5"><span className="text-[12px] font-bold text-muted">Hailand vous doit</span><span className="font-display text-[20px] font-semibold">{d ? formatGnf(d.balance, false) : '…'} <span className="text-[12px] text-muted">GNF</span></span></span>
          <span className="flex items-center gap-1 text-[13px] font-extrabold text-blue-ink">Voir<Icon name="chevron" size={15} stroke={2.2} /></span>
        </Link>
      )}
    </Screen>
  );
}
