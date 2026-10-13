'use client';
import { useEffect, useRef, useState } from 'react';

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
interface Step { maneuver: { instruction: string }; distance: number }
interface Route { distance: number; duration: number; geometry: GeoJSON.LineString; legs: { steps: Step[] }[] }
const km = (m: number) => (m >= 1000 ? `${(m / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km` : `${Math.round(m / 10) * 10} m`);
const dist = (a: [number, number], b: [number, number]) => { const R = 6371008.8, r = Math.PI / 180, dLa = (b[1] - a[1]) * r, dLo = (b[0] - a[0]) * r; const h = Math.sin(dLa / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };

/**
 * Guidage dans l'application : itinéraire sur la carte (Mapbox Directions), distance, durée et consigne suivante, recalculés quand le livreur
 * se déplace de plus de 100 m. Sans jeton ou sans réseau, le bouton « Itinéraire » vers l'application de cartes reste disponible.
 */
export function GuideMap({ from, to, label }: { from: { lat: number; lng: number } | null; to: { lat: number; lng: number }; label: string }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<import('mapbox-gl').Map | null>(null);
  const mb = useRef<typeof import('mapbox-gl').default | null>(null);
  const marks = useRef<Record<string, import('mapbox-gl').Marker>>({});
  const last = useRef<[number, number] | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [showSteps, setShowSteps] = useState(false);

  useEffect(() => {
    if (!TOKEN || !box.current) return;
    let cancelled = false;
    (async () => {
      const m = (await import('mapbox-gl')).default;
      await import('mapbox-gl/dist/mapbox-gl.css');
      if (cancelled || !box.current) return;
      m.accessToken = TOKEN; mb.current = m;
      const mp = new m.Map({ container: box.current, style: 'mapbox://styles/mapbox/dark-v11', center: [to.lng, to.lat], zoom: 13, attributionControl: false });
      mp.addControl(new m.AttributionControl({ compact: true }));
      mp.on('load', () => {
        mp.addSource('route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        mp.addLayer({ id: 'route', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#c8f25a', 'line-width': 6 } });
        setReady(true);
      });
      mp.on('error', () => setFailed(true));
      map.current = mp;
    })();
    return () => { cancelled = true; map.current?.remove(); map.current = null; marks.current = {}; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Itinéraire : au premier relevé, puis quand le livreur s'est déplacé de plus de 100 m.
  useEffect(() => {
    if (!TOKEN || !from) return;
    const here: [number, number] = [from.lng, from.lat];
    if (last.current && dist(last.current, here) < 100) return;
    last.current = here;
    const ctrl = new AbortController();
    fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${here[0]},${here[1]};${to.lng},${to.lat}?geometries=geojson&overview=full&steps=true&language=fr&access_token=${TOKEN}`, { signal: ctrl.signal })
      .then((r) => r.json()).then((j) => { const r0 = (j as { routes?: Route[] }).routes?.[0]; if (r0) setRoute(r0); else setFailed(true); }).catch(() => { if (!ctrl.signal.aborted) setFailed(true); });
    return () => ctrl.abort();
  }, [from, to.lat, to.lng]);

  useEffect(() => {
    const mp = map.current, m = mb.current; if (!mp || !m || !ready) return;
    const put = (key: string, p: [number, number], color: string) => { if (marks.current[key]) marks.current[key]!.setLngLat(p); else marks.current[key] = new m.Marker({ color }).setLngLat(p).addTo(mp); };
    put('to', [to.lng, to.lat], '#c8f25a');
    if (from) put('me', [from.lng, from.lat], '#ffffff');
    if (route) {
      (mp.getSource('route') as import('mapbox-gl').GeoJSONSource).setData({ type: 'Feature', properties: {}, geometry: route.geometry });
      const b = new m.LngLatBounds(route.geometry.coordinates[0] as [number, number], route.geometry.coordinates[0] as [number, number]);
      route.geometry.coordinates.forEach((c) => b.extend(c as [number, number]));
      mp.fitBounds(b, { padding: 40, maxZoom: 17, duration: 400 });
    }
  }, [route, from, to.lat, to.lng, ready]);

  if (!TOKEN || failed) return null;
  const steps = route?.legs[0]?.steps ?? [];
  const next = steps.find((s) => s.maneuver.instruction && s.distance > 0);
  return (
    <div className="flex flex-col gap-2">
      <div ref={box} className="h-[240px] w-full overflow-hidden rounded-2xl border border-night-line bg-night" aria-label={`Itinéraire vers ${label}`} />
      {!from && <p className="text-[12px] font-semibold text-night-muted">En attente de votre position pour calculer l’itinéraire…</p>}
      {route && (
        <div className="flex flex-col gap-1.5 rounded-2xl bg-night px-3.5 py-2.5">
          <div className="flex items-baseline justify-between"><span className="font-display text-[18px] font-semibold text-lime">{km(route.distance)}</span><span className="text-[13px] font-bold text-night-muted">≈ {Math.max(1, Math.round(route.duration / 60))} min</span></div>
          {next && <p className="text-[13.5px] font-bold">{next.maneuver.instruction}</p>}
          <button type="button" onClick={() => setShowSteps((v) => !v)} className="h-9 self-start text-[12.5px] font-bold text-night-muted">{showSteps ? 'Masquer les étapes' : `Voir les ${steps.length} étapes`}</button>
          {showSteps && <ol className="flex max-h-[180px] list-decimal flex-col gap-1 overflow-y-auto pl-5 text-[12.5px] font-medium text-night-muted">{steps.map((s, i) => <li key={i}>{s.maneuver.instruction}{s.distance > 0 ? ` (${km(s.distance)})` : ''}</li>)}</ol>}
        </div>
      )}
    </div>
  );
}
