'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@hailandx/ui';
import { CONFIDENCE_LABELS, describeGeoError, fmtM, isInAppBrowser, shouldStop, summarize, type GpsSample, type GpsSummary } from '@hailandx/scorpion';

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const CONAKRY: [number, number] = [-13.6773, 9.5370];

export interface Picked { point: [number, number]; accuracy: number; source: 'gps' | 'carte' }

/** « Où livrer ? » : me localiser (plusieurs mesures GPS moyennées par Scorpion) puis ajuster le repère en touchant la carte. */
export function AddressPicker({ onChange }: { onChange: (p: Picked | null) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<import('mapbox-gl').Map | null>(null);
  const marker = useRef<import('mapbox-gl').Marker | null>(null);
  const mapboxRef = useRef<typeof import('mapbox-gl').default | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const [summary, setSummary] = useState<GpsSummary | null>(null);
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [help, setHelp] = useState<string | null>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const inApp = typeof navigator !== 'undefined' && isInAppBrowser();

  const place = useCallback((point: [number, number], accuracy: number, source: Picked['source'], fly = true) => {
    const m = map.current; const mb = mapboxRef.current;
    if (m && mb) {
      if (!marker.current) {
        marker.current = new mb.Marker({ color: '#3346f0', draggable: true }).setLngLat(point).addTo(m);
        marker.current.on('dragend', () => { const l = marker.current!.getLngLat(); const p: Picked = { point: [l.lng, l.lat], accuracy: 0, source: 'carte' }; setPicked(p); onChange(p); });
      } else marker.current.setLngLat(point);
      if (fly) m.flyTo({ center: point, zoom: Math.max(m.getZoom(), 18), duration: 700 });
    }
    const p: Picked = { point, accuracy, source };
    setPicked(p); onChange(p);
  }, [onChange]);

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
      m.on('click', (e) => place([e.lngLat.lng, e.lngLat.lat], 0, 'carte', false));
      m.on('load', () => setMapReady(true));
      m.on('error', () => setMapFailed(true)); // style ou fonds de carte inaccessibles (réseau) : on le dit au lieu d'attendre
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
      setState('done'); setSummary(s); place(s.position, s.accuracy, 'gps');
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

  return (
    <div className="flex flex-col gap-3">
      {inApp && <p role="alert" className="rounded-2xl bg-amber-soft px-4 py-3 text-[13px] font-semibold">La localisation ne marche pas dans le navigateur de cette application. Ouvrez ce lien dans Safari ou Chrome (menu ⋯ puis « Ouvrir dans le navigateur »), ou touchez la carte pour placer votre porte.</p>}
      <Button type="button" onClick={locate} disabled={state === 'busy'} variant="lime">{state === 'busy' ? 'Mesure en cours…' : state === 'done' ? 'Me localiser à nouveau' : 'Me localiser'}</Button>
      {summary && <p aria-live="polite" className="text-[12.5px] font-semibold text-muted">{state === 'busy' ? `${summary.kept} mesures · précision ±${fmtM(summary.accuracy, 0)} m…` : `Précision ±${fmtM(summary.accuracy, 0)} m · confiance ${CONFIDENCE_LABELS[summary.confidence].toLowerCase()}.`}</p>}
      {help && <p role="alert" className="rounded-2xl bg-[#fde8e4] px-4 py-3 text-[13px] font-semibold text-[#8a2a1c]">{help}</p>}
      {TOKEN ? (
        <>
          <div ref={box} className="h-[300px] w-full overflow-hidden rounded-[22px] border border-line bg-sand" aria-label="Carte : touchez l’emplacement de votre porte" />
          <p className="text-[12.5px] font-medium text-muted">{mapFailed && !mapReady ? 'La carte ne se charge pas (réseau). Utilisez « Me localiser » : votre position suffit.' : mapReady ? (picked ? 'Repère placé. Touchez la carte ou faites-le glisser pour l’ajuster.' : 'Touchez la carte à l’emplacement de votre porte.') : 'Chargement de la carte…'}</p>
        </>
      ) : (
        <p className="rounded-2xl bg-sand px-4 py-3 text-[12.5px] font-semibold text-muted">Carte indisponible pour l’instant : utilisez « Me localiser ».</p>
      )}
    </div>
  );
}
