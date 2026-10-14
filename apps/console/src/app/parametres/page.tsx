'use client';
import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@hailandx/kit';
import { btn, Flash, PageHead, Panel, useAction, useConsole } from '@/components/ConsoleShell';
import { pctToBps, SETTING_LABEL, settingText, when } from '@/lib/format';

interface Setting { key: string; value: string; updated_at: string | null }
const HELP: Record<string, string> = {
  commission_bps: 'Prélevée sur le prix des articles, à la remise du colis',
  courier_share_bps: 'Des frais de livraison payés par l’acheteur',
  payment_mode: 'Essai : réservé à l’équipe. Orange Money : seulement une fois le compte marchand ouvert',
};
const ORDER = ['commission_bps', 'courier_share_bps', 'payment_mode'];

/**
 * Paramètres sensibles de l'écosystème. Modification réservée au fondateur, avec un motif obligatoire et une confirmation ;
 * la base refuse toute autre voie et inscrit chaque changement au journal.
 */
export default function SettingsPage() {
  const { sb, role } = useConsole();
  const { busy, msg, setMsg, run } = useAction();
  const [rows, setRows] = useState<Setting[] | null>(null);
  const [edit, setEdit] = useState<string | null>(null);
  const [value, setValue] = useState('');
  const [motif, setMotif] = useState('');
  const founder = role === 'fondateur';

  const load = useCallback(async () => {
    const { data } = await sb.from('settings').select('key,value,updated_at');
    setRows(((data as Setting[]) ?? []).filter((r) => ORDER.includes(r.key)).sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key)));
  }, [sb]);
  useEffect(() => { void load(); }, [load]);

  const cur = rows?.find((r) => r.key === edit) ?? null;
  const next = cur ? (cur.key === 'payment_mode' ? value : pctToBps(value)) : null;
  const open = (r: Setting) => { setEdit(r.key); setMotif(''); setMsg(null); setValue(r.key === 'payment_mode' ? r.value : String(Number(r.value) / 100).replace('.', ',')); };
  const save = () => cur && next && run(
    sb.rpc('fn_console_setting_update', { p_key: cur.key, p_value: next, p_motif: motif.trim() }),
    `${SETTING_LABEL[cur.key]} : ${settingText(cur.key, cur.value)} → ${settingText(cur.key, next)}. Inscrit au journal.`,
    async () => { setEdit(null); await load(); },
  );

  return (
    <>
      <PageHead title="Paramètres" right={
        <span className="flex h-9 items-center gap-2 rounded-[11px] bg-ink px-3 text-[12.5px] font-extrabold text-lime"><Icon name="shield" size={14} stroke={2.4} />Modifications réservées au rôle fondateur</span>
      } />
      <Flash msg={msg} />
      <div className="grid gap-4 xl:grid-cols-[1.15fr_1fr]">
        <Panel title="Argent et livraison" className="overflow-hidden">
          {rows?.map((r) => (
            <div key={r.key} className={`flex flex-wrap items-center gap-3.5 border-t border-[#f0ede6] px-[18px] py-3.5 ${edit === r.key ? 'bg-[#f6f8ff]' : ''}`}>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[14.5px] font-extrabold">{SETTING_LABEL[r.key] ?? r.key}</span>
                <span className="text-[12.5px] font-semibold text-muted">{HELP[r.key]}{r.updated_at ? ` · modifié le ${when(r.updated_at)}` : ''}</span>
              </span>
              <span className="font-display text-[16px] font-semibold">{settingText(r.key, r.value)}</span>
              {founder && <button type="button" onClick={() => open(r)} className={edit === r.key ? `${btn.small} bg-ink text-white` : btn.small}>Modifier</button>}
            </div>
          ))}
          {rows && <SettingsFooter empty={rows.length === 0} />}
        </Panel>
        {founder && cur && (
          <Panel label={`Modifier ${SETTING_LABEL[cur.key]}`} className="flex flex-col gap-3 border-2 border-ink p-[18px]">
            <h2 className="text-[15px] font-extrabold">Modifier : {SETTING_LABEL[cur.key]}</h2>
            {cur.key === 'payment_mode' ? (
              <div className="flex gap-2">
                {(['simulation', 'orange_money'] as const).map((m) => (
                  <button key={m} type="button" aria-pressed={value === m} onClick={() => setValue(m)} className={`h-11 flex-1 rounded-[12px] text-[13.5px] font-extrabold ${value === m ? 'bg-ink text-white' : 'border border-line bg-card'}`}>{settingText('payment_mode', m)}</button>
                ))}
              </div>
            ) : (
              <label className="flex items-center gap-3 text-[13.5px] font-extrabold">Nouvelle valeur
                <span className="flex items-center gap-1.5"><input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" className="h-11 w-24 rounded-[12px] border-2 border-blue px-3 text-[16px] font-extrabold outline-none" />%</span>
              </label>
            )}
            <div className="flex flex-wrap items-center gap-2.5 text-[14px] font-extrabold">
              <span className="rounded-[10px] bg-sand px-3 py-2">{settingText(cur.key, cur.value)}</span>→
              <span className={`rounded-[10px] border-2 px-3 py-2 ${next ? 'border-blue' : 'border-[#a3321f] text-[#a3321f]'}`}>{next ? settingText(cur.key, next) : 'valeur invalide'}</span>
              <span className="text-[12.5px] font-semibold text-muted">s’applique aux nouvelles commandes seulement</span>
            </div>
            <label className="flex flex-col gap-1.5 text-[13px] font-extrabold">Motif (obligatoire, gardé au journal)
              <input value={motif} onChange={(e) => setMotif(e.target.value)} maxLength={200} placeholder="Ex. : promotion de lancement à Matam" className="h-11 rounded-[12px] border border-line px-3 text-[14px] font-semibold outline-none focus:border-blue" />
            </label>
            {cur.key === 'payment_mode' && value === 'orange_money' && cur.value !== 'orange_money' && (
              <p className="rounded-[12px] bg-amber-soft px-3 py-2.5 text-[12.5px] font-bold text-[#7a5500]">Vérifiez d’abord que le compte marchand Orange Money est ouvert et que la notification de paiement est configurée : sinon les acheteurs ne pourront pas payer.</p>
            )}
            <div className="flex gap-2.5">
              <button type="button" disabled={busy || !next || next === cur.value || motif.trim().length < 3} onClick={save} className={`${btn.dark} h-12 flex-1`}>Confirmer la modification</button>
              <button type="button" onClick={() => setEdit(null)} className={`${btn.line} h-12`}>Annuler</button>
            </div>
          </Panel>
        )}
        {!founder && <p className="text-[13px] font-semibold text-muted">Vous êtes opérateur : vous voyez les paramètres, seul le fondateur peut les modifier.</p>}
      </div>
    </>
  );
}

/** Rappel affiché sous les paramètres : ce qui n'est pas (encore) réglable ici. */
function SettingsFooter({ empty }: { empty: boolean }) {
  if (empty) return <p className="border-t border-[#f0ede6] px-[18px] py-4 text-[13.5px] font-semibold text-muted">Aucun paramètre lisible.</p>;
  return <p className="border-t border-[#f0ede6] px-[18px] py-3.5 text-[12.5px] font-semibold text-muted">Les frais de livraison et le plafond d’espèces des livreurs se règlent encore dans la base ; ils rejoindront cette page.</p>;
}
