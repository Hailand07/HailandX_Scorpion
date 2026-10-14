'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ago } from '@hailandx/commerce';
import { HAILANDX_URL } from '@hailandx/kit';
import { btn, Flash, PageHead, useAction, useConsole } from '@/components/ConsoleShell';
import { phoneText } from '@/lib/format';

interface Req {
  declaration_id: string; shop_id: string | null; shop_name: string | null; shop_slug: string | null; owner_phone: string | null;
  declared_label: string | null; hailand_code: string | null; quartier: string | null; commune: string | null; level: number;
  landmark: string | null; lat: number | null; lng: number | null; status: 'a_verifier' | 'transmise' | 'refusee'; console_note: string | null;
  requested_at: string; decided_at: string | null; map_status: string | null;
}
type Tab = 'nouvelles' | 'transmises' | 'certifiees' | 'refusees';
const TABS: { id: Tab; label: string; keep: (r: Req) => boolean }[] = [
  { id: 'nouvelles', label: 'Nouvelles', keep: (r) => r.status === 'a_verifier' && r.level < 3 },
  { id: 'transmises', label: 'Transmises à HailandMap', keep: (r) => r.status === 'transmise' && r.level < 3 },
  { id: 'certifiees', label: 'Certifiées', keep: (r) => r.level === 3 },
  { id: 'refusees', label: 'Refusées', keep: (r) => r.status === 'refusee' && r.level < 3 },
];
const CHECKS = [
  'L’adresse est bien dans une zone couverte',
  'Le nom et la catégorie de la boutique sont sérieux',
  'Pas d’autre boutique déjà certifiée à cette adresse',
  'Vendeur joint par téléphone',
];
const LEVEL: Record<number, string> = { 0: '0 · point seul', 1: '1 · point GPS', 2: '2 · contour du bâtiment', 3: '3 · certifié' };
const MAPBOX = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

/**
 * Certifications : une demande venant de HailandX Vendeur est d'abord vérifiée ici.
 * Confirmée, elle remonte à HailandMap (agent de terrain) ; refusée, le vendeur reçoit le motif.
 */
export default function CertificationsPage() {
  const { sb } = useConsole();
  const { busy, msg, run } = useAction();
  const [rows, setRows] = useState<Req[] | null>(null);
  const [tab, setTab] = useState<Tab>('nouvelles');
  const [sel, setSel] = useState<string | null>(null);
  const [checked, setChecked] = useState<boolean[]>(CHECKS.map(() => false));
  const [note, setNote] = useState('');
  const [refusing, setRefusing] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await sb.rpc('fn_console_certifications');
    setRows(error ? [] : ((data as Req[]) ?? []));
  }, [sb]);
  useEffect(() => { void load(); }, [load]);

  const list = useMemo(() => (rows ?? []).filter(TABS.find((t) => t.id === tab)!.keep), [rows, tab]);
  const cur = list.find((r) => r.declaration_id === sel) ?? list[0] ?? null;
  useEffect(() => { setChecked(CHECKS.map(() => false)); setNote(''); setRefusing(false); }, [cur?.declaration_id]);

  const decide = (accept: boolean) => cur && run(
    sb.rpc('fn_console_certification_decide', { p_declaration: cur.declaration_id, p_accept: accept, p_note: note.trim() || null }),
    accept ? `« ${cur.shop_name ?? 'Boutique'} » confirmée : la demande est transmise à HailandMap.` : `Demande de « ${cur.shop_name ?? 'Boutique'} » refusée ; le vendeur a reçu le motif.`,
    load,
  );

  const step = (n: number, t: string, on: boolean) => (
    <span className={`flex items-center gap-2 text-[13px] font-extrabold ${on ? '' : 'text-[#8a8d9c]'}`}>
      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[12px] text-white ${on ? 'bg-ink' : 'bg-[#e2ded3]'}`}>{n}</span>{t}
    </span>
  );

  return (
    <>
      <PageHead title="Certifications" right={
        <div aria-label="Circuit d’une demande" className="hidden items-center gap-2.5 rounded-[14px] border border-line-soft bg-card px-3.5 py-2.5 md:flex">
          {step(1, 'Vendeur', true)}<span className="font-extrabold text-[#c9c4b6]">→</span>{step(2, 'Console', true)}<span className="font-extrabold text-[#c9c4b6]">→</span>
          {step(3, 'HailandMap (terrain)', tab !== 'nouvelles')}<span className="font-extrabold text-[#c9c4b6]">→</span>{step(4, 'Certifiée', tab === 'certifiees')}
        </div>
      } />
      <div role="tablist" aria-label="Demandes" className="flex gap-2 overflow-x-auto">
        {TABS.map((t) => {
          const n = (rows ?? []).filter(t.keep).length;
          return <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => { setTab(t.id); setSel(null); }}
            className={`h-9 shrink-0 rounded-full px-3.5 text-[13px] font-extrabold ${tab === t.id ? 'bg-ink text-white' : 'border border-line bg-card'}`}>{t.label}{n ? ` · ${n}` : ''}</button>;
        })}
      </div>
      <Flash msg={msg} />
      {rows && list.length === 0 && <p className="rounded-[22px] border border-line-soft bg-card px-5 py-6 text-[14px] font-semibold text-muted">Aucune demande dans cette liste.</p>}
      {cur && (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <section aria-label="Liste des demandes" className="flex flex-col gap-2">
            {list.map((r) => {
              const on = r.declaration_id === cur.declaration_id;
              return (
                <button key={r.declaration_id} type="button" onClick={() => setSel(r.declaration_id)} aria-pressed={on}
                  className={`flex flex-col gap-0.5 rounded-[14px] px-3.5 py-3 text-left ${on ? 'border-2 border-blue bg-blue-soft' : 'border border-line-soft bg-card'}`}>
                  <span className="flex justify-between gap-2"><span className="truncate text-[14px] font-extrabold">{r.shop_name ?? 'Boutique'}</span><span className="shrink-0 text-[11.5px] font-bold text-muted">{ago(r.requested_at)}</span></span>
                  <span className="text-[12.5px] font-semibold text-muted">{[r.quartier, r.commune].filter(Boolean).join(' · ') || 'Quartier inconnu'} · niveau {r.level}</span>
                </button>
              );
            })}
          </section>
          <section aria-label="Demande sélectionnée" className="grid gap-5 rounded-[22px] border border-line-soft bg-card p-5 xl:grid-cols-[1fr_300px]">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col">
                <span className="font-display text-[20px] font-semibold">{cur.shop_name ?? 'Boutique'}</span>
                <span className="text-[12.5px] font-bold text-muted">Demande prioritaire · reçue {ago(cur.requested_at)}{cur.decided_at ? ` · traitée ${ago(cur.decided_at)}` : ''}</span>
              </div>
              <dl className="grid grid-cols-2 gap-3.5">
                <Info k="Vendeur" v={cur.owner_phone ? <a href={`tel:+${cur.owner_phone.replace(/\D/g, '')}`} className="text-blue">{phoneText(cur.owner_phone)}</a> : '—'} />
                <Info k="Boutique" v={cur.shop_slug ? <a href={`${HAILANDX_URL}/b/${cur.shop_slug}`} target="_blank" rel="noreferrer" className="text-blue">Voir sur HailandX ↗</a> : '—'} />
                <Info k="Adresse déclarée" v={cur.declared_label ?? '—'} />
                <Info k="Code Hailand" v={cur.hailand_code ?? '—'} />
                <Info k="Quartier" v={cur.quartier ?? '—'} />
                <Info k="Commune" v={cur.commune ?? '—'} />
                <Info k="Niveau actuel" v={LEVEL[cur.level] ?? String(cur.level)} />
                <Info k="Repère" v={cur.landmark ?? '—'} />
              </dl>
              {cur.status === 'a_verifier' && (
                <>
                  <fieldset className="flex flex-col gap-2.5">
                    <legend className="mb-2.5 text-[12.5px] font-extrabold uppercase tracking-[0.04em] text-muted">À vérifier avant de transmettre</legend>
                    {CHECKS.map((c, i) => (
                      <label key={c} className="flex min-h-8 cursor-pointer items-center gap-2.5 text-[13.5px] font-bold">
                        <input type="checkbox" checked={checked[i]} onChange={(e) => setChecked(checked.map((x, j) => (j === i ? e.target.checked : x)))} className="h-5 w-5 accent-[#12141c]" />{c}
                      </label>
                    ))}
                  </fieldset>
                  <label className="flex flex-col gap-1.5 text-[13px] font-extrabold">{refusing ? 'Motif du refus (envoyé au vendeur)' : 'Note (facultative, gardée au journal)'}
                    <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500}
                      placeholder={refusing ? 'Ex. : l’adresse ne correspond pas à la boutique, corrigez-la dans NavigationX' : 'Ex. : boutique au rez-de-chaussée, ouverte de 9 h à 19 h'}
                      className="rounded-[14px] border border-line px-3 py-2.5 text-[14px] font-semibold outline-none focus:border-blue" />
                  </label>
                </>
              )}
              {cur.status !== 'a_verifier' && cur.console_note && <p className="rounded-[14px] bg-sand px-3.5 py-3 text-[13px] font-semibold"><span className="font-extrabold">Note de la console : </span>{cur.console_note}</p>}
            </div>
            <div className="flex flex-col gap-3">
              <MapThumb lat={cur.lat} lng={cur.lng} />
              {cur.status === 'a_verifier' && !refusing && (
                <>
                  <button type="button" disabled={busy || checked.some((x) => !x)} onClick={() => decide(true)} className={`${btn.dark} h-[52px]`}>Confirmer et transmettre à HailandMap</button>
                  <button type="button" disabled={busy} onClick={() => setRefusing(true)} className={btn.danger}>Refuser (avec motif)</button>
                  <p className="text-[12.5px] font-semibold leading-snug text-muted">{checked.some((x) => !x) ? 'Cochez les quatre vérifications pour confirmer. ' : ''}Une fois confirmée, la demande apparaît dans HailandMap pour la visite de l’agent. Le vendeur est prévenu à chaque étape.</p>
                </>
              )}
              {cur.status === 'a_verifier' && refusing && (
                <>
                  <button type="button" disabled={busy || note.trim().length < 3} onClick={() => decide(false)} className={`${btn.dark} h-[52px] bg-[#a3321f]`}>Refuser la demande</button>
                  <button type="button" disabled={busy} onClick={() => setRefusing(false)} className={btn.line}>Annuler</button>
                  <p className="text-[12.5px] font-semibold leading-snug text-muted">Le vendeur reçoit le motif et peut corriger son adresse dans NavigationX, puis redemander.</p>
                </>
              )}
              {cur.status === 'transmise' && cur.level < 3 && <p className="rounded-[14px] bg-blue-soft px-3.5 py-3 text-[13px] font-bold text-blue-ink">Chez HailandMap : en attente de la visite de l’agent de terrain.</p>}
              {cur.level === 3 && <p className="rounded-[14px] bg-ok-soft px-3.5 py-3 text-[13px] font-bold text-ok">Adresse certifiée : la boutique peut ouvrir la vente.</p>}
              {cur.status === 'refusee' && cur.level < 3 && <p className="rounded-[14px] bg-[#fbeae5] px-3.5 py-3 text-[13px] font-bold text-[#a3321f]">Refusée. Le vendeur peut corriger et redemander.</p>}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function Info({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-0.5"><dt className="text-[11.5px] font-extrabold uppercase tracking-[0.04em] text-muted">{k}</dt><dd className="break-words text-[14.5px] font-extrabold">{v}</dd></div>;
}

/** Aperçu de l'emplacement (image statique Mapbox) ; sans jeton ni position, un simple encadré. */
function MapThumb({ lat, lng }: { lat: number | null; lng: number | null }) {
  if (lat === null || lng === null) return <div className="flex h-[220px] items-center justify-center rounded-[18px] bg-[#e9efe4] text-[13px] font-bold text-muted">Position non renseignée</div>;
  const link = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`;
  if (!MAPBOX) return <a href={link} target="_blank" rel="noreferrer" className="flex h-[220px] items-center justify-center rounded-[18px] bg-[#e9efe4] text-[13px] font-extrabold text-blue">{lat.toFixed(5)}, {lng.toFixed(5)} ↗</a>;
  const src = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-l+3346f0(${lng},${lat})/${lng},${lat},17.5,0/600x440@2x?access_token=${MAPBOX}`;
  // eslint-disable-next-line @next/next/no-img-element
  return <a href={link} target="_blank" rel="noreferrer" aria-label="Ouvrir l’emplacement sur une carte"><img src={src} alt="Emplacement déclaré de la boutique" className="h-[220px] w-full rounded-[18px] bg-[#e9efe4] object-cover" /></a>;
}
