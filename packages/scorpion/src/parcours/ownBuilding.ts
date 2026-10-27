import * as turf from '@turf/turf';
import type { DeclarationRecord } from './declarations';
import type { Candidate, CandidateInput } from '../buildingDetection';

/**
 * « Chez soi » : reconnaît, parmi les adresses déjà enregistrées par l'utilisateur, celle qui correspond à un bâtiment détecté
 * ou touché pendant « Ajouter un nouveau bâtiment ». Le bâtiment de l'utilisateur est toujours considéré comme le sien :
 * on l'en informe, sans rien lui demander ni enregistrer (décision du fondateur, 2026-10-06).
 *
 * Une adresse correspond à un candidat si :
 * - bâtiment certifié Hailand : l'adresse est rattachée à ce bâtiment, à sa concession, ou à un bâtiment de la même concession ;
 * - contour OSM : même identifiant, ou le contour de l'adresse recouvre celui du candidat (≥ 60 %, comme la base), ou la position
 *   de l'adresse tombe dans le candidat ;
 * - zone au niveau 1 : le point touché (ou la position) est à moins de `ZONE_MATCH_M` de la position de l'adresse.
 */

/** Distance sous laquelle un point est considéré comme « la même zone » qu'une adresse de niveau 1 (m). */
export const ZONE_MATCH_M = 15;

type Pt = [number, number];

const polygonOf = (g: GeoJSON.Polygon) => turf.polygon(g.coordinates);

function insidePolygon(p: Pt, g: GeoJSON.Polygon): boolean {
  try {
    return turf.booleanPointInPolygon(turf.point(p), polygonOf(g));
  } catch {
    return false;
  }
}

function overlapShare(a: GeoJSON.Polygon, b: GeoJSON.Polygon): number {
  try {
    const pa = polygonOf(a);
    const pb = polygonOf(b);
    const inter = turf.intersect(turf.featureCollection([pa, pb]));
    if (!inter) return 0;
    return turf.area(inter) / Math.min(turf.area(pa), turf.area(pb));
  } catch {
    return 0;
  }
}

/** Adresse de l'utilisateur correspondant à ce candidat (bâtiment certifié ou contour OSM), sinon `null`. */
export function ownMatchForCandidate(c: Pick<CandidateInput, 'source' | 'id' | 'polygon' | 'parentId'>, homes: DeclarationRecord[]): DeclarationRecord | null {
  for (const d of homes) {
    if (c.source === 'hailand') {
      const cb = d.certifiedBuildingId;
      if (cb && (cb === c.id || cb === c.parentId)) return d;
      continue;
    }
    if (d.osmPolygonId && d.osmPolygonId === c.id && !c.id.startsWith('osm-')) return d;
    if (d.polygon && overlapShare(d.polygon, c.polygon) >= 0.6) return d;
    if (!d.polygon && !d.certifiedBuildingId && insidePolygon(d.gps as Pt, c.polygon)) return d;
  }
  // Bâtiment certifié de l'adresse reconnu sur son contour OSM : la position de l'adresse tombe dans ce contour.
  if (c.source === 'osm') {
    for (const d of homes) if (d.certifiedBuildingId && insidePolygon(d.gps as Pt, c.polygon)) return d;
  }
  return null;
}

/** Adresse de niveau 1 (zone) correspondant à un point touché, sinon `null`. */
export function ownMatchForPoint(p: Pt, homes: DeclarationRecord[]): DeclarationRecord | null {
  for (const d of homes) {
    if (d.polygon || d.certifiedBuildingId) continue;
    try {
      if (turf.distance(turf.point(p), turf.point(d.gps as Pt), { units: 'meters' }) <= ZONE_MATCH_M) return d;
    } catch {
      /* position invalide : ignorée */
    }
  }
  return null;
}

/** Contours à dessiner « chez vous » sur la vue satellite : contour de l'adresse (niveau 2), bâtiment certifié rattaché, sinon petite zone. */
export function ownOutlines(homes: DeclarationRecord[], certified: CandidateInput[]): GeoJSON.Polygon[] {
  const out: GeoJSON.Polygon[] = [];
  for (const d of homes) {
    const cert = d.certifiedBuildingId ? certified.filter((c) => c.id === d.certifiedBuildingId || c.parentId === d.certifiedBuildingId) : [];
    if (cert.length) out.push(...cert.map((c) => c.polygon));
    else if (d.polygon) out.push(d.polygon);
    else out.push(turf.circle(d.gps as Pt, 6, { units: 'meters', steps: 24 }).geometry);
  }
  return out;
}

export type OwnCandidate = Candidate;
