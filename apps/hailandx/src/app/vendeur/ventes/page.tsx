'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Wordmark } from '@hailandx/ui';
import { formatGnf } from '@hailandx/commerce';
import { browserClient } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';

interface Day { day: string; parcels: number; revenue_gnf: number }
interface Src { source: string; parcels: number; revenue_gnf: number }
const SRC: Record<string, string> = { application: 'Application', tiktok: 'TikTok', whatsapp: 'WhatsApp', facebook: 'Facebook', autre: 'Autre' };
const PERIODS = [7, 30, 90];

/** Ventes du vendeur : par jour (colis non annulés) et par source des liens partagés. */
export default function SalesPage() {
  const session = useSession();
  const [days, setDays] = useState(30);
  const [shopId, setShopId] = useState<string | null | undefined>(undefined);
  const [series, setSeries] = useState<Day[] | null>(null);
  const [sources, setSources] = useState<Src[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sb = browserClient(); if (!sb || !session) return;
    sb.from('shops').select('id').eq('owner_id', session.user.id).limit(1).maybeSingle().then(({ data }) => setShopId((data as { id: string } | null)?.id ?? null));
  }, [session]);
  const load = useCallback(async () => {
    const sb = browserClient(); if (!sb || !shopId) return;
    const [a, b] = await Promise.all([sb.rpc('fn_shop_sales', { p_shop: shopId, p_days: days }), sb.rpc('fn_shop_sources', { p_shop: shopId, p_days: days })]);
    if (a.error || b.error) return setError('Les ventes n’ont pas pu être lues.');
    setSeries(((a.data as Day[]) ?? []).map((d) => ({ ...d, revenue_gnf: Number(d.revenue_gnf) })));
    setSources(((b.data as Src[]) ?? []).map((s) => ({ ...s, revenue_gnf: Number(s.revenue_gnf) })));
  }, [shopId, days]);
  useEffect(() => { void load(); }, [load]);

  const total = (series ?? []).reduce((n, d) => n + d.revenue_gnf, 0);
  const count = (series ?? []).reduce((n, d) => n + d.parcels, 0);
  const max = Math.max(1, ...(series ?? []).map((d) => d.revenue_gnf));
  const best = sources[0];
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-5 pb-6 pt-6">
      <div className="flex items-center justify-between"><Link href="/" aria-label="Accueil"><Wordmark /></Link><Link href="/vendeur" className="text-[13px] font-bold text-blue-ink">Mon espace</Link></div>
      <h1 className="font-display text-[22px] font-semibold tracking-tight">Mes ventes</h1>
      {session === null && <Link href="/connexion?next=/vendeur/ventes" className="font-bold text-blue-ink">Se connecter</Link>}
      {shopId === null && <p className="text-[14px] font-medium text-muted">Créez d’abord votre boutique dans « Mon espace ».</p>}
      {error && <p role="alert" className="rounded-2xl bg-[#fde8e4] px-4 py-3 text-[13.5px] font-semibold text-[#8a2a1c]">{error}</p>}
      {shopId && (
        <>
          <div className="flex gap-2" role="radiogroup" aria-label="Période">{PERIODS.map((p) => <button key={p} type="button" role="radio" aria-checked={days === p} onClick={() => setDays(p)} className={`h-10 flex-1 rounded-full text-[13px] font-bold ${days === p ? 'bg-ink text-white' : 'border border-line'}`}>{p} jours</button>)}</div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl bg-ink px-4 py-3 text-white"><div className="text-[12px] font-bold text-white/70">Ventes (articles)</div><div className="font-display text-[20px] font-semibold">{formatGnf(total)}</div></div>
            <div className="rounded-2xl border border-line-soft bg-card px-4 py-3"><div className="text-[12px] font-bold text-muted">Colis</div><div className="font-display text-[20px] font-semibold">{count}</div></div>
          </div>
          {series && (
            <section aria-label="Ventes par jour" className="flex flex-col gap-2 rounded-[22px] border border-line-soft bg-card p-4">
              <div className="flex h-[120px] items-end gap-[2px]" role="img" aria-label={`Ventes par jour sur ${days} jours, total ${formatGnf(total)}`}>
                {series.map((d) => <span key={d.day} title={`${new Date(d.day).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} : ${formatGnf(d.revenue_gnf)}`} className={`flex-1 rounded-t-[3px] ${d.revenue_gnf ? 'bg-blue' : 'bg-line'}`} style={{ height: `${d.revenue_gnf ? Math.max(6, (d.revenue_gnf / max) * 100) : 3}%` }} />)}
              </div>
              <div className="flex justify-between text-[11px] font-semibold text-muted"><span>{new Date(series[0]!.day).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span><span>Aujourd’hui</span></div>
              {count === 0 && <p className="text-[13px] font-medium text-muted">Aucune vente sur cette période. Partagez votre boutique depuis « Mon espace ».</p>}
            </section>
          )}
          <section aria-label="Sources des ventes" className="flex flex-col gap-2">
            <h2 className="font-display text-[16px] font-semibold">D’où viennent vos ventes</h2>
            {best && <p className="text-[13px] font-medium text-muted">Votre meilleure source : <b className="text-ink">{SRC[best.source] ?? best.source}</b>.</p>}
            {sources.length === 0 && <p className="text-[13px] font-medium text-muted">Pas encore de vente à analyser.</p>}
            {sources.map((s) => (
              <div key={s.source} className="flex items-center gap-3 rounded-2xl border border-line-soft bg-card px-4 py-3">
                <span className="w-24 shrink-0 text-[13.5px] font-extrabold">{SRC[s.source] ?? s.source}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-sand"><span className="block h-full rounded-full bg-blue" style={{ width: `${Math.max(4, (s.revenue_gnf / Math.max(1, sources[0]!.revenue_gnf)) * 100)}%` }} /></span>
                <span className="text-right text-[12.5px] font-bold">{formatGnf(s.revenue_gnf)}<span className="block text-[11px] font-semibold text-muted">{s.parcels} colis</span></span>
              </div>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
