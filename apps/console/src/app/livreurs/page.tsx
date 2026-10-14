'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ago, formatGnf } from '@hailandx/commerce';
import { btn, Flash, PageHead, Panel, useAction, useConsole } from '@/components/ConsoleShell';
import { phoneText } from '@/lib/format';

interface Courier {
  user_id: string; full_name: string; phone: string | null; vehicle: string; status: string; available: boolean;
  cash_balance_gnf: number; cash_limit_gnf: number; last_seen_at: string | null; created_at: string;
}
type Tab = 'candidat' | 'valide' | 'especes' | 'suspendu';
const VEHICLE: Record<string, string> = { moto: 'Moto', velo: 'Vélo', voiture: 'Voiture', pied: 'À pied' };
const keep: Record<Tab, (c: Courier) => boolean> = {
  candidat: (c) => c.status === 'candidat',
  valide: (c) => c.status === 'valide',
  especes: (c) => c.cash_balance_gnf > 0,
  suspendu: (c) => c.status === 'suspendu',
};
const TABS: { id: Tab; label: string }[] = [{ id: 'candidat', label: 'À valider' }, { id: 'valide', label: 'Validés' }, { id: 'especes', label: 'Espèces en main' }, { id: 'suspendu', label: 'Suspendus' }];
const online = (c: Courier) => c.status === 'valide' && c.available && c.last_seen_at !== null && Date.now() - new Date(c.last_seen_at).getTime() < 15 * 60_000;

/** Livreurs : valider les candidatures, suspendre, enregistrer les espèces reversées (tout est inscrit au journal). */
export default function CouriersPage() {
  const { sb } = useConsole();
  const { busy, msg, run } = useAction();
  const [rows, setRows] = useState<Courier[] | null>(null);
  const [tab, setTab] = useState<Tab>('candidat');
  const [confirm, setConfirm] = useState<string | null>(null);
  const [cash, setCash] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const { data } = await sb.from('couriers').select('user_id,full_name,phone,vehicle,status,available,cash_balance_gnf,cash_limit_gnf,last_seen_at,created_at').order('created_at', { ascending: false });
    setRows((data as Courier[]) ?? []);
  }, [sb]);
  useEffect(() => { void load(); }, [load]);

  const list = useMemo(() => (rows ?? []).filter(keep[tab]).sort((a, b) => (tab === 'especes' ? b.cash_balance_gnf - a.cash_balance_gnf : 0)), [rows, tab]);

  const after = async () => { setConfirm(null); await load(); };
  const validate = (c: Courier) => run(sb.from('couriers').update({ status: 'valide' }).eq('user_id', c.user_id), `${c.full_name} est validé : il peut se mettre en service.`, after);
  const suspend = (c: Courier) => run(sb.from('couriers').update({ status: 'suspendu', available: false }).eq('user_id', c.user_id), c.status === 'candidat' ? `Candidature de ${c.full_name} refusée.` : `${c.full_name} est suspendu.`, after);
  const settle = (c: Courier) => {
    const amount = Number((cash[c.user_id] ?? String(c.cash_balance_gnf)).replace(/\D/g, ''));
    return run(sb.rpc('fn_courier_cash_settle', { p_courier: c.user_id, p_amount: amount }), `Espèces reçues de ${c.full_name} : ${formatGnf(amount)}.`, async () => { setCash((x) => ({ ...x, [c.user_id]: '' })); await load(); });
  };

  return (
    <>
      <PageHead title="Livreurs" sub={rows ? `${rows.filter(online).length} en service maintenant · ${rows.filter((c) => c.status === 'valide').length} validés` : undefined} />
      <div role="tablist" aria-label="Livreurs" className="flex gap-2 overflow-x-auto">
        {TABS.map((t) => {
          const n = (rows ?? []).filter(keep[t.id]).length;
          return <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`h-9 shrink-0 rounded-full px-3.5 text-[13px] font-extrabold ${tab === t.id ? 'bg-ink text-white' : 'border border-line bg-card'}`}>{t.label}{n ? ` · ${n}` : ''}</button>;
        })}
      </div>
      <Flash msg={msg} />
      <Panel label="Liste des livreurs" className="overflow-hidden">
        {rows && list.length === 0 && <p className="px-[18px] py-5 text-[14px] font-semibold text-muted">Personne dans cette liste.</p>}
        <ul>
          {list.map((c, i) => {
            const over = c.cash_balance_gnf > c.cash_limit_gnf;
            return (
              <li key={c.user_id} className={`flex flex-col gap-3 px-[18px] py-3.5 ${i ? 'border-t border-[#f0ede6]' : ''}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-2 text-[14.5px] font-extrabold">{c.full_name}{online(c) && <span className="rounded-full bg-ok-soft px-2 py-0.5 text-[11px] font-extrabold text-ok">En service</span>}</span>
                    <span className="text-[12.5px] font-semibold text-muted">
                      {VEHICLE[c.vehicle] ?? c.vehicle} · {c.phone ? <a href={`tel:+${c.phone.replace(/\D/g, '')}`} className="text-blue">{phoneText(c.phone)}</a> : 'sans numéro'} · inscrit {ago(c.created_at)}
                      {c.last_seen_at ? ` · vu ${ago(c.last_seen_at)}` : ''}
                    </span>
                  </span>
                  {c.status === 'candidat' && <button type="button" disabled={busy} onClick={() => validate(c)} className={btn.dark}>Valider</button>}
                  {c.status === 'suspendu' && <button type="button" disabled={busy} onClick={() => validate(c)} className={btn.small}>Réactiver</button>}
                  {c.status !== 'suspendu' && (confirm === c.user_id ? (
                    <span className="flex gap-2">
                      <button type="button" disabled={busy} onClick={() => suspend(c)} className={`${btn.small} border-[#a3321f] text-[#a3321f]`}>{c.status === 'candidat' ? 'Confirmer le refus' : 'Confirmer la suspension'}</button>
                      <button type="button" onClick={() => setConfirm(null)} className={btn.small}>Annuler</button>
                    </span>
                  ) : <button type="button" onClick={() => setConfirm(c.user_id)} className={btn.small}>{c.status === 'candidat' ? 'Refuser' : 'Suspendre'}</button>)}
                </div>
                {c.cash_balance_gnf > 0 && (
                  <form className="flex flex-wrap items-center gap-2 rounded-[14px] bg-[#faf9f5] px-3 py-2.5" onSubmit={(e) => { e.preventDefault(); void settle(c); }}>
                    <span className={`flex-1 text-[13px] font-extrabold ${over ? 'text-[#9a6b00]' : ''}`}>Espèces en main : {formatGnf(c.cash_balance_gnf)}{over ? ` · au-dessus du plafond (${formatGnf(c.cash_limit_gnf)})` : ''}</span>
                    <input inputMode="numeric" aria-label={`Montant reçu de ${c.full_name}`} value={cash[c.user_id] ?? String(c.cash_balance_gnf)} onChange={(e) => setCash((x) => ({ ...x, [c.user_id]: e.target.value }))}
                      className="h-9 w-32 rounded-[11px] border border-line bg-card px-2.5 text-[14px] font-bold" />
                    <button type="submit" disabled={busy} className={btn.small}>Reçu</button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      </Panel>
    </>
  );
}
