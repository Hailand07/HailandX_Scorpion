/**
 * Niveaux de précision d'une adresse (définition du fondateur, 2026-10-03 — ECOSYSTEME_HAILAND.md §3.4).
 *  1 = le GPS n'identifie aucun polygone OSM (précision faible)
 *  2 = le GPS tombe dans un polygone OSM (bonne précision, non vérifiée)
 *  3 = vérifié, enregistré et certifié par l'équipe Hailand (très haute précision)
 * Le niveau 3 n'est PAS la suite des niveaux 1 et 2 : c'est une vérification humaine indépendante.
 */
export type AddressLevel = 1 | 2 | 3;

export interface LevelInfo {
  level: AddressLevel;
  label: string;
  precision: string;
  /** Ce que le niveau implique pour l'utilisateur (guidage). */
  guidance: string;
}

export const LEVELS: Record<AddressLevel, LevelInfo> = {
  1: {
    level: 1,
    label: 'Niveau 1',
    precision: 'Précision faible',
    guidance: 'Guidage vers une zone approximative.',
  },
  2: {
    level: 2,
    label: 'Niveau 2',
    precision: 'Précision bonne · non vérifiée',
    guidance: 'Guidage jusqu’au bon bâtiment, entrée non vérifiée.',
  },
  3: {
    level: 3,
    label: 'Niveau 3',
    precision: 'Précision très haute · certifié',
    guidance: 'Guidage jusqu’à l’entrée précise.',
  },
};

/** Niveau détecté automatiquement à partir du GPS : un polygone OSM identifié → 2, sinon 1. */
export function detectedLevel(polygonFound: boolean): AddressLevel {
  return polygonFound ? 2 : 1;
}

/** Niveau effectif : 3 seulement si l'équipe Hailand a certifié le bâtiment. */
export function effectiveLevel(detected: AddressLevel, certifiedByHailand: boolean): AddressLevel {
  return certifiedByHailand ? 3 : detected;
}
