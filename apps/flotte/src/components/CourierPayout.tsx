'use client';
import { useCallback, useEffect, useState } from 'react';
import { formatGnf, maskAccount, PAYOUT_METHODS, payoutMethodLabel } from '@hailandx/commerce';
import { browserClient } from '@/lib/supabase';

interface Summary { balance_gnf: number; payable_gnf: number; waiting_gnf: number; pending_gnf: number; withdrawable_gnf: number; min_gnf: number; next_release_at: string | null; next_release_gnf: number | null; method: string | null; account_number: string | null; holder_name: string | null; usable_from: string | null }
interface Req { id: string; amount_gnf: number; status: string; reason: string | null; method: string; account_number: string; created_at: string }
const when = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * Gains à recevoir (§48) : livraisons payées en ligne (Mobile Money, carte). Sur les espèces, le livreur a déjà gardé
 * son gain. Retrait à la demande (§63, comme les vendeurs au §62) : dès 10 000 GNF disponibles, une demande que l'équipe envoie.
 */
export function CourierPayout() {
  const sb = browserClient();
  const [s, setS] = useState<Summary | null>(null);
  const [edit, setEdit] = useState(false);
  const [method, setMethod] = useState<string>('orange_money');
  const [account, setAccount] = useState('');
  const [holder, setHolder] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [req, setReq] = useState<Req | null>(null);
  const [sheet, setSheet] = useState(false);
  const [montant, setMontant] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!sb) return;
    const uid = (await sb.auth.getUser()).data.user?.id;
    const [a, b] = await Promise.all([
      sb.rpc('fn_my_balance', { p_shop: null }),
      uid ? sb.from('payout_requests').select('id,amount_gnf,status,reason,method,account_number,created_at').eq('courier_id', uid).order('created_at', { ascending: false }).limit(1) : Promise.resolve({ data: [] }),
    ]);
    const row = ((a.data as Summary[] | null) ?? [])[0] ?? null;
    setS(row); if (row && !row.method) setEdit(true);
    setReq(((b.data as Req[] | null) ?? [])[0] ?? null);
  }, [sb]);
  const n = Number(montant.replace(/\D/g, '')) || 0;
  async function retirer() {
    if (!s) return;
    setErr(null);
    if (n < s.min_gnf) return setErr(`Le retrait minimum est de ${formatGnf(s.min_gnf)}.`);
    if (n > s.withdrawable_gnf) return setErr(`Vous pouvez retirer au plus ${formatGnf(s.withdrawable_gnf)}.`);
    setBusy(true);
    const { error } = await sb!.rpc('fn_withdraw_request', { p_shop: null, p_amount: n });
    setBusy(false);
    if (error) return setErr(error.message.replace(/^.*?:\s*/, ''));
    setSheet(false); setMontant('');
    setMsg(`Demande de retrait de ${formatGnf(n)} envoyée. Vous serez prévenu dès que l’argent part sur votre compte.`);
    await load();
  }
  async function annuler() {
    if (!req) return;
    setBusy(true);
    const { error } = await sb!.rpc('fn_withdraw_cancel', { p_request: req.id });
    setBusy(false);
    setMsg(error ? error.message.replace(/^.*?:\s*/, '') : 'Demande de retrait annulée.');
    await load();
  }
  useEffect(() => { void load(); }, [load]);
  async function save() {
    setBusy(true); setMsg(null);
    const { data, error } = await sb!.rpc('fn_payout_method_set', { p_shop: null, p_method: method, p_account: account, p_holder: holder });
    setBusy(false);
    if (error) { setMsg(error.message.replace(/^.*?:\s*/, '')); return; }
    const later = new Date(String(data)).getTime() > Date.now() + 60_000;
    setMsg(later ? `Enregistré. Par sécurité, il sera utilisé à partir du ${when(String(data))}.` : 'Moyen de versement enregistré.');
    setEdit(false); setAccount(''); await load();
  }
  const pendingChange = s?.usable_from && new Date(s.usable_from).getTime() > Date.now();
  return (
    <section id="versements" aria-label="Gains à recevoir" className="flex flex-col gap-2.5 rounded-[20px] border border-night-line bg-night-card p-4">
      <span className="text-[12.5px] font-bold text-night-muted">Gains à recevoir (livraisons payées en ligne)</span>
      <span className="font-display text-[26px] font-semibold">{s ? formatGnf(s.balance_gnf) : '…'}</span>
      {s && (
        <div className="grid grid-cols-2 gap-2">
          <span className="flex flex-col gap-0.5 rounded-2xl bg-night px-3 py-2.5"><span className="flex items-center gap-1.5 text-[11.5px] font-bold text-night-muted"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-lime" />Disponible</span><span className="font-display text-[17px] font-semibold">{formatGnf(s.withdrawable_gnf, false)}</span></span>
          <span className="flex flex-col gap-0.5 rounded-2xl bg-night px-3 py-2.5"><span className="flex items-center gap-1.5 text-[11.5px] font-bold text-night-muted"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-night-muted" />En attente (48 h)</span><span className="font-display text-[17px] font-semibold">{formatGnf(s.waiting_gnf, false)}</span></span>
        </div>
      )}
      {/* §63 : retrait à la demande, comme les vendeurs. */}
      {s && req?.status === 'demande' ? (
        <div className="flex items-center gap-3 rounded-2xl bg-lime/10 px-3 py-2.5">
          <span className="flex min-w-0 flex-1 flex-col"><span className="text-[13.5px] font-extrabold text-lime">Retrait de {formatGnf(req.amount_gnf)} en cours</span><span className="truncate text-[12px] font-semibold text-night-muted">Vers {payoutMethodLabel(req.method)} {maskAccount(req.method, req.account_number)} · demandé le {when(req.created_at)}</span></span>
          <button type="button" disabled={busy} onClick={annuler} className="h-9 shrink-0 px-1 text-[12.5px] font-bold text-night-muted underline underline-offset-4">Annuler</button>
        </div>
      ) : s && (
        <>
          <button type="button" disabled={!s.method || pendingChange || s.withdrawable_gnf < s.min_gnf} onClick={() => { setSheet(true); setErr(null); setMontant(String(s.withdrawable_gnf)); }} className="h-12 rounded-2xl bg-lime text-[15px] font-extrabold text-ink disabled:opacity-40">Retirer</button>
          {(!s.method || pendingChange || s.withdrawable_gnf < s.min_gnf) && <span className="text-[12px] font-semibold text-night-muted">{!s.method ? 'Indiquez d’abord où recevoir vos gains.' : pendingChange ? `Nouveau compte : retrait possible à partir du ${when(s.usable_from!)}.` : `Retrait possible dès ${formatGnf(s.min_gnf)} disponibles.`}</span>}
        </>
      )}
      {req?.status === 'refuse' && Date.now() - new Date(req.created_at).getTime() < 7 * 864e5 && <p className="rounded-2xl bg-[#3a1a1a] px-3 py-2.5 text-[12.5px] font-semibold text-[#ffb4a8]">Retrait de {formatGnf(req.amount_gnf)} refusé : {req.reason}</p>}
      <span className="text-[12px] font-semibold text-night-muted">Chaque gain devient disponible 48 h après la remise. Sur les espèces, vous gardez déjà votre part.</span>
      {sheet && s && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center">
          <button type="button" aria-label="Fermer" onClick={() => setSheet(false)} className="absolute inset-0 bg-black/60" />
          <div role="dialog" aria-modal="true" aria-label="Retirer mes gains" className="relative flex w-full max-w-md flex-col gap-3.5 rounded-t-[26px] border-t border-night-line bg-night-card p-5 pb-[max(20px,env(safe-area-inset-bottom))]">
            <h2 className="font-display text-[20px] font-semibold">Retirer mes gains</h2>
            <span className="flex h-14 items-center gap-2 rounded-2xl border border-night-line bg-night px-4 focus-within:border-lime">
              <input value={n ? n.toLocaleString('fr-FR') : ''} onChange={(e) => { setErr(null); setMontant(e.target.value); }} inputMode="numeric" autoFocus aria-label="Montant à retirer" className="h-full min-w-0 flex-1 bg-transparent font-display text-[22px] font-semibold outline-none" />
              <span className="text-[14px] font-extrabold text-night-muted">GNF</span>
            </span>
            <button type="button" onClick={() => setMontant(String(s.withdrawable_gnf))} className="self-start rounded-full bg-lime/15 px-3.5 py-2 text-[12.5px] font-extrabold text-lime">Tout · {formatGnf(s.withdrawable_gnf)}</button>
            <span className="rounded-2xl bg-night px-3.5 py-3 text-[13px] font-semibold">Vers {payoutMethodLabel(s.method ?? '')} {maskAccount(s.method ?? '', s.account_number)} · {s.holder_name}</span>
            <span className="text-[12px] font-semibold text-night-muted">L’équipe Hailand envoie l’argent sur ce compte et vous prévient. Minimum {formatGnf(s.min_gnf)}.</span>
            {err && <p role="alert" className="rounded-2xl bg-[#3a1a1a] px-3 py-2.5 text-[13px] font-semibold text-[#ffb4a8]">{err}</p>}
            <button type="button" disabled={busy || n < s.min_gnf} onClick={retirer} className="h-[54px] rounded-2xl bg-lime text-[15px] font-extrabold text-ink disabled:opacity-40">{busy ? 'Envoi de la demande…' : `Retirer ${formatGnf(n)}`}</button>
          </div>
        </div>
      )}
      {s?.method && !edit && (
        <div className="flex items-center gap-3 rounded-2xl bg-night px-3 py-2.5">
          <span className="flex min-w-0 flex-1 flex-col"><span className="text-[13.5px] font-extrabold">{payoutMethodLabel(s.method)} · {maskAccount(s.method, s.account_number)}</span><span className="truncate text-[12px] font-semibold text-night-muted">{s.holder_name}{pendingChange ? ` · à partir du ${when(s.usable_from!)}` : ''}</span></span>
          <button type="button" onClick={() => { setEdit(true); setMethod(s.method ?? 'orange_money'); setHolder(s.holder_name ?? ''); }} className="h-10 shrink-0 rounded-xl border border-night-line px-3 text-[13px] font-bold">Changer</button>
        </div>
      )}
      {edit && (
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-extrabold">Où recevoir vos gains ?</span>
          <div role="radiogroup" aria-label="Moyen de versement" className="grid grid-cols-2 gap-1.5">
            {PAYOUT_METHODS.map((m) => <button key={m.id} type="button" role="radio" aria-checked={method === m.id} onClick={() => setMethod(m.id)} className={`h-11 rounded-xl text-[13px] font-extrabold ${method === m.id ? 'bg-lime text-ink' : 'border border-night-line'}`}>{m.label}</button>)}
          </div>
          <input value={account} onChange={(e) => setAccount(e.target.value)} inputMode={method === 'banque' ? 'text' : 'tel'} placeholder={method === 'banque' ? 'Numéro de compte (RIB)' : 'Numéro, ex. 620 00 00 00'} aria-label="Numéro" className="h-12 rounded-xl border border-night-line bg-night px-3 text-[15px] font-semibold outline-none focus:border-lime" />
          <input value={holder} onChange={(e) => setHolder(e.target.value)} placeholder="Nom du titulaire du compte" aria-label="Nom du titulaire" className="h-12 rounded-xl border border-night-line bg-night px-3 text-[15px] font-semibold outline-none focus:border-lime" />
          {s?.method && <span className="text-[12px] font-semibold text-night-muted">Par sécurité, un nouveau moyen n’est utilisé qu’après 48 h.</span>}
          <div className="flex gap-2">
            <button type="button" disabled={busy || account.trim().length < 6 || holder.trim().length < 2} onClick={save} className="h-12 flex-1 rounded-xl bg-lime text-[14px] font-extrabold text-ink disabled:opacity-40">Enregistrer</button>
            {s?.method && <button type="button" onClick={() => setEdit(false)} className="h-12 rounded-xl border border-night-line px-4 text-[14px] font-bold">Annuler</button>}
          </div>
        </div>
      )}
      {msg && <p role="status" className="text-[13px] font-bold text-lime">{msg}</p>}
    </section>
  );
}
