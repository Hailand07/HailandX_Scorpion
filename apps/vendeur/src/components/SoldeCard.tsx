'use client';
import { useCallback, useEffect, useState } from 'react';
import { formatGnf, maskAccount, payoutMethodLabel } from '@hailandx/commerce';
import { browserClient, Icon } from '@hailandx/kit';

export interface Balance {
  balance_gnf: number; payable_gnf: number; waiting_gnf: number; pending_gnf: number; withdrawable_gnf: number;
  next_release_at: string | null; next_release_gnf: number | null; min_gnf: number;
  method: string | null; account_number: string | null; holder_name: string | null; usable_from: string | null;
}
interface Request { id: string; amount_gnf: number; status: 'demande' | 'envoye' | 'refuse' | 'annule'; reason: string | null; method: string; account_number: string; created_at: string }

const quand = (iso: string) => {
  const d = new Date(iso); const today = new Date();
  const demain = new Date(today); demain.setDate(today.getDate() + 1);
  const h = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === today.toDateString()) return `aujourd’hui à ${h}`;
  if (d.toDateString() === demain.toDateString()) return `demain à ${h}`;
  return `le ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} à ${h}`;
};
const chiffres = (s: string) => Number(s.replace(/\D/g, '')) || 0;

/**
 * Solde du vendeur (§62) : tout ce qui lui revient, la part disponible (48 h après la remise, sans litige), la part en attente
 * avec sa date de déblocage, et le bouton « Retirer » (à partir de 10 000 GNF). Étape 1 : un retrait crée une demande que
 * l'équipe Hailand envoie depuis son compte Chap Chap Pay ; le vendeur est prévenu à l'envoi. Les frais ne sont pas évoqués au vendeur.
 */
export function SoldeCard({ shopId, nom, onChange }: { shopId: string; nom?: string; onChange?: () => void }) {
  const sb = browserClient();
  const [b, setB] = useState<Balance | null>(null);
  const [open, setOpen] = useState<Request | null>(null);
  const [last, setLast] = useState<Request | null>(null);
  const [sheet, setSheet] = useState(false);
  const [montant, setMontant] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    if (!sb) return;
    const [a, r] = await Promise.all([
      sb.rpc('fn_my_balance', { p_shop: shopId }),
      sb.from('payout_requests').select('id,amount_gnf,status,reason,method,account_number,created_at').eq('shop_id', shopId).order('created_at', { ascending: false }).limit(1),
    ]);
    setB(((a.data as Balance[] | null) ?? [])[0] ?? null);
    const req = ((r.data as Request[] | null) ?? [])[0] ?? null;
    setOpen(req?.status === 'demande' ? req : null);
    setLast(req && req.status === 'refuse' && Date.now() - new Date(req.created_at).getTime() < 7 * 864e5 ? req : null);
  }, [sb, shopId]);
  useEffect(() => { void load(); }, [load]);

  async function retirer() {
    if (!b) return;
    const n = chiffres(montant);
    setMsg(null);
    if (n < b.min_gnf) return setMsg({ ok: false, text: `Le retrait minimum est de ${formatGnf(b.min_gnf)}.` });
    if (n > b.withdrawable_gnf) return setMsg({ ok: false, text: `Vous pouvez retirer au plus ${formatGnf(b.withdrawable_gnf)}.` });
    setBusy(true);
    const { error } = await sb!.rpc('fn_withdraw_request', { p_shop: shopId, p_amount: n });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message.replace(/^.*?:\s*/, '') });
    setSheet(false); setMontant('');
    setMsg({ ok: true, text: `Demande de retrait de ${formatGnf(n)} envoyée. Vous serez prévenu dès que l’argent part sur votre compte.` });
    await load(); onChange?.();
  }
  async function annuler() {
    if (!open) return;
    setBusy(true);
    const { error } = await sb!.rpc('fn_withdraw_cancel', { p_request: open.id });
    setBusy(false);
    setMsg(error ? { ok: false, text: error.message.replace(/^.*?:\s*/, '') } : { ok: true, text: 'Demande de retrait annulée.' });
    await load(); onChange?.();
  }

  const peut = b && b.method && !(b.usable_from && new Date(b.usable_from).getTime() > Date.now()) && !open && b.withdrawable_gnf >= b.min_gnf;
  const pourquoi = !b ? null
    : !b.method ? 'Indiquez d’abord où recevoir votre argent (plus bas).'
    : b.usable_from && new Date(b.usable_from).getTime() > Date.now() ? `Nouveau compte de réception : retrait possible ${quand(b.usable_from)}.`
    : open ? null
    : b.withdrawable_gnf < b.min_gnf ? `Retrait possible dès ${formatGnf(b.min_gnf)} disponibles.` : null;

  return (
    <>
      {/* Même dessin que la carte HailandPay (§62, demande du fondateur) : fond noir, lueur verte, pastille « SOLDE » comme « TEST ». */}
      <section aria-label="Solde" className="relative flex flex-col gap-3.5 overflow-hidden rounded-[26px] bg-ink p-[18px] text-white">
        <span aria-hidden="true" className="absolute -right-10 -top-10 h-[170px] w-[170px] rounded-full bg-[radial-gradient(circle,rgba(200,242,90,.22),rgba(200,242,90,0)_70%)]" />
        <span className="relative flex items-center justify-between gap-3">
          <span className="truncate font-display text-[17px] font-semibold tracking-tight">{nom ?? 'Ma boutique'}</span>
          <span className="shrink-0 rounded-full bg-lime/15 px-2.5 py-1 text-[11px] font-extrabold tracking-[0.04em] text-lime">SOLDE</span>
        </span>
        <span className="relative font-display text-[32px] font-semibold leading-tight tracking-tight">{b ? formatGnf(b.balance_gnf, false) : '…'} <span className="text-[16px] text-lime">GNF</span></span>
        <span className="relative grid grid-cols-2 gap-2">
          <span className="flex flex-col gap-0.5 rounded-[16px] bg-white/[0.07] px-3 py-2.5">
            <span className="flex items-center gap-1.5 text-[11.5px] font-bold text-white/65"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-lime" />Disponible</span>
            <span className="font-display text-[17px] font-semibold">{b ? formatGnf(b.withdrawable_gnf, false) : '…'}</span>
          </span>
          <span className="flex flex-col gap-0.5 rounded-[16px] bg-white/[0.07] px-3 py-2.5">
            <span className="flex items-center gap-1.5 text-[11.5px] font-bold text-white/65"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-white/40" />En attente</span>
            <span className="font-display text-[17px] font-semibold">{b ? formatGnf(b.waiting_gnf, false) : '…'}</span>
          </span>
        </span>
        <span className="relative text-[12px] font-bold text-white/60">
          {b && b.next_release_at && b.next_release_gnf ? `+ ${formatGnf(b.next_release_gnf)} disponibles ${quand(b.next_release_at)}` : 'Chaque vente devient disponible 48 h après la remise du colis.'}
        </span>
        {open ? (
          <span className="relative flex items-center gap-3 rounded-[16px] bg-lime/10 px-3 py-2.5">
            <span className="flex min-w-0 flex-1 flex-col"><span className="text-[13.5px] font-extrabold text-lime">Retrait de {formatGnf(open.amount_gnf)} en cours</span><span className="truncate text-[12px] font-semibold text-white/65">Vers {payoutMethodLabel(open.method)} {maskAccount(open.method, open.account_number)} · {quand(open.created_at)}</span></span>
            <button type="button" disabled={busy} onClick={annuler} className="h-9 shrink-0 px-1 text-[12.5px] font-bold text-white/70 underline underline-offset-4">Annuler</button>
          </span>
        ) : (
          <button type="button" disabled={!peut} onClick={() => { setSheet(true); setMsg(null); setMontant(b ? String(b.withdrawable_gnf) : ''); }}
            className="relative flex h-12 items-center justify-center rounded-2xl bg-lime text-[15px] font-extrabold text-ink disabled:opacity-40">Retirer</button>
        )}
        {pourquoi && <span className="relative -mt-1.5 text-[12px] font-semibold leading-snug text-white/60">{pourquoi}</span>}
      </section>
      {last && <p role="status" className="rounded-2xl bg-[#fde8e4] px-4 py-3 text-[13px] font-semibold text-[#8a2a1c]">Retrait de {formatGnf(last.amount_gnf)} refusé : {last.reason}</p>}
      {msg && !sheet && <p role="status" className={`rounded-2xl px-4 py-3 text-[13px] font-semibold ${msg.ok ? 'bg-ok-soft text-ok' : 'bg-[#fde8e4] text-[#8a2a1c]'}`}>{msg.text}</p>}

      {sheet && b && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
          <button type="button" aria-label="Fermer" onClick={() => setSheet(false)} className="absolute inset-0 bg-black/45" />
          <div role="dialog" aria-modal="true" aria-label="Retirer de l’argent" className="relative flex w-full max-w-md flex-col gap-4 rounded-t-[26px] bg-card p-5 pb-[max(20px,env(safe-area-inset-bottom))] sm:rounded-[26px]">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-[20px] font-semibold tracking-tight">Retirer de l’argent</h2>
              <button type="button" onClick={() => setSheet(false)} aria-label="Fermer" className="-mr-1 flex h-9 w-9 items-center justify-center rounded-full text-[18px] font-bold text-muted">×</button>
            </div>
            <label className="flex flex-col gap-1.5 text-[13px] font-extrabold">Montant
              <span className="flex h-14 items-center gap-2 rounded-2xl border border-line px-4 focus-within:border-blue">
                <input value={montant ? Number(chiffres(montant)).toLocaleString('fr-FR') : ''} onChange={(e) => { setMsg(null); setMontant(e.target.value); }} inputMode="numeric" autoFocus aria-label="Montant à retirer" className="h-full min-w-0 flex-1 bg-transparent font-display text-[22px] font-semibold outline-none" />
                <span className="text-[14px] font-extrabold text-muted">GNF</span>
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setMontant(String(b.withdrawable_gnf))} className="h-9 rounded-full bg-ink px-3.5 text-[12.5px] font-extrabold text-white">Tout · {formatGnf(b.withdrawable_gnf)}</button>
              {b.withdrawable_gnf >= 2 * b.min_gnf && <button type="button" onClick={() => setMontant(String(Math.max(b.min_gnf, Math.round(b.withdrawable_gnf / 2 / 1000) * 1000)))} className="h-9 rounded-full border border-line px-3.5 text-[12.5px] font-extrabold">La moitié</button>}
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-bg px-3.5 py-3">
              <Icon name="wallet" size={20} />
              <span className="flex min-w-0 flex-col"><span className="text-[13.5px] font-extrabold">Vers {payoutMethodLabel(b.method ?? '')} {maskAccount(b.method ?? '', b.account_number)}</span><span className="truncate text-[12px] font-semibold text-muted">{b.holder_name}</span></span>
            </div>
            <p className="text-[12.5px] font-medium leading-snug text-muted">L’équipe Hailand envoie l’argent sur ce compte et vous prévient dès qu’il est parti. Minimum {formatGnf(b.min_gnf)}.</p>
            {msg && <p role="alert" className={`rounded-2xl px-4 py-3 text-[13px] font-semibold ${msg.ok ? 'bg-ok-soft text-ok' : 'bg-[#fde8e4] text-[#8a2a1c]'}`}>{msg.text}</p>}
            <button type="button" disabled={busy || chiffres(montant) < b.min_gnf} onClick={retirer} className="flex h-[54px] items-center justify-center rounded-2xl bg-ink text-[15px] font-extrabold text-white disabled:opacity-40">
              {busy ? 'Envoi de la demande…' : `Retirer ${formatGnf(chiffres(montant))}`}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
