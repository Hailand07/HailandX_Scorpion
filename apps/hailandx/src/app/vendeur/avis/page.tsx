'use client';
import { useCallback, useEffect, useState } from 'react';
import { browserClient } from '@/lib/supabase';
import { ago } from '@/lib/seller';
import { BackHeader, errText, Notice, Screen } from '@/components/Screen';
import { SellerGate } from '@/components/seller/SellerGate';

interface Review { id: string; rating: number; comment: string | null; created_at: string; hidden: boolean; review_reports: { status: string; reason: string }[] | null; parcels: { order_items: { name_snapshot: string }[] } | null }
const REASONS: [string, string][] = [['faux', 'Cette personne n’a pas commandé'], ['injurieux', 'Propos injurieux'], ['hors_sujet', 'Sans rapport avec le produit ou la livraison'], ['autre', 'Autre raison']];
const stars = (n: number) => `${'★'.repeat(n)}${'☆'.repeat(5 - n)}`;

/** Avis des clients (v2) : la note, sa répartition, et chaque avis ; un avis abusif se signale, l'équipe Hailand décide. */
export default function SellerReviewsPage() {
  return <SellerGate title="Avis des clients">{({ shop }) => <Reviews shopId={shop.id} />}</SellerGate>;
}

function Reviews({ shopId }: { shopId: string }) {
  const [list, setList] = useState<Review[] | null>(null);
  const [reporting, setReporting] = useState<string | null>(null);
  const [reason, setReason] = useState('faux');
  const [details, setDetails] = useState('');
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const load = useCallback(async () => {
    const sb = browserClient(); if (!sb) return;
    const { data } = await sb.from('reviews').select('id,rating,comment,created_at,hidden,review_reports(status,reason),parcels(order_items(name_snapshot))').eq('shop_id', shopId).order('created_at', { ascending: false }).limit(200);
    setList((data as unknown as Review[]) ?? []);
  }, [shopId]);
  useEffect(() => { void load(); }, [load]);

  async function send(id: string) {
    const { error } = await browserClient()!.rpc('fn_report_review', { p_review: id, p_reason: reason, p_details: details || null });
    setMsg(error ? { tone: 'err', text: errText(error) } : { tone: 'ok', text: 'Signalement envoyé : l’équipe Hailand l’examine.' });
    setReporting(null); setDetails(''); await load();
  }

  const shown = (list ?? []).filter((r) => !r.hidden);
  const avg = shown.length ? shown.reduce((n, r) => n + r.rating, 0) / shown.length : 0;
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, count: shown.filter((r) => r.rating === n).length }));
  const top = Math.max(1, ...dist.map((d) => d.count));

  return (
    <Screen>
      <BackHeader href="/vendeur" title="Avis des clients" label="Retour à Ma boutique" />
      <section className="flex items-center gap-[18px] rounded-[22px] border border-line-soft bg-card p-4">
        <span className="flex min-w-[84px] flex-col items-center gap-0.5">
          <span className="font-display text-[34px] font-semibold">{shown.length ? avg.toFixed(1).replace('.', ',') : '—'}</span>
          <span className="text-[13px] tracking-[1px] text-[#c48a00]" aria-label={`${avg.toFixed(1)} sur 5`}>{stars(Math.round(avg))}</span>
          <span className="text-[11.5px] font-bold text-muted">{shown.length} avis</span>
        </span>
        <span className="flex flex-1 flex-col gap-[5px]">
          {dist.map((d) => (
            <span key={d.n} className="grid grid-cols-[14px_1fr_22px] items-center gap-2 text-[11.5px] font-bold text-muted">
              <span>{d.n}</span><span className="block h-[7px] overflow-hidden rounded-full bg-[#efece4]"><span className="block h-full rounded-full bg-ink" style={{ width: `${(d.count / top) * 100}%` }} /></span><span className="text-right">{d.count}</span>
            </span>
          ))}
        </span>
      </section>
      <Notice msg={msg} />
      {list?.length === 0 && <p className="rounded-[20px] border border-dashed border-line px-4 py-6 text-center text-[13.5px] font-semibold text-muted">Aucun avis pour l’instant. Vos clients notent après la remise du colis.</p>}
      {list?.map((r) => {
        const rep = r.review_reports?.[0];
        const product = r.parcels?.order_items?.[0]?.name_snapshot;
        return (
          <article key={r.id} className={`flex flex-col gap-2 rounded-[20px] border border-line-soft bg-card px-4 py-3.5 ${r.hidden ? 'opacity-60' : ''}`}>
            <div className="flex items-center justify-between gap-2.5"><span className="text-[13px] tracking-[1px] text-[#c48a00]">{stars(r.rating)}</span><span className="text-[11.5px] font-bold text-muted">{ago(r.created_at)}</span></div>
            {r.comment && <p className="text-[14px] font-semibold leading-snug">{r.comment}</p>}
            {product && <span className="text-[11.5px] font-bold text-muted">{product}</span>}
            {r.hidden && <span className="self-start rounded-full bg-sand px-2.5 py-1 text-[12px] font-extrabold">Masqué par l’équipe Hailand</span>}
            {rep && !r.hidden && <span className="self-start rounded-full bg-amber-soft px-2.5 py-1 text-[12px] font-extrabold text-[#6b5317]">{rep.status === 'ouvert' ? 'Signalé · l’équipe Hailand vérifie' : 'Signalement examiné : avis maintenu'}</span>}
            {!rep && !r.hidden && reporting !== r.id && <button type="button" onClick={() => setReporting(r.id)} className="h-9 self-start text-[12.5px] font-extrabold text-muted underline">Signaler un avis abusif</button>}
            {reporting === r.id && (
              <div className="flex flex-col gap-2 rounded-2xl bg-bg p-3">
                <select value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Raison" className="h-11 rounded-xl border border-line bg-card px-3 text-[15px]">{REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                <textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={500} rows={2} placeholder="Précisions (facultatif)" className="rounded-xl border border-line bg-card px-3 py-2 text-[15px]" />
                <div className="flex gap-2"><button type="button" onClick={() => send(r.id)} className="h-11 flex-1 rounded-xl bg-ink text-[13.5px] font-extrabold text-white">Envoyer</button><button type="button" onClick={() => setReporting(null)} className="h-11 rounded-xl border border-line bg-card px-4 text-[13.5px] font-bold">Annuler</button></div>
              </div>
            )}
          </article>
        );
      })}
    </Screen>
  );
}
