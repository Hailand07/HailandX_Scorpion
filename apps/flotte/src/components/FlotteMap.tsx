'use client';
import { useEffect, useRef, useState } from 'react';
import type { LngLat } from '@/lib/nav';
import { HAILAND_NUIT, NUIT } from '@/lib/hailandNuit';

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
/** Carte « Hailand Nuit » (style écrit dans `lib/hailandNuit.ts`) ; repli sur le style sombre de Mapbox si elle ne se charge pas. */
const FALLBACK_STYLE = 'mapbox://styles/mapbox/dark-v11';
export const hasMap = Boolean(TOKEN);

export interface Pin { id: string; at: LngLat; kind: 'me' | 'pickup' | 'dropoff' | 'fee'; label?: string; heading?: number | null; active?: boolean; onClick?: () => void }
/** Tracé. `glow` : halo lumineux (itinéraire à suivre) ; `dashed` : pointillé (étape suivante, trajet indicatif). */
export interface Line { id: string; coords: LngLat[]; color: string; dashed?: boolean; width?: number; glow?: boolean }
/** Bâtiment surligné : `color` (retrait ambre, dépôt vert), `active` = l'arrêt vers lequel on va maintenant (plus marqué). */
export interface Area { id: string; geometry: GeoJSON.Geometry; color?: string; active?: boolean }
export type View =
  | { mode: 'fit'; points: LngLat[]; padding?: { top: number; bottom: number; left: number; right: number }; maxZoom?: number }
  | { mode: 'follow'; at: LngLat; bearing: number | null; padding?: { top: number; bottom: number }; zoom?: number };

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

/** Déplace doucement un marqueur vers sa nouvelle position (≈ 0,9 s) au lieu de le faire sauter d'un point GPS à l'autre. */
const glides = new WeakMap<object, number>();
function glide(mk: import('mapbox-gl').Marker, to: LngLat, ms = 900) {
  const from = mk.getLngLat();
  const stop = glides.get(mk); if (stop) cancelAnimationFrame(stop);
  if (Math.abs(from.lng - to[0]) + Math.abs(from.lat - to[1]) > 0.01) { mk.setLngLat(to); return; } // saut (> ~1 km) : pas d'animation
  const t0 = performance.now();
  const step = (t: number) => {
    const k = Math.min(1, (t - t0) / ms), e = k * (2 - k);
    mk.setLngLat([from.lng + (to[0] - from.lng) * e, from.lat + (to[1] - from.lat) * e]);
    if (k < 1) glides.set(mk, requestAnimationFrame(step)); else glides.delete(mk);
  };
  glides.set(mk, requestAnimationFrame(step));
}

function pinElement(p: Pin): HTMLElement {
  const el = document.createElement(p.onClick ? 'button' : 'div');
  if (p.onClick) { (el as HTMLButtonElement).type = 'button'; el.addEventListener('click', (e) => { e.stopPropagation(); p.onClick?.(); }); }
  paint(el, p);
  return el;
}

function paint(el: HTMLElement, p: Pin) {
  el.setAttribute('aria-label', p.kind === 'me' ? 'Votre position' : p.kind === 'pickup' ? `Retrait${p.label ? ` : ${p.label}` : ''}` : p.kind === 'dropoff' ? 'Dépôt' : `Mission ${p.label ?? ''}`);
  if (p.kind === 'me') {
    // Curseur du livreur (maquette v5 F4) : flèche bleue bordée de blanc avec halo quand le cap est connu, sinon point bleu.
    // La rotation est faite par Mapbox (marqueur aligné sur la carte) : la flèche reste juste quand la carte tourne.
    const fleche = p.heading !== null && p.heading !== undefined;
    el.style.cssText = 'width:52px;height:52px;display:flex;align-items:center;justify-content:center;pointer-events:none';
    el.innerHTML = fleche
      ? '<span style="position:absolute;inset:4px;border-radius:50%;background:rgba(51,70,240,.22)"></span><svg width="40" height="40" viewBox="0 0 40 40" style="position:relative;filter:drop-shadow(0 2px 4px rgba(0,0,0,.5))"><path d="M20 4 33 34 20 27 7 34z" fill="#3346f0" stroke="#fff" stroke-width="3" stroke-linejoin="round"/></svg>'
      : '<span style="position:absolute;inset:10px;border-radius:50%;background:rgba(51,70,240,.25)"></span><span style="position:relative;width:20px;height:20px;border-radius:50%;background:#3346f0;border:4px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.5)"></span>';
  } else if (p.kind === 'pickup' || p.kind === 'dropoff') {
    const d = p.kind === 'dropoff';
    el.style.cssText = `width:32px;height:32px;border-radius:${d ? '16px' : '9px'};background:${d ? NUIT.depot : NUIT.retrait};color:#12141c;font:800 14px Manrope,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.45);border:2px solid #12141c`;
    el.textContent = d ? 'D' : 'R';
  } else {
    el.style.cssText = `height:30px;padding:0 10px;border-radius:15px;background:${p.active ? '#c8f25a' : '#fff'};color:#12141c;font:800 12.5px Manrope,system-ui,sans-serif;display:flex;align-items:center;box-shadow:0 2px 8px rgba(0,0,0,.45);border:${p.active ? '2px solid #12141c' : '0'};cursor:pointer;white-space:nowrap`;
    el.textContent = p.label ?? '';
  }
}

/**
 * Carte Mapbox plein cadre de Flotte : repères (position, retrait R, dépôt D, missions), tracés, contours de bâtiments.
 * `view` : cadrer des points, ou suivre le livreur (carte orientée dans son sens de marche, inclinée).
 * `onUserMove` : le livreur a déplacé la carte à la main (on cesse de le suivre jusqu'à « Recentrer »).
 */
export function FlotteMap({ pins, lines = [], areas = [], view, onUserMove, className = '' }: { pins: Pin[]; lines?: Line[]; areas?: Area[]; view: View | null; onUserMove?: () => void; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<import('mapbox-gl').Map | null>(null);
  const mb = useRef<typeof import('mapbox-gl').default | null>(null);
  const marks = useRef<Map<string, { m: import('mapbox-gl').Marker; key: string }>>(new Map());
  const moveCb = useRef(onUserMove);
  moveCb.current = onUserMove;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!TOKEN || !box.current) return;
    let cancelled = false; let loaded = false; let fellBack = false;
    (async () => {
      const m = (await import('mapbox-gl')).default;
      await import('mapbox-gl/dist/mapbox-gl.css');
      if (cancelled || !box.current) return;
      m.accessToken = TOKEN; mb.current = m;
      const mp = new m.Map({ container: box.current, style: HAILAND_NUIT, center: [-13.6773, 9.537], zoom: 13, attributionControl: false, pitchWithRotate: false });
      mp.addControl(new m.AttributionControl({ compact: true }), 'bottom-left');
      const setup = () => {
        if (!mp.getSource('hx-lines')) {
          mp.addSource('hx-areas', { type: 'geojson', data: EMPTY });
          mp.addLayer({ id: 'hx-areas-glow', type: 'line', source: 'hx-areas', filter: ['==', ['get', 'active'], true], paint: { 'line-color': ['get', 'color'], 'line-width': 12, 'line-blur': 8, 'line-opacity': 0.55 } });
          mp.addLayer({ id: 'hx-areas-fill', type: 'fill', source: 'hx-areas', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': ['case', ['get', 'active'], 0.42, 0.22] } });
          mp.addLayer({ id: 'hx-areas-line', type: 'line', source: 'hx-areas', paint: { 'line-color': ['get', 'color'], 'line-width': ['case', ['get', 'active'], 3.5, 2] } });
          // En navigation inclinée, le bâtiment surligné se dresse en volume coloré au-dessus des volumes sombres de la ville.
          mp.addLayer({ id: 'hx-areas-3d', type: 'fill-extrusion', source: 'hx-areas', minzoom: 15, paint: { 'fill-extrusion-color': ['get', 'color'], 'fill-extrusion-height': ['case', ['get', 'active'], 9, 7], 'fill-extrusion-base': 0, 'fill-extrusion-opacity': 0.7 } });
          mp.addSource('hx-lines', { type: 'geojson', data: EMPTY });
          mp.addLayer({ id: 'hx-lines-glow', type: 'line', source: 'hx-lines', filter: ['==', ['get', 'glow'], true], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': ['+', ['get', 'width'], 16], 'line-blur': 10, 'line-opacity': 0.42 } });
          mp.addLayer({ id: 'hx-lines-casing', type: 'line', source: 'hx-lines', filter: ['!=', ['get', 'dashed'], true], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': NUIT.halo, 'line-width': ['+', ['get', 'width'], 4], 'line-opacity': 0.7 } });
          mp.addLayer({ id: 'hx-lines', type: 'line', source: 'hx-lines', filter: ['!=', ['get', 'dashed'], true], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': ['get', 'width'] } });
          mp.addLayer({ id: 'hx-lines-dash', type: 'line', source: 'hx-lines', filter: ['==', ['get', 'dashed'], true], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': ['get', 'width'], 'line-dasharray': [0.1, 2] } });
        }
        loaded = true; setReady(false); setReady(true);
      };
      mp.on('style.load', setup);
      // Carte Hailand Nuit inaccessible (jeton, réseau) : on bascule une fois sur le style sombre de Mapbox.
      mp.on('error', (e) => {
        const status = (e.error as { status?: number } | undefined)?.status;
        if (!loaded && !fellBack && (status === 401 || status === 403 || status === 404)) { fellBack = true; mp.setStyle(FALLBACK_STYLE); return; }
        if (!loaded && fellBack) setFailed(true);
      });
      mp.on('dragstart', (e) => { if ((e as { originalEvent?: unknown }).originalEvent) moveCb.current?.(); });
      mp.on('zoomstart', (e) => { if ((e as { originalEvent?: unknown }).originalEvent) moveCb.current?.(); });
      map.current = mp;
    })().catch(() => setFailed(true));
    const marksNow = marks.current;
    return () => { cancelled = true; map.current?.remove(); map.current = null; marksNow.clear(); };
  }, []);

  // Repères : créés, déplacés ou repeints selon leur identifiant.
  useEffect(() => {
    const mp = map.current, m = mb.current; if (!mp || !m || !ready) return;
    const seen = new Set<string>();
    for (const p of pins) {
      seen.add(p.id);
      const isMe = p.kind === 'me';
      // Pour le curseur, la clé ne change qu'entre flèche et point : la rotation est appliquée à part (sans repeindre).
      const key = `${p.kind}|${p.label ?? ''}|${p.active ? 1 : 0}|${isMe ? (p.heading === null || p.heading === undefined ? '-' : 'f') : ''}`;
      const cur = marks.current.get(p.id);
      if (cur) {
        if (isMe) glide(cur.m, p.at); else cur.m.setLngLat(p.at);
        if (cur.key !== key) { paint(cur.m.getElement(), p); cur.key = key; }
      } else {
        const opts = isMe ? { element: pinElement(p), rotationAlignment: 'map' as const, pitchAlignment: 'map' as const } : { element: pinElement(p) };
        marks.current.set(p.id, { m: new m.Marker(opts).setLngLat(p.at).addTo(mp), key });
      }
      if (isMe) marks.current.get(p.id)!.m.setRotation(p.heading ?? 0);
    }
    for (const [id, v] of marks.current) if (!seen.has(id)) { v.m.remove(); marks.current.delete(id); }
  }, [pins, ready]);

  useEffect(() => {
    const mp = map.current; if (!mp || !ready) return;
    (mp.getSource('hx-lines') as import('mapbox-gl').GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: lines.filter((l) => l.coords.length > 1).map((l) => ({ type: 'Feature', properties: { color: l.color, dashed: Boolean(l.dashed), glow: Boolean(l.glow), width: l.width ?? 6 }, geometry: { type: 'LineString', coordinates: l.coords } })) });
    (mp.getSource('hx-areas') as import('mapbox-gl').GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: areas.map((a) => ({ type: 'Feature', properties: { color: a.color ?? NUIT.depot, active: a.active !== false }, geometry: a.geometry })) });
  }, [lines, areas, ready]);

  // Cadrage : suivi du livreur (orienté, incliné), ou ensemble des points utiles.
  const viewKey = view ? (view.mode === 'follow' ? `f|${view.at[0].toFixed(5)}|${view.at[1].toFixed(5)}|${Math.round((view.bearing ?? 0) / 4)}|${(view.zoom ?? 0).toFixed(1)}` : `b|${view.points.map((p) => `${p[0].toFixed(4)},${p[1].toFixed(4)}`).join(';')}|${Math.round((view.padding?.bottom ?? 0) / 40)}`) : '';
  useEffect(() => {
    const mp = map.current, m = mb.current; if (!mp || !m || !ready || !view) return;
    if (view.mode === 'follow') {
      // Caméra de navigation : inclinée, orientée dans le sens de marche, zoom selon la vitesse ; glissement linéaire entre deux points GPS.
      mp.easeTo({ center: view.at, bearing: view.bearing ?? mp.getBearing(), pitch: 60, zoom: view.zoom ?? 17.3, padding: { top: view.padding?.top ?? 170, bottom: view.padding?.bottom ?? 150, left: 0, right: 0 }, duration: 1000, easing: (t) => t });
    } else if (view.points.length === 1) {
      mp.easeTo({ center: view.points[0], zoom: 16, bearing: 0, pitch: 0, duration: 600 });
    } else if (view.points.length > 1) {
      const b = new m.LngLatBounds(view.points[0], view.points[0]);
      view.points.forEach((p) => b.extend(p));
      // Le cadre doit tenir dans la carte même quand le panneau du bas est haut.
      const H = mp.getContainer().clientHeight, W = mp.getContainer().clientWidth;
      const pad = view.padding ?? { top: 90, bottom: 330, left: 50, right: 50 };
      const bottom = Math.min(pad.bottom, Math.max(0, H - pad.top - 120));
      mp.fitBounds(b, { padding: { ...pad, bottom, left: Math.min(pad.left, W / 4), right: Math.min(pad.right, W / 4) }, maxZoom: view.maxZoom ?? 16.5, bearing: 0, pitch: 0, duration: 700 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey, ready]);

  if (!TOKEN || failed) {
    return <div className={`flex items-center justify-center bg-night-card px-8 text-center text-[13px] font-semibold text-night-muted ${className}`}>Carte indisponible (jeton Mapbox ou réseau). Les adresses et les appels restent ci-dessous.</div>;
  }
  // Cadre séparé : la feuille de style de Mapbox impose `position: relative` au conteneur de la carte, ce qui annulerait le plein écran.
  return <div className={`bg-night ${className}`} role="region" aria-label="Carte"><div ref={box} className="h-full w-full" /></div>;
}
