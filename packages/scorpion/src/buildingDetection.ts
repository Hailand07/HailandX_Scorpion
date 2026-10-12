import * as turf from '@turf/turf';

/**
 * Identification du bâtiment à partir de la position retenue (phase D de l'enregistrement guidé).
 * Ordre, du plus fiable au moins fiable :
 * 1. bâtiment **certifié Hailand** contenant la position (même règle que la base : `fn_find_certified_building`,
 *    bâtiment avant concession, puis le plus petit) → niveau 3 ;
 * 2. contour **OSM** contenant la position (le plus petit) → niveau 2 ;
 * 3. sinon, le bâtiment **le plus proche** dans le rayon d'examen, certifié ou non (un certifié l'emporte s'il est à 3 m près
 *    aussi proche) → verrouillé et proposé ; l'utilisateur confirme qu'il l'identifie visuellement ;
 * 4. rien → l'utilisateur montre son bâtiment sur la carte.
 * Décision du fondateur (2026-10-06) : la certification niveau 3 atteste que le **bâtiment** existe à cet endroit, pas qui
 * l'occupe. Plusieurs personnes peuvent donc s'y rattacher, et la confirmation visuelle de l'utilisateur suffit pour se rattacher
 * à un bâtiment certifié, même si le point GPS tombe juste à côté.
 * Tous les chiffres affichés (distances, surfaces, recouvrement) sont calculés ici.
 */

export type CandidateSource = 'hailand' | 'osm';

export interface CandidateInput {
  source: CandidateSource;
  id: string;
  polygon: GeoJSON.Polygon;
  /** Concession (cour) plutôt que bâtiment : passe après un bâtiment à égalité. */
  courtyard?: boolean;
  /** Concession à laquelle appartient ce bâtiment (bâtiments certifiés d'une cour). */
  parentId?: string | null;
  label?: string | null;
  code?: string | null;
}

export interface Candidate extends CandidateInput {
  /** Distance de la position au contour (0 si la position est dedans), en mètres. */
  distance: number;
  contains: boolean;
  /** Surface du contour (m²). */
  area: number;
  /** Part du cercle de précision qui tombe dans le contour (0 à 1). */
  overlap: number;
}

export interface Detection {
  /** Contours examinés, du plus proche au plus éloigné. */
  examined: Candidate[];
  chosen: Candidate | null;
  /** Comment le bâtiment a été trouvé. */
  method: 'hailand' | 'osm_dedans' | 'hailand_proche' | 'osm_proche' | 'aucun';
  hailandCount: number;
  osmCount: number;
}

/** Rayon d'examen autour de la position (m). */
export const SCAN_RADIUS_M = 60;

export function snapRadius(accuracy: number): number {
  return Math.min(Math.max(accuracy, 5), 15);
}

function measure(input: CandidateInput, position: [number, number], circle: GeoJSON.Feature<GeoJSON.Polygon>): Candidate | null {
  try {
    const poly = turf.polygon(input.polygon.coordinates);
    const pt = turf.point(position);
    const contains = turf.booleanPointInPolygon(pt, poly);
    const distance = contains ? 0 : turf.pointToPolygonDistance(pt, poly, { units: 'meters' });
    const area = turf.area(poly);
    let overlap = 0;
    const inter = turf.intersect(turf.featureCollection([circle, poly]));
    if (inter) overlap = Math.min(turf.area(inter) / turf.area(circle), 1);
    return { ...input, contains, distance: Math.max(distance, 0), area, overlap };
  } catch {
    return null; // contour invalide (auto-intersection…) : ignoré
  }
}

export function detectBuilding(position: [number, number], accuracy: number, inputs: CandidateInput[]): Detection {
  const circle = turf.circle(position, Math.max(accuracy, 1), { units: 'meters', steps: 48 });
  const examined = inputs
    .map((c) => measure(c, position, circle))
    .filter((c): c is Candidate => !!c && c.distance <= SCAN_RADIUS_M)
    .sort((a, b) => a.distance - b.distance || a.area - b.area);

  const hailandCount = examined.filter((c) => c.source === 'hailand').length;
  const osmCount = examined.length - hailandCount;
  const smallest = (list: Candidate[]) => [...list].sort((a, b) => Number(!!a.courtyard) - Number(!!b.courtyard) || a.area - b.area)[0];

  const hailandIn = examined.filter((c) => c.source === 'hailand' && c.contains);
  if (hailandIn.length) return { examined, chosen: smallest(hailandIn), method: 'hailand', hailandCount, osmCount };

  const osmIn = examined.filter((c) => c.source === 'osm' && c.contains);
  if (osmIn.length) return { examined, chosen: smallest(osmIn), method: 'osm_dedans', hailandCount, osmCount };

  const nearest = examined[0];
  if (nearest) {
    const certified = examined.find((c) => c.source === 'hailand' && c.distance <= nearest.distance + 3);
    const chosen = certified ?? nearest;
    return { examined, chosen, method: chosen.source === 'hailand' ? 'hailand_proche' : 'osm_proche', hailandCount, osmCount };
  }

  return { examined, chosen: null, method: 'aucun', hailandCount, osmCount };
}

/** Rectangle englobant [ouest, sud, est, nord] d'un polygone. */
export function bboxOf(polygon: GeoJSON.Polygon): [number, number, number, number] {
  return turf.bbox(polygon) as [number, number, number, number];
}

/* ───────────── Phase E : l'utilisateur montre son bâtiment ───────────── */

/** Distance maximale entre le point touché et la position GPS retenue : 100 m, ou la précision si elle est plus grande. */
export function maxTapDistance(accuracy: number): number {
  return Math.max(100, accuracy);
}

/** Rayon d'accroche autour du point touché (un doigt couvre plusieurs mètres à l'écran). */
export const TAP_SNAP_M = 8;

export type TapResult =
  | { kind: 'trop_loin'; distance: number; max: number }
  /** Bâtiment certifié Hailand désigné : rattachement officiel après confirmation de l'utilisateur. */
  | { kind: 'certifie'; candidate: Candidate; distance: number }
  | { kind: 'osm'; candidate: Candidate; distance: number; method: 'dedans' | 'proche' }
  | { kind: 'zone'; distance: number };

/**
 * Bâtiment désigné par une touche : contour OSM contenant le point touché (le plus petit), sinon le plus proche à moins de
 * `TAP_SNAP_M`, sinon la zone touchée (niveau 1). `distance` = distance entre le point touché et la position GPS retenue.
 */
export function detectAtTap(
  tap: [number, number],
  gps: [number, number],
  accuracy: number,
  inputs: CandidateInput[],
  /** Tolérance du doigt en mètres (dépend du zoom : environ 12 pixels à l'écran), bornée entre 1,5 et 8 m. */
  snapM = TAP_SNAP_M,
): TapResult {
  const distance = turf.distance(turf.point(gps), turf.point(tap), { units: 'meters' });
  const max = maxTapDistance(accuracy);
  if (distance > max) return { kind: 'trop_loin', distance, max };
  // La touche fait foi : on retient le bâtiment SOUS le doigt, jamais « le plus proche » à des dizaines de mètres.
  const circle = turf.circle(tap, 1, { units: 'meters', steps: 16 });
  const measured = inputs.map((c) => measure(c, tap, circle)).filter((c): c is Candidate => !!c);
  const result = (c: Candidate, method: 'dedans' | 'proche'): TapResult =>
    c.source === 'hailand' ? { kind: 'certifie', candidate: c, distance } : { kind: 'osm', candidate: c, distance, method };

  // 1. Bâtiments (hors concessions) qui contiennent le point : le certifié d'abord (même bâtiment que son contour OSM), puis le plus petit.
  const inside = measured.filter((c) => c.contains && !c.courtyard).sort((x, y) => Number(x.source !== 'hailand') - Number(y.source !== 'hailand') || x.area - y.area);
  if (inside.length) return result(inside[0], 'dedans');
  // 2. Une concession certifiée qui contient le point (touche dans la cour, hors de tout bâtiment).
  const yard = measured.filter((c) => c.contains && c.courtyard && c.source === 'hailand').sort((x, y) => x.area - y.area)[0];
  if (yard) return result(yard, 'dedans');
  // 3. Le contour le plus proche, seulement à portée de doigt.
  const tol = Math.min(Math.max(snapM, 1.5), TAP_SNAP_M);
  const near = measured.filter((c) => !c.contains && c.distance <= tol).sort((x, y) => x.distance - y.distance)[0];
  if (near) return result(near, 'proche');
  return { kind: 'zone', distance };
}
