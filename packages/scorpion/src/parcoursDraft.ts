/**
 * Brouillon du parcours d'adresse (§55). Sur certains téléphones, ouvrir l'appareil photo (photo du portail ou de la devanture)
 * fait recharger la page, ou le parcours est remonté : on revenait alors au tout début, après avoir déjà repéré le bâtiment.
 * L'étape « infos » est donc gardée sur le téléphone (30 minutes au plus) et reprise toute seule au retour.
 * Module léger (sans React ni carte) : les pages l'importent pour rouvrir le parcours (`@hailandx/scorpion/brouillon`).
 */
export interface ParcoursDraft {
  at: number;
  gps: { lngLat: [number, number]; accuracy: number };
  polygon: GeoJSON.Polygon | null;
  osmId: string | null;
  tapPoint: [number, number] | null;
  certifiedId: string | null;
  admin: Record<string, unknown>;
  level: 1 | 2;
  locatedBy: 'gps' | 'hors_cercle' | 'a_distance';
  label: string;
  buildingType: string;
  floor: string;
  door: string;
  landmark: string;
  /** Photo du portail déjà envoyée (chemin dans le stockage). */
  gatePath: string | null;
  /** Données propres à l'application (ex. adresse temporaire). */
  extra?: Record<string, unknown>;
}

const PREFIX = 'hx.parcours.';
const MAX_AGE_MS = 30 * 60_000;

export function readDraft(key: string): ParcoursDraft | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const d = JSON.parse(raw) as ParcoursDraft;
    if (!d || typeof d.at !== 'number' || Date.now() - d.at > MAX_AGE_MS || !d.gps) { localStorage.removeItem(PREFIX + key); return null; }
    return d;
  } catch { return null; }
}
export function writeDraft(key: string, d: Omit<ParcoursDraft, 'at'>): void {
  try { localStorage.setItem(PREFIX + key, JSON.stringify({ ...d, at: Date.now() })); } catch { /* stockage refusé : pas de reprise */ }
}
export function clearDraft(key: string): void {
  try { localStorage.removeItem(PREFIX + key); } catch { /* rien */ }
}
export const hasDraft = (key: string) => readDraft(key) !== null;
