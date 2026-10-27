'use client';
import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { SupabaseClient } from '@supabase/supabase-js';
import * as turf from '@turf/turf';
import { osmPolygonsAround } from '../osmDetection';
import { certifiedBuildingsNear, type BuildingsClient } from '../certifiedBuildings';
import { IMPRECISE_ACCURACY_M, SCAN_RADIUS_M, bboxOf, detectAtTap, detectBuilding, maxTapDistance, type CandidateInput, type Detection, type TapResult } from '../buildingDetection';
import { fmtCoord, fmtM } from '../gpsAcquisition';
import { Ico, LevelBadge } from './ui';
import { effectiveLevelOf, type DeclarationRecord } from './declarations';
import { ownMatchForCandidate, ownMatchForPoint, ownOutlines } from './ownBuilding';

/** Vue satellite de l'enregistrement guidé (images + rues), comme NavigationX. */
const MAPBOX_SATELLITE_STYLE = 'mapbox://styles/mapbox/satellite-streets-v12';

interface Props {
  /** Client Supabase de l'application (lecture publique des bâtiments certifiés). */
  sb: SupabaseClient;
  /** Jeton public Mapbox de l'application (`NEXT_PUBLIC_MAPBOX_TOKEN`). */
  token: string;
  position: [number, number];
  accuracy: number;
  /** Ligne d'adresse administrative (résolue par le parent). */
  adminLine: string;
  /** Adresses déjà enregistrées par l'utilisateur : leur bâtiment est toujours « chez lui » (notification, rien à enregistrer). */
  homes: DeclarationRecord[];
  /** Résultat de l'analyse, dès qu'il est connu (pour l'adresse administrative et l'enregistrement). */
  onDetected: (d: Detection) => void;
  /** « Oui, c'est mon bâtiment » (ou « Continuer » quand rien n'est trouvé). */
  onConfirm: () => void;
  /** Bâtiment (ou zone) montré par l'utilisateur après « Ce n'est pas le mien » ou « aucun bâtiment ». */
  onPicked: (p: PickedBuilding) => void;
  onRetry: () => void;
  onClose: () => void;
  /** Le bâtiment est déjà l'une des adresses du compte : on la réutilise (rien n'est enregistré une seconde fois). */
  onUseExisting: (d: DeclarationRecord) => void;
}

/** Désignation par touche : contour OSM retenu (niveau 2) ou zone touchée (niveau 1). */
export interface PickedBuilding {
  point: [number, number];
  polygon: GeoJSON.Polygon | null;
  osmId: string | null;
  /** Bâtiment certifié Hailand désigné (rattachement officiel après confirmation visuelle). */
  certifiedId: string | null;
}

type Phase = 'loading' | 'scanning' | 'result' | 'pick';
type Rect = { x: number; y: number; w: number; h: number };

const OSM_FILL = 'reg-osm-fill';
const HUD_CYAN = '#38bdf8';
const COLOR_L3 = '#22c55e';
const COLOR_L2 = '#f5a524';
const COLOR_OWN = '#c084fc'; // « chez vous »
const SHEET_PAD = 300; // marge initiale pour la feuille du bas (ajustée ensuite à sa hauteur réelle)

const empty: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
const fc = (polys: GeoJSON.Polygon[]): GeoJSON.FeatureCollection => ({
  type: 'FeatureCollection',
  features: polys.map((geometry) => ({ type: 'Feature', properties: {}, geometry })),
});

/** Mètres par pixel à la latitude et au zoom courants. */
const metersPerPx = (map: mapboxgl.Map, lat: number) => (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** map.getZoom());

/**
 * Étape « Identification » : vue satellite, lignes de précision graduées en mètres, cercle de précision, balayage, contours
 * examinés un à un, puis crochets resserrés sur le bâtiment retenu. Tout ce qui est affiché vient du calcul (`buildingDetection.ts`).
 */
export const BuildingScan: React.FC<Props> = ({ sb, token, position, accuracy, adminLine, homes, onDetected, onConfirm, onPicked, onRetry, onClose, onUseExisting }) => {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [det, setDet] = useState<Detection | null>(null);
  const [lit, setLit] = useState(0);
  const [hailandSeen, setHailandSeen] = useState<number | null>(null);
  const [center, setCenter] = useState<{ x: number; y: number } | null>(null);
  const [pxPerM, setPxPerM] = useState(0);
  const [target, setTarget] = useState<Rect | null>(null);
  const [size, setSize] = useState({ w: 390, h: 844 });
  const [tap, setTap] = useState<{ point: [number, number]; result: TapResult } | null>(null);
  /** Vue satellite indisponible (réseau faible, Mapbox injoignable) : on continue sans elle plutôt que de bloquer le client. */
  const [noSatellite, setNoSatellite] = useState(false);
  const phaseRef = useRef<Phase>('loading');
  phaseRef.current = phase;
  /** Contour encadré par les crochets (recalculé à chaque déplacement de la carte). */
  const targetRef = useRef<GeoJSON.Polygon | null>(null);
  const hailandRef = useRef<CandidateInput[]>([]);
  const homesRef = useRef(homes);
  homesRef.current = homes;
  /** Feuille du bas : sa hauteur réelle sert de marge à la carte pour garder la cible visible pendant l'analyse. */
  const sheetRef = useRef<HTMLDivElement>(null);
  /** L'utilisateur manipule la carte : la feuille se réduit au bouton principal, puis revient après 3 s de calme. */
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const el = mapDivRef.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const rest = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setBusy(false), 3000);
    };
    const start = () => {
      if (phaseRef.current !== 'result' && phaseRef.current !== 'pick') return;
      clearTimeout(timer);
      setBusy(true);
    };
    const wheel = () => {
      start();
      rest();
    };
    el.addEventListener('pointerdown', start);
    el.addEventListener('wheel', wheel, { passive: true });
    window.addEventListener('pointerup', rest);
    window.addEventListener('pointercancel', rest);
    return () => {
      clearTimeout(timer);
      el.removeEventListener('pointerdown', start);
      el.removeEventListener('wheel', wheel);
      window.removeEventListener('pointerup', rest);
      window.removeEventListener('pointercancel', rest);
    };
  }, []);
  const sheetHRef = useRef(SHEET_PAD);
  useEffect(() => {
    const el = sheetRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      const h = Math.round(el.getBoundingClientRect().height);
      if (Math.abs(h - sheetHRef.current) < 4) return;
      sheetHRef.current = h;
      const map = mapRef.current;
      // Hors du mode « montrer » (où l'utilisateur déplace la carte), la position reste centrée au-dessus de la feuille.
      if (map && (phaseRef.current === 'loading' || phaseRef.current === 'scanning')) map.easeTo({ center: position, padding: { top: 40, bottom: h, left: 0, right: 0 }, duration: 300 });
    });
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapDivRef.current) return;
    let cancelled = false;
    const timers: number[] = [];
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: mapDivRef.current,
      style: MAPBOX_SATELLITE_STYLE,
      center: position,
      zoom: 18.6,
      pitch: 0,
      bearing: 0,
      interactive: false,
      attributionControl: false,
    });
    mapRef.current = map;
    map.setPadding({ top: 40, bottom: SHEET_PAD, left: 0, right: 0 });

    const measureScreen = () => {
      const p = map.project(position);
      setCenter({ x: p.x, y: p.y });
      setPxPerM(1 / metersPerPx(map, position[1]));
      const c = map.getContainer();
      setSize({ w: c.clientWidth, h: c.clientHeight });
      const t = targetRef.current;
      if (t) {
        const [w, s, e, n] = bboxOf(t);
        const a = map.project([w, n]);
        const b = map.project([e, s]);
        setTarget({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) });
      } else setTarget(null);
    };
    map.on('resize', measureScreen);
    map.on('move', measureScreen);

    const whenSettled = (cb: () => void, maxMs = 3000) => {
      let fired = false;
      const go = () => {
        if (fired || cancelled) return;
        fired = true;
        cb();
      };
      map.once('idle', go);
      timers.push(window.setTimeout(go, maxMs));
    };

    // Repli : sans vue satellite après 15 s (ou en cas d'erreur avant le chargement), seuls les bâtiments certifiés Hailand
    // sont examinés ; sinon l'adresse est une zone de niveau 1 autour de la position mesurée (jamais de position inventée).
    let loaded = false;
    const fallback = () => {
      if (loaded || cancelled) return;
      loaded = true;
      setNoSatellite(true);
      void certifiedBuildingsNear(sb as unknown as BuildingsClient, position).then((hailand) => {
        if (cancelled) return;
        setHailandSeen(hailand.length);
        const d = detectBuilding(position, accuracy, hailand);
        setDet(d);
        onDetected(d);
        setPhase('result');
      });
    };
    timers.push(window.setTimeout(fallback, 15000));
    map.on('error', () => { if (!map.loaded()) fallback(); });

    map.on('load', () => {
      if (cancelled || loaded) return;
      loaded = true;
      measureScreen();
      // Contours OSM (tuiles Mapbox Streets) dessinés par-dessus l'image satellite.
      map.addSource('reg-osm', { type: 'vector', url: 'mapbox://mapbox.mapbox-streets-v8' });
      map.addLayer({ id: OSM_FILL, type: 'fill', source: 'reg-osm', 'source-layer': 'building', paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.06 } });
      map.addLayer({ id: 'reg-osm-line', type: 'line', source: 'reg-osm', 'source-layer': 'building', paint: { 'line-color': '#ffffff', 'line-opacity': 0.45, 'line-width': 1 } });
      map.addSource('reg-hailand', { type: 'geojson', data: empty });
      map.addLayer({ id: 'reg-hailand-line', type: 'line', source: 'reg-hailand', paint: { 'line-color': COLOR_L3, 'line-width': 1.6, 'line-opacity': 0.9 } });
      map.addSource('reg-own', { type: 'geojson', data: empty });
      map.addLayer({ id: 'reg-own-fill', type: 'fill', source: 'reg-own', paint: { 'fill-color': COLOR_OWN, 'fill-opacity': 0.28 } });
      map.addLayer({ id: 'reg-own-line', type: 'line', source: 'reg-own', paint: { 'line-color': COLOR_OWN, 'line-width': 3 } });
      map.addSource('reg-scan', { type: 'geojson', data: empty });
      map.addLayer({ id: 'reg-scan-line', type: 'line', source: 'reg-scan', paint: { 'line-color': HUD_CYAN, 'line-width': 2, 'line-opacity': 0.95 } });
      map.addSource('reg-chosen', { type: 'geojson', data: empty });
      map.addLayer({ id: 'reg-chosen-fill', type: 'fill', source: 'reg-chosen', paint: { 'fill-color': COLOR_L2, 'fill-opacity': 0.3 } });
      map.addLayer({ id: 'reg-chosen-line', type: 'line', source: 'reg-chosen', paint: { 'line-color': COLOR_L2, 'line-width': 3.5 } });
      // Limite de désignation par touche (cercle pointillé), affichée seulement en mode « montrer mon bâtiment ».
      map.addSource('reg-limit', { type: 'geojson', data: empty });
      map.addLayer({ id: 'reg-limit-line', type: 'line', source: 'reg-limit', paint: { 'line-color': '#ffffff', 'line-width': 1.6, 'line-dasharray': [2, 2], 'line-opacity': 0.8 } });
      map.addSource('reg-tap', { type: 'geojson', data: empty });
      map.addLayer({ id: 'reg-tap-fill', type: 'fill', source: 'reg-tap', paint: { 'fill-color': COLOR_L2, 'fill-opacity': 0.25 } });
      map.addLayer({ id: 'reg-tap-line', type: 'line', source: 'reg-tap', paint: { 'line-color': COLOR_L2, 'line-width': 2.5, 'line-dasharray': [2, 1.5] } });

      const hailandP = certifiedBuildingsNear(sb as unknown as BuildingsClient, position).then((list) => {
        if (cancelled) return list;
        setHailandSeen(list.length);
        hailandRef.current = list;
        (map.getSource('reg-hailand') as mapboxgl.GeoJSONSource | undefined)?.setData(fc(list.map((b) => b.polygon)));
        // Ses propres adresses sont dessinées « chez vous » (violet), pour qu'il les reconnaisse tout de suite.
        (map.getSource('reg-own') as mapboxgl.GeoJSONSource | undefined)?.setData(fc(ownOutlines(homesRef.current, list)));
        return list;
      });

      let tries = 0;
      const analyse = async () => {
        if (cancelled) return;
        const osm = osmPolygonsAround(map, position, SCAN_RADIUS_M, [OSM_FILL]);
        // Tuiles pas encore chargées : on attend un peu (3 essais au plus).
        if (osm.length === 0 && tries < 2) {
          tries += 1;
          whenSettled(() => timers.push(window.setTimeout(analyse, 500)));
          return;
        }
        const hailand = await hailandP;
        if (cancelled) return;
        const d = detectBuilding(position, accuracy, [...hailand, ...osm.map((o) => ({ source: 'osm' as const, id: o.id, polygon: o.polygon }))]);
        setDet(d);
        onDetected(d);
        setPhase('scanning');
        // Contours examinés allumés un à un, du plus proche au plus éloigné (2 s au plus).
        const n = d.examined.length;
        const step = n ? Math.max(40, Math.min(140, 2000 / n)) : 0;
        let i = 0;
        const next = () => {
          if (cancelled) return;
          i += 1;
          setLit(i);
          (map.getSource('reg-scan') as mapboxgl.GeoJSONSource | undefined)?.setData(fc(d.examined.slice(0, i).map((c) => c.polygon)));
          if (i < n) timers.push(window.setTimeout(next, step));
          else timers.push(window.setTimeout(() => finish(d), 450));
        };
        if (n) next();
        else timers.push(window.setTimeout(() => finish(d), 1200));
      };

      const finish = (d: Detection) => {
        if (cancelled) return;
        (map.getSource('reg-scan') as mapboxgl.GeoJSONSource | undefined)?.setData(empty);
        if (d.chosen) {
          const color = d.chosen.source === 'hailand' ? COLOR_L3 : COLOR_L2;
          map.setPaintProperty('reg-chosen-fill', 'fill-color', color);
          map.setPaintProperty('reg-chosen-line', 'line-color', color);
          (map.getSource('reg-chosen') as mapboxgl.GeoJSONSource | undefined)?.setData(fc([d.chosen.polygon]));
          targetRef.current = d.chosen.polygon;
          measureScreen();
        }
        // Le résultat se regarde sur la carte : on peut la déplacer et l'agrandir (la feuille se réduit pendant ce temps).
        map.dragPan.enable();
        map.scrollZoom.enable();
        map.touchZoomRotate.enable();
        map.touchZoomRotate.disableRotation();
        setPhase('result');
      };

      whenSettled(() => timers.push(window.setTimeout(analyse, 300)));
    });

    // Mode « montrer mon bâtiment » : nouvelle recherche autour du point touché (`detectAtTap`).
    map.on('click', (e) => {
      if (phaseRef.current !== 'pick') return;
      const point: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      const osm = osmPolygonsAround(map, point, 30, [OSM_FILL]).map((o) => ({ source: 'osm' as const, id: o.id, polygon: o.polygon }));
      // Tolérance du doigt ≈ 12 pixels à l'écran, convertie en mètres au zoom courant.
      const result = detectAtTap(point, position, accuracy, [...hailandRef.current, ...osm], 12 * metersPerPx(map, point[1]));
      setTap({ point, result });
      let shape: GeoJSON.Polygon | null = null;
      let color = COLOR_L2;
      if (result.kind === 'osm') shape = result.candidate.polygon;
      else if (result.kind === 'certifie') {
        shape = result.candidate.polygon;
        color = COLOR_L3;
      } else if (result.kind === 'zone') shape = turf.circle(point, 6, { units: 'meters', steps: 32 }).geometry;
      map.setPaintProperty('reg-tap-fill', 'fill-color', color);
      map.setPaintProperty('reg-tap-line', 'line-color', color);
      (map.getSource('reg-tap') as mapboxgl.GeoJSONSource | undefined)?.setData(shape ? fc([shape]) : empty);
      targetRef.current = shape;
      measureScreen();
    });

    return () => {
      cancelled = true;
      timers.forEach((t) => clearTimeout(t));
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position[0], position[1], accuracy]);

  /** Passe en mode « montrer mon bâtiment » : carte déplaçable, cercle limite, ancien résultat effacé. */
  const startPick = () => {
    const map = mapRef.current;
    if (!map) return;
    setTap(null);
    targetRef.current = null;
    (map.getSource('reg-chosen') as mapboxgl.GeoJSONSource | undefined)?.setData(empty);
    (map.getSource('reg-tap') as mapboxgl.GeoJSONSource | undefined)?.setData(empty);
    const limit = turf.circle(position, maxTapDistance(accuracy), { units: 'meters', steps: 72 }).geometry;
    (map.getSource('reg-limit') as mapboxgl.GeoJSONSource | undefined)?.setData(fc([limit]));
    // Vue élargie pour voir tout le cercle limite ; l'utilisateur agrandit ensuite à son bâtiment.
    const [w, so, e, n] = bboxOf(limit);
    map.fitBounds([w, so, e, n], { padding: { top: 70, bottom: sheetHRef.current + 10, left: 16, right: 16 }, duration: 600 });
    map.dragPan.enable();
    map.scrollZoom.enable();
    map.touchZoomRotate.enable();
    map.touchZoomRotate.disableRotation();
    map.getCanvas().style.cursor = 'crosshair';
    setTarget(null);
    setPhase('pick');
  };
  const confirmPick = () => {
    if (!tap) return;
    const r = tap.result;
    if (r.kind === 'osm') onPicked({ point: tap.point, polygon: r.candidate.polygon, osmId: r.candidate.id.startsWith('osm-') ? null : r.candidate.id, certifiedId: null });
    else if (r.kind === 'certifie') onPicked({ point: tap.point, polygon: null, osmId: null, certifiedId: r.candidate.id });
    else if (r.kind === 'zone') onPicked({ point: tap.point, polygon: null, osmId: null, certifiedId: null });
  };

  const chosen = det?.chosen ?? null;
  const isL3 = chosen?.source === 'hailand';
  // Position trop imprécise (ex. relevé d'ordinateur à ±500 m) : on ne valide pas le bâtiment deviné, on le fait montrer.
  const imprecise = accuracy > IMPRECISE_ACCURACY_M;
  // Le bâtiment (ou la zone) retenu est-il l'un de ceux de l'utilisateur ? Alors on l'en informe, sans rien enregistrer.
  const tr0 = tap?.result;
  const ownDetected = phase === 'result' ? (chosen ? ownMatchForCandidate(chosen, homes) : ownMatchForPoint(position, homes)) : null;
  const ownTapped =
    phase === 'pick' && tap && tr0 && tr0.kind !== 'trop_loin'
      ? tr0.kind === 'zone'
        ? ownMatchForPoint(tap.point, homes)
        : ownMatchForCandidate(tr0.candidate, homes)
      : null;
  const own = ownTapped ?? ownDetected;
  const rPx = Math.max(accuracy * pxPerM, 6);
  // Crochets : cadre large autour de la position pendant l'analyse, resserré sur le bâtiment retenu ensuite.
  const pad = 14;
  const frame: Rect | null = center
    ? phase === 'pick'
      ? target
        ? { x: target.x - pad, y: target.y - pad, w: target.w + 2 * pad, h: target.h + 2 * pad }
        : null
      : phase === 'result' && target
      ? { x: target.x - pad, y: target.y - pad, w: target.w + 2 * pad, h: target.h + 2 * pad }
      : { x: center.x - Math.max(rPx * 1.6, 70), y: center.y - Math.max(rPx * 1.6, 70), w: 2 * Math.max(rPx * 1.6, 70), h: 2 * Math.max(rPx * 1.6, 70) }
    : null;
  const tr = tap?.result;
  const locked = !!own || (phase === 'result' && !!chosen) || (phase === 'pick' && !!tr && tr.kind !== 'trop_loin');
  // Le bâtiment retenu ou touché, quand c'est « chez vous », est coloré en violet sur la carte.
  const ownKey = own ? 'own' : '';
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer('reg-chosen-fill')) return;
    const c = own ? COLOR_OWN : isL3 ? COLOR_L3 : COLOR_L2;
    map.setPaintProperty('reg-chosen-fill', 'fill-color', c);
    map.setPaintProperty('reg-chosen-line', 'line-color', c);
    map.setPaintProperty('reg-tap-fill', 'fill-color', own ? COLOR_OWN : tr?.kind === 'certifie' ? COLOR_L3 : COLOR_L2);
    map.setPaintProperty('reg-tap-line', 'line-color', own ? COLOR_OWN : tr?.kind === 'certifie' ? COLOR_L3 : COLOR_L2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownKey, phase, isL3, tr?.kind]);
  const frameColor =
    own
      ? COLOR_OWN
      : phase === 'pick'
      ? tr?.kind === 'certifie'
        ? COLOR_L3
        : COLOR_L2
      : phase === 'result' && chosen
        ? isL3
          ? COLOR_L3
          : COLOR_L2
        : '#ffffff';
  const frameLabel =
    own
      ? 'CHEZ VOUS'
      : phase === 'pick'
      ? tr?.kind === 'osm'
        ? 'BÂTIMENT DÉSIGNÉ'
        : tr?.kind === 'certifie'
          ? 'CERTIFIÉ HAILAND'
          : 'ZONE DÉSIGNÉE'
      : phase === 'result'
        ? chosen
          ? isL3
            ? 'CERTIFIÉ HAILAND'
            : 'CIBLE VERROUILLÉE'
          : 'AUCUNE CIBLE'
        : 'ANALYSE…';
  const primaryCls = 'mt-2.5 flex h-[52px] w-full items-center justify-center rounded-[18px] bg-blue text-[16px] font-bold text-white active:opacity-80 disabled:opacity-40';
  // Graduations : pas de 10, 20, 50 ou 100 m selon le zoom, pour que les étiquettes restent lisibles.
  const tickStep = [10, 20, 50, 100].find((m) => m * pxPerM >= 42) ?? 100;
  const nearest = det?.examined[0];
  const btn = (label: string, onClick: () => void) => (
    <button type="button" onClick={onClick} className={primaryCls}>
      {label}
    </button>
  );
  /** Notification « c'est déjà votre emplacement » : aucune action d'enregistrement, on prévient seulement. */
  const ownSheet = (d: DeclarationRecord, secondary: React.ReactNode) => ({
    details: (
      <div role="status">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[12.5px] font-bold tracking-[0.07em]" style={{ color: '#9333ea' }}>
            CHEZ VOUS
          </div>
          <LevelBadge level={effectiveLevelOf(d)} />
        </div>
        <div className="mt-1.5 text-[21px] font-bold leading-tight">C’est déjà votre emplacement</div>
        <p className="mt-0.5 font-mono text-[13px] font-semibold text-muted">{d.hailandCode}</p>
        <p className="mt-2 text-[13.5px] font-medium leading-snug text-muted">
          Ce bâtiment est déjà enregistré à votre compte{d.declared.label ? ` (${d.declared.label})` : ''}. Il ne sera pas enregistré une seconde fois : utilisez simplement cette adresse.
        </p>
      </div>
    ),
    primary: btn('Utiliser cette adresse', () => onUseExisting(d)),
    secondary,
  });
  const sheet: { details: React.ReactNode; primary?: React.ReactNode; secondary?: React.ReactNode } =
    own && phase === 'pick'
      ? ownSheet(own, <p className="mt-2 text-center text-[13px] font-semibold text-muted">Ou touchez un autre endroit de la carte.</p>)
      : own && phase === 'result'
      ? ownSheet(
          own,
          <div className="mt-1 flex items-center justify-between">
            <button type="button" onClick={onRetry} className="h-11 px-1 text-[14.5px] font-bold text-muted">
              Recommencer
            </button>
            <button type="button" onClick={startPick} className="h-11 px-1 text-[14.5px] font-bold text-blue">
              Montrer un autre bâtiment
            </button>
          </div>,
        )
      : phase === 'pick'
      ? !tr
        ? {
            details: (
              <div role="status">
                <div className="text-[12.5px] font-bold tracking-[0.07em] text-muted">MONTREZ VOTRE BÂTIMENT</div>
                <div className="mt-1.5 text-[21px] font-bold leading-tight">Touchez votre bâtiment sur la carte</div>
                <p className="mt-1 text-[14px] font-medium leading-snug text-muted">
                  Déplacez et agrandissez la vue satellite si besoin. Votre bâtiment doit se trouver dans le cercle pointillé (à moins de {Math.round(maxTapDistance(accuracy))} m de votre position).
                </p>
              </div>
            ),
          }
        : tr.kind === 'trop_loin'
          ? {
              details: (
                <div role="status">
                  <div className="text-[12.5px] font-bold tracking-[0.07em] text-muted">MONTREZ VOTRE BÂTIMENT</div>
                  <div className="mt-1.5 text-[21px] font-bold leading-tight">Trop loin de votre position</div>
                  <p className="mt-1 text-[14px] font-medium leading-snug text-[#a3321f]">
                    Ce point est à {Math.round(tr.distance)} m de votre position (maximum {Math.round(tr.max)} m). Touchez un bâtiment dans le cercle pointillé.
                  </p>
                </div>
              ),
            }
          : {
              details: (
                <div role="status">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[12.5px] font-bold tracking-[0.07em] text-muted">MONTREZ VOTRE BÂTIMENT</div>
                    <LevelBadge level={tr.kind === 'certifie' ? 3 : tr.kind === 'osm' ? 2 : 1} />
                  </div>
                  <div className="mt-1.5 text-[21px] font-bold leading-tight">
                    {tr.kind === 'certifie' ? tr.candidate.label || 'Bâtiment certifié Hailand' : tr.kind === 'osm' ? 'Est-ce bien celui-ci ?' : 'Aucun contour à cet endroit'}
                  </div>
                  {tr.kind === 'certifie' && tr.candidate.code && <p className="mt-0.5 text-[13.5px] font-medium text-muted">{tr.candidate.code}</p>}
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                    {(tr.kind === 'zone'
                      ? [
                          ['DE VOUS', `${Math.round(tr.distance)} m`],
                          ['CONTOURS', '0'],
                          ['NIVEAU', '1'],
                        ]
                      : [
                          ['SURFACE', `${Math.round(tr.candidate.area).toLocaleString('fr-FR')} m²`],
                          ['DE VOUS', `${Math.round(tr.distance)} m`],
                          ['TOUCHE', tr.kind === 'certifie' || tr.method === 'dedans' || tr.candidate.distance < 0.5 ? 'dedans' : `à ${fmtM(tr.candidate.distance)} m`],
                        ]
                    ).map(([k, v]) => (
                      <div key={k} className="rounded-2xl bg-bg px-2 py-2">
                        <dt className="text-[10.5px] font-bold tracking-[0.06em] text-muted">{k}</dt>
                        <dd className="mt-0.5 font-mono text-[15px] font-bold">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-2 text-[12.5px] font-medium leading-snug text-muted">
                    {tr.kind === 'certifie'
                      ? 'Bâtiment certifié par Hailand : si c’est bien le vôtre, votre adresse y sera rattachée officiellement (niveau 3).'
                      : tr.kind === 'osm'
                        ? 'Bâtiment trouvé autour du point touché : votre adresse sera enregistrée au niveau 2.'
                        : 'Aucun bâtiment connu à cet endroit : la zone touchée sera enregistrée au niveau 1 (zone approximative).'}
                  </p>
                </div>
              ),
              primary: btn(tr.kind === 'zone' ? 'Enregistrer cette zone' : 'Oui, c’est mon bâtiment', confirmPick),
              secondary: <p className="mt-2 text-center text-[13px] font-semibold text-muted">Ou touchez un autre endroit de la carte.</p>,
            }
      : phase !== 'result'
        ? {
            details: (
              <div role="status">
                <div className="text-[12.5px] font-bold tracking-[0.07em] text-muted">IDENTIFICATION DU BÂTIMENT</div>
                <div className="mt-1 text-[20px] font-bold">{phase === 'loading' ? 'Chargement de la vue satellite…' : 'Analyse des contours…'}</div>
                <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 font-mono text-[13px]">
                  <dt className="text-muted">Position retenue</dt>
                  <dd className="text-right font-bold">±{fmtM(accuracy)} m</dd>
                  <dt className="text-muted">Rayon d’examen</dt>
                  <dd className="text-right font-bold">{SCAN_RADIUS_M} m</dd>
                  <dt className="text-muted">Bâtiments certifiés Hailand proches</dt>
                  <dd className="text-right font-bold">{hailandSeen ?? '…'}</dd>
                  <dt className="text-muted">Contours examinés</dt>
                  <dd className="text-right font-bold tabular-nums">{det ? `${Math.min(lit, det.examined.length)} / ${det.examined.length}` : '…'}</dd>
                  <dt className="text-muted">Contour le plus proche</dt>
                  <dd className="text-right font-bold">{nearest && lit > 0 ? (nearest.contains ? 'position dedans' : `${fmtM(nearest.distance)} m`) : '…'}</dd>
                </dl>
              </div>
            ),
          }
        : chosen
          ? {
              details: (
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[12.5px] font-bold tracking-[0.07em]" style={{ color: isL3 ? '#15803d' : '#b45309' }}>
                      {isL3 ? (det?.method === 'hailand_proche' ? 'CERTIFIÉ HAILAND · LE PLUS PROCHE' : 'BÂTIMENT CERTIFIÉ HAILAND') : det?.method === 'osm_proche' ? 'BÂTIMENT LE PLUS PROCHE' : 'BÂTIMENT IDENTIFIÉ'}
                    </div>
                    <LevelBadge level={isL3 ? 3 : 2} />
                  </div>
                  <div className="mt-1.5 text-[21px] font-bold leading-tight">{isL3 ? chosen.label || 'Bâtiment enregistré' : 'Est-ce bien votre bâtiment ?'}</div>
                  <p className="mt-0.5 text-[14px] font-medium text-muted">{isL3 && chosen.code ? `${chosen.code} · ` : ''}{adminLine}</p>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                    {[
                      ['SURFACE', `${Math.round(chosen.area).toLocaleString('fr-FR')} m²`],
                      ['RECOUVREMENT', `${Math.round(chosen.overlap * 100)} %`],
                      ['DISTANCE', chosen.contains ? 'dedans' : `${fmtM(chosen.distance)} m`],
                    ].map(([k, v]) => (
                      <div key={k} className="rounded-2xl bg-bg px-2 py-2">
                        <dt className="text-[10.5px] font-bold tracking-[0.06em] text-muted">{k}</dt>
                        <dd className="mt-0.5 font-mono text-[15px] font-bold">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-2 text-[12.5px] font-medium leading-snug text-muted">
                    {isL3
                      ? 'Bâtiment certifié par Hailand : si c’est bien le vôtre, votre adresse y sera rattachée officiellement (niveau 3).'
                      : `${det?.examined.length ?? 0} contour(s) examiné(s) dans un rayon de ${SCAN_RADIUS_M} m. Recouvrement : part du cercle de précision qui tombe dans le bâtiment.`}
                  </p>
                  {imprecise && (
                    <p role="alert" className="mt-2 rounded-2xl bg-[#f5a524]/15 px-3 py-2 text-[13px] font-semibold leading-snug text-[#8a5a00]">
                      Votre position n’est connue qu’à ±{Math.round(accuracy)} m : ce bâtiment n’est qu’une supposition. Touchez votre bâtiment sur la vue satellite pour que le livreur trouve la bonne porte.
                    </p>
                  )}
                </div>
              ),
              primary: imprecise && !noSatellite ? btn('Montrer mon bâtiment sur la carte', startPick) : btn('Oui, c’est mon bâtiment', onConfirm),
              secondary: (
                <div className="mt-1 flex items-center justify-between">
                  <button type="button" onClick={onRetry} className="h-11 px-1 text-[14.5px] font-bold text-muted">
                    Recommencer
                  </button>
                  {!noSatellite && (
                    <button type="button" onClick={startPick} className="h-11 px-1 text-[14.5px] font-bold text-blue">
                      Ce n’est pas le mien
                    </button>
                  )}
                </div>
              ),
            }
          : {
              details: (
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[12.5px] font-bold tracking-[0.07em] text-muted">AUCUN BÂTIMENT IDENTIFIÉ</div>
                    <LevelBadge level={1} />
                  </div>
                  <div className="mt-1.5 text-[21px] font-bold leading-tight">Nous n’avons pas trouvé votre bâtiment</div>
                  <p className="mt-1 text-[14px] font-medium leading-snug text-muted">
                    {noSatellite
                      ? `La vue satellite ne se charge pas (réseau faible). Votre adresse sera enregistrée comme une zone (niveau 1) autour de votre position mesurée à ±${Math.round(accuracy)} m : le livreur appellera en arrivant. Vous pourrez la refaire plus tard.`
                      : `${det?.examined.length ?? 0} contour(s) examiné(s) à moins de ${SCAN_RADIUS_M} m, aucun ne correspond à votre position. Montrez-nous votre bâtiment sur la vue satellite.`}
                  </p>
                </div>
              ),
              primary: noSatellite ? btn('Continuer avec cette position', onConfirm) : btn('Montrer mon bâtiment sur la carte', startPick),
              secondary: (
                <button type="button" onClick={onRetry} className="mt-1 flex h-11 w-full items-center justify-center text-[14.5px] font-bold text-muted">
                  Refaire la récupération
                </button>
              ),
            };
  const ticks = pxPerM ? [1, 2, 3, 4, 5].map((k) => k * tickStep).filter((m) => m * pxPerM > rPx + 8) : [];

  return (
    <div className="fixed inset-0 z-[60] mx-auto max-w-md overflow-hidden bg-black font-sans text-ink">
      <div className="absolute inset-0">
        <div ref={mapDivRef} className="h-full w-full" />
      </div>

      {/* Affichage d'analyse (au-dessus de la carte, non cliquable) */}
      {center && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${size.w} ${size.h}`} aria-hidden="true">
          <defs>
            <linearGradient id="reg-sweep" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor={HUD_CYAN} stopOpacity="0" />
              <stop offset="1" stopColor={HUD_CYAN} stopOpacity="0.35" />
            </linearGradient>
          </defs>
          {/* Lignes de précision en « + », graduées en mètres */}
          <g stroke="#fff" strokeOpacity={0.55} strokeWidth={1}>
            <line x1={0} y1={center.y} x2={center.x - rPx - 4} y2={center.y} />
            <line x1={center.x + rPx + 4} y1={center.y} x2={size.w} y2={center.y} />
            <line x1={center.x} y1={0} x2={center.x} y2={center.y - rPx - 4} />
            <line x1={center.x} y1={center.y + rPx + 4} x2={center.x} y2={size.h} />
            {ticks.map((m) => (
              <g key={m}>
                <line x1={center.x + m * pxPerM} y1={center.y - 5} x2={center.x + m * pxPerM} y2={center.y + 5} />
                <line x1={center.x - m * pxPerM} y1={center.y - 5} x2={center.x - m * pxPerM} y2={center.y + 5} />
                <line x1={center.x - 5} y1={center.y - m * pxPerM} x2={center.x + 5} y2={center.y - m * pxPerM} />
              </g>
            ))}
          </g>
          {ticks.slice(0, 3).filter((m) => center.x + m * pxPerM + 40 < size.w).map((m) => (
            <text key={m} x={center.x + m * pxPerM + 3} y={center.y - 8} fontSize={10} fill="#fff" fillOpacity={0.75} fontFamily="ui-monospace, monospace">
              {m} m
            </text>
          ))}
          {/* Balayage pendant l'analyse */}
          {(phase === 'loading' || phase === 'scanning') && (
            <g className="motion-safe:animate-[spin_2.4s_linear_infinite]" style={{ transformOrigin: `${center.x}px ${center.y}px` }}>
              <path
                d={`M ${center.x} ${center.y} L ${center.x + Math.max(rPx * 2.4, 120)} ${center.y} A ${Math.max(rPx * 2.4, 120)} ${Math.max(rPx * 2.4, 120)} 0 0 0 ${center.x + Math.max(rPx * 2.4, 120) * Math.cos(-0.7)} ${center.y + Math.max(rPx * 2.4, 120) * Math.sin(-0.7)} Z`}
                fill="url(#reg-sweep)"
              />
            </g>
          )}
          {/* Cercle de précision et anneau tournant */}
          <circle cx={center.x} cy={center.y} r={rPx} fill={HUD_CYAN} fillOpacity={0.14} stroke={HUD_CYAN} strokeWidth={1.6} />
          <g className={phase === 'result' ? '' : 'motion-safe:animate-[spin_6s_linear_infinite]'} style={{ transformOrigin: `${center.x}px ${center.y}px` }}>
            <circle cx={center.x} cy={center.y} r={rPx + 9} fill="none" stroke="#fff" strokeOpacity={0.6} strokeWidth={1.2} strokeDasharray="2 7" />
          </g>
          <circle cx={center.x} cy={center.y} r={4.5} fill="#fff" stroke={HUD_CYAN} strokeWidth={2} />
          <text x={center.x + rPx + 12} y={center.y + rPx + 16} fontSize={10.5} fill="#fff" fontFamily="ui-monospace, monospace">
            ±{fmtM(accuracy)} m
          </text>
        </svg>
      )}

      {/* Crochets d'angle (transition vers le bâtiment retenu) */}
      {frame && (
        <div
          className="pointer-events-none absolute transition-all duration-700 ease-out motion-reduce:transition-none"
          style={{ left: frame.x, top: frame.y, width: frame.w, height: frame.h }}
          aria-hidden="true"
        >
          {(['left-0 top-0 border-l-2 border-t-2', 'right-0 top-0 border-r-2 border-t-2', 'left-0 bottom-0 border-l-2 border-b-2', 'right-0 bottom-0 border-r-2 border-b-2'] as const).map((c) => (
            <span key={c} className={`absolute h-5 w-5 ${c} ${locked ? '' : 'motion-safe:animate-pulse'}`} style={{ borderColor: frameColor }} />
          ))}
          <span className={`absolute -top-5 whitespace-nowrap font-mono text-[10.5px] font-bold tracking-wide text-white drop-shadow ${frame.x + 170 > size.w ? 'right-0' : 'left-0'}`}>
            {frameLabel}
          </span>
        </div>
      )}

      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer"
        className="absolute left-3.5 top-5 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-card shadow-[0_6px_24px_rgba(0,0,0,0.16)]"
      >
        <Ico name="x" size={22} stroke={2.4} />
      </button>
      <div className="pointer-events-none absolute inset-x-0 top-6 z-10 flex justify-center">
        <div className="flex h-9 items-center gap-2.5 rounded-full bg-black/70 px-3.5 font-mono text-[12px] font-bold tracking-wide text-white backdrop-blur">
          {fmtCoord(position[1])} · {fmtCoord(position[0])}
        </div>
      </div>

      {/* Feuille du bas : complète au repos ; dès que l'utilisateur manipule la carte, elle se réduit au seul bouton principal,
          puis revient après quelques secondes de calme (même principe que le panneau « Mon domicile »). */}
      <div ref={sheetRef} data-scan-sheet className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-12">
        {/* Fondu : opaque en bas, transparent en haut ; il s'efface quand la feuille se réduit. */}
        <div
          aria-hidden="true"
          className={`absolute inset-0 transition-opacity duration-500 ease-out ${busy ? 'opacity-0' : 'opacity-100'}`}
          style={{ background: 'linear-gradient(to top, var(--color-card) 0%, color-mix(in srgb, var(--color-card) 94%, transparent) 62%, transparent 100%)' }}
        />
        <div className="relative">
          <Collapse hidden={busy}>{sheet.details}</Collapse>
          {sheet.primary && <div className="pointer-events-auto">{sheet.primary}</div>}
          <Collapse hidden={busy}>{sheet.secondary}</Collapse>
        </div>
      </div>
    </div>
  );
};

/** Bloc qui se replie en hauteur et en opacité (transition fluide). */
const Collapse: React.FC<{ hidden: boolean; children?: React.ReactNode }> = ({ hidden, children }) =>
  children ? (
    <div aria-hidden={hidden} className={`grid transition-[grid-template-rows,opacity] duration-500 ease-out ${hidden ? 'grid-rows-[0fr] opacity-0' : 'pointer-events-auto grid-rows-[1fr] opacity-100'}`}>
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  ) : null;
