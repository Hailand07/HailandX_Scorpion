'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatGnf } from '@hailandx/commerce';
import { telMasque } from '@hailandx/kit';
import { AppMark } from '@hailandx/ui';
import { browserClient, signOutFlotte } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';
import { useGeo } from '@/lib/useGeo';
import { meters, type LngLat } from '@/lib/nav';
import { useHeight } from '@/lib/device';
import { FlotteMap, type Line, type Pin, type View } from '@/components/FlotteMap';
import { CTA, FLOAT_BTN, GHOST, MAP_AREA, Menu, SHEET, SheetHead, Stat, StopBadge, TOP_BAR, WARN, useWide } from '@/components/Frame';
import { Ico } from '@/components/Icons';

interface Courier { user_id: string; full_name: string; vehicle: string; status: 'candidat' | 'valide' | 'suspendu'; available: boolean; cash_balance_gnf: number; cash_limit_gnf: number }
interface Mission {
  parcel_id: string; fee_gnf: number; distance_km: number; cod_amount_gnf: number; pickup_m: number;
  from_name: string; from_quartier: string | null; from_commune: string | null; from_lat: number; from_lng: number;
  to_quartier: string | null; to_commune: string | null; to_level: number; to_lat: number; to_lng: number;
}
interface Mine { id: string; status: string; delivery_fee_gnf: number; shops: { name: string } | null }

const cta = CTA;
const short = (n: number) => n.toLocaleString('fr-FR').replace(/ | /g, ' ');
const where = (q: string | null, c: string | null) => [q, c].filter(Boolean).join(', ') || 'Zone de livraison';

/**
 * Hailand Flotte, accueil du livreur (maquettes v5) : hors service (ma journée, F1), en service (missions proches sur la carte, F2),
 * mission proposée (F3, avant d'accepter), menu (F8). Téléphone : panneau du bas ; ordinateur : panneau à gauche.
 */
export default function Home() {
  const router = useRouter();
  const session = useSession();
  const sb = browserClient();
  const uid = session?.user.id;
  const [courier, setCourier] = useState<Courier | null | undefined>(undefined);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [mine, setMine] = useState<Mine[]>([]);
  const [today, setToday] = useState({ count: 0, fees: 0, km: 0 });
  const [detail, setDetail] = useState(false);
  const [menu, setMenu] = useState(false);
  const wide = useWide();
  const [sel, setSel] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { fix, error: geoError } = useGeo(courier?.status === 'valide' && courier.available);
  const lastPing = useRef(0);
  const [sheetRef, sheetH] = useHeight<HTMLElement>();

  const loadCourier = useCallback(async () => {
    if (!sb || !uid) return;
    // Livreurs recrutés par l'équipe (Hailand Console) : une invitation en attente pour ce numéro devient ici un livreur validé.
    await sb.rpc('fn_flotte_rejoindre');
    const { data } = await sb.from('couriers').select('user_id,full_name,vehicle,status,available,cash_balance_gnf,cash_limit_gnf').eq('user_id', uid).maybeSingle();
    setCourier((data as Courier | null) ?? null);
  }, [sb, uid]);
  useEffect(() => { if (session === null) router.replace('/connexion'); else if (uid) void loadCourier(); }, [session, uid, loadCourier, router]);

  // Position envoyée au serveur (au plus toutes les 20 s) : sert à proposer les missions proches et à contrôler la remise.
  useEffect(() => {
    if (!sb || !fix || courier?.status !== 'valide' || Date.now() - lastPing.current < 20_000) return;
    lastPing.current = Date.now();
    void sb.rpc('fn_courier_ping', { p_lat: fix.lat, p_lng: fix.lng });
  }, [sb, fix, courier?.status]);

  const loadMissions = useCallback(async () => {
    if (!sb || courier?.status !== 'valide') return;
    const m = await sb.from('parcels').select('id,status,delivery_fee_gnf,shops(name)').eq('courier_id', uid!).in('status', ['accepte', 'retire']);
    setMine((m.data as unknown as Mine[]) ?? []);
    const since = new Date(); since.setHours(0, 0, 0, 0);
    const d = await sb.from('parcels').select('delivery_fee_gnf,distance_km').eq('courier_id', uid!).eq('status', 'remis').gte('delivered_at', since.toISOString());
    const rows = (d.data as { delivery_fee_gnf: number; distance_km: number | null }[]) ?? [];
    setToday({ count: rows.length, fees: rows.reduce((n, r) => n + r.delivery_fee_gnf, 0), km: rows.reduce((n, r) => n + Number(r.distance_km ?? 0), 0) });
    if (courier.available && fix) {
      const r = await sb.rpc('fn_missions_carte', { p_lat: fix.lat, p_lng: fix.lng, p_radius_km: 8 });
      setMissions((r.data as Mission[] | null) ?? []);
    } else setMissions([]);
  }, [sb, uid, courier?.status, courier?.available, fix]);
  useEffect(() => { void loadMissions(); const t = setInterval(loadMissions, 10_000); return () => clearInterval(t); }, [loadMissions]);

  async function toggle() {
    if (!courier) return;
    const { error } = await sb!.from('couriers').update({ available: !courier.available }).eq('user_id', courier.user_id);
    if (error) setMsg(error.message); else { setDetail(false); await loadCourier(); }
  }
  async function accept(id: string) {
    setMsg(null); setBusy(true);
    const { error } = await sb!.rpc('fn_courier_accept', { p_parcel: id });
    setBusy(false);
    if (error) { setMsg(error.message.replace(/^.*?:\s*/, '')); return loadMissions(); }
    // Dès l'acceptation : la carte de la mission s'ouvre en plein écran.
    router.push(`/mission/${id}`);
  }

  const selected = missions.find((m) => m.parcel_id === sel) ?? missions[0] ?? null;
  const me: LngLat | null = fix ? [fix.lng, fix.lat] : null;
  const pins: Pin[] = useMemo(() => {
    const out: Pin[] = detail && selected
      ? [{ id: 'R', kind: 'pickup', at: [selected.from_lng, selected.from_lat], label: selected.from_name }]
      : missions.map((m) => ({ id: m.parcel_id, kind: 'fee', at: [m.from_lng, m.from_lat], label: short(m.fee_gnf), active: m.parcel_id === selected?.parcel_id, onClick: () => setSel(m.parcel_id) }));
    if (selected) out.push({ id: 'D', kind: 'dropoff', at: [selected.to_lng, selected.to_lat] });
    if (me) out.push({ id: 'me', kind: 'me', at: me, heading: fix?.heading ?? null });
    return out;
  }, [missions, selected, detail, me?.[0], me?.[1], fix?.heading]); // eslint-disable-line react-hooks/exhaustive-deps
  const lines: Line[] = useMemo(() => (selected ? [{ id: 'trajet', coords: [[selected.from_lng, selected.from_lat], [selected.to_lng, selected.to_lat]], color: '#c8f25a', dashed: !detail, glow: detail, width: detail ? 6 : 4 }] : []), [selected, detail]);
  const view: View | null = useMemo(() => {
    const pts: LngLat[] = [...(me ? [me] : []), ...(selected ? [[selected.from_lng, selected.from_lat] as LngLat, [selected.to_lng, selected.to_lat] as LngLat] : missions.map((m) => [m.from_lng, m.from_lat] as LngLat))];
    const padding = wide ? { top: 110, bottom: 60, left: 60, right: 60 } : { top: 120, bottom: (sheetH || 340) + 30, left: 50, right: 50 };
    return pts.length ? { mode: 'fit', points: pts, padding } : null;
  }, [selected?.parcel_id, missions.length, me !== null, sheetH, wide]); // eslint-disable-line react-hooks/exhaustive-deps

  const Head = (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-2.5"><AppMark app="flotte" size={38} /><div><div className="font-display text-xl font-bold tracking-[-0.03em]">Hailand <span className="text-lime">Flotte</span></div><div className="text-xs font-semibold text-night-muted">Application des livreurs</div></div></div>
      {session && <button type="button" onClick={() => void signOutFlotte()} className="h-11 px-2 text-[13px] font-bold text-night-muted">Déconnexion</button>}
    </header>
  );
  const Shell = ({ children }: { children: React.ReactNode }) => <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-3.5 px-5 pb-16 pt-[max(20px,env(safe-area-inset-top))] lg:justify-center">{Head}{children}</main>;

  if (session === undefined || session === null || courier === undefined) return <Shell><p className="text-[14px] font-medium text-night-muted">Chargement…</p></Shell>;

  // Flotte n'est proposée à personne : sans dossier livreur, on explique simplement que l'équipe recrute (maquette F1 v4).
  if (courier === null) {
    return (
      <Shell>
        <span className="mt-4 flex h-14 w-14 items-center justify-center rounded-[18px] bg-night-card text-lime" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7h13v10H3z" /><path d="M16 10h3l2 3v4h-5" /><circle cx="7" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></svg></span>
        <h1 className="font-display text-[24px] font-semibold leading-tight tracking-tight">Ce numéro n’est pas enregistré comme livreur Hailand</h1>
        <p className="text-[14px] font-medium leading-relaxed text-night-muted">Les livreurs sont recrutés par l’équipe Hailand. Si vous avez été recruté, demandez à votre responsable d’ajouter ce numéro, puis revenez ici.</p>
        <div className="flex flex-col gap-0.5 rounded-[18px] border border-night-line bg-night-card px-4 py-3">
          <span className="text-[12px] font-bold text-night-muted">Connecté avec</span>
          <span className="text-[15px] font-extrabold">{telMasque(session.user.phone) || 'votre numéro'}</span>
        </div>
        <div className="mt-auto flex flex-col gap-2.5 lg:mt-4">
          <button type="button" disabled={busy} onClick={async () => { setBusy(true); await loadCourier(); setBusy(false); }} className={cta}>{busy ? 'Vérification…' : 'Vérifier à nouveau'}</button>
          <button type="button" onClick={() => void signOutFlotte()} className="flex h-12 items-center justify-center text-[14px] font-extrabold text-night-muted">Changer de numéro</button>
        </div>
      </Shell>
    );
  }
  if (courier.status !== 'valide') {
    return (
      <Shell>
        <h1 className="font-display text-[24px] font-semibold tracking-tight">{courier.status === 'candidat' ? 'Dossier en cours de validation' : 'Compte suspendu'}</h1>
        <p className="text-[14px] font-medium text-night-muted">{courier.status === 'candidat' ? `Merci ${courier.full_name}. Hailand vous prévient dès que votre compte est validé : revenez ici ensuite.` : 'Contactez l’équipe Hailand.'}</p>
        <button type="button" onClick={loadCourier} className={cta}>Actualiser</button>
      </Shell>
    );
  }

  const room = courier.cash_limit_gnf - courier.cash_balance_gnf;
  const current = mine[0];
  const enService = courier.available;
  // La mission ouverte doit rester celle choisie : si elle disparaît (prise par un autre livreur), on revient à la liste.
  const open = enService && detail && selected !== null && selected.parcel_id === sel;
  const Current = current && (
    <Link href={`/mission/${current.id}`} className="flex items-center justify-between gap-3 rounded-2xl bg-lime px-4 py-3.5 text-ink shadow-[0_8px_22px_rgba(0,0,0,.35)]">
      <span className="flex min-w-0 flex-col"><span className="text-[11.5px] font-extrabold tracking-[0.04em]">MISSION EN COURS</span><span className="truncate text-[14.5px] font-extrabold">{current.shops?.name ?? 'Boutique'} · {current.status === 'retire' ? 'en route vers le dépôt' : 'à récupérer'}</span></span>
      <span className="shrink-0 text-[13px] font-extrabold">Reprendre →</span>
    </Link>
  );
  const capsule = 'flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-2xl border border-night-line bg-night-card/95 pl-3.5 pr-1.5 shadow-[0_6px_18px_rgba(0,0,0,.35)]';

  return (
    <main className="fixed inset-0 overflow-hidden bg-night">
      <div className={MAP_AREA}>
        <FlotteMap className="absolute inset-0" pins={enService ? pins : []} lines={enService ? lines : []} view={enService ? view : null} />
        {!enService && <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-night/55" />}
      </div>

      {/* ── Barre du haut : menu (ou retour) et état du service ─────────────────────────── */}
      <div className={TOP_BAR}>
        <div className="flex items-center gap-2.5">
          {open
            ? <button type="button" onClick={() => setDetail(false)} aria-label="Retour aux missions" className={FLOAT_BTN}>{Ico.close(20)}</button>
            : <button type="button" onClick={() => setMenu(true)} aria-label="Menu" className={FLOAT_BTN}>{Ico.menu(20)}</button>}
          {!open && (enService ? (
            <div className={capsule}>
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-lime shadow-[0_0_0_4px_rgba(200,242,90,.2)]" aria-hidden="true" />
              <span className="flex min-w-0 flex-1 flex-col"><span className="text-[14px] font-extrabold leading-tight">En service</span><span className="truncate text-[11.5px] font-bold text-night-muted">{fix ? `${missions.length} mission${missions.length > 1 ? 's' : ''} proche${missions.length > 1 ? 's' : ''} · ${formatGnf(today.fees)}` : 'Recherche de votre position…'}</span></span>
              <button type="button" onClick={toggle} className="h-9 shrink-0 rounded-xl border border-night-line bg-night px-3 text-[12.5px] font-extrabold">Pause</button>
            </div>
          ) : (
            <div className={capsule}><span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#6e7694]" aria-hidden="true" /><span className="text-[14px] font-extrabold">Hors service</span></div>
          ))}
        </div>
        {!open && Current}
        {enService && geoError && <p role="alert" className={WARN}>{geoError}</p>}
      </div>

      {/* ── Panneau : ma journée (F1), missions proches (F2) ou mission proposée (F3) ─────── */}
      <section ref={sheetRef} aria-label={!enService ? 'Ma journée' : open ? 'Mission proposée' : 'Missions proches'} className={SHEET}>
        <SheetHead />
        {msg && <p role="status" className="rounded-2xl bg-night px-4 py-3 text-[13.5px] font-semibold">{msg}</p>}

        {!enService && (
          <>
            <div className="flex items-end justify-between gap-3">
              <span className="flex flex-col gap-0.5"><span className="text-[12.5px] font-bold text-night-muted">Gagné aujourd’hui</span><span className="font-display text-[34px] font-semibold leading-none tracking-[-0.02em]">{formatGnf(today.fees)}</span></span>
              <span className="pb-1 text-[12.5px] font-bold capitalize text-night-muted">{new Date().toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
            </div>
            <div className="flex gap-2">
              <Stat label="Livraisons" value={String(today.count)} />
              <Stat label="Distance" value={`${today.km.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`} />
              <Stat label="Espèces à reverser" value={short(courier.cash_balance_gnf)} accent={courier.cash_balance_gnf > 0} />
            </div>
            {room <= 0 && <p className={WARN}>{Ico.wallet(18)}Plafond d’espèces atteint ({formatGnf(courier.cash_limit_gnf)}) : reversez vos espèces à Hailand avant une mission payable à la livraison.</p>}
            <button type="button" onClick={toggle} className={cta}>{Ico.bolt(20)}Passer en service</button>
            <p className="text-center text-[12.5px] font-semibold text-night-muted">Les missions proches apparaissent dès que vous êtes en service. Votre position n’est partagée que pendant le service.</p>
          </>
        )}

        {enService && !open && (
          <>
            <div className="flex items-baseline justify-between"><h1 className="font-display text-[18px] font-semibold">Missions proches</h1>{missions.length > 1 && <span className="text-[12.5px] font-bold text-night-muted">{missions.length} disponibles</span>}</div>
            {room <= 0 && <p className={WARN}>{Ico.wallet(18)}Plafond d’espèces atteint : reversez vos espèces avant une mission payable à la livraison.</p>}
            {!fix && <p className="text-[13.5px] font-medium text-night-muted">Recherche de votre position… Autorisez la localisation pour voir les missions autour de vous.</p>}
            {fix && missions.length === 0 && <p className="text-[13.5px] font-medium text-night-muted">Aucune mission pour l’instant. La carte se met à jour toute seule.</p>}
            {missions.map((m) => {
              const on = m.parcel_id === selected?.parcel_id;
              return (
                <button key={m.parcel_id} type="button" onClick={() => { setSel(m.parcel_id); setDetail(true); }} className={`flex shrink-0 flex-col gap-2.5 rounded-[20px] border bg-night p-3.5 text-left ${on ? 'border-[1.5px] border-lime' : 'border-night-line'}`}>
                  <span className="flex items-baseline justify-between gap-2"><span className={`font-display text-[20px] font-semibold ${on ? 'text-lime' : ''}`}>{formatGnf(m.fee_gnf)}</span><span className="text-[12.5px] font-extrabold text-night-muted">{Number(m.distance_km).toLocaleString('fr-FR')} km · à {meters(m.pickup_m)}</span></span>
                  <span className="flex items-center gap-2 text-[13.5px] font-bold"><StopBadge letter="R" size={20} /><span className="truncate">{m.from_name} · {where(m.from_quartier, m.from_commune)}</span></span>
                  <span className="flex items-center gap-2 text-[13.5px] font-bold"><StopBadge letter="D" size={20} /><span className="truncate">{where(m.to_quartier, m.to_commune)}</span></span>
                  {m.cod_amount_gnf > 0 && <span className="text-[12px] font-extrabold text-[#f3dc8a]">Espèces à encaisser : {formatGnf(m.cod_amount_gnf)}</span>}
                </button>
              );
            })}
          </>
        )}

        {open && selected && (
          <>
            <div className="flex items-end justify-between gap-3">
              <span className="flex flex-col gap-0.5"><span className="text-[12.5px] font-bold text-night-muted">Votre gain</span><span className="font-display text-[34px] font-semibold leading-none tracking-[-0.02em] text-lime">{formatGnf(selected.fee_gnf)}</span></span>
              <span className="flex flex-col items-end gap-0.5 pb-0.5"><span className="font-display text-[18px] font-semibold">{Number(selected.distance_km).toLocaleString('fr-FR')} km</span><span className="text-[12.5px] font-bold text-night-muted">retrait à {meters(selected.pickup_m)}</span></span>
            </div>
            <div className="flex flex-col">
              <div className="flex gap-3">
                <span className="flex flex-col items-center"><StopBadge letter="R" /><span aria-hidden="true" className="w-0.5 flex-1 bg-[repeating-linear-gradient(#c8f25a_0_4px,transparent_4px_9px)]" /></span>
                <span className="flex min-w-0 flex-col gap-0.5 pb-3.5"><span className="text-[15px] font-extrabold">Retrait · {selected.from_name}</span><span className="text-[12.5px] font-semibold text-night-muted">{where(selected.from_quartier, selected.from_commune)}</span></span>
              </div>
              <div className="flex gap-3">
                <StopBadge letter="D" />
                <span className="flex min-w-0 flex-col gap-0.5"><span className="text-[15px] font-extrabold">Dépôt · {where(selected.to_quartier, selected.to_commune)}</span><span className="text-[12.5px] font-semibold text-night-muted">{selected.to_level === 3 ? 'Bâtiment certifié Hailand' : selected.to_level === 2 ? 'Bâtiment repéré' : 'Zone approximative : il faudra appeler'}</span></span>
              </div>
            </div>
            {selected.cod_amount_gnf > 0 && <p className={WARN}>{Ico.wallet(18)}Paiement à la livraison : encaisser {formatGnf(selected.cod_amount_gnf)}</p>}
            <button type="button" disabled={busy} onClick={() => accept(selected.parcel_id)} className={cta}>{busy ? 'Acceptation…' : 'Accepter la mission'}</button>
            <button type="button" onClick={() => setDetail(false)} className={`${GHOST} lg:flex hidden`}>Retour aux missions</button>
          </>
        )}
      </section>
      {menu && <Menu courier={courier} onClose={() => setMenu(false)} onSignOut={() => void signOutFlotte()} />}
    </main>
  );
}
