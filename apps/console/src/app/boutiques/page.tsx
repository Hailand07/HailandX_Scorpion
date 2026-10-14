'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { HAILANDX_URL } from '@hailandx/kit';
import { btn, Flash, PageHead, Panel, useAction, useConsole } from '@/components/ConsoleShell';

interface Shop { id: string; name: string; slug: string; status: string; created_at: string; shop_scores: { trust: number } | { trust: number }[] | null }
const trustOf = (s: Shop) => (Array.isArray(s.shop_scores) ? s.shop_scores[0]?.trust : s.shop_scores?.trust) ?? 0;
type Filter = 'toutes' | 'ouverte' | 'preparation' | 'suspendue';
const FILTERS: { id: Filter; label: string }[] = [{ id: 'toutes', label: 'Toutes' }, { id: 'ouverte', label: 'Ouvertes' }, { id: 'preparation', label: 'En préparation' }, { id: 'suspendue', label: 'Suspendues' }];
const STATUS: Record<string, { t: string; c: string }> = {
  ouverte: { t: 'Ouverte', c: 'bg-ok-soft text-ok' }, preparation: { t: 'En préparation', c: 'bg-sand text-ink' },
  bientot: { t: 'Bientôt', c: 'bg-blue-soft text-blue-ink' }, suspendue: { t: 'Suspendue', c: 'bg-[#fbeae5] text-[#a3321f]' },
};

/** Boutiques : chercher, voir, suspendre ou réactiver (chaque changement est inscrit au journal). */
export default function ShopsPage() {
  const { sb } = useConsole();
  const { busy, msg, run } = useAction();
  const [shops, setShops] = useState<Shop[] | null>(null);
  const [filter, setFilter] = useState<Filter>('toutes');
  const [q, setQ] = useState('');
  const [confirm, setConfirm] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await sb.from('shops').select('id,name,slug,status,created_at,shop_scores(trust)').order('created_at', { ascending: false }).limit(500);
    setShops((data as unknown as Shop[]) ?? []);
  }, [sb]);
  useEffect(() => { void load(); }, [load]);

  const list = useMemo(() => (shops ?? []).filter((s) =>
    (filter === 'toutes' || s.status === filter || (filter === 'preparation' && s.status === 'bientot')) && s.name.toLowerCase().includes(q.trim().toLowerCase())), [shops, filter, q]);

  const toggle = (s: Shop) => run(
    // Réactivée, la boutique repasse « en préparation » : son vendeur rouvre la vente lui-même (adresse certifiée exigée).
    sb.from('shops').update({ status: s.status === 'suspendue' ? 'preparation' : 'suspendue' }).eq('id', s.id),
    s.status === 'suspendue' ? `« ${s.name} » réactivée : le vendeur peut rouvrir la vente.` : `« ${s.name} » suspendue : elle n’apparaît plus sur HailandX.`,
    async () => { setConfirm(null); await load(); },
  );

  return (
    <>
      <PageHead title="Boutiques" sub={shops ? `${shops.length} boutique${shops.length > 1 ? 's' : ''}` : undefined} />
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)} className={`h-9 rounded-full px-3.5 text-[13px] font-extrabold ${filter === f.id ? 'bg-ink text-white' : 'border border-line bg-card'}`}>{f.label}</button>)}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher une boutique" aria-label="Chercher une boutique" className="h-10 min-w-[200px] flex-1 rounded-xl border border-line bg-card px-3.5 text-[14px] font-semibold outline-none focus:border-blue sm:max-w-xs" />
      </div>
      <Flash msg={msg} />
      <Panel label="Liste des boutiques" className="overflow-hidden">
        {shops && list.length === 0 && <p className="px-[18px] py-5 text-[14px] font-semibold text-muted">Aucune boutique.</p>}
        <ul>
          {list.map((s, i) => {
            const st = STATUS[s.status] ?? { t: s.status, c: 'bg-sand' };
            return (
              <li key={s.id} className={`flex flex-wrap items-center gap-3 px-[18px] py-3 ${i ? 'border-t border-[#f0ede6]' : ''}`}>
                <span className="flex min-w-0 flex-1 flex-col">
                  <a href={`${HAILANDX_URL}/b/${s.slug}`} target="_blank" rel="noreferrer" className="truncate text-[14.5px] font-extrabold hover:text-blue">{s.name}</a>
                  <span className="text-[12.5px] font-semibold text-muted">Créée le {new Date(s.created_at).toLocaleDateString('fr-FR')} · indice de confiance {trustOf(s)}</span>
                </span>
                <span className={`rounded-full px-2.5 py-1 text-[12px] font-extrabold ${st.c}`}>{st.t}</span>
                {confirm === s.id ? (
                  <span className="flex gap-2">
                    <button type="button" disabled={busy} onClick={() => toggle(s)} className={s.status === 'suspendue' ? btn.small : `${btn.small} border-[#a3321f] text-[#a3321f]`}>{s.status === 'suspendue' ? 'Confirmer la réactivation' : 'Confirmer la suspension'}</button>
                    <button type="button" onClick={() => setConfirm(null)} className={btn.small}>Annuler</button>
                  </span>
                ) : (
                  <button type="button" onClick={() => setConfirm(s.id)} className={btn.small}>{s.status === 'suspendue' ? 'Réactiver' : 'Suspendre'}</button>
                )}
              </li>
            );
          })}
        </ul>
      </Panel>
    </>
  );
}
