'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { browserClient } from '@/lib/supabase';

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
interface Tracking { status: string; shop_lng: number | null; shop_lat: number | null; dest_lng: number | null; dest_lat: number | null; courier_lng: number | null; courier_lat: number | null; courier_seen_at: string | null }
const dot = (color: string, label: string) => { const el = document.createElement('div'); el.setAttribute('aria-label', label); el.style.cssText = `width:18px;height:18px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35)`; return el; };

/** Carte de suivi : boutique (retrait), votre adresse, et le livreur quand il a retiré le colis (position récente seulement). */
export function TrackingMap({ parcelId }: { parcelId: string }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<import('mapbox-gl').Map | null>(null);
  const mb = useRef<typeof import('mapbox-gl').default | null>(null);
  const marks = useRef<Record<string, import('mapbox-gl').Marker>>({});
  const fitted = useRef(false);
  const [t, setT] = useState<Tracking | null>(null);
  const [failed, setFailed] = useState(false);

  const poll = useCallback(async () => {
    const sb = browserClient(); if (!sb) return;
    const { data } = await sb.rpc('fn_parcel_tracking', { p_parcel: parcelId });
    const r = (data as Tracking[] | null)?.[0]; if (r) setT(r);
  }, [parcelId]);
  useEffect(() => { void poll(); const i = setInterval(poll, 10_000); return () => clearInterval(i); }, [poll]);

  useEffect(() => {
    if (!TOKEN || !box.current) return;
    let cancelled = false;
    (async () => {
      const m = (await import('mapbox-gl')).default;
      await import('mapbox-gl/dist/mapbox-gl.css');
      if (cancelled || !box.current) return;
      m.accessToken = TOKEN; mb.current = m;
      const mp = new m.Map({ container: box.current, style: 'mapbox://styles/mapbox/streets-v12', center: [-13.6773, 9.537], zoom: 12, attributionControl: false });
      mp.addControl(new m.AttributionControl({ compact: true }));
      mp.on('error', () => setFailed(true));
      map.current = mp;
    })();
    return () => { cancelled = true; map.current?.remove(); map.current = null; marks.current = {}; fitted.current = false; };
  }, []);

  useEffect(() => {
    const mp = map.current, m = mb.current; if (!t || !mp || !m) return;
    const put = (key: string, lng: number | null, lat: number | null, color: string, label: string) => {
      if (lng == null || lat == null) { marks.current[key]?.remove(); delete marks.current[key]; return; }
      if (marks.current[key]) marks.current[key]!.setLngLat([lng, lat]); else marks.current[key] = new m.Marker({ element: dot(color, label) }).setLngLat([lng, lat]).addTo(mp);
    };
    put('shop', t.shop_lng, t.shop_lat, '#12141c', 'Boutique');
    put('dest', t.dest_lng, t.dest_lat, '#3346f0', 'Votre adresse');
    put('courier', t.courier_lng, t.courier_lat, '#c8f25a', 'Livreur');
    if (!fitted.current) {
      const pts = [[t.shop_lng, t.shop_lat], [t.dest_lng, t.dest_lat]].filter((p): p is [number, number] => p[0] != null && p[1] != null);
      if (pts.length) { const b = new m.LngLatBounds(pts[0], pts[0]); pts.forEach((p) => b.extend(p)); mp.fitBounds(b, { padding: 50, maxZoom: 16, duration: 0 }); fitted.current = true; }
    }
  }, [t]);

  if (!TOKEN || failed) return null;
  const seen = t?.courier_seen_at ? Math.max(0, Math.round((Date.now() - new Date(t.courier_seen_at).getTime()) / 60_000)) : null;
  return (
    <div className="flex flex-col gap-1.5">
      <div ref={box} className="h-[220px] w-full overflow-hidden rounded-2xl border border-line bg-sand" aria-label="Carte de suivi du colis" />
      <p className="flex flex-wrap gap-x-3 text-[11.5px] font-semibold text-muted"><span>● Boutique</span><span className="text-blue">● Votre adresse</span>{t?.courier_lat != null && <span className="text-ok">● Livreur{seen !== null ? ` (vu il y a ${seen} min)` : ''}</span>}</p>
    </div>
  );
}
