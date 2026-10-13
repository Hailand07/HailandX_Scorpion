import type { Candidate, Detection, TapResult } from './buildingDetection';
import type { AddressLevel } from './levels';

/**
 * Ce que l'écran propose à l'utilisateur après la détection du bâtiment. Rien n'est enregistré sans sa confirmation ;
 * le niveau 3 n'est jamais décidé ici : la base le vérifie (bâtiment certifié, à moins de max(100 m, précision) du GPS).
 */
export type Proposal =
  | { kind: 'certifie'; candidate: Candidate; level: 3; text: string }
  | { kind: 'osm'; candidate: Candidate; level: 2; text: string }
  | { kind: 'zone'; level: 1; text: string }
  | { kind: 'trop_loin'; level: 1; text: string };

const m = (v: number) => `${Math.round(v)} m`;

/** Proposition issue de la détection automatique autour de la position GPS. */
export function proposalFromDetection(d: Detection): Proposal {
  const c = d.chosen;
  if (!c) return { kind: 'zone', level: 1, text: 'Aucun bâtiment repéré ici : votre adresse sera enregistrée comme une zone (niveau 1). Touchez votre bâtiment sur la carte pour le désigner.' };
  if (c.source === 'hailand') {
    const near = d.method === 'hailand_proche' ? ` (à ${m(c.distance)})` : '';
    return { kind: 'certifie', candidate: c, level: 3, text: `Bâtiment certifié Hailand trouvé${near}${c.code ? ` : ${c.code}` : ''}. C’est le vôtre ?` };
  }
  const near = d.method === 'osm_proche' ? ` à ${m(c.distance)}` : '';
  return { kind: 'osm', candidate: c, level: 2, text: `Bâtiment repéré${near} sur la carte (niveau 2). C’est le vôtre ?` };
}

/** Proposition issue d'une touche de l'utilisateur sur la carte. */
export function proposalFromTap(r: TapResult): Proposal {
  switch (r.kind) {
    case 'trop_loin': return { kind: 'trop_loin', level: 1, text: `Ce point est à ${m(r.distance)} de votre position : trop loin (maximum ${m(r.max)}). Rapprochez-vous ou touchez plus près.` };
    case 'certifie': return { kind: 'certifie', candidate: r.candidate, level: 3, text: `Bâtiment certifié Hailand désigné${r.candidate.code ? ` : ${r.candidate.code}` : ''}. C’est bien le vôtre ?` };
    case 'osm': return { kind: 'osm', candidate: r.candidate, level: 2, text: 'Bâtiment désigné (niveau 2). C’est bien le vôtre ?' };
    default: return { kind: 'zone', level: 1, text: 'Aucun bâtiment sous votre doigt : zone enregistrée (niveau 1).' };
  }
}

export const levelLabel = (l: AddressLevel): string => (l === 3 ? 'Niveau 3 · bâtiment certifié' : l === 2 ? 'Niveau 2 · bâtiment repéré' : 'Niveau 1 · zone');
