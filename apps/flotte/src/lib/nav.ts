/**
 * Guidage virage par virage de Hailand Flotte : calculs purs (sans carte ni réseau), testés dans nav.test.ts.
 * L'itinéraire vient de Mapbox Directions (`steps`, `voice_instructions`, `language=fr`) ; la position, du GPS du téléphone.
 */

export type LngLat = [number, number];

export interface Maneuver { type: string; modifier?: string; instruction: string; location: LngLat }
export interface VoiceInstruction { distanceAlongGeometry: number; announcement: string }
export interface Step { distance: number; duration: number; name?: string; maneuver: Maneuver; voiceInstructions?: VoiceInstruction[] }
export interface Leg { distance: number; duration: number; steps: Step[] }
export interface Route { distance: number; duration: number; geometry: { type: 'LineString'; coordinates: LngLat[] }; legs: Leg[] }

const R = 6371008.8;
const RAD = Math.PI / 180;

/** Distance en mètres entre deux points [lng, lat]. */
export function haversine(a: LngLat, b: LngLat): number {
  const dLa = (b[1] - a[1]) * RAD, dLo = (b[0] - a[0]) * RAD;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(a[1] * RAD) * Math.cos(b[1] * RAD) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Cap (0 = nord, 90 = est) de a vers b. */
export function bearing(a: LngLat, b: LngLat): number {
  const y = Math.sin((b[0] - a[0]) * RAD) * Math.cos(b[1] * RAD);
  const x = Math.cos(a[1] * RAD) * Math.sin(b[1] * RAD) - Math.sin(a[1] * RAD) * Math.cos(b[1] * RAD) * Math.cos((b[0] - a[0]) * RAD);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}

/** Projection d'un point sur un segment, en mètres locaux (assez précis à l'échelle d'une rue). */
function onSegment(p: LngLat, a: LngLat, b: LngLat): { t: number; d: number } {
  const k = Math.cos(p[1] * RAD) * R * RAD, kl = R * RAD;
  const ax = (a[0] - p[0]) * k, ay = (a[1] - p[1]) * kl, bx = (b[0] - p[0]) * k, by = (b[1] - p[1]) * kl;
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
  return { t, d: Math.hypot(ax + t * dx, ay + t * dy) };
}

/** Itinéraire préparé : distances cumulées le long du tracé et fin de chaque étape (toutes les étapes de tous les tronçons). */
export interface Prepared { route: Route; coords: LngLat[]; cum: number[]; total: number; steps: Step[]; stepEnd: number[] }

export function prepare(route: Route): Prepared {
  const coords = route.geometry.coordinates;
  const cum = [0];
  for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1]! + haversine(coords[i - 1]!, coords[i]!));
  const total = cum[cum.length - 1] ?? 0;
  const steps = route.legs.flatMap((l) => l.steps);
  // Les distances des étapes (Mapbox) et la longueur du tracé diffèrent un peu : on les ramène à la longueur réelle du tracé.
  const sum = steps.reduce((n, s) => n + s.distance, 0) || 1;
  const stepEnd: number[] = [];
  let acc = 0;
  for (const s of steps) { acc += (s.distance / sum) * total; stepEnd.push(acc); }
  return { route, coords, cum, total, steps, stepEnd };
}

export interface Progress {
  /** Distance parcourue le long du tracé (m). */
  along: number;
  /** Écart entre la position et le tracé (m). */
  offRoute: number;
  /** Étape en cours (index dans `steps`). */
  step: number;
  /** Distance jusqu'à la prochaine manœuvre (m). */
  toManeuver: number;
  /** Prochaine manœuvre (fin de l'étape en cours), puis celle d'après. */
  next: Maneuver | null;
  then: { maneuver: Maneuver; distance: number } | null;
  remaining: number;
  remainingSeconds: number;
}

/**
 * Où en est le livreur sur l'itinéraire. `hint` (dernière distance parcourue connue) évite de « sauter » sur un tronçon parallèle
 * ou repassé plus loin : on cherche d'abord autour de la dernière position.
 */
export function progress(p: Prepared, pos: LngLat, hint = 0): Progress {
  let best = { i: 0, t: 0, d: Infinity };
  for (let i = 0; i < p.coords.length - 1; i++) {
    const s = onSegment(pos, p.coords[i]!, p.coords[i + 1]!);
    const along = p.cum[i]! + s.t * (p.cum[i + 1]! - p.cum[i]!);
    // Pénalité légère pour un point très en arrière ou très en avant de la dernière position connue.
    const penalty = Math.max(0, Math.abs(along - hint) - 300) * 0.05;
    if (s.d + penalty < best.d) best = { i, t: s.t, d: s.d + penalty };
  }
  const seg = p.coords.length > 1 ? onSegment(pos, p.coords[best.i]!, p.coords[best.i + 1]!) : { t: 0, d: haversine(pos, p.coords[0] ?? pos) };
  const along = p.coords.length > 1 ? p.cum[best.i]! + seg.t * (p.cum[best.i + 1]! - p.cum[best.i]!) : 0;
  let step = p.stepEnd.findIndex((e) => along < e - 1);
  if (step < 0) step = p.steps.length - 1;
  const toManeuver = Math.max(0, (p.stepEnd[step] ?? p.total) - along);
  const nextStep = p.steps[step + 1] ?? null;
  const thenStep = p.steps[step + 2] ?? null;
  const remaining = Math.max(0, p.total - along);
  return {
    along, offRoute: seg.d, step, toManeuver,
    next: nextStep ? nextStep.maneuver : p.steps[step]?.maneuver.type === 'arrive' ? p.steps[step]!.maneuver : null,
    then: thenStep && nextStep ? { maneuver: thenStep.maneuver, distance: nextStep.distance } : null,
    remaining,
    remainingSeconds: p.total > 0 ? (p.route.duration * remaining) / p.total : 0,
  };
}

/** Hors route quand l'écart dépasse 40 m, ou la précision du GPS + 15 m si elle est plus mauvaise. */
export const isOffRoute = (offRoute: number, accuracy = 0) => offRoute > Math.max(40, accuracy + 15);

/** Annonces vocales à dire entre deux positions (seuils de Mapbox, sinon 400 m, 150 m et 30 m avant chaque manœuvre). */
export function announcements(p: Prepared, from: number, to: number): string[] {
  if (to <= from) return [];
  const out: string[] = [];
  p.steps.forEach((s, i) => {
    const end = p.stepEnd[i]!;
    const start = i === 0 ? 0 : p.stepEnd[i - 1]!;
    const next = p.steps[i + 1];
    if (!next) return;
    const voices = s.voiceInstructions?.length
      ? s.voiceInstructions.map((v) => ({ at: end - v.distanceAlongGeometry, text: v.announcement }))
      : [400, 150, 30].filter((d) => d < end - start + 1).map((d) => ({ at: end - d, text: d <= 30 ? next.maneuver.instruction : `Dans ${spokenMeters(d)}, ${lowerFirst(next.maneuver.instruction)}` }));
    for (const v of voices) if (v.at > from && v.at <= to) out.push(v.text);
  });
  return out;
}

const lowerFirst = (s: string) => (s ? s[0]!.toLowerCase() + s.slice(1) : s);
const spokenMeters = (m: number) => (m >= 1000 ? `${(m / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} kilomètres` : `${Math.round(m / 10) * 10} mètres`);

/** « 200 m », « 1,2 km » (arrondi lisible en roulant). */
export function meters(m: number): string {
  if (m >= 1000) return `${(m / 1000).toLocaleString('fr-FR', { maximumFractionDigits: m >= 10000 ? 0 : 1 })} km`;
  if (m >= 100) return `${Math.round(m / 50) * 50} m`;
  return `${Math.max(0, Math.round(m / 10) * 10)} m`;
}

/** « 5 min », « 1 h 05 ». */
export function minutes(s: number): string {
  const m = Math.max(1, Math.round(s / 60));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
}

/** Heure d'arrivée : « 14 h 32 ». */
export function arrivalClock(now: Date, seconds: number): string {
  const d = new Date(now.getTime() + seconds * 1000);
  return `${d.getHours()} h ${String(d.getMinutes()).padStart(2, '0')}`;
}

export type Turn = 'left' | 'right' | 'slight-left' | 'slight-right' | 'sharp-left' | 'sharp-right' | 'straight' | 'uturn' | 'roundabout' | 'arrive' | 'depart';
/** Pictogramme d'une manœuvre Mapbox. */
export function turnOf(m: Pick<Maneuver, 'type' | 'modifier'> | null): Turn {
  if (!m) return 'straight';
  if (m.type === 'arrive') return 'arrive';
  if (m.type === 'depart') return 'depart';
  if (m.type === 'roundabout' || m.type === 'rotary' || m.type === 'roundabout turn') return 'roundabout';
  switch (m.modifier) {
    case 'left': return 'left';
    case 'right': return 'right';
    case 'slight left': return 'slight-left';
    case 'slight right': return 'slight-right';
    case 'sharp left': return 'sharp-left';
    case 'sharp right': return 'sharp-right';
    case 'uturn': return 'uturn';
    default: return 'straight';
  }
}

/** Point dans un polygone GeoJSON (premier anneau, ou un des polygones d'un MultiPolygon). */
export function inPolygon(pt: LngLat, g: { type: string; coordinates?: unknown } | null | undefined): boolean {
  if (!g) return false;
  const rings: LngLat[][] = g.type === 'Polygon' ? [(g.coordinates as LngLat[][])[0]!] : g.type === 'MultiPolygon' ? (g.coordinates as LngLat[][][]).map((p) => p[0]!) : [];
  return rings.some((ring) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i]!, [xj, yj] = ring[j]!;
      if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  });
}

/** Seuil d'arrivée : « Je suis arrivé » à moins de 50 m du point, ou à l'intérieur du contour du bâtiment. */
export const ARRIVAL_M = 50;
export function arrived(pos: LngLat, target: LngLat, outline?: { type: string; coordinates?: unknown } | null): boolean {
  return haversine(pos, target) <= ARRIVAL_M || inPolygon(pos, outline);
}

/** Profil Mapbox Directions selon le véhicule du livreur. */
export const profileOf = (vehicle: string | null | undefined) => (vehicle === 'pied' ? 'walking' : vehicle === 'velo' ? 'cycling' : 'driving');

/** Adresse de l'API Directions (le jeton est public, restreint aux domaines Hailand). */
export function directionsUrl(points: LngLat[], profile: string, token: string): string {
  const path = points.map((p) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`).join(';');
  return `https://api.mapbox.com/directions/v5/mapbox/${profile}/${path}?geometries=geojson&overview=full&steps=true&voice_instructions=true&voice_units=metric&language=fr&access_token=${token}`;
}
