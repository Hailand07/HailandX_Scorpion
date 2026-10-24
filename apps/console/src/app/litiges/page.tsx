'use client';
import { useCallback, useEffect, useState } from 'react';
import { ago, formatGnf } from '@hailandx/commerce';
import { DisputeThread, ProofPhoto } from '@hailandx/kit';
import { btn, Flash, PageHead, Panel, useAction, useConsole } from '@/components/ConsoleShell';

interface Dispute { id: string; parcel_id: string; reason: string; details: string | null; created_at: string; parcels: { subtotal_gnf: number; delivery_fee_gnf: number; shops: { name: string } | null } | null }
interface Report { id: string; reason: string; details: string | null; created_at: string; reviews: { rating: number; comment: string | null } | null; shops: { name: string } | null }
interface Question { id: string; question: string; answer: string | null; hidden: boolean; created_at: string; catalog_products: { name: string } | null; shops: { name: string } | null }
const REASON: Record<string, string> = { non_recu: 'Colis non reçu', endommage: 'Produit abîmé', different: 'Produit différent', autre: 'Autre problème' };
const REVIEW_REASON: Record<string, string> = { faux: 'Avis sans commande', injurieux: 'Propos injurieux', hors_sujet: 'Hors sujet', autre: 'Autre' };

/** Litiges (acheteur ↔ vendeur ↔ livreur), avis signalés par les vendeurs, et questions publiques des fiches produit (HAILANDX.md §35). */
export default function DisputesPage() {
  const { sb } = useConsole();
  const { busy, msg, run } = useAction();
  const [disputes, setDisputes] = useState<Dispute[] | null>(null);
  const [reports, setReports] = useState<Report[] | null>(null);
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  // Remboursement partiel (A7) : montant des articles rendu à l'acheteur ; vide = tout le colis.
  const [refunds, setRefunds] = useState<Record<string, string>>({});
  const refundOf = (id: string) => { const n = Number((refunds[id] ?? '').replace(/\D/g, '')); return n > 0 ? n : null; };
  const [confirm, setConfirm] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [d, r, qs] = await Promise.all([
      sb.from('disputes').select('id,parcel_id,reason,details,created_at,parcels(subtotal_gnf,delivery_fee_gnf,shops(name))').eq('status', 'ouvert').order('created_at'),
      sb.from('review_reports').select('id,reason,details,created_at,reviews(rating,comment),shops(name)').eq('status', 'ouvert').order('created_at'),
      sb.from('product_questions').select('id,question,answer,hidden,created_at,catalog_products(name),shops:answer_shop_id(name)').order('created_at', { ascending: false }).limit(50),
    ]);
    setQuestions((qs.data as unknown as Question[]) ?? []);
    setDisputes((d.data as unknown as Dispute[]) ?? []); setReports((r.data as unknown as Report[]) ?? []);
  }, [sb]);
  useEffect(() => { void load(); }, [load]);
  const note = (id: string) => notes[id]?.trim() || null;
  const after = async () => { setConfirm(null); await load(); };

  const resolve = (d: Dispute, side: 'acheteur' | 'vendeur') => {
    const partial = side === 'acheteur' && refundOf(d.id) !== null && refundOf(d.id)! < (d.parcels?.subtotal_gnf ?? Infinity);
    return run(
      sb.rpc('fn_resolve_dispute', { p_dispute: d.id, p_in_favor_of: side, p_note: note(d.id), p_refund_gnf: side === 'acheteur' ? refundOf(d.id) : null }),
      side === 'vendeur' ? 'Tranché en faveur du vendeur : livraison confirmée.'
        : partial ? `Tranché en faveur de l’acheteur : remboursement partiel de ${formatGnf(refundOf(d.id)!)} à effectuer (page Argent).`
        : 'Tranché en faveur de l’acheteur : colis annulé, remboursement à effectuer (page Argent).', after);
  };
  const moderate = (r: Report, hide: boolean) => run(
    sb.rpc('fn_moderate_review', { p_report: r.id, p_hide: hide, p_note: note(r.id) }), hide ? 'Avis masqué : il ne compte plus dans l’indice de confiance.' : 'Avis maintenu.', after);

  const moderateQuestion = (q: Question, hide: boolean) => run(
    sb.rpc('fn_moderate_question', { p_question: q.id, p_hide: hide, p_note: note(q.id) }), hide ? 'Question masquée : elle n’apparaît plus sur la fiche du produit.' : 'Question rétablie.', after);

  return (
    <>
      <PageHead title="Litiges, avis et questions" />
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
            <label className="flex flex-col gap-1.5 text-[13px] font-extrabold">Remboursement à l’acheteur (GNF, si décision en sa faveur)
              <input inputMode="numeric" value={refunds[d.id] ?? ''} onChange={(e) => setRefunds((x) => ({ ...x, [d.id]: e.target.value }))} placeholder={d.parcels ? `Vide = tout le colis (${formatGnf(d.parcels.subtotal_gnf)})` : 'Vide = tout le colis'} className="h-11 rounded-[14px] border border-line px-3 text-[14px] font-semibold outline-none focus:border-blue" />
              <span className="text-[12px] font-semibold text-muted">Un montant plus petit que les articles = remboursement partiel : le colis reste livré, la boutique rend cette somme (commission comprise).</span>
            </label>
            {confirm === d.id ? (
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy} onClick={() => resolve(d, 'acheteur')} className={btn.dark}>{refundOf(d.id) !== null && d.parcels && refundOf(d.id)! < d.parcels.subtotal_gnf ? `Confirmer : rembourser ${formatGnf(refundOf(d.id)!)} à l’acheteur` : 'Confirmer : pour l’acheteur (colis annulé)'}</button>
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

      <h2 className="mt-2 font-display text-[18px] font-semibold">Questions des acheteurs{questions ? ` · ${questions.length} dernières` : ''}</h2>
      <p className="text-[13px] font-semibold text-muted">Publiques sur les fiches produit. Masquez une question ou une réponse injurieuse, hors sujet ou qui contient un numéro de téléphone (l’action est inscrite au journal).</p>
      {questions?.length === 0 && <p className="rounded-[22px] border border-line-soft bg-card px-5 py-5 text-[14px] font-semibold text-muted">Aucune question pour l’instant.</p>}
      {questions && questions.length > 0 && (
        <Panel label="Questions des acheteurs" className="overflow-hidden">
          <ul>
            {questions.map((q, i) => (
              <li key={q.id} className={`flex flex-col gap-2 px-[18px] py-3.5 ${i ? 'border-t border-[#f0ede6]' : ''} ${q.hidden ? 'opacity-60' : ''}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[13px] font-extrabold">{q.catalog_products?.name ?? 'Produit'}</span>
                  <span className="text-[12.5px] font-bold text-muted">{q.hidden ? 'Masquée · ' : ''}{ago(q.created_at)}</span>
                </div>
                <p className="text-[13.5px] font-semibold">Q. {q.question}</p>
                {q.answer ? <p className="text-[13.5px] font-semibold text-muted">R. ({q.shops?.name ?? 'boutique'}) {q.answer}</p> : <p className="text-[12.5px] font-bold text-muted">Sans réponse</p>}
                <div className="flex flex-wrap items-center gap-2">
                  <input value={notes[q.id] ?? ''} onChange={(e) => setNotes((x) => ({ ...x, [q.id]: e.target.value }))} placeholder="Motif (facultatif)" aria-label="Motif de modération" maxLength={300} className="h-9 min-w-[180px] flex-1 rounded-[11px] border border-line px-3 text-[14px] font-semibold" />
                  {q.hidden
                    ? <button type="button" disabled={busy} onClick={() => moderateQuestion(q, false)} className={btn.small}>Rétablir</button>
                    : <button type="button" disabled={busy} onClick={() => moderateQuestion(q, true)} className={`${btn.small} bg-ink text-white`}>Masquer</button>}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}
