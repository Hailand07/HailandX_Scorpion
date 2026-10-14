'use client';
import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { QrScanner } from '@hailandx/ui';
import { MAX_HANDOVER_ATTEMPTS, formatGnf, formatGnPhone } from '@hailandx/commerce';
import { browserClient } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';
import { useGeo } from '@/lib/useGeo';
import { telHref, useHeight, useVoice, useWakeLock } from '@/lib/device';
import { uploadProof } from '@/lib/proof';
import { announcements, ARRIVAL_M, arrivalClock, arrived, directionsUrl, haversine, isOffRoute, meters, minutes, prepare, profileOf, progress, turnOf, type LngLat, type Route } from '@/lib/nav';
import { FlotteMap, hasMap, type Line, type Pin, type View } from '@/components/FlotteMap';
import { Ico, TurnIcon } from '@/components/Icons';

interface Stop {
  name?: string; phone: string | null; lat: number; lng: number; quartier: string | null; commune: string | null; code: string | null; level: number;
  landmark: string | null; floor: string | null; door: string | null; accuracy_m?: number | null; outline: GeoJSON.Geometry | null;
}
interface Detail { status: 'accepte' | 'retire'; fee_gnf: number; distance_km: number; cod_amount_gnf: number; handover_failures: number; pickup: Stop; dropoff: Stop }
type Mode = 'apercu' | 'guidage' | 'arrivee';

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';
const cta = 'flex h-[54px] w-full shrink-0 items-center justify-center gap-2.5 rounded-2xl bg-lime text-[15.5px] font-extrabold text-ink disabled:opacity-40';
const ghost = 'flex h-12 w-full shrink-0 items-center justify-center gap-2 rounded-2xl border border-night-line bg-night text-[14px] font-bold disabled:opacity-40';
const LEVEL: Record<number, string> = { 3: 'bâtiment certifié (niveau 3)', 2: 'bâtiment repéré (niveau 2)', 1: 'zone approximative (niveau 1) : appelez' };
const place = (s: Stop) => [s.quartier, s.commune && `commune de ${s.commune}`].filter(Boolean).join(' · ') || 'Quartier non renseigné';
const details = (s: Stop) => [s.floor && `étage ${s.floor}`, s.door && `porte ${s.door}`, s.landmark].filter(Boolean).join(' · ');
const errText = (e: { message: string }) => e.message.replace(/^[^:]{0,60}:\s*/, '');
const legCoords = (r: Route, i: number): LngLat[] => (r.legs[i]?.steps ?? []).flatMap((s) => ((s as unknown as { geometry?: { coordinates: LngLat[] } }).geometry?.coordinates ?? []));

/**
 * Mission en cours, carte plein écran dès l'acceptation :
 * aperçu (retrait R et dépôt D), guidage virage par virage avec voix et recalcul hors route, arrivée à moins de 50 m
 * (contour du bâtiment surligné), retrait par scan du QR, remise par photo et code. Aucun lien vers une autre application de cartes.
 */
export default function MissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const session = useSession();
  const sb = browserClient();
  const { fix, error: geoError } = useGeo(true);
  const voice = useVoice();
  const [info, setInfo] = useState<Detail | null>(null);
  const [vehicle, setVehicle] = useState<string | null>(null);
  const [gone, setGone] = useState(false);
  const [mode, setMode] = useState<Mode>('apercu');
  const [overview, setOverview] = useState<Route | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [rerouting, setRerouting] = useState(false);
  const [follow, setFollow] = useState(true);
  const [scan, setScan] = useState(false);
  const [code, setCode] = useState('');
  const [shot, setShot] = useState<File | null>(null);
  const [shotUrl, setShotUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [done, setDone] = useState<{ cod: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const lastAlong = useRef(0);
  const lastFetch = useRef(0);
  const lastPing = useRef(0);
  const [sheetRef, sheetH] = useHeight<HTMLElement>();
  useWakeLock(mode !== 'apercu' && !done);

  const load = useCallback(async () => {
    if (!sb || done) return null;
    const r = await sb.rpc('fn_mission_detail', { p_parcel: id });
    const d = r.data as Detail | null;
    if (!d) { setGone(true); return null; }
    setInfo(d);
    return d;
  }, [sb, id, done]);
  useEffect(() => { if (session) void load(); }, [session, load]);
  useEffect(() => {
    const uid = session?.user.id; if (!sb || !uid) return;
    void sb.from('couriers').select('vehicle').eq('user_id', uid).maybeSingle().then(({ data }) => setVehicle((data as { vehicle: string } | null)?.vehicle ?? null));
  }, [sb, session]);

  // Position envoyée au serveur (au plus toutes les 20 s) : suivi de l'acheteur et contrôle de proximité à la remise.
  useEffect(() => {
    if (!sb || !fix || !session || Date.now() - lastPing.current < 20_000) return;
    lastPing.current = Date.now();
    void sb.rpc('fn_courier_ping', { p_lat: fix.lat, p_lng: fix.lng });
  }, [sb, fix, session]);

  const leg = info?.status === 'retire' ? 'dropoff' : 'pickup';
  const target = info ? info[leg] : null;
  const targetAt: LngLat | null = target ? [target.lng, target.lat] : null;
  const me: LngLat | null = fix ? [fix.lng, fix.lat] : null;
  const distTarget = me && targetAt ? haversine(me, targetAt) : null;
  const near = Boolean(me && targetAt && target && arrived(me, targetAt, target.outline));
  const profile = profileOf(vehicle);

  // Aperçu : itinéraire position → retrait → dépôt (ou position → dépôt), calculé une fois par étape de la mission.
  const ovKey = info ? `${info.status}|${me ? 1 : 0}` : '';
  useEffect(() => {
    if (!info || !TOKEN) return;
    const pts: LngLat[] = [...(me ? [me] : []), ...(info.status === 'accepte' ? [[info.pickup.lng, info.pickup.lat] as LngLat] : []), [info.dropoff.lng, info.dropoff.lat]];
    if (pts.length < 2) return;
    const ctrl = new AbortController();
    fetch(directionsUrl(pts, profile, TOKEN), { signal: ctrl.signal }).then((r) => r.json()).then((j: { routes?: Route[] }) => setOverview(j.routes?.[0] ?? null)).catch(() => undefined);
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ovKey, profile]);

  // Guidage : itinéraire position → arrêt en cours ; recalculé hors route (au plus toutes les 8 s).
  const fetchRoute = useCallback(async (from: LngLat, to: LngLat) => {
    if (!TOKEN) return;
    lastFetch.current = Date.now();
    setRerouting(true);
    try {
      const j = (await (await fetch(directionsUrl([from, to], profile, TOKEN))).json()) as { routes?: Route[] };
      if (j.routes?.[0]) { setRoute(j.routes[0]); lastAlong.current = 0; }
    } catch { /* réseau : on garde l'itinéraire précédent */ }
    setRerouting(false);
  }, [profile]);

  const prepared = useMemo(() => (route ? prepare(route) : null), [route]);
  const prog = useMemo(() => (prepared && me ? progress(prepared, me, lastAlong.current) : null), [prepared, me?.[0], me?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mode !== 'guidage' || !me || !targetAt) return;
    if (!route) { if (Date.now() - lastFetch.current > 3000) void fetchRoute(me, targetAt); return; }
    if (prog && isOffRoute(prog.offRoute, fix?.accuracy) && Date.now() - lastFetch.current > 8000) {
      voice.say('Nouvel itinéraire.', true);
      void fetchRoute(me, targetAt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, me?.[0], me?.[1], route, prog?.offRoute]);

  // Consignes vocales : celles franchies depuis la dernière position (la plus récente seulement, pour ne pas s'accumuler).
  useEffect(() => {
    if (mode !== 'guidage' || !prepared || !prog) return;
    const said = announcements(prepared, lastAlong.current, prog.along);
    if (said.length) voice.say(said[said.length - 1]!);
    lastAlong.current = Math.max(lastAlong.current, prog.along);
  }, [mode, prepared, prog, voice]);

  // Arrivée : à moins de 50 m du point ou dans le contour du bâtiment.
  useEffect(() => {
    if (mode === 'guidage' && near) { setMode('arrivee'); voice.say(`Vous êtes arrivé. ${leg === 'pickup' ? 'Scannez le QR du colis.' : 'Prenez la photo, puis demandez le code.'}`, true); }
  }, [mode, near, leg, voice]);

  function start() {
    setMsg(null); setFollow(true); setRoute(null); lastAlong.current = 0;
    if (near) { setMode('arrivee'); return; }
    setMode('guidage');
    if (me && targetAt) void fetchRoute(me, targetAt);
    voice.say(leg === 'pickup' ? `Navigation vers ${info?.pickup.name ?? 'la boutique'}.` : `Navigation vers le dépôt${info?.dropoff.quartier ? ` à ${info.dropoff.quartier}` : ''}.`, true);
  }

  async function pickup(qr: string) {
    setScan(false); setBusy(true); setMsg(null);
    const { error } = await sb!.rpc('fn_parcel_pickup', { p_qr: qr, p_lat: fix?.lat ?? null, p_lng: fix?.lng ?? null });
    setBusy(false);
    if (error) return setMsg({ tone: 'err', text: errText(error) });
    const d = await load();
    setMsg({ tone: 'ok', text: 'Colis retiré, l’acheteur est prévenu. Guidage vers le dépôt.' });
    setRoute(null); setOverview(null); lastAlong.current = 0; setFollow(true); setMode('guidage');
    voice.say(`Colis retiré. En route vers le dépôt${d?.dropoff.quartier ? ` à ${d.dropoff.quartier}` : ''}.`, true);
  }
  async function release() {
    setBusy(true);
    const { error } = await sb!.rpc('fn_courier_release', { p_parcel: id });
    setBusy(false);
    if (error) return setMsg({ tone: 'err', text: errText(error) });
    window.location.href = '/';
  }
  async function handover(e: React.FormEvent) {
    e.preventDefault(); setMsg(null); setBusy(true);
    // La position la plus récente est envoyée juste avant : le serveur vérifie la proximité de l'adresse.
    if (fix) await sb!.rpc('fn_courier_ping', { p_lat: fix.lat, p_lng: fix.lng });
    let photoPath: string;
    try { photoPath = await uploadProof(sb!, session!.user.id, id, shot!); }
    catch (err) { setBusy(false); return setMsg({ tone: 'err', text: err instanceof Error ? err.message : 'Photo non envoyée.' }); }
    const { data, error } = await sb!.rpc('fn_parcel_handover_proof', { p_parcel: id, p_method: 'code', p_value: code, p_photo: photoPath });
    setBusy(false);
    if (error) return setMsg({ tone: 'err', text: errText(error) });
    if (data === 'remis') { voice.say('Livraison terminée. Merci.', true); return setDone({ cod: info?.cod_amount_gnf ?? 0 }); }
    setCode(''); await load();
    setMsg({ tone: 'err', text: 'Code incorrect. Demandez-le à l’acheteur (visible dans son suivi de commande).' });
  }

  // ── Carte : repères, tracés, contour, cadrage ──────────────────────────────────────────────────────────────────────────
  const pins: Pin[] = useMemo(() => {
    if (!info) return [];
    const out: Pin[] = [];
    if (info.status === 'accepte') out.push({ id: 'R', kind: 'pickup', at: [info.pickup.lng, info.pickup.lat], label: info.pickup.name });
    if (mode === 'apercu' || leg === 'dropoff') out.push({ id: 'D', kind: 'dropoff', at: [info.dropoff.lng, info.dropoff.lat] });
    if (me) out.push({ id: 'me', kind: 'me', at: me, heading: fix?.heading ?? null });
    return out;
  }, [info, mode, leg, me?.[0], me?.[1], fix?.heading]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasMe = me !== null;
  const lines: Line[] = useMemo(() => {
    if (mode === 'apercu' && overview) {
      const n = overview.legs.length;
      return overview.legs.map((_, i) => {
        const current = i === 0 && hasMe;
        return { id: `leg${i}`, coords: legCoords(overview, i), color: current ? '#3346f0' : '#c8f25a', dashed: !current && n > 1, width: current ? 6 : 5 };
      });
    }
    if (mode !== 'apercu' && route) return [{ id: 'route', coords: route.geometry.coordinates, color: '#c8f25a', width: 8 }];
    return [];
  }, [mode, overview, route, hasMe]);

  const areas = useMemo(() => {
    const g = mode === 'apercu' ? info?.dropoff.outline : target?.outline;
    return g ? [{ id: 'cible', geometry: g }] : [];
  }, [mode, target, info]);

  const view: View | null = useMemo(() => {
    if (!info || !targetAt) return null;
    if (mode === 'guidage') return follow && me ? { mode: 'follow', at: me, bearing: fix?.heading ?? null, padding: { top: 190, bottom: 140 } } : null;
    const bottom = (sheetH || 360) + 30;
    if (mode === 'arrivee') {
      // Arrivée : le bâtiment (contour surligné) et le livreur, au plus près.
      const ring = target?.outline?.type === 'Polygon' ? (target.outline.coordinates[0] as LngLat[]) : [];
      return { mode: 'fit', points: [...ring, targetAt, ...(me && distTarget !== null && distTarget < 300 ? [me] : [])], padding: { top: 120, bottom, left: 60, right: 60 }, maxZoom: 19 };
    }
    const pts: LngLat[] = [...(me ? [me] : []), ...(info.status === 'accepte' ? [[info.pickup.lng, info.pickup.lat] as LngLat] : []), [info.dropoff.lng, info.dropoff.lat]];
    return { mode: 'fit', points: pts, padding: { top: 90, bottom, left: 50, right: 50 } };
  }, [info, mode, follow, me?.[0], me?.[1], fix?.heading, targetAt?.[0], targetAt?.[1], sheetH]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── États simples ──────────────────────────────────────────────────────────────────────────────────────────────────────
  if (session === null) return <main className="mx-auto max-w-md px-5 pt-6"><Link href="/connexion" className="font-bold text-lime">Se connecter</Link></main>;
  if (done) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-5 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-lime text-ink">{Ico.check(40)}</div>
        <h1 className="font-display text-[26px] font-semibold">Livraison terminée</h1>
        {done.cod > 0 && <p className="rounded-2xl bg-[#3a2f12] px-5 py-3 text-[15px] font-bold text-amber">Vous avez encaissé {formatGnf(done.cod)} en espèces.</p>}
        <Link href="/" className={cta}>Retour aux missions</Link>
      </main>
    );
  }
  if (gone) return <main className="mx-auto flex max-w-md flex-col gap-4 px-5 pt-6"><p className="text-[14px] font-medium text-night-muted">Cette mission n’est plus à vous (annulée, remise ou reprise).</p><Link href="/" className={cta}>Retour</Link></main>;
  if (!info || !target || !targetAt) return <main className="mx-auto max-w-md px-5 pt-6"><p className="text-[14px] font-medium text-night-muted">Chargement de la mission…</p></main>;

  const left = Math.max(0, MAX_HANDOVER_ATTEMPTS - info.handover_failures);
  const stopName = leg === 'pickup' ? info.pickup.name ?? 'la boutique' : `l’acheteur${info.dropoff.quartier ? ` · ${info.dropoff.quartier}` : ''}`;
  const Msg = msg && <p role={msg.tone === 'err' ? 'alert' : 'status'} className={`rounded-2xl px-4 py-3 text-[13.5px] font-semibold ${msg.tone === 'err' ? 'bg-[#3a1a1a] text-[#ffb4a8]' : 'bg-night text-lime'}`}>{msg.text}</p>;
  const sheet = 'absolute inset-x-0 bottom-0 z-20 mx-auto flex max-h-[68dvh] max-w-md flex-col gap-3 overflow-y-auto rounded-t-[26px] border-t border-night-line bg-night-card px-4 pb-[max(18px,env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-12px_30px_rgba(0,0,0,.45)]';
  const handle = <span aria-hidden="true" className="mx-auto mb-1 h-1 w-10 shrink-0 rounded-full bg-night-line" />;
  const pickupTel = telHref(info.pickup.phone);
  const buyerTel = telHref(info.dropoff.phone);

  return (
    <main className="fixed inset-0 overflow-hidden bg-night">
      <FlotteMap className="absolute inset-0" pins={pins} lines={lines} areas={areas} view={view} onUserMove={() => setFollow(false)} />
      {!hasMap && <div className="absolute inset-x-0 top-24 z-10 mx-auto max-w-md px-4"><p className="rounded-2xl bg-night-card px-4 py-3 text-[13px] font-semibold text-night-muted">Carte indisponible : suivez les adresses ci-dessous et appelez en cas de doute.</p></div>}

      {/* ── Aperçu de la mission ─────────────────────────────────────────────────────── */}
      {mode === 'apercu' && (
        <>
          <div className="absolute inset-x-0 top-0 z-20 mx-auto flex max-w-md items-start justify-between px-4 pt-[max(14px,env(safe-area-inset-top))]">
            <Link href="/" aria-label="Retour aux missions" className="flex h-12 w-12 items-center justify-center rounded-2xl border border-night-line bg-night-card/95">{Ico.back()}</Link>
            {info.cod_amount_gnf > 0 && <span className="rounded-2xl bg-[#3a2f12] px-3.5 py-3 text-[13px] font-extrabold text-amber">Espèces : {formatGnf(info.cod_amount_gnf)}</span>}
          </div>
          <section ref={sheetRef} aria-label="Mission" className={sheet}>
            {handle}
            <div className="flex items-baseline justify-between gap-3">
              <h1 className="font-display text-[19px] font-semibold">{info.status === 'accepte' ? 'Mission acceptée' : 'Colis à livrer'}</h1>
              <span className="text-[12.5px] font-bold text-night-muted">{overview ? `${meters(overview.distance)} · ≈ ${minutes(overview.duration)} · ` : ''}{formatGnf(info.fee_gnf)}</span>
            </div>
            {Msg}
            {geoError && <p role="alert" className="rounded-2xl bg-[#3a2f12] px-4 py-3 text-[13px] font-semibold text-amber">{geoError}</p>}
            {info.status === 'accepte' && <StopCard letter="R" title="Retrait" stop={info.pickup} heading={info.pickup.name ?? 'Boutique'} leg={overview && hasMe ? overview.legs[0] ?? null : null} callLabel="Appeler la boutique" />}
            <StopCard letter="D" title="Dépôt" stop={info.dropoff} heading={place(info.dropoff)} leg={overview ? overview.legs[overview.legs.length - 1] ?? null : null} callLabel="Appeler l’acheteur" showPlace={false} />
            <button type="button" onClick={start} className={cta}>{Ico.nav(18)}{near ? 'Je suis arrivé' : leg === 'pickup' ? 'Démarrer la navigation vers le retrait' : 'Démarrer la navigation vers le dépôt'}</button>
            {info.status === 'accepte' && <button type="button" disabled={busy} onClick={release} className="h-10 shrink-0 text-[13px] font-bold text-night-muted">Je ne peux plus faire cette mission</button>}
          </section>
        </>
      )}

      {/* ── Guidage virage par virage ───────────────────────────────────────────────── */}
      {mode === 'guidage' && (
        <>
          <div className="absolute inset-x-0 top-0 z-20 mx-auto flex max-w-md flex-col gap-2 px-3 pt-[max(12px,env(safe-area-inset-top))]">
            <div className="flex items-center gap-3.5 rounded-[22px] bg-lime px-4 py-3.5 text-ink shadow-[0_8px_24px_rgba(0,0,0,.35)]" aria-live="polite">
              <TurnIcon turn={turnOf(prog?.next ?? null)} />
              <div className="flex min-w-0 flex-col">
                <span className="font-display text-[28px] font-semibold leading-none">{prog ? meters(prog.toManeuver) : me ? '…' : 'GPS…'}</span>
                <span className="mt-1 text-[14px] font-extrabold leading-snug">{prog?.next?.instruction ?? (me ? (rerouting ? 'Calcul de l’itinéraire…' : 'Suivez la ligne verte') : 'Recherche de votre position…')}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {prog?.then && <span className="rounded-xl border border-night-line bg-night-card/95 px-3 py-2 text-[12.5px] font-bold">Puis : {prog.then.maneuver.instruction.replace(/\.$/, '')} · {meters(prog.then.distance)}</span>}
              {rerouting && route && <span className="rounded-xl bg-[#3a2f12] px-3 py-2 text-[12.5px] font-bold text-amber">Nouvel itinéraire…</span>}
            </div>
            {Msg}
          </div>
          <div className="absolute right-3 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-2.5">
            {voice.supported && <button type="button" onClick={voice.toggle} aria-pressed={voice.on} aria-label={voice.on ? 'Couper la voix' : 'Activer la voix'} className="flex h-12 w-12 items-center justify-center rounded-2xl border border-night-line bg-night-card/95">{voice.on ? Ico.sound() : Ico.mute()}</button>}
            {!follow && <button type="button" onClick={() => setFollow(true)} aria-label="Recentrer sur ma position" className="flex h-12 w-12 items-center justify-center rounded-2xl border border-night-line bg-night-card/95 text-lime">{Ico.locate()}</button>}
          </div>
          <div className="absolute inset-x-0 bottom-0 z-20 mx-auto flex max-w-md items-center gap-3 rounded-t-[24px] border-t border-night-line bg-night-card px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3.5">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="font-display text-[22px] font-semibold"><span className="text-lime">{prog ? minutes(prog.remainingSeconds) : '–'}</span> · {prog ? meters(prog.remaining) : distTarget !== null ? meters(distTarget) : '–'}</span>
              <span className="truncate text-[12.5px] font-bold text-night-muted">{prog ? `Arrivée ${arrivalClock(new Date(), prog.remainingSeconds)} · ` : ''}{leg === 'pickup' ? 'Retrait' : 'Dépôt'} chez {stopName}</span>
            </div>
            {near
              ? <button type="button" onClick={() => setMode('arrivee')} className="h-12 shrink-0 rounded-2xl bg-lime px-4 text-[14px] font-extrabold text-ink">Je suis arrivé</button>
              : <button type="button" onClick={() => { setMode('apercu'); if (voice.supported) window.speechSynthesis.cancel(); }} className="h-12 shrink-0 rounded-2xl bg-[#3a1a1a] px-4 text-[14px] font-extrabold text-[#ffb4a8]">Arrêter</button>}
          </div>
        </>
      )}

      {/* ── Arrivée : retrait (scan) ou remise (photo + code) ───────────────────────── */}
      {mode === 'arrivee' && (
        <>
          <div className="absolute inset-x-0 top-0 z-20 mx-auto max-w-md px-3 pt-[max(12px,env(safe-area-inset-top))]">
            <div className="flex items-center gap-3 rounded-[20px] border border-night-line bg-night-card/95 px-3.5 py-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lime text-ink">{Ico.check(20)}</span>
              <span className="flex min-w-0 flex-col">
                <span className="font-display text-[18px] font-semibold">{near ? 'Vous êtes arrivé' : 'Presque arrivé'}</span>
                <span className="truncate text-[12.5px] font-bold text-night-muted">{leg === 'pickup' ? info.pickup.name : place(info.dropoff)}{target.outline ? ' · bâtiment surligné' : ''}{distTarget !== null ? ` · ${meters(distTarget)}` : ''}</span>
              </span>
            </div>
          </div>
          <section ref={sheetRef} aria-label={leg === 'pickup' ? 'Retrait du colis' : 'Remise du colis'} className={sheet}>
            {handle}
            {Msg}
            {!near && distTarget !== null && <p className="rounded-2xl bg-[#3a2f12] px-4 py-3 text-[13px] font-semibold text-amber">Vous êtes à {meters(distTarget)} du point (arrivée à moins de {ARRIVAL_M} m). Approchez-vous : la base vérifie la position.</p>}
            {leg === 'pickup' ? (
              <>
                <p className="text-[13.5px] font-bold leading-snug">{details(info.pickup) ? `Repère : ${details(info.pickup)}. ` : ''}Le vendeur vous montre le QR de l’étiquette.</p>
                <button type="button" disabled={busy} onClick={() => setScan(true)} className={cta}>{Ico.scan(20)}Scanner le QR du colis</button>
                {pickupTel && <a href={pickupTel} className={ghost}>{Ico.phone(18)}Appeler la boutique</a>}
                <p className="text-center text-[12.5px] font-semibold text-night-muted">Ensuite : la carte vous guide vers le dépôt{info.dropoff.quartier ? ` à ${info.dropoff.quartier}` : ''}.</p>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-1 rounded-2xl bg-night px-3.5 py-3">
                  <span className="text-[14px] font-extrabold">{info.dropoff.code ? `Code ${info.dropoff.code} · ` : ''}{LEVEL[info.dropoff.level] ?? ''}</span>
                  {details(info.dropoff) && <span className="text-[13.5px] font-bold">{details(info.dropoff)}</span>}
                </div>
                {info.cod_amount_gnf > 0 && <div className="rounded-2xl bg-[#3a2f12] px-4 py-3 text-[14px] font-bold text-amber">Espèces à encaisser : {formatGnf(info.cod_amount_gnf)}</div>}
                {buyerTel && <a href={buyerTel} className={ghost}>{Ico.phone(18)}Appeler l’acheteur · {formatGnPhone(buyerTel.slice(4))}</a>}
                <form onSubmit={handover} className="flex flex-col gap-3">
                  <div className="flex flex-col gap-2">
                    <span className="text-[13px] font-bold">1. Photo du colis à l’adresse (obligatoire)</span>
                    <label className={`${ghost} cursor-pointer ${shot ? 'border-lime text-lime' : ''}`}>
                      {Ico.camera(18)}{shot ? 'Photo prise · la reprendre' : 'Prendre la photo'}
                      <input type="file" accept="image/*" capture="environment" aria-label="Photo de la remise" className="sr-only" onChange={(e) => { const f = e.target.files?.[0] ?? null; setShot(f); setShotUrl((u) => { if (u) URL.revokeObjectURL(u); return f ? URL.createObjectURL(f) : null; }); }} />
                    </label>
                    {shotUrl && /* eslint-disable-next-line @next/next/no-img-element */ <img src={shotUrl} alt="Aperçu de la photo de remise" className="h-28 w-full rounded-2xl object-cover" />}
                  </div>
                  <span className="text-[13px] font-bold">2. Code à 4 chiffres de l’acheteur (dans son suivi de commande)</span>
                  <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" autoComplete="off" aria-label="Code de remise à 4 chiffres" placeholder="••••" disabled={left === 0}
                    className="h-14 shrink-0 rounded-2xl border border-night-line bg-night text-center font-display text-[26px] tracking-[0.5em] outline-none focus:border-lime" />
                  <button type="submit" disabled={busy || code.length !== 4 || left === 0 || !shot} className={cta}>{busy ? 'Envoi et vérification…' : !shot ? 'Prenez d’abord la photo' : 'Confirmer la remise'}</button>
                  <p className="text-[12px] font-semibold text-night-muted">{left === 0 ? 'Colis verrouillé : contactez l’équipe Hailand.' : info.handover_failures > 0 ? `${left} essai${left > 1 ? 's' : ''} restant${left > 1 ? 's' : ''}.` : 'L’acheteur peut aussi scanner lui-même le QR du colis.'}</p>
                </form>
              </>
            )}
            <button type="button" onClick={() => { setFollow(true); setMode('guidage'); }} className="h-10 shrink-0 text-[13px] font-bold text-night-muted">Reprendre le guidage</button>
          </section>
        </>
      )}
      {scan && <QrScanner dark onClose={() => setScan(false)} onResult={pickup} />}
    </main>
  );
}

/** Fiche d'un arrêt (R : retrait, D : dépôt) dans l'aperçu de la mission. */
function StopCard({ letter, title, stop, heading, leg, callLabel, showPlace = true }: { letter: 'R' | 'D'; title: string; stop: Stop; heading: string; leg: { distance: number; duration: number } | null; callLabel: string; showPlace?: boolean }) {
  const tel = telHref(stop.phone);
  const extra = details(stop);
  return (
    <article className="flex items-start gap-3 rounded-[18px] border border-night-line bg-night px-3.5 py-3">
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center text-[13px] font-extrabold text-ink ${letter === 'D' ? 'rounded-full bg-lime' : 'rounded-[9px] bg-white'}`}>{letter}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[11.5px] font-extrabold tracking-[0.04em] text-night-muted">{title.toUpperCase()}{leg ? ` · ${meters(leg.distance)} · ${minutes(leg.duration)}` : ''}</span>
        <span className="text-[15px] font-extrabold">{heading}</span>
        {showPlace && <span className="text-[13px] font-semibold text-night-text/85">{place(stop)}</span>}
        {(stop.code || letter === 'D') && <span className="text-[12.5px] font-semibold text-night-muted">{stop.code ? `Code ${stop.code}` : 'Sans code'}{letter === 'D' ? ` · ${LEVEL[stop.level] ?? ''}` : ''}</span>}
        {extra && <span className="text-[12.5px] font-semibold text-night-muted">{letter === 'R' ? 'Repère : ' : ''}{extra}</span>}
      </div>
      {tel && <a href={tel} aria-label={callLabel} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-night-line">{Ico.phone(18)}</a>}
    </article>
  );
}
