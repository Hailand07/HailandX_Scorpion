'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@hailandx/ui';
import {
  CONFIDENCE_LABELS, SCAN_RADIUS_M, certifiedBuildingsNear, describeGeoError, detectAtTap, detectBuilding, fmtM, isInAppBrowser, levelLabel, osmPolygonsAround, proposalFromDetection, proposalFromTap,
  shouldStop, summarize, type BuildingsClient, type CandidateInput, type GpsSample, type GpsSummary, type Proposal,
} from '@hailandx/scorpion';
import { browserClient } from '@hailandx/kit';
import type { ConfirmedBuilding } from '@/lib/address';

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const CONAKRY: [number, number] = [-13.6773, 9.5370];
const OSM_FILL = 'hx-osm-fill';
const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
const fc = (polys: GeoJSON.Polygon[]): GeoJSON.FeatureCollection => ({ type: 'FeatureCollection', features: polys.map((p) => ({ type: 'Feature', properties: {}, geometry: p })) });

export interface Picked { point: [number, number]; gps: [number, number] | null; accuracy: number; source: 'gps' | 'carte'; building: ConfirmedBuilding | null }

/**
 * « Où livrer ? » : me localiser (plusieurs mesures GPS moyennées par Scorpion), ajuster le repère en touchant la carte, puis confirmer
 * le bâtiment détecté (certifié Hailand = niveau 3 après vérification par la base ; contour OSM = niveau 2 ; sinon zone = niveau 1).
 */
export function AddressPicker({ onChange }: { onChange: (p: Picked | null) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<import('mapbox-gl').Map | null>(null);
  const marker = useRef<import('mapbox-gl').Marker | null>(null);
  const mapboxRef = useRef<typeof import('mapbox-gl').default | null>(null);
  const hailand = useRef<CandidateInput[]>([]);
  const gpsRef = useRef<{ gps: [number, number]; accuracy: number } | null>(null);
  const pickedRef = useRef<Picked | null>(null);
  const run = useRef(0);
  const [mapReady, setMapReady] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const [summary, setSummary] = useState<GpsSummary | null>(null);
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [help, setHelp] = useState<string | null>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const inApp = typeof navigator !== 'undefined' && isInAppBrowser();

  const emit = useCallback((p: Picked | null) => { pickedRef.current = p; setPicked(p); onChange(p); }, [onChange]);
  const setSource = (id: string, data: GeoJSON.FeatureCollection) => (map.current?.getSource(id) as import('mapbox-gl').GeoJSONSource | undefined)?.setData(data);

  // Attend que les tuiles soient chargées (3 essais) avant de lire les contours OSM.
  const readOsm = useCallback(async (center: [number, number], radius: number) => {
    const mp = map.current; if (!mp) return [];
    for (let i = 0; i < 3; i++) {
      const found = osmPolygonsAround(mp as never, center, radius, [OSM_FILL]);
      if (found.length || i === 2) return found.map((o) => ({ source: 'osm' as const, id: o.id, polygon: o.polygon }));
      await new Promise<void>((res) => { const t = setTimeout(res, 700); mp.once('idle', () => { clearTimeout(t); res(); }); });
    }
    return [];
  }, []);

  const loadHailand = useCallback(async (center: [number, number]) => {
    const sb = browserClient(); if (!sb) return;
    hailand.current = await certifiedBuildingsNear(sb as unknown as BuildingsClient, center, 300);
    setSource('hx-hailand', fc(hailand.current.map((b) => b.polygon)));
  }, []);

  const showProposal = useCallback((pr: Proposal) => {
    setProposal(pr);
    setSource('hx-chosen', pr.kind === 'certifie' || pr.kind === 'osm' ? fc([pr.candidate.polygon]) : EMPTY);
  }, []);

  const place = useCallback(async (point: [number, number], opts: { accuracy: number; gps: [number, number] | null; source: Picked['source']; fly?: boolean; tap?: boolean }) => {
    const m = map.current; const mb = mapboxRef.current;
    if (m && mb) {
      if (!marker.current) {
        marker.current = new mb.Marker({ color: '#3346f0', draggable: true }).setLngLat(point).addTo(m);
        marker.current.on('dragend', () => { const l = marker.current!.getLngLat(); void place([l.lng, l.lat], { accuracy: gpsRef.current?.accuracy ?? 0, gps: gpsRef.current?.gps ?? null, source: 'carte', tap: true }); });
      } else marker.current.setLngLat(point);
      if (opts.fly) m.flyTo({ center: point, zoom: Math.max(m.getZoom(), 18), duration: 700 });
    }
    // Un nouveau point annule la confirmation précédente.
    emit({ point, gps: opts.gps, accuracy: opts.accuracy, source: opts.source, building: null });
    setProposal(null); setSource('hx-chosen', EMPTY);
    if (!m) return;
    const id = ++run.current;
    setAnalysing(true);
    await loadHailand(point);
    const gps = opts.gps ?? point;
    const inputs = opts.tap
      ? [...hailand.current, ...(await readOsm(point, 30))]
      : [...hailand.current, ...(await readOsm(point, SCAN_RADIUS_M))];
    if (id !== run.current) return; // un point plus récent a pris le relais
    setAnalysing(false);
    if (opts.tap) {
      const mPerPx = (40075016.686 * Math.cos((point[1] * Math.PI) / 180)) / (512 * 2 ** m.getZoom());
      showProposal(proposalFromTap(detectAtTap(point, gps, opts.accuracy, inputs, 12 * mPerPx)));
    } else {
      showProposal(proposalFromDetection(detectBuilding(gps, opts.accuracy, inputs)));
    }
  }, [emit, loadHailand, readOsm, showProposal]);

  function confirmProposal() {
    if (!proposal || (proposal.kind !== 'certifie' && proposal.kind !== 'osm') || !pickedRef.current) return;
    const c = proposal.candidate;
    emit({ ...pickedRef.current, building: proposal.kind === 'certifie' ? { kind: 'certifie', id: c.id, code: c.code ?? null } : { kind: 'osm', id: c.id, polygon: c.polygon } });
  }
  function declineProposal() {
    setProposal({ kind: 'zone', level: 1, text: 'D’accord. Touchez votre bâtiment sur la carte pour le désigner, ou gardez la zone (niveau 1).' });
    setSource('hx-chosen', EMPTY);
    if (pickedRef.current) emit({ ...pickedRef.current, building: null });
  }

  useEffect(() => {
    if (!TOKEN || !box.current) return;
    let cancelled = false;
    (async () => {
      const mb = (await import('mapbox-gl')).default;
      await import('mapbox-gl/dist/mapbox-gl.css');
      if (cancelled || !box.current) return;
      mb.accessToken = TOKEN;
      mapboxRef.current = mb;
      const m = new mb.Map({ container: box.current, style: 'mapbox://styles/mapbox/satellite-streets-v12', center: CONAKRY, zoom: 12, attributionControl: false });
      m.addControl(new mb.AttributionControl({ compact: true }));
      m.on('load', () => {
        // Contours OSM (invisibles pour l'œil, lisibles par le code), bâtiments certifiés Hailand (vert) et bâtiment retenu (bleu).
        m.addSource('hx-osm', { type: 'vector', url: 'mapbox://mapbox.mapbox-streets-v8' });
        m.addLayer({ id: OSM_FILL, type: 'fill', source: 'hx-osm', 'source-layer': 'building', paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.05 } });
        m.addLayer({ id: 'hx-osm-line', type: 'line', source: 'hx-osm', 'source-layer': 'building', paint: { 'line-color': '#ffffff', 'line-opacity': 0.4, 'line-width': 1 } });
        m.addSource('hx-hailand', { type: 'geojson', data: EMPTY });
        m.addLayer({ id: 'hx-hailand-line', type: 'line', source: 'hx-hailand', paint: { 'line-color': '#3ddc84', 'line-width': 2, 'line-opacity': 0.9 } });
        m.addSource('hx-chosen', { type: 'geojson', data: EMPTY });
        m.addLayer({ id: 'hx-chosen-fill', type: 'fill', source: 'hx-chosen', paint: { 'fill-color': '#3346f0', 'fill-opacity': 0.3 } });
        m.addLayer({ id: 'hx-chosen-line', type: 'line', source: 'hx-chosen', paint: { 'line-color': '#3346f0', 'line-width': 3.5 } });
        setMapReady(true);
      });
      m.on('click', (e) => void place([e.lngLat.lng, e.lngLat.lat], { accuracy: gpsRef.current?.accuracy ?? 0, gps: gpsRef.current?.gps ?? null, source: 'carte', tap: true }));
      m.on('error', () => setMapFailed(true));
      map.current = m;
    })();
    return () => { cancelled = true; map.current?.remove(); map.current = null; marker.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function locate() {
    setHelp(null); setState('busy'); setSummary(null);
    if (!navigator.geolocation) { setState('idle'); return setHelp('La localisation n’est pas disponible sur cet appareil. Touchez la carte pour placer votre porte.'); }
    const samples: GpsSample[] = [];
    const t0 = Date.now();
    let id = -1;
    const finish = (s: GpsSummary | null) => {
      navigator.geolocation.clearWatch(id);
      if (!s) { setState('idle'); return setHelp('Position introuvable. Sortez à l’air libre, ou touchez la carte pour placer votre porte.'); }
      setState('done'); setSummary(s);
      gpsRef.current = { gps: s.position, accuracy: s.accuracy };
      void place(s.position, { accuracy: s.accuracy, gps: s.position, source: 'gps', fly: true });
    };
    const timer = setTimeout(() => finish(summarize(samples)), 15_000);
    id = navigator.geolocation.watchPosition(
      (p) => {
        samples.push({ lng: p.coords.longitude, lat: p.coords.latitude, accuracy: p.coords.accuracy, t: Date.now() });
        const s = summarize(samples); setSummary(s);
        if (shouldStop(s, Date.now() - t0)) { clearTimeout(timer); finish(s); }
      },
      (e) => { clearTimeout(timer); navigator.geolocation.clearWatch(id); setState('idle'); const h = describeGeoError(e.code); setHelp(`${h.title}. ${h.steps[0] ?? ''}`.trim()); },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
    );
  }

  const confirmed = picked?.building ?? null;
  const level = confirmed ? (confirmed.kind === 'certifie' ? 3 : 2) : 1;
  return (
    <div className="flex flex-col gap-3">
      {inApp && <p role="alert" className="rounded-2xl bg-amber-soft px-4 py-3 text-[13px] font-semibold">La localisation ne marche pas dans le navigateur de cette application. Ouvrez ce lien dans Safari ou Chrome (menu ⋯ puis « Ouvrir dans le navigateur »), ou touchez la carte pour placer votre porte.</p>}
      <Button type="button" onClick={locate} disabled={state === 'busy'} variant="lime">{state === 'busy' ? 'Mesure en cours…' : state === 'done' ? 'Me localiser à nouveau' : 'Me localiser'}</Button>
      {summary && <p aria-live="polite" className="text-[12.5px] font-semibold text-muted">{state === 'busy' ? `${summary.kept} mesures · précision ±${fmtM(summary.accuracy, 0)} m…` : `Précision ±${fmtM(summary.accuracy, 0)} m · confiance ${CONFIDENCE_LABELS[summary.confidence].toLowerCase()}.`}</p>}
      {help && <p role="alert" className="rounded-2xl bg-[#fde8e4] px-4 py-3 text-[13px] font-semibold text-[#8a2a1c]">{help}</p>}
      {TOKEN ? (
        <>
          <div ref={box} className="h-[300px] w-full overflow-hidden rounded-[22px] border border-line bg-sand" aria-label="Carte : touchez l’emplacement de votre porte" />
          <p className="text-[12.5px] font-medium text-muted">{mapFailed && !mapReady ? 'La carte ne se charge pas (réseau). Utilisez « Me localiser » : votre position suffit (niveau 1).' : mapReady ? (picked ? 'Repère placé. Touchez la carte ou faites-le glisser pour l’ajuster.' : 'Touchez la carte à l’emplacement de votre porte.') : 'Chargement de la carte…'}</p>
        </>
      ) : (
        <p className="rounded-2xl bg-sand px-4 py-3 text-[12.5px] font-semibold text-muted">Carte indisponible pour l’instant : utilisez « Me localiser ».</p>
      )}
      {analysing && <p aria-live="polite" className="text-[12.5px] font-semibold text-muted">Recherche de votre bâtiment…</p>}
      {proposal && !analysing && (
        <div role="status" className={`flex flex-col gap-2 rounded-2xl px-4 py-3 ${proposal.kind === 'certifie' ? 'bg-ok-soft' : proposal.kind === 'osm' ? 'bg-blue-soft' : 'bg-sand'}`}>
          <span className="text-[13.5px] font-bold">{proposal.text}</span>
          {(proposal.kind === 'certifie' || proposal.kind === 'osm') && !confirmed && (
            <div className="flex gap-2">
              <button type="button" onClick={confirmProposal} className="h-11 flex-1 rounded-xl bg-ink text-[13.5px] font-extrabold text-white">Oui, c’est mon bâtiment</button>
              <button type="button" onClick={declineProposal} className="h-11 rounded-xl border border-line bg-card px-4 text-[13.5px] font-bold">Non</button>
            </div>
          )}
          {confirmed && <span className="text-[12.5px] font-extrabold text-ok">✓ Confirmé : {levelLabel(level)}{confirmed.kind === 'certifie' ? ' (vérifié à l’enregistrement)' : ''}</span>}
        </div>
      )}
      {picked && !proposal && !analysing && mapReady && <p className="text-[12px] font-semibold text-muted">{levelLabel(1)}</p>}
    </div>
  );
}
