'use client';
import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { formatGnf, maskAccount, payoutMethodLabel } from '@hailandx/commerce';
import { browserClient, Icon } from '@hailandx/kit';

export interface Balance {
  balance_gnf: number; payable_gnf: number; waiting_gnf: number; pending_gnf: number; withdrawable_gnf: number;
  next_release_at: string | null; next_release_gnf: number | null; min_gnf: number;
  method: string | null; account_number: string | null; holder_name: string | null; usable_from: string | null;
}
interface Request { id: string; amount_gnf: number; status: 'demande' | 'envoye' | 'refuse' | 'annule'; reason: string | null; method: string; account_number: string; created_at: string }

export const quand = (iso: string) => {
  const d = new Date(iso); const today = new Date();
  const demain = new Date(today); demain.setDate(today.getDate() + 1);
  const h = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === today.toDateString()) return `aujourd’hui à ${h}`;
  if (d.toDateString() === demain.toDateString()) return `demain à ${h}`;
  return `le ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} à ${h}`;
};
const chiffres = (s: string) => Number(s.replace(/\D/g, '')) || 0;

/**
 * Solde et retraits du vendeur (§62). Une seule logique (`useRetrait`) et deux présentations :
 * - `SoldeAccueil` : la carte de l'accueil, au dessin de la carte HailandPay, qui porte aussi les ventes (une seule carte) ;
 * - `SoldeArgent` : la page Argent, présentée comme un réglage (lignes claires, grand bouton « Retirer »).
 * Étape 1 : un retrait crée une demande que l'équipe envoie depuis le compte Chap Chap Pay de Hailand ; les frais ne sont pas évoqués.
 */
export function useRetrait(shopId: string, onChange?: () => void) {
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
  const ouvrir = () => { setSheet(true); setMsg(null); setMontant(b ? String(b.withdrawable_gnf) : ''); };

  const peut = Boolean(b && b.method && !(b.usable_from && new Date(b.usable_from).getTime() > Date.now()) && !open && b.withdrawable_gnf >= b.min_gnf);
  const pourquoi = !b ? null
    : !b.method ? 'Indiquez d’abord où recevoir votre argent.'
    : b.usable_from && new Date(b.usable_from).getTime() > Date.now() ? `Nouveau compte de réception : retrait possible ${quand(b.usable_from)}.`
    : open ? null
    : b.withdrawable_gnf < b.min_gnf ? `Retrait possible dès ${formatGnf(b.min_gnf)} disponibles.` : null;
  return { b, open, last, sheet, setSheet, montant, setMontant, busy, msg, setMsg, retirer, annuler, ouvrir, peut, pourquoi };
}
type Retrait = ReturnType<typeof useRetrait>;

/** Messages (demande envoyée, refus récent) et fenêtre « Retirer de l'argent », communs aux deux présentations. */
function Suite({ r }: { r: Retrait }) {
  const { b, sheet, setSheet, montant, setMontant, busy, msg, setMsg, retirer, last } = r;
  return (
    <>
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

/**
 * Carte de l'accueil (§62, dessin de la carte HailandPay) : le solde en haut (pastille « SOLDE », GNF en vert lime, disponible,
 * en attente, « Retirer »), puis les ventes en bas (`children`) — une seule carte, pas deux.
 */
export function SoldeAccueil({ shopId, nom, children }: { shopId: string; nom: string; children?: ReactNode }) {
  const r = useRetrait(shopId);
  const { b, open, busy, annuler, ouvrir, peut, pourquoi } = r;
  return (
    <>
      <section aria-label="Solde et ventes" className="relative flex flex-col gap-3 overflow-hidden rounded-[26px] bg-ink p-[18px] text-white">
        <span aria-hidden="true" className="absolute -right-10 -top-10 h-[170px] w-[170px] rounded-full bg-[radial-gradient(circle,rgba(200,242,90,.22),rgba(200,242,90,0)_70%)]" />
        <span className="relative flex items-center justify-between gap-3">
          {/* Marque comme « HailandPay » ; le nom de la boutique est déjà dans l'en-tête de l'accueil. */}
          <span aria-label={`Argent de ${nom}`} className="font-display text-[17px] font-semibold tracking-tight">Hailand<span className="text-lime">X</span></span>
          <span className="shrink-0 rounded-full bg-lime/15 px-2.5 py-1 text-[11px] font-extrabold tracking-[0.04em] text-lime">SOLDE</span>
        </span>
        <span className="relative font-display text-[32px] font-semibold leading-tight tracking-tight">{b ? formatGnf(b.balance_gnf, false) : '…'} <span className="text-[16px] text-lime">GNF</span></span>
        <span className="relative flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] font-bold">
          <span className="flex items-center gap-1.5"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-lime" /><span className="text-white/60">Disponible</span> {b ? formatGnf(b.withdrawable_gnf, false) : '…'}</span>
          <span className="flex items-center gap-1.5"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-white/40" /><span className="text-white/60">En attente</span> {b ? formatGnf(b.waiting_gnf, false) : '…'}</span>
        </span>
        {open ? (
          <span className="relative flex items-center gap-3 rounded-[16px] bg-lime/10 px-3 py-2.5">
            <span className="flex min-w-0 flex-1 flex-col"><span className="text-[13.5px] font-extrabold text-lime">Retrait de {formatGnf(open.amount_gnf)} en cours</span><span className="truncate text-[12px] font-semibold text-white/65">Vers {payoutMethodLabel(open.method)} {maskAccount(open.method, open.account_number)}</span></span>
            <button type="button" disabled={busy} onClick={annuler} className="h-9 shrink-0 px-1 text-[12.5px] font-bold text-white/70 underline underline-offset-4">Annuler</button>
          </span>
        ) : peut ? (
          <button type="button" onClick={ouvrir} className="relative flex h-11 items-center justify-center rounded-2xl bg-lime text-[14.5px] font-extrabold text-ink">Retirer</button>
        ) : (
          <Link href="/argent" className="relative text-[12px] font-semibold leading-snug text-white/60">{pourquoi ?? (b?.next_release_at && b.next_release_gnf ? `+ ${formatGnf(b.next_release_gnf)} disponibles ${quand(b.next_release_at)}` : '')}</Link>
        )}
        {children && <div className="relative flex flex-col gap-3 border-t border-white/10 pt-3.5">{children}</div>}
      </section>
      <Suite r={r} />
    </>
  );
}

/**
 * Page Argent (§62) : présentée comme un réglage — l'essentiel en lignes claires, et le bouton « Retirer » en grand, comme action
 * principale de la page. La carte noire est réservée à l'accueil.
 */
export function SoldeArgent({ shopId, onChange }: { shopId: string; onChange?: () => void }) {
  const r = useRetrait(shopId, onChange);
  const { b, open, busy, annuler, ouvrir, peut, pourquoi } = r;
  const ligne = (label: ReactNode, valeur: ReactNode, sub?: ReactNode, last = false) => (
    <div className={`flex items-center justify-between gap-3 px-4 py-3 ${last ? '' : 'border-b border-line-soft'}`}>
      <span className="flex min-w-0 flex-col"><span className="text-[14px] font-bold">{label}</span>{sub && <span className="text-[12px] font-semibold text-muted">{sub}</span>}</span>
      <span className="shrink-0 font-display text-[16px] font-semibold">{valeur}</span>
    </div>
  );
  return (
    <>
      <section aria-label="Solde" className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5 px-1">
          <span className="text-[13px] font-bold text-muted">Solde</span>
          <span className="font-display text-[34px] font-semibold leading-tight tracking-tight">{b ? formatGnf(b.balance_gnf, false) : '…'} <span className="text-[16px] text-muted">GNF</span></span>
        </div>
        <div className="overflow-hidden rounded-[20px] border border-line-soft bg-card">
          {ligne(<span className="flex items-center gap-2"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-ok" />Disponible</span>, b ? formatGnf(b.withdrawable_gnf) : '…', 'Retirable maintenant')}
          {ligne(<span className="flex items-center gap-2"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-[#c9c4b6]" />En attente</span>, b ? formatGnf(b.waiting_gnf) : '…',
            b?.next_release_at && b.next_release_gnf ? `+ ${formatGnf(b.next_release_gnf)} ${quand(b.next_release_at)}` : '48 h après la remise de chaque colis', !open)}
          {open && ligne(<span className="text-ok">Retrait en cours</span>, formatGnf(open.amount_gnf), <>Vers {payoutMethodLabel(open.method)} {maskAccount(open.method, open.account_number)} · {quand(open.created_at)} · <button type="button" disabled={busy} onClick={annuler} className="font-bold text-blue-ink underline">Annuler</button></>, true)}
        </div>
        {!open && <button type="button" disabled={!peut} onClick={ouvrir} className="flex h-[54px] items-center justify-center gap-2 rounded-2xl bg-ink text-[15.5px] font-extrabold text-white disabled:opacity-40"><Icon name="wallet" size={19} stroke={2} />Retirer</button>}
        {pourquoi && <p className="px-1 text-[12.5px] font-semibold leading-snug text-muted">{pourquoi}</p>}
      </section>
      <Suite r={r} />
    </>
  );
}
