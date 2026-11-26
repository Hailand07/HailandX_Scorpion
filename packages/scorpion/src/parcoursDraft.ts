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

/**
 * Reprise après rechargement (2026-11-26). Sur iPhone, Safari garde le refus de localisation pour la page déjà ouverte :
 * même après « Autoriser » dans les Réglages, une nouvelle demande reste refusée tant que la page n'est pas rechargée.
 * Le parcours note donc qu'il faut rouvrir la récupération GPS, puis recharge la page ; la page qui l'héberge le rouvre.
 */
const RESUME = 'hx.parcours.reprise.';
const RESUME_MAX_MS = 10 * 60_000;
export interface ParcoursResume { at: number; extra?: Record<string, unknown> }
export function markResume(key: string, extra?: Record<string, unknown>): void {
  try { localStorage.setItem(RESUME + key, JSON.stringify({ at: Date.now(), extra })); } catch { /* stockage refusé */ }
}
export function peekResume(key: string): ParcoursResume | null {
  try {
    const raw = localStorage.getItem(RESUME + key);
    if (!raw) return null;
    const r = JSON.parse(raw) as ParcoursResume;
    if (!r || typeof r.at !== 'number' || Date.now() - r.at > RESUME_MAX_MS) { localStorage.removeItem(RESUME + key); return null; }
    return r;
  } catch { return null; }
}
export function clearResume(key: string): void {
  try { localStorage.removeItem(RESUME + key); } catch { /* rien */ }
}
/** Un parcours interrompu attend d'être rouvert (étape « infos » gardée, ou récupération GPS à relancer après rechargement). */
export const hasParcours = (key: string) => hasDraft(key) || peekResume(key) !== null;
