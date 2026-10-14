'use client';
import { useCallback, useEffect, useState } from 'react';
import { btn, Flash, PageHead, Panel, useAction, useConsole } from '@/components/ConsoleShell';
import { phoneText } from '@/lib/format';

interface Member { user_id: string; full_name: string | null; phone: string | null; console_role: 'fondateur' | 'operateur'; active: boolean; created_at: string }

/**
 * Comptes et équipe : qui a accès à la console, avec quel rôle.
 * Seul le fondateur ajoute un membre (par son numéro, compte déjà créé), change un rôle ou retire un accès.
 */
export default function TeamPage() {
  const { sb, uid, role } = useConsole();
  const { busy, msg, run } = useAction();
  const [team, setTeam] = useState<Member[] | null>(null);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [newRole, setNewRole] = useState<'operateur' | 'fondateur'>('operateur');
  const [confirm, setConfirm] = useState<string | null>(null);
  const founder = role === 'fondateur';

  const load = useCallback(async () => {
    const { data } = await sb.rpc('fn_console_team');
    setTeam((data as Member[]) ?? []);
  }, [sb]);
  useEffect(() => { void load(); }, [load]);

  const set = (p: string, n: string | null, r: string, active: boolean, ok: string) =>
    run(sb.rpc('fn_console_team_set', { p_phone: p, p_full_name: n ?? '', p_console_role: r, p_active: active }), ok, async () => { setConfirm(null); await load(); });

  const add = () => set(phone, name, newRole, true, `${name.trim() || 'Le membre'} a maintenant accès à la console (${newRole === 'fondateur' ? 'fondateur' : 'opérateur'}).`)
    .then((ok) => { if (ok) { setPhone(''); setName(''); setNewRole('operateur'); } });

  return (
    <>
      <PageHead title="Comptes et équipe" right={!founder ? <span className="rounded-[11px] bg-sand px-3 py-2 text-[12.5px] font-extrabold">Lecture seule : réservé au fondateur</span> : undefined} />
      <Flash msg={msg} />
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Équipe Hailand" className="overflow-hidden">
          <ul>
            {team?.map((m) => {
              const me = m.user_id === uid;
              return (
                <li key={m.user_id} className={`flex flex-wrap items-center gap-3 border-t border-[#f0ede6] px-[18px] py-3 ${m.active ? '' : 'opacity-60'}`}>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[14.5px] font-extrabold">{m.full_name || 'Sans nom'}{me ? ' (vous)' : ''}</span>
                    <span className="text-[12.5px] font-semibold text-muted">{phoneText(m.phone)} · depuis le {new Date(m.created_at).toLocaleDateString('fr-FR')}</span>
                  </span>
                  <span className={`rounded-full px-2.5 py-1 text-[12px] font-extrabold ${!m.active ? 'bg-sand' : m.console_role === 'fondateur' ? 'bg-ink text-lime' : 'bg-blue-soft text-blue-ink'}`}>
                    {!m.active ? 'Accès retiré' : m.console_role === 'fondateur' ? 'Fondateur' : 'Opérateur'}
                  </span>
                  {founder && !me && m.phone && (confirm === m.user_id ? (
                    <span className="flex flex-wrap gap-2">
                      {m.active && <button type="button" disabled={busy} onClick={() => set(m.phone!, m.full_name, m.console_role === 'fondateur' ? 'operateur' : 'fondateur', true, 'Rôle modifié.')} className={btn.small}>{m.console_role === 'fondateur' ? 'Passer opérateur' : 'Passer fondateur'}</button>}
                      <button type="button" disabled={busy} onClick={() => set(m.phone!, m.full_name, m.console_role, !m.active, m.active ? 'Accès retiré.' : 'Accès rétabli.')} className={`${btn.small} ${m.active ? 'text-[#a3321f]' : ''}`}>{m.active ? 'Retirer l’accès' : 'Rétablir l’accès'}</button>
                      <button type="button" onClick={() => setConfirm(null)} className={btn.small}>Annuler</button>
                    </span>
                  ) : <button type="button" onClick={() => setConfirm(m.user_id)} className={btn.small}>Modifier</button>)}
                </li>
              );
            })}
          </ul>
        </Panel>
        <div className="flex flex-col gap-4">
          {founder && (
            <Panel title="Ajouter un membre" className="pb-4">
              <form className="flex flex-col gap-3 px-[18px]" onSubmit={(e) => { e.preventDefault(); void add(); }}>
                <label className="flex flex-col gap-1.5 text-[13px] font-extrabold">Numéro de téléphone
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="620 00 00 00" className="h-11 rounded-[12px] border border-line px-3 text-[15px] font-bold outline-none focus:border-blue" />
                </label>
                <label className="flex flex-col gap-1.5 text-[13px] font-extrabold">Nom
                  <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Ex. Aïssatou Bah" className="h-11 rounded-[12px] border border-line px-3 text-[15px] font-bold outline-none focus:border-blue" />
                </label>
                <fieldset className="flex gap-2">
                  <legend className="mb-1.5 text-[13px] font-extrabold">Rôle</legend>
                  {(['operateur', 'fondateur'] as const).map((r) => (
                    <button key={r} type="button" aria-pressed={newRole === r} onClick={() => setNewRole(r)} className={`h-10 flex-1 rounded-[12px] text-[13.5px] font-extrabold ${newRole === r ? 'bg-ink text-white' : 'border border-line bg-card'}`}>{r === 'fondateur' ? 'Fondateur' : 'Opérateur'}</button>
                  ))}
                </fieldset>
                <button type="submit" disabled={busy || phone.replace(/\D/g, '').length < 9} className={btn.dark}>Donner l’accès</button>
                <p className="text-[12px] font-semibold leading-snug text-muted">La personne doit d’abord s’être connectée une fois à une application Hailand avec ce numéro.</p>
              </form>
            </Panel>
          )}
          <Panel title="Les deux rôles" className="pb-4">
            <ul className="flex flex-col gap-2.5 px-[18px] text-[13px] font-semibold leading-snug">
              <li><span className="font-extrabold">Opérateur</span> : le quotidien — certifications, boutiques, livreurs, litiges, avis, versements.</li>
              <li><span className="font-extrabold">Fondateur</span> : tout, plus la commission, la part du livreur, le mode de paiement et l’équipe.</li>
              <li className="text-muted">Toutes les actions sont inscrites au journal, qui ne peut être ni modifié ni effacé.</li>
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
