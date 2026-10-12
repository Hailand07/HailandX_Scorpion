/**
 * Récupération de la position par mesures GPS multiples (phase B de l'enregistrement guidé).
 * Toutes les valeurs affichées à l'utilisateur viennent d'ici : ce sont de vrais calculs sur les mesures du téléphone, rien d'inventé.
 *
 * Méthode :
 * 1. on recueille plusieurs mesures (position + précision annoncée par le téléphone) pendant 15 s au plus ;
 * 2. on écarte les mesures nettement moins précises que la meilleure, puis celles trop éloignées du groupe (valeurs aberrantes) ;
 * 3. la position retenue est la moyenne des mesures restantes, pondérée par 1 / précision² (une mesure à ±5 m pèse 4 fois plus qu'à ±10 m) ;
 * 4. la précision retenue est prudente : jamais meilleure que la meilleure mesure, ni que la dispersion observée.
 */

export interface GpsSample {
  lng: number;
  lat: number;
  /** Rayon de précision annoncé par le téléphone (m, 68 %). */
  accuracy: number;
  /** Horodatage (ms). */
  t: number;
}

export interface GpsSummary {
  /** Mesures reçues. */
  received: number;
  /** Mesures conservées après filtrage. */
  kept: number;
  /** Mesures écartées (imprécises ou aberrantes). */
  rejected: number;
  /** Position retenue [lng, lat] (moyenne pondérée). */
  position: [number, number];
  /** Meilleure précision annoncée parmi les mesures conservées (m). */
  bestAccuracy: number;
  /** Écart-type des mesures conservées autour de la position retenue (m). */
  dispersion: number;
  /** Précision retenue (m) : max(meilleure mesure, dispersion). */
  accuracy: number;
  confidence: Confidence;
  /** Mesures conservées (pour les distinguer à l'écran des mesures écartées). */
  keptSamples: GpsSample[];
}

export type Confidence = 'elevee' | 'moyenne' | 'faible';

export const CONFIDENCE_LABELS: Record<Confidence, string> = { elevee: 'Élevé', moyenne: 'Moyen', faible: 'Faible' };

/** Durée maximale de la récupération (ms). */
export const MAX_DURATION_MS = 15000;
/** Durée minimale, pour recueillir plusieurs mesures même quand la première est bonne (ms). */
export const MIN_DURATION_MS = 4000;
/** Précision à partir de laquelle on s'arrête avant la fin (m). */
export const TARGET_ACCURACY_M = 10;
/** Nombre minimal de mesures conservées pour s'arrêter avant la fin. */
export const MIN_SAMPLES = 4;

const R = 6371008.8;
const rad = (d: number) => (d * Math.PI) / 180;

/** Décalage en mètres (est, nord) de `p` par rapport à `o` (plan local, valable sur quelques kilomètres). */
export function toLocal(o: [number, number], p: [number, number]): [number, number] {
  const x = rad(p[0] - o[0]) * R * Math.cos(rad(o[1]));
  const y = rad(p[1] - o[1]) * R;
  return [x, y];
}

/** Distance en mètres entre deux positions [lng, lat]. */
export function distanceM(a: [number, number], b: [number, number]): number {
  const [x, y] = toLocal(a, b);
  return Math.hypot(x, y);
}

function weightedMean(samples: GpsSample[]): [number, number] {
  let sw = 0;
  let lng = 0;
  let lat = 0;
  for (const s of samples) {
    const w = 1 / Math.max(s.accuracy, 1) ** 2;
    sw += w;
    lng += s.lng * w;
    lat += s.lat * w;
  }
  return [lng / sw, lat / sw];
}

function median(v: number[]): number {
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function confidenceOf(accuracy: number): Confidence {
  if (accuracy <= 10) return 'elevee';
  if (accuracy <= 25) return 'moyenne';
  return 'faible';
}

/** Résumé des mesures reçues ; `null` tant qu'aucune mesure n'est disponible. */
export function summarize(samples: GpsSample[]): GpsSummary | null {
  const valid = samples.filter((s) => Number.isFinite(s.lng) && Number.isFinite(s.lat) && Number.isFinite(s.accuracy) && s.accuracy > 0);
  if (valid.length === 0) return null;

  // 1. Précision : on écarte les mesures plus de 3 fois moins précises que la meilleure (minimum 20 m de tolérance).
  const best = Math.min(...valid.map((s) => s.accuracy));
  let kept = valid.filter((s) => s.accuracy <= Math.max(best * 3, 20));

  // 2. Valeurs aberrantes : distance à la position provisoire au-delà de 3 × l'écart médian (et de la précision de la mesure).
  if (kept.length >= 3) {
    const center = weightedMean(kept);
    const d = kept.map((s) => distanceM(center, [s.lng, s.lat]));
    const med = median(d);
    const limit = Math.max(3 * med, 5);
    const filtered = kept.filter((s, i) => d[i] <= Math.max(limit, s.accuracy));
    if (filtered.length > 0) kept = filtered;
  }

  const position = weightedMean(kept);
  const bestAccuracy = Math.min(...kept.map((s) => s.accuracy));
  const dispersion =
    kept.length > 1 ? Math.sqrt(kept.reduce((acc, s) => acc + distanceM(position, [s.lng, s.lat]) ** 2, 0) / kept.length) : 0;
  const accuracy = Math.max(bestAccuracy, dispersion);

  return {
    received: samples.length,
    kept: kept.length,
    rejected: samples.length - kept.length,
    position,
    bestAccuracy,
    dispersion,
    accuracy,
    confidence: confidenceOf(accuracy),
    keptSamples: kept,
  };
}

/** Faut-il arrêter la récupération ? (fin du temps, ou précision atteinte avec assez de mesures après la durée minimale) */
export function shouldStop(summary: GpsSummary | null, elapsedMs: number): boolean {
  if (elapsedMs >= MAX_DURATION_MS) return true;
  if (!summary || elapsedMs < MIN_DURATION_MS) return false;
  return summary.kept >= MIN_SAMPLES && summary.accuracy <= TARGET_ACCURACY_M;
}

/** Nombre formaté à la française (« 3,1 »). */
export const fmtM = (v: number, digits = 1) => v.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Coordonnée formatée en degrés décimaux (6 décimales ≈ 11 cm). */
export const fmtCoord = (v: number) => v.toFixed(6);
