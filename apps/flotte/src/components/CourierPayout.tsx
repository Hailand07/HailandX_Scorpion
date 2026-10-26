'use client';
import { useCallback, useEffect, useState } from 'react';
import { formatGnf, maskAccount, PAYOUT_METHODS, payoutMethodLabel } from '@hailandx/commerce';
import { browserClient } from '@/lib/supabase';

interface Summary { balance_gnf: number; payable_gnf: number; waiting_gnf: number; method: string | null; account_number: string | null; holder_name: string | null; usable_from: string | null }
const when = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * Gains à recevoir (§48) : livraisons payées en ligne (Mobile Money, carte). Sur les espèces, le livreur a déjà gardé
 * son gain. Hailand verse chaque semaine sur le moyen choisi, frais payés par Hailand.
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
  const load = useCallback(async () => {
    if (!sb) return;
    const { data } = await sb.rpc('fn_my_payout_summary', { p_shop: null });
    const row = ((data as Summary[] | null) ?? [])[0] ?? null;
    setS(row); if (row && !row.method) setEdit(true);
  }, [sb]);
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
      {s && <span className="text-[12.5px] font-semibold text-night-muted">{formatGnf(s.payable_gnf)} disponibles · {formatGnf(s.waiting_gnf)} dans 48 h. Versés chaque semaine, frais payés par Hailand. Sur les espèces, vous gardez déjà votre part.</span>}
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
