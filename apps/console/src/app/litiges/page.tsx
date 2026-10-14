'use client';
import { useCallback, useEffect, useState } from 'react';
import { ago, formatGnf } from '@hailandx/commerce';
import { DisputeThread, ProofPhoto } from '@hailandx/kit';
import { btn, Flash, PageHead, Panel, useAction, useConsole } from '@/components/ConsoleShell';

interface Dispute { id: string; parcel_id: string; reason: string; details: string | null; created_at: string; parcels: { subtotal_gnf: number; delivery_fee_gnf: number; shops: { name: string } | null } | null }
interface Report { id: string; reason: string; details: string | null; created_at: string; reviews: { rating: number; comment: string | null } | null; shops: { name: string } | null }
const REASON: Record<string, string> = { non_recu: 'Colis non reçu', endommage: 'Produit abîmé', different: 'Produit différent', autre: 'Autre problème' };
const REVIEW_REASON: Record<string, string> = { faux: 'Avis sans commande', injurieux: 'Propos injurieux', hors_sujet: 'Hors sujet', autre: 'Autre' };

/** Litiges (acheteur ↔ vendeur ↔ livreur) et avis signalés par les vendeurs. */
export default function DisputesPage() {
  const { sb } = useConsole();
  const { busy, msg, run } = useAction();
  const [disputes, setDisputes] = useState<Dispute[] | null>(null);
  const [reports, setReports] = useState<Report[] | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [d, r] = await Promise.all([
      sb.from('disputes').select('id,parcel_id,reason,details,created_at,parcels(subtotal_gnf,delivery_fee_gnf,shops(name))').eq('status', 'ouvert').order('created_at'),
      sb.from('review_reports').select('id,reason,details,created_at,reviews(rating,comment),shops(name)').eq('status', 'ouvert').order('created_at'),
    ]);
    setDisputes((d.data as unknown as Dispute[]) ?? []); setReports((r.data as unknown as Report[]) ?? []);
  }, [sb]);
  useEffect(() => { void load(); }, [load]);
  const note = (id: string) => notes[id]?.trim() || null;
  const after = async () => { setConfirm(null); await load(); };

  const resolve = (d: Dispute, side: 'acheteur' | 'vendeur') => run(
    sb.rpc('fn_resolve_dispute', { p_dispute: d.id, p_in_favor_of: side, p_note: note(d.id) }),
    side === 'acheteur' ? 'Tranché en faveur de l’acheteur : colis annulé, remboursement à effectuer (page Argent).' : 'Tranché en faveur du vendeur : livraison confirmée.', after);
  const moderate = (r: Report, hide: boolean) => run(
    sb.rpc('fn_moderate_review', { p_report: r.id, p_hide: hide, p_note: note(r.id) }), hide ? 'Avis masqué : il ne compte plus dans l’indice de confiance.' : 'Avis maintenu.', after);

  return (
    <>
      <PageHead title="Litiges et avis" />
      <Flash msg={msg} />
      <h2 className="font-display text-[18px] font-semibold">Litiges ouverts{disputes ? ` · ${disputes.length}` : ''}</h2>
      {disputes?.length === 0 && <p className="rounded-[22px] border border-line-soft bg-card px-5 py-5 text-[14px] font-semibold text-muted">Aucun litige ouvert.</p>}
      {disputes?.map((d) => (
        <Panel key={d.id} label={`Litige : ${REASON[d.reason] ?? d.reason}`} className="grid gap-4 p-5 xl:grid-cols-[1fr_380px]">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-display text-[18px] font-semibold">{REASON[d.reason] ?? d.reason}</span>
              <span className="rounded-full bg-sand px-2.5 py-1 text-[12px] font-extrabold">{d.parcels?.shops?.name ?? 'Boutique'}</span>
            </div>
            <p className="text-[12.5px] font-bold text-muted">Ouvert {ago(d.created_at)}{d.parcels ? ` · articles ${formatGnf(d.parcels.subtotal_gnf)} + livraison ${formatGnf(d.parcels.delivery_fee_gnf)}` : ''}</p>
            {d.details && <p className="rounded-[14px] bg-[#faf9f5] px-3.5 py-3 text-[13.5px] font-semibold">L’acheteur : « {d.details} »</p>}
            <ProofPhoto parcelId={d.parcel_id} />
            <label className="flex flex-col gap-1.5 text-[13px] font-extrabold">Note de décision (facultative, gardée au journal ; pour l’expliquer aux parties, écrivez-leur dans les échanges)
              <textarea rows={2} maxLength={500} value={notes[d.id] ?? ''} onChange={(e) => setNotes((x) => ({ ...x, [d.id]: e.target.value }))} className="rounded-[14px] border border-line px-3 py-2.5 text-[14px] font-semibold outline-none focus:border-blue" />
            </label>
            {confirm === d.id ? (
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy} onClick={() => resolve(d, 'acheteur')} className={btn.dark}>Confirmer : pour l’acheteur (colis annulé)</button>
                <button type="button" disabled={busy} onClick={() => resolve(d, 'vendeur')} className={btn.line}>Confirmer : pour le vendeur (livré)</button>
                <button type="button" onClick={() => setConfirm(null)} className={btn.line}>Annuler</button>
              </div>
            ) : <button type="button" onClick={() => setConfirm(d.id)} className={`${btn.dark} self-start`}>Trancher le litige</button>}
          </div>
          <DisputeThread disputeId={d.id} mine="equipe" />
        </Panel>
      ))}

      <h2 className="mt-2 font-display text-[18px] font-semibold">Avis signalés{reports ? ` · ${reports.length}` : ''}</h2>
      {reports?.length === 0 && <p className="rounded-[22px] border border-line-soft bg-card px-5 py-5 text-[14px] font-semibold text-muted">Aucun avis à examiner.</p>}
      {reports && reports.length > 0 && (
        <Panel label="Avis signalés" className="overflow-hidden">
          <ul>
            {reports.map((r, i) => (
              <li key={r.id} className={`flex flex-col gap-2 px-[18px] py-3.5 ${i ? 'border-t border-[#f0ede6]' : ''}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[14.5px] font-extrabold"><span aria-label={`${r.reviews?.rating ?? 0} étoiles sur 5`}>{'★'.repeat(r.reviews?.rating ?? 0)}</span> · {REVIEW_REASON[r.reason] ?? r.reason}</span>
                  <span className="text-[12.5px] font-bold text-muted">{r.shops?.name ?? 'Boutique'} · signalé {ago(r.created_at)}</span>
                </div>
                {r.reviews?.comment && <p className="text-[13.5px] font-semibold">Avis : « {r.reviews.comment} »</p>}
                {r.details && <p className="text-[13px] font-semibold text-muted">Le vendeur : « {r.details} »</p>}
                <div className="flex flex-wrap items-center gap-2">
                  <input value={notes[r.id] ?? ''} onChange={(e) => setNotes((x) => ({ ...x, [r.id]: e.target.value }))} placeholder="Note (facultative)" aria-label="Note de modération" maxLength={300} className="h-9 min-w-[180px] flex-1 rounded-[11px] border border-line px-3 text-[14px] font-semibold" />
                  <button type="button" disabled={busy} onClick={() => moderate(r, true)} className={`${btn.small} bg-ink text-white`}>Masquer l’avis</button>
                  <button type="button" disabled={busy} onClick={() => moderate(r, false)} className={btn.small}>Maintenir</button>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}
