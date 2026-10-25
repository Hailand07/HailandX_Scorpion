'use client';
import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@hailandx/kit';
import { btn, Flash, PageHead, Panel, useAction, useConsole } from '@/components/ConsoleShell';
import { deliveryFee, gnfInput, pctToBps, SETTING_LABEL, settingText, when } from '@/lib/format';

interface Setting { key: string; value: string; updated_at: string | null }
const HELP: Record<string, string> = {
  commission_bps: 'Prélevée sur le prix des articles, à la remise du colis',
  courier_share_bps: 'Des frais de livraison payés par l’acheteur',
  delivery_base_gnf: 'Montant fixe de chaque livraison, avant les kilomètres',
  delivery_per_km_gnf: 'Par kilomètre à vol d’oiseau entre la boutique et l’adresse (la route fait environ 1,3 fois plus)',
  delivery_min_gnf: 'Aucune livraison ne coûte moins que ce montant',
  payment_mode: 'Essai : bouton « Simuler » pour l’équipe. Chap Chap Pay test : vraie page de paiement, clés de test, équipe seulement. Ouvert à tous : clés de production et KYC validé',
};
const ORDER = ['commission_bps', 'courier_share_bps', 'delivery_base_gnf', 'delivery_per_km_gnf', 'delivery_min_gnf', 'payment_mode'];
const isGnf = (k: string) => k.startsWith('delivery_');
/** Distances d'exemple : le repère du fondateur (rond-point T8 → Samatran Plateau, moto-taxi 7 000 GNF), puis 1, 5 et 10 km. */
const EXAMPLES: [string, number][] = [['T8 → Samatran (2,9 km)', 2.88], ['1 km', 1], ['5 km', 5], ['10 km', 10]];

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
  const next = cur ? (cur.key === 'payment_mode' ? value : isGnf(cur.key) ? gnfInput(value) : pctToBps(value)) : null;
  const val = (k: string) => Number(k === cur?.key && next ? next : rows?.find((r) => r.key === k)?.value ?? 0);
  const open = (r: Setting) => { setEdit(r.key); setMotif(''); setMsg(null); setValue(r.key === 'payment_mode' || isGnf(r.key) ? r.value : String(Number(r.value) / 100).replace('.', ',')); };
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
                {(['simulation', 'chapchappay_test', 'chapchappay'] as const).map((m) => (
                  <button key={m} type="button" aria-pressed={value === m} onClick={() => setValue(m)} className={`h-11 flex-1 rounded-[12px] text-[13.5px] font-extrabold ${value === m ? 'bg-ink text-white' : 'border border-line bg-card'}`}>{settingText('payment_mode', m)}</button>
                ))}
              </div>
            ) : (
              <label className="flex items-center gap-3 text-[13.5px] font-extrabold">Nouvelle valeur
                <span className="flex items-center gap-1.5"><input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" className={`h-11 ${isGnf(cur.key) ? 'w-32' : 'w-24'} rounded-[12px] border-2 border-blue px-3 text-[16px] font-extrabold outline-none`} />{isGnf(cur.key) ? (cur.key === 'delivery_per_km_gnf' ? 'GNF/km' : 'GNF') : '%'}</span>
              </label>
            )}
            <div className="flex flex-wrap items-center gap-2.5 text-[14px] font-extrabold">
              <span className="rounded-[10px] bg-sand px-3 py-2">{settingText(cur.key, cur.value)}</span>→
              <span className={`rounded-[10px] border-2 px-3 py-2 ${next ? 'border-blue' : 'border-[#a3321f] text-[#a3321f]'}`}>{next ? settingText(cur.key, next) : 'valeur invalide'}</span>
              <span className="text-[12.5px] font-semibold text-muted">s’applique aux nouvelles commandes seulement</span>
            </div>
            {isGnf(cur.key) && (
              <div className="flex flex-col gap-1.5 rounded-[12px] bg-sand px-3 py-2.5 text-[13px] font-bold">
                <span className="text-[12px] font-extrabold text-muted">Frais d’une livraison avec ces réglages (livreur : {settingText('courier_share_bps', rows?.find((r) => r.key === 'courier_share_bps')?.value ?? '8000')})</span>
                {EXAMPLES.map(([label, km]) => {
                  const now = deliveryFee(km, Number(rows?.find((r) => r.key === 'delivery_base_gnf')?.value ?? 0), Number(rows?.find((r) => r.key === 'delivery_per_km_gnf')?.value ?? 0), Number(rows?.find((r) => r.key === 'delivery_min_gnf')?.value ?? 0));
                  const then = deliveryFee(km, val('delivery_base_gnf'), val('delivery_per_km_gnf'), val('delivery_min_gnf'));
                  return <span key={label} className="flex justify-between gap-3"><span>{label}</span><span>{now.toLocaleString('fr-FR')} → <b>{then.toLocaleString('fr-FR')} GNF</b></span></span>;
                })}
              </div>
            )}
            <label className="flex flex-col gap-1.5 text-[13px] font-extrabold">Motif (obligatoire, gardé au journal)
              <input value={motif} onChange={(e) => setMotif(e.target.value)} maxLength={200} placeholder="Ex. : promotion de lancement à Matam" className="h-11 rounded-[12px] border border-line px-3 text-[14px] font-semibold outline-none focus:border-blue" />
            </label>
            {cur.key === 'payment_mode' && value === 'chapchappay' && cur.value !== 'chapchappay' && (
              <p className="rounded-[12px] bg-amber-soft px-3 py-2.5 text-[12.5px] font-bold text-[#7a5500]">Vérifiez d’abord que le compte Chap Chap Pay est validé (KYC) et que les clés de PRODUCTION sont posées dans HailandX (Vercel) : sinon les acheteurs ne pourront pas payer, ou paieraient en mode test.</p>
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
  return <p className="border-t border-[#f0ede6] px-[18px] py-3.5 text-[12.5px] font-semibold text-muted">Le plafond d’espèces des livreurs se règle par livreur (page Livreurs). Les frais déjà calculés d’une commande ne changent pas.</p>;
}
