'use client';
import { useCallback, useEffect, useState } from 'react';
import { formatGnf, payoutMethodLabel } from '@hailandx/commerce';
import { btn, Flash, PageHead, Panel, useAction, useConsole } from '@/components/ConsoleShell';
import { phoneText } from '@/lib/format';

interface Due { kind: 'boutique' | 'livreur'; target_id: string; name: string; phone: string | null; balance_gnf: number; payable_gnf: number; method: string | null; account_number: string | null; holder_name: string | null; usable_from: string | null }
interface Withdraw { id: string; kind: 'boutique' | 'livreur'; target_id: string; name: string; amount_gnf: number; payable_gnf: number; method: string; account_number: string; holder_name: string; created_at: string }
interface Refund { buyer_id: string; amount_gnf: number; buyer_phone: string | null }
interface Totals { platform: number; escrow: number; courier: number; cash: number }

/**
 * Argent : demandes de retrait des vendeurs (§62 : à envoyer depuis le compte Chap Chap Pay de Hailand, puis « Envoyé »), versements de la semaine aux boutiques et aux livreurs (§48 : disponible 48 h après la remise, sur le moyen de
 * versement de chacun, frais payés par Hailand), remboursements aux acheteurs, soldes globaux. Chaque versement est journalisé.
 */
export default function MoneyPage() {
  const { sb } = useConsole();
  const { busy, msg, run } = useAction();
  const [owed, setOwed] = useState<Due[] | null>(null);
  const [ref, setRef] = useState('');
  const [refunds, setRefunds] = useState<Refund[] | null>(null);
  const [withdraws, setWithdraws] = useState<Withdraw[] | null>(null);
  const [reason, setReason] = useState('');
  const [totals, setTotals] = useState<Totals | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [led, payouts, due, wd] = await Promise.all([
      sb.from('ledger_entries').select('account,account_id,amount_gnf').limit(20000),
      sb.rpc('fn_payouts_due'),
      sb.rpc('fn_refunds_due'),
      sb.rpc('fn_withdraw_requests'),
    ]);
    setWithdraws((wd.data as Withdraw[]) ?? []);
    const t: Totals = { platform: 0, escrow: 0, courier: 0, cash: 0 };
    for (const r of (led.data as { account: string; account_id: string | null; amount_gnf: number }[]) ?? []) {
      if (r.account === 'platform') t.platform += r.amount_gnf;
      if (r.account === 'escrow') t.escrow += r.amount_gnf;
      if (r.account === 'courier') t.courier += r.amount_gnf;
      if (r.account === 'courier_cash') t.cash += r.amount_gnf;
    }
    setOwed((payouts.data as Due[]) ?? []);
    setRefunds((due.data as Refund[]) ?? []);
    setTotals(t);
  }, [sb]);
  useEffect(() => { void load(); }, [load]);
  const after = async () => { setConfirm(null); setRef(''); setReason(''); await load(); };
  const when = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  const owedTotal = (owed ?? []).reduce((n, o) => n + o.balance_gnf, 0);
  const readyTotal = (owed ?? []).reduce((n, o) => n + o.payable_gnf, 0);
  const refundTotal = (refunds ?? []).reduce((n, r) => n + r.amount_gnf, 0);

  return (
    <>
      <PageHead title="Argent" sub="Grand livre Hailand" />
      <section aria-label="Soldes" className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <Tile label="Commission Hailand (cumul)" value={totals ? formatGnf(totals.platform) : '…'} />
        <Tile label="En séquestre" value={totals ? formatGnf(totals.escrow) : '…'} sub="Payé, pas encore livré" />
        <Tile label="Espèces chez les livreurs" value={totals ? formatGnf(totals.cash) : '…'} sub="Encaissées, pas encore reversées" />
        <Tile label="À verser (boutiques, livreurs)" value={owed ? formatGnf(owedTotal) : '…'} sub={owed ? `dont ${formatGnf(readyTotal)} disponibles` : ''} />
        <Tile label="À rembourser" value={refunds ? formatGnf(refundTotal) : '…'} sub={refunds ? `${refunds.length} acheteur${refunds.length > 1 ? 's' : ''}` : ''} />
      </section>
      <Flash msg={msg} />
      {/* §62 : les vendeurs retirent quand ils veulent (dès 10 000 GNF). L'équipe envoie l'argent, puis marque « Envoyé ». */}
      <Panel title={`Demandes de retrait${withdraws && withdraws.length ? ` · ${withdraws.length}` : ''}`} className="overflow-hidden">
        {withdraws?.length === 0 && <p className="border-t border-[#f0ede6] px-[18px] py-4 text-[14px] font-semibold text-muted">Aucune demande en attente.</p>}
        <ul>
          {withdraws?.map((w) => {
            const key = `w${w.id}`;
            const trop = w.amount_gnf > w.payable_gnf;
            return (
              <li key={w.id} className="flex flex-col gap-2 border-t border-[#f0ede6] px-[18px] py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[14.5px] font-extrabold">{formatGnf(w.amount_gnf)} · {w.name} <span className="text-[11.5px] font-bold text-muted">· {w.kind}</span></span>
                    <span className="text-[12.5px] font-semibold text-muted">{payoutMethodLabel(w.method)} {w.method === 'banque' ? w.account_number : phoneText(w.account_number)} · {w.holder_name} · demandé le {when(w.created_at)}</span>
                    {trop && <span className="text-[12px] font-bold text-[#a3321f]">Le disponible n’est plus que de {formatGnf(w.payable_gnf)} (litige ou versement entre-temps) : refusez la demande.</span>}
                  </span>
                  {confirm !== key && confirm !== `x${w.id}` && (
                    <span className="flex gap-2">
                      {!trop && <button type="button" onClick={() => { setConfirm(key); setRef(''); }} className={`${btn.small} bg-ink text-white`}>Envoyé</button>}
                      <button type="button" onClick={() => { setConfirm(`x${w.id}`); setReason(''); }} className={btn.small}>Refuser</button>
                    </span>
                  )}
                </div>
                {confirm === key && (
                  <div className="flex flex-wrap items-center gap-2">
                    <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Référence de l’envoi Chap Chap Pay / Orange Money (facultatif)" aria-label="Référence de l’envoi" className="h-10 min-w-0 flex-1 rounded-[10px] border border-line px-3 text-[13px] font-semibold outline-none focus:border-blue" />
                    <button type="button" disabled={busy} onClick={() => run(sb.rpc('fn_withdraw_done', { p_request: w.id, p_ref: ref }), `Retrait de ${formatGnf(w.amount_gnf)} pour « ${w.name} » marqué envoyé.`, after)} className={`${btn.small} bg-ink text-white`}>Confirmer l’envoi de {formatGnf(w.amount_gnf)}</button>
                    <button type="button" onClick={() => setConfirm(null)} className={btn.small}>Annuler</button>
                  </div>
                )}
                {confirm === `x${w.id}` && (
                  <div className="flex flex-wrap items-center gap-2">
                    <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motif (montré au vendeur)" aria-label="Motif du refus" className="h-10 min-w-0 flex-1 rounded-[10px] border border-line px-3 text-[13px] font-semibold outline-none focus:border-blue" />
                    <button type="button" disabled={busy || reason.trim().length < 3} onClick={() => run(sb.rpc('fn_withdraw_refuse', { p_request: w.id, p_reason: reason }), 'Demande refusée ; le vendeur est prévenu.', after)} className={`${btn.small} bg-[#a3321f] text-white`}>Refuser la demande</button>
                    <button type="button" onClick={() => setConfirm(null)} className={btn.small}>Annuler</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Panel>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Versements de la semaine" className="overflow-hidden">
          {owed?.length === 0 && <p className="border-t border-[#f0ede6] px-[18px] py-4 text-[14px] font-semibold text-muted">Rien à verser.</p>}
          <ul>
            {owed?.map((o) => {
              const key = `${o.kind}${o.target_id}`;
              const later = o.usable_from && new Date(o.usable_from).getTime() > Date.now();
              const blocked = !o.method ? 'pas de moyen de versement' : later ? `moyen modifié : utilisable le ${new Date(o.usable_from!).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : o.payable_gnf <= 0 ? 'rien de disponible (48 h)' : null;
              return (
                <li key={key} className="flex flex-col gap-2 border-t border-[#f0ede6] px-[18px] py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[14.5px] font-extrabold">{o.name} <span className="text-[11.5px] font-bold text-muted">· {o.kind}</span></span>
                      <span className="text-[12.5px] font-semibold text-muted">{formatGnf(o.payable_gnf)} disponibles sur {formatGnf(o.balance_gnf)}{o.method ? ` · ${payoutMethodLabel(o.method)} ${o.method === 'banque' ? o.account_number : phoneText(o.account_number ?? '')} · ${o.holder_name}` : ''}</span>
                    </span>
                    {blocked ? <span className="rounded-full bg-amber-soft px-2.5 py-1 text-[11.5px] font-extrabold text-[#7a5500]">{blocked}</span>
                      : confirm !== key && <button type="button" onClick={() => { setConfirm(key); setRef(''); }} className={btn.small}>Versé</button>}
                  </div>
                  {confirm === key && (
                    <div className="flex flex-wrap items-center gap-2">
                      <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Référence de l’envoi (facultatif)" aria-label="Référence de l’envoi" className="h-10 min-w-0 flex-1 rounded-[10px] border border-line px-3 text-[13px] font-semibold outline-none focus:border-blue" />
                      <button type="button" disabled={busy} onClick={() => run(sb.rpc('fn_payout_record', { p_kind: o.kind, p_target: o.target_id, p_amount: o.payable_gnf, p_ref: ref }), `Versement de ${formatGnf(o.payable_gnf)} à « ${o.name} » enregistré.`, after)} className={`${btn.small} bg-ink text-white`}>Confirmer {formatGnf(o.payable_gnf)}</button>
                      <button type="button" onClick={() => setConfirm(null)} className={btn.small}>Annuler</button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Panel>
        <Panel title="Remboursements à effectuer" className="overflow-hidden">
          {refunds?.length === 0 && <p className="border-t border-[#f0ede6] px-[18px] py-4 text-[14px] font-semibold text-muted">Aucun remboursement en attente.</p>}
          <ul>
            {refunds?.map((r) => (
              <li key={r.buyer_id} className="flex flex-wrap items-center gap-3 border-t border-[#f0ede6] px-[18px] py-3">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[14.5px] font-extrabold">{r.buyer_phone ? <a href={`tel:+${r.buyer_phone.replace(/\D/g, '')}`} className="hover:text-blue">{phoneText(r.buyer_phone)}</a> : 'Acheteur'}</span>
                  <span className="text-[12.5px] font-semibold text-muted">{formatGnf(r.amount_gnf)}</span>
                </span>
                {confirm === `r${r.buyer_id}` ? (
                  <span className="flex gap-2">
                    <button type="button" disabled={busy} onClick={() => run(sb.rpc('fn_refund_paid', { p_buyer: r.buyer_id, p_amount: r.amount_gnf }), `Remboursement de ${formatGnf(r.amount_gnf)} enregistré.`, after)} className={`${btn.small} bg-ink text-white`}>Confirmer le remboursement</button>
                    <button type="button" onClick={() => setConfirm(null)} className={btn.small}>Annuler</button>
                  </span>
                ) : <button type="button" onClick={() => setConfirm(`r${r.buyer_id}`)} className={btn.small}>Remboursé</button>}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      <p className="text-[12.5px] font-semibold text-muted">« Envoyé », « Versé » et « Remboursé » enregistrent un envoi déjà fait (Orange Money, MTN, Kulu… frais à la charge de Hailand) : la console ne déplace pas d’argent elle-même. Rappel automatique chaque lundi matin.</p>
    </>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-[20px] border border-line-soft bg-card px-[18px] py-4">
      <span className="text-[12.5px] font-bold text-muted">{label}</span>
      <span className="font-display text-[20px] font-semibold lg:text-[22px]">{value}</span>
      {sub && <span className="text-[12px] font-bold text-muted">{sub}</span>}
    </div>
  );
}
