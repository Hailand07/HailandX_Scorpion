'use client';
import { useCallback, useEffect, useState } from 'react';
import { formatGnf, maskAccount, PAYOUT_METHODS, payoutMethodLabel } from '@hailandx/commerce';
import { browserClient } from '@hailandx/kit';

interface Summary { balance_gnf: number; payable_gnf: number; waiting_gnf: number; method: string | null; account_number: string | null; holder_name: string | null; usable_from: string | null }
interface Payout { id: string; amount_gnf: number; method: string; account_number: string; created_at: string }
const when = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * Versements (§48) : moyen de versement de la boutique (Orange Money, MTN, Kulu, Soutra, PayCard, banque), argent
 * disponible (48 h après la remise) et versements reçus. Hailand verse chaque semaine et paie les frais.
 */
export function PayoutCard({ shopId }: { shopId: string }) {
  const sb = browserClient();
  const [s, setS] = useState<Summary | null>(null);
  const [list, setList] = useState<Payout[]>([]);
  const [edit, setEdit] = useState(false);
  const [method, setMethod] = useState<string>('orange_money');
  const [account, setAccount] = useState('');
  const [holder, setHolder] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    if (!sb) return;
    const [a, b] = await Promise.all([sb.rpc('fn_my_payout_summary', { p_shop: shopId }), sb.from('payouts').select('id,amount_gnf,method,account_number,created_at').eq('shop_id', shopId).order('created_at', { ascending: false }).limit(20)]);
    const row = ((a.data as Summary[] | null) ?? [])[0] ?? null;
    setS(row); setList((b.data as Payout[]) ?? []);
    if (row && !row.method) setEdit(true);
  }, [sb, shopId]);
  useEffect(() => { void load(); }, [load]);

  async function save() {
    setBusy(true); setMsg(null);
    const { data, error } = await sb!.rpc('fn_payout_method_set', { p_shop: shopId, p_method: method, p_account: account, p_holder: holder });
    setBusy(false);
    if (error) { setMsg(error.message.replace(/^.*?:\s*/, '')); return; }
    const later = new Date(String(data)).getTime() > Date.now() + 60_000;
    setMsg(later ? `Enregistré. Par sécurité, ce nouveau moyen sera utilisé à partir du ${when(String(data))}.` : 'Moyen de versement enregistré.');
    setEdit(false); setAccount(''); await load();
  }
  const pendingChange = s?.usable_from && new Date(s.usable_from).getTime() > Date.now();

  return (
    <section aria-label="Versements" className="flex flex-col gap-3 rounded-[20px] border border-line-soft bg-card p-4">
      <h2 className="font-display text-[16px] font-semibold">Versements</h2>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col rounded-[14px] bg-ok-soft px-3 py-2.5"><span className="text-[11.5px] font-bold text-ok">Disponible</span><span className="font-display text-[17px] font-semibold">{s ? formatGnf(s.payable_gnf) : '…'}</span></div>
        <div className="flex flex-col rounded-[14px] bg-sand px-3 py-2.5"><span className="text-[11.5px] font-bold text-muted">En attente (48 h)</span><span className="font-display text-[17px] font-semibold">{s ? formatGnf(s.waiting_gnf) : '…'}</span></div>
      </div>
      <p className="text-[12px] font-semibold leading-snug text-muted">Une vente devient disponible 48 h après la remise du colis (le temps d’un éventuel litige). Hailand verse chaque semaine et paie les frais d’envoi.</p>
      {s?.method && !edit && (
        <div className="flex items-center gap-3 rounded-[14px] border border-line px-3 py-2.5">
          <span className="flex min-w-0 flex-1 flex-col"><span className="text-[13.5px] font-extrabold">{payoutMethodLabel(s.method)} · {maskAccount(s.method, s.account_number)}</span><span className="truncate text-[12px] font-semibold text-muted">{s.holder_name}{pendingChange ? ` · utilisé à partir du ${when(s.usable_from!)}` : ''}</span></span>
          <button type="button" onClick={() => { setEdit(true); setMethod(s.method ?? 'orange_money'); setHolder(s.holder_name ?? ''); }} className="h-10 shrink-0 rounded-xl border border-line px-3 text-[13px] font-bold">Changer</button>
        </div>
      )}
      {edit && (
        <div className="flex flex-col gap-2.5">
          <span className="text-[13px] font-extrabold">Où recevoir vos versements ?</span>
          <div role="radiogroup" aria-label="Moyen de versement" className="grid grid-cols-2 gap-1.5">
            {PAYOUT_METHODS.map((m) => (
              <button key={m.id} type="button" role="radio" aria-checked={method === m.id} onClick={() => setMethod(m.id)} className={`h-11 rounded-xl text-[13px] font-extrabold ${method === m.id ? 'bg-ink text-white' : 'border border-line'}`}>{m.label}</button>
            ))}
          </div>
          <input value={account} onChange={(e) => setAccount(e.target.value)} inputMode={method === 'banque' ? 'text' : 'tel'} placeholder={method === 'banque' ? 'Numéro de compte (RIB)' : 'Numéro, ex. 620 00 00 00'} aria-label="Numéro" className="h-12 rounded-xl border border-line px-3 text-[15px] font-semibold outline-none focus:border-blue" />
          <input value={holder} onChange={(e) => setHolder(e.target.value)} placeholder="Nom du titulaire du compte" aria-label="Nom du titulaire" className="h-12 rounded-xl border border-line px-3 text-[15px] font-semibold outline-none focus:border-blue" />
          {s?.method && <p className="text-[12px] font-semibold text-muted">Par sécurité, un nouveau moyen n’est utilisé qu’après 48 h, et Hailand est prévenu.</p>}
          <div className="flex gap-2">
            <button type="button" disabled={busy || account.trim().length < 6 || holder.trim().length < 2} onClick={save} className="h-12 flex-1 rounded-xl bg-ink text-[14px] font-extrabold text-white disabled:opacity-50">Enregistrer</button>
            {s?.method && <button type="button" onClick={() => setEdit(false)} className="h-12 rounded-xl border border-line px-4 text-[14px] font-bold">Annuler</button>}
          </div>
        </div>
      )}
      {msg && <p role="status" className="text-[12.5px] font-bold">{msg}</p>}
      {list.length > 0 && (
        <ul className="flex flex-col gap-1 border-t border-[#f0ede6] pt-2">
          {list.map((p) => <li key={p.id} className="flex justify-between gap-3 text-[13px] font-semibold"><span>{when(p.created_at)} · {payoutMethodLabel(p.method)} {maskAccount(p.method, p.account_number)}</span><span className="font-extrabold">{formatGnf(p.amount_gnf)}</span></li>)}
        </ul>
      )}
    </section>
  );
}
