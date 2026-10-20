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

interface Courier { user_id: string; full_name: string; vehicle: string; status: 'candidat' | 'valide' | 'suspendu'; available: boolean; cash_balance_gnf: number; cash_limit_gnf: number }
interface Mission {
  parcel_id: string; fee_gnf: number; distance_km: number; cod_amount_gnf: number; pickup_m: number;
  from_name: string; from_quartier: string | null; from_commune: string | null; from_lat: number; from_lng: number;
  to_quartier: string | null; to_commune: string | null; to_level: number; to_lat: number; to_lng: number;
}
interface Mine { id: string; status: string; delivery_fee_gnf: number; shops: { name: string } | null }

const cta = 'flex h-[54px] w-full items-center justify-center rounded-2xl bg-lime text-[15px] font-extrabold text-ink disabled:opacity-40';
const short = (n: number) => n.toLocaleString('fr-FR').replace(/ | /g, ' ');
const where = (q: string | null, c: string | null) => [q, c].filter(Boolean).join(', ') || 'Zone de livraison';

/** Hailand Flotte : candidature, puis, une fois validé, carte des missions disponibles (plein écran) et mission en cours. */
export default function Home() {
  const router = useRouter();
  const session = useSession();
  const sb = browserClient();
  const uid = session?.user.id;
  const [courier, setCourier] = useState<Courier | null | undefined>(undefined);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [mine, setMine] = useState<Mine[]>([]);
  const [today, setToday] = useState({ count: 0, fees: 0 });
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
    const d = await sb.from('parcels').select('delivery_fee_gnf').eq('courier_id', uid!).eq('status', 'remis').gte('delivered_at', since.toISOString());
    const rows = (d.data as { delivery_fee_gnf: number }[]) ?? [];
    setToday({ count: rows.length, fees: rows.reduce((n, r) => n + r.delivery_fee_gnf, 0) });
    if (courier.available && fix) {
      const r = await sb.rpc('fn_missions_carte', { p_lat: fix.lat, p_lng: fix.lng, p_radius_km: 8 });
      setMissions((r.data as Mission[] | null) ?? []);
    } else setMissions([]);
  }, [sb, uid, courier?.status, courier?.available, fix]);
  useEffect(() => { void loadMissions(); const t = setInterval(loadMissions, 10_000); return () => clearInterval(t); }, [loadMissions]);

  async function toggle() {
    if (!courier) return;
    const { error } = await sb!.from('couriers').update({ available: !courier.available }).eq('user_id', courier.user_id);
    if (error) setMsg(error.message); else await loadCourier();
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
    const out: Pin[] = missions.map((m) => ({ id: m.parcel_id, kind: 'fee', at: [m.from_lng, m.from_lat], label: short(m.fee_gnf), active: m.parcel_id === selected?.parcel_id, onClick: () => setSel(m.parcel_id) }));
    if (selected) out.push({ id: 'D', kind: 'dropoff', at: [selected.to_lng, selected.to_lat] });
    if (me) out.push({ id: 'me', kind: 'me', at: me, heading: fix?.heading ?? null });
    return out;
  }, [missions, selected, me?.[0], me?.[1], fix?.heading]); // eslint-disable-line react-hooks/exhaustive-deps
  const lines: Line[] = useMemo(() => (selected ? [{ id: 'trajet', coords: [[selected.from_lng, selected.from_lat], [selected.to_lng, selected.to_lat]], color: '#c8f25a', dashed: true, width: 4 }] : []), [selected]);
  const view: View | null = useMemo(() => {
    const pts: LngLat[] = [...(me ? [me] : []), ...(selected ? [[selected.from_lng, selected.from_lat] as LngLat, [selected.to_lng, selected.to_lat] as LngLat] : missions.map((m) => [m.from_lng, m.from_lat] as LngLat))];
    return pts.length ? { mode: 'fit', points: pts, padding: { top: 120, bottom: (sheetH || 340) + 30, left: 50, right: 50 } } : null;
  }, [selected?.parcel_id, missions.length, me !== null, sheetH]); // eslint-disable-line react-hooks/exhaustive-deps

  const Head = (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-2.5"><AppMark app="flotte" size={38} /><div><div className="font-display text-xl font-bold tracking-[-0.03em]">Hailand <span className="text-lime">Flotte</span></div><div className="text-xs font-semibold text-night-muted">Application des livreurs</div></div></div>
      {session && <button type="button" onClick={() => void signOutFlotte()} className="h-11 px-2 text-[13px] font-bold text-night-muted">Déconnexion</button>}
    </header>
  );
  const Shell = ({ children }: { children: React.ReactNode }) => <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-3.5 px-5 pb-16 pt-5">{Head}{children}</main>;

  if (session === undefined || session === null || courier === undefined) return <Shell><p className="text-[14px] font-medium text-night-muted">Chargement…</p></Shell>;

  // Flotte n'est proposée à personne : sans dossier livreur, on explique simplement que l'équipe recrute (maquette F1).
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
        <div className="mt-auto flex flex-col gap-2.5">
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
  const Current = current && (
    <Link href={`/mission/${current.id}`} className="flex items-center justify-between gap-3 rounded-2xl bg-lime px-4 py-3.5 text-ink">
      <span className="flex flex-col"><span className="text-[11.5px] font-extrabold tracking-[0.04em]">MISSION EN COURS</span><span className="text-[14.5px] font-extrabold">{current.shops?.name ?? 'Boutique'} · {current.status === 'retire' ? 'en route vers le dépôt' : 'à récupérer'}</span></span>
      <span className="shrink-0 text-[13px] font-extrabold">Reprendre →</span>
    </Link>
  );

  // ── Indisponible : tableau simple (pas de carte, pas de position demandée) ───────────────────────────────────────────
  if (!courier.available) {
    return (
      <Shell>
        <button type="button" onClick={toggle} className="flex h-[58px] items-center justify-between rounded-2xl border border-night-line bg-night-card px-5 text-[15px] font-extrabold">
          <span>Indisponible</span><span className="text-lime">Démarrer</span>
        </button>
        {Current}
        {msg && <p role="status" className="rounded-2xl bg-night-card px-4 py-3 text-[13.5px] font-semibold">{msg}</p>}
        <section className="grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl border border-night-line bg-night-card px-3.5 py-3"><div className="text-[11.5px] font-bold text-night-muted">Aujourd’hui</div><div className="font-display text-[20px] font-semibold">{today.count} livraison{today.count > 1 ? 's' : ''}</div><div className="text-[12px] font-bold text-lime">{formatGnf(today.fees)} de frais</div></div>
          <div className="rounded-2xl border border-night-line bg-night-card px-3.5 py-3"><div className="text-[11.5px] font-bold text-night-muted">Espèces à reverser</div><div className="font-display text-[20px] font-semibold">{formatGnf(courier.cash_balance_gnf)}</div><div className="text-[12px] font-bold text-night-muted">plafond {formatGnf(courier.cash_limit_gnf)}</div></div>
        </section>
        {room <= 0 && <p className="rounded-2xl bg-[#3a2f12] px-4 py-3 text-[13px] font-semibold text-amber">Plafond d’espèces atteint : reversez vos espèces à Hailand avant de prendre une mission payable à la livraison.</p>}
        <p className="text-[13.5px] font-medium text-night-muted">Appuyez sur « Démarrer » : la carte des missions proches s’ouvre et votre position est partagée tant que vous êtes en service.</p>
      </Shell>
    );
  }

  // ── En service : carte plein écran des missions disponibles ─────────────────────────────────────────────────────────────
  const others = missions.filter((m) => m.parcel_id !== selected?.parcel_id);
  return (
    <main className="fixed inset-0 overflow-hidden bg-night">
      <FlotteMap className="absolute inset-0" pins={pins} lines={lines} view={view} />
      <div className="absolute inset-x-0 top-0 z-20 mx-auto flex max-w-md flex-col gap-2 px-4 pt-[max(14px,env(safe-area-inset-top))]">
        <div className="flex items-center gap-3 rounded-[20px] border border-night-line bg-night-card/95 px-4 py-3">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-lime" aria-hidden="true" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[14px] font-extrabold">En service</span>
            <span className="truncate text-[12px] font-semibold text-night-muted">{fix ? `${missions.length} mission${missions.length > 1 ? 's' : ''} proche${missions.length > 1 ? 's' : ''}` : 'Recherche de votre position…'}</span>
          </span>
          <span className="flex flex-col items-end"><span className="font-display text-[15px] font-semibold text-lime">{formatGnf(today.fees)}</span><span className="text-[11px] font-bold text-night-muted">aujourd’hui</span></span>
          <button type="button" onClick={toggle} className="ml-1 h-10 shrink-0 rounded-xl border border-night-line px-3 text-[12.5px] font-extrabold">Arrêter</button>
        </div>
        {Current}
        {geoError && <p role="alert" className="rounded-2xl bg-[#3a2f12] px-4 py-3 text-[13px] font-semibold text-amber">{geoError}</p>}
        {room <= 0 && <p className="rounded-2xl bg-[#3a2f12] px-4 py-3 text-[13px] font-semibold text-amber">Plafond d’espèces atteint : reversez vos espèces avant une mission payable à la livraison.</p>}
      </div>
      <section ref={sheetRef} aria-label="Missions proches" className="absolute inset-x-0 bottom-0 z-20 mx-auto flex max-h-[52dvh] max-w-md flex-col gap-2.5 overflow-y-auto rounded-t-[26px] border-t border-night-line bg-night-card px-4 pb-[max(18px,env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-12px_30px_rgba(0,0,0,.45)]">
        <span aria-hidden="true" className="mx-auto mb-1 h-1 w-10 shrink-0 rounded-full bg-night-line" />
        <h1 className="font-display text-[18px] font-semibold">Missions proches</h1>
        {msg && <p role="status" className="rounded-2xl bg-night px-4 py-3 text-[13.5px] font-semibold">{msg}</p>}
        {fix && missions.length === 0 && <p className="text-[13.5px] font-medium text-night-muted">Aucune mission pour l’instant. La carte se met à jour toute seule.</p>}
        {selected && (
          <article className="flex flex-col gap-2.5 rounded-[20px] border-2 border-lime bg-night p-3.5">
            <div className="flex items-baseline justify-between"><span className="font-display text-[19px] font-semibold text-lime">{formatGnf(selected.fee_gnf)}</span><span className="text-[12.5px] font-bold text-night-muted">à {meters(selected.pickup_m)} · trajet {Number(selected.distance_km).toLocaleString('fr-FR')} km</span></div>
            <div className="flex items-center gap-2 text-[13px] font-bold"><span className="h-2.5 w-2.5 shrink-0 rounded-[3px] bg-white" aria-hidden="true" />Retrait · {selected.from_name} · {where(selected.from_quartier, selected.from_commune)}</div>
            <div className="flex items-center gap-2 text-[13px] font-bold"><span className="h-2.5 w-2.5 shrink-0 rounded-full bg-lime" aria-hidden="true" />Dépôt · {where(selected.to_quartier, selected.to_commune)} · niveau {selected.to_level}</div>
            {selected.cod_amount_gnf > 0 && <div className="rounded-xl bg-[#3a2f12] px-3 py-2 text-[12.5px] font-bold text-amber">Espèces à encaisser : {formatGnf(selected.cod_amount_gnf)}</div>}
            <button type="button" disabled={busy} onClick={() => accept(selected.parcel_id)} className={cta}>Accepter la mission</button>
          </article>
        )}
        {others.map((m) => (
          <button key={m.parcel_id} type="button" onClick={() => setSel(m.parcel_id)} className="flex items-center justify-between gap-3 rounded-[18px] border border-night-line bg-night px-3.5 py-3 text-left">
            <span className="flex min-w-0 flex-col"><span className="font-display text-[15.5px] font-semibold">{formatGnf(m.fee_gnf)}</span><span className="truncate text-[12px] font-semibold text-night-muted">{m.from_quartier ?? m.from_name} → {m.to_quartier ?? 'dépôt'} · à {meters(m.pickup_m)}</span></span>
            <span className="h-9 shrink-0 rounded-xl border border-night-line px-3 py-2 text-[12.5px] font-extrabold">Voir</span>
          </button>
        ))}
      </section>
    </main>
  );
}
