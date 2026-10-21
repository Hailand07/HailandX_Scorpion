'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ago, formatGnf } from '@hailandx/commerce';
import { btn, Flash, PageHead, Panel, useAction, useConsole } from '@/components/ConsoleShell';
import { phoneText } from '@/lib/format';

interface Courier {
  user_id: string; full_name: string; phone: string | null; vehicle: string; status: string; available: boolean;
  cash_balance_gnf: number; cash_limit_gnf: number; last_seen_at: string | null; created_at: string;
}
interface Invitation { phone: string; full_name: string; vehicle: string; created_at: string }
type Tab = 'valide' | 'invitation' | 'candidat' | 'especes' | 'suspendu';
const VEHICLE: Record<string, string> = { moto: 'Moto', velo: 'Vélo', voiture: 'Voiture', pied: 'À pied' };
const keep: Record<Exclude<Tab, 'invitation'>, (c: Courier) => boolean> = {
  candidat: (c) => c.status === 'candidat',
  valide: (c) => c.status === 'valide',
  especes: (c) => c.cash_balance_gnf > 0,
  suspendu: (c) => c.status === 'suspendu',
};
// « Anciennes candidatures » : n'apparaît que s'il en reste (la candidature publique est fermée depuis la phase 5).
const TABS: { id: Tab; label: string }[] = [{ id: 'valide', label: 'Validés' }, { id: 'invitation', label: 'Invitations en attente' }, { id: 'candidat', label: 'Anciennes candidatures' }, { id: 'especes', label: 'Espèces en main' }, { id: 'suspendu', label: 'Suspendus' }];
const online = (c: Courier) => c.status === 'valide' && c.available && c.last_seen_at !== null && Date.now() - new Date(c.last_seen_at).getTime() < 15 * 60_000;

/**
 * Livreurs : Flotte n'est proposée à personne, l'équipe recrute et AJOUTE les livreurs ici par leur numéro (maquette F2).
 * Numéro déjà connu → livreur validé tout de suite ; sinon invitation en attente, validée à sa première connexion à Flotte.
 * Suspendre, réactiver, enregistrer les espèces reversées : tout est inscrit au journal.
 */
export default function CouriersPage() {
  const { sb, role } = useConsole();
  const { busy, msg, run } = useAction();
  const [rows, setRows] = useState<Courier[] | null>(null);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [tab, setTab] = useState<Tab>('valide');
  const [form, setForm] = useState({ phone: '', name: '', vehicle: 'moto' });
  const [confirm, setConfirm] = useState<string | null>(null);
  const [cash, setCash] = useState<Record<string, string>>({});
  /** Plafond d'espèces en cours de modification (fondateur) : livreur, montant, motif. */
  const [plafond, setPlafond] = useState<{ id: string; montant: string; motif: string } | null>(null);

  const load = useCallback(async () => {
    const { data } = await sb.from('couriers').select('user_id,full_name,phone,vehicle,status,available,cash_balance_gnf,cash_limit_gnf,last_seen_at,created_at').order('created_at', { ascending: false });
    setRows((data as Courier[]) ?? []);
    const inv = await sb.from('courier_invitations').select('phone,full_name,vehicle,created_at').is('accepted_at', null).order('created_at', { ascending: false });
    setInvites((inv.data as Invitation[]) ?? []);
  }, [sb]);
  useEffect(() => { void load(); }, [load]);

  const list = useMemo(() => (tab === 'invitation' ? [] : (rows ?? []).filter(keep[tab]).sort((a, b) => (tab === 'especes' ? b.cash_balance_gnf - a.cash_balance_gnf : 0))), [rows, tab]);
  const count = (t: Tab) => (t === 'invitation' ? invites.length : (rows ?? []).filter(keep[t]).length);
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    let result: string | null = null;
    const ok = await run(
      sb.rpc('fn_console_courier_add', { p_phone: form.phone, p_name: form.name, p_vehicle: form.vehicle }).then((r) => { result = r.data as string | null; return r; }),
      `${form.name.trim()} est ajouté à la Flotte : validé si son numéro a déjà un compte Hailand, sinon invitation en attente jusqu’à sa première connexion.`,
      load,
    );
    if (ok) {
      setTab(result === 'invitation' ? 'invitation' : 'valide');
      setForm({ phone: '', name: '', vehicle: 'moto' });
    }
  };

  const after = async () => { setConfirm(null); await load(); };
  const validate = (c: Courier) => run(sb.from('couriers').update({ status: 'valide' }).eq('user_id', c.user_id), `${c.full_name} est validé : il peut se mettre en service.`, after);
  const suspend = (c: Courier) => run(sb.from('couriers').update({ status: 'suspendu', available: false }).eq('user_id', c.user_id), c.status === 'candidat' ? `Candidature de ${c.full_name} refusée.` : `${c.full_name} est suspendu.`, after);
  const settle = (c: Courier) => {
    const amount = Number((cash[c.user_id] ?? String(c.cash_balance_gnf)).replace(/\D/g, ''));
    return run(sb.rpc('fn_courier_cash_settle', { p_courier: c.user_id, p_amount: amount }), `Espèces reçues de ${c.full_name} : ${formatGnf(amount)}.`, async () => { setCash((x) => ({ ...x, [c.user_id]: '' })); await load(); });
  };
  const saveLimit = (c: Courier) => {
    if (!plafond) return;
    const amount = Number(plafond.montant.replace(/\D/g, ''));
    return run(sb.rpc('fn_console_courier_cash_limit', { p_courier: c.user_id, p_limit: amount, p_motif: plafond.motif }), `Plafond d’espèces de ${c.full_name} : ${formatGnf(amount)}.`, async () => { setPlafond(null); await load(); });
  };

  return (
    <>
      <PageHead title="Livreurs" sub={rows ? `${rows.filter(online).length} en service maintenant · ${rows.filter((c) => c.status === 'valide').length} validés` : undefined} />
      <div className="flex flex-col gap-5 lg:flex-row-reverse lg:items-start">
      <form onSubmit={add} aria-label="Ajouter un livreur" className="flex flex-col gap-3 rounded-[22px] border-[1.5px] border-ink bg-card p-[18px] lg:w-[380px] lg:shrink-0">
        <h2 className="font-display text-[17px] font-semibold">Ajouter un livreur</h2>
        <label className="flex flex-col gap-1.5 text-[13px] font-extrabold">Numéro de téléphone
          <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} inputMode="tel" placeholder="+224 6XX XX XX XX" className="h-12 rounded-[14px] border border-line px-3.5 text-[15px] font-bold outline-none focus:border-blue" />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-extrabold">Nom
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Prénom et nom" className="h-12 rounded-[14px] border border-line px-3.5 text-[15px] font-bold outline-none focus:border-blue" />
        </label>
        <div role="radiogroup" aria-label="Moyen de transport" className="grid grid-cols-4 gap-2">
          {Object.entries(VEHICLE).map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={form.vehicle === v} onClick={() => setForm((f) => ({ ...f, vehicle: v }))} className={`h-10 rounded-[12px] text-[13px] font-extrabold ${form.vehicle === v ? 'bg-ink text-white' : 'border border-line bg-card'}`}>{l}</button>)}
        </div>
        <button type="submit" disabled={busy || form.phone.replace(/\D/g, '').length < 9 || form.name.trim().length < 2} className={btn.dark}>Ajouter à la Flotte</button>
        <p className="text-[12.5px] font-semibold leading-snug text-muted">Le livreur se connecte à Hailand Flotte avec ce numéro. S’il n’a pas encore de compte Hailand, l’invitation reste « en attente » jusqu’à sa première connexion. Inscrit au journal.</p>
      </form>
      <div className="flex min-w-0 flex-1 flex-col gap-4">
      <div role="tablist" aria-label="Livreurs" className="flex gap-2 overflow-x-auto">
        {TABS.filter((t) => t.id !== 'candidat' || count('candidat') > 0).map((t) => {
          const n = count(t.id);
          return <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`h-9 shrink-0 rounded-full px-3.5 text-[13px] font-extrabold ${tab === t.id ? 'bg-ink text-white' : 'border border-line bg-card'}`}>{t.label}{n ? ` · ${n}` : ''}</button>;
        })}
      </div>
      <Flash msg={msg} />
      {tab === 'invitation' && (
        <Panel label="Invitations en attente" className="overflow-hidden">
          {invites.length === 0 && <p className="px-[18px] py-5 text-[14px] font-semibold text-muted">Aucune invitation en attente.</p>}
          <ul>
            {invites.map((v, i) => (
              <li key={v.phone} className={`flex flex-wrap items-center gap-3 px-[18px] py-3.5 ${i ? 'border-t border-[#f0ede6]' : ''}`}>
                <span className="flex min-w-0 flex-1 flex-col"><span className="text-[14.5px] font-extrabold">{v.full_name}</span><span className="text-[12.5px] font-semibold text-muted">{VEHICLE[v.vehicle] ?? v.vehicle} · {phoneText('+' + v.phone)} · invité {ago(v.created_at)}</span></span>
                <span className="rounded-full bg-[#fff4db] px-2.5 py-1 text-[12px] font-extrabold text-[#7a5500]">Invitation en attente</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      {tab !== 'invitation' && <Panel label="Liste des livreurs" className="overflow-hidden">
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
                {c.status === 'valide' && (plafond?.id === c.user_id ? (
                  <form className="flex flex-wrap items-center gap-2 rounded-[14px] bg-[#faf9f5] px-3 py-2.5" onSubmit={(e) => { e.preventDefault(); void saveLimit(c); }}>
                    <span className="text-[13px] font-extrabold">Plafond d’espèces</span>
                    <input inputMode="numeric" aria-label={`Nouveau plafond d’espèces de ${c.full_name}`} value={plafond.montant} onChange={(e) => setPlafond({ ...plafond, montant: e.target.value })} className="h-9 w-32 rounded-[11px] border border-line bg-card px-2.5 text-[14px] font-bold" />
                    <input aria-label="Motif" placeholder="Motif (obligatoire)" value={plafond.motif} onChange={(e) => setPlafond({ ...plafond, motif: e.target.value })} className="h-9 min-w-0 flex-1 rounded-[11px] border border-line bg-card px-2.5 text-[13px] font-semibold" />
                    <button type="submit" disabled={busy || plafond.motif.trim().length < 3} className={btn.small}>Enregistrer</button>
                    <button type="button" onClick={() => setPlafond(null)} className={btn.small}>Annuler</button>
                  </form>
                ) : (
                  <span className="flex flex-wrap items-center gap-2 text-[12.5px] font-semibold text-muted">
                    Plafond d’espèces : <span className="font-extrabold text-ink">{formatGnf(c.cash_limit_gnf)}</span>
                    {role === 'fondateur' && <button type="button" onClick={() => setPlafond({ id: c.user_id, montant: String(c.cash_limit_gnf), motif: '' })} className="font-extrabold text-blue">Modifier</button>}
                  </span>
                ))}
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
      </Panel>}
      </div>
      </div>
    </>
  );
}
