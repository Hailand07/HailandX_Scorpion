/**
 * Cycle de vie d'un colis (un colis = ce qu'un vendeur remet pour une commande) et preuves de remise.
 * Ce module décrit les RÈGLES ; la décision réelle est prise côté serveur (fonctions de la base), jamais dans le navigateur.
 */
export type ParcelStatus =
  | 'attente_vendeur' // commande reçue, le vendeur doit accepter
  | 'prepare' // le vendeur a préparé le colis (QR disponible)
  | 'mission_proposee' // proposé aux livreurs proches
  | 'accepte' // un livreur a accepté (mission verrouillée pour lui)
  | 'retire' // QR scanné au retrait : l'acheteur est prévenu
  | 'remis' // remise confirmée (scan de l'acheteur ou code)
  | 'annule'
  | 'litige';

const NEXT: Record<ParcelStatus, ParcelStatus[]> = {
  attente_vendeur: ['prepare', 'annule'],
  prepare: ['mission_proposee', 'annule'],
  mission_proposee: ['accepte', 'annule'],
  accepte: ['retire', 'mission_proposee', 'annule'], // le livreur peut se désister : la mission est reproposée
  retire: ['remis', 'litige'],
  remis: ['litige'],
  annule: [],
  litige: ['remis', 'annule'],
};

export const canTransition = (from: ParcelStatus, to: ParcelStatus): boolean => NEXT[from].includes(to);
export const isFinal = (s: ParcelStatus): boolean => s === 'annule' || s === 'remis';

/** Étapes affichées à l'acheteur (suivi) : l'état interne `mission_proposee`/`accepte` reste « en préparation de la livraison ». */
export function buyerStep(s: ParcelStatus): 'confirmee' | 'preparee' | 'en_route' | 'remise' | 'annulee' | 'litige' {
  switch (s) {
    case 'attente_vendeur':
      return 'confirmee';
    case 'prepare':
    case 'mission_proposee':
    case 'accepte':
      return 'preparee';
    case 'retire':
      return 'en_route';
    case 'remis':
      return 'remise';
    case 'annule':
      return 'annulee';
    default:
      return 'litige';
  }
}

/** Code de remise à 4 chiffres (repli quand l'acheteur ne peut pas scanner). `rng` est injectable pour les tests. */
export function newHandoverCode(rng: () => number = Math.random): string {
  return String(Math.floor(rng() * 10000)).padStart(4, '0');
}

export const MAX_HANDOVER_ATTEMPTS = 5;

export interface HandoverCheck {
  ok: boolean;
  /** Essais restants après celui-ci ; 0 = colis verrouillé (appel à l'équipe). */
  attemptsLeft: number;
}

/** Vérifie le code saisi par le livreur. Comparaison en temps constant ; après 5 échecs le colis est verrouillé. */
export function checkHandoverCode(expected: string, given: string, previousFailures: number): HandoverCheck {
  if (previousFailures >= MAX_HANDOVER_ATTEMPTS) return { ok: false, attemptsLeft: 0 };
  const a = expected.padEnd(4, ' ');
  const b = given.padEnd(4, ' ');
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  const ok = diff === 0 && /^\d{4}$/.test(given);
  return { ok, attemptsLeft: ok ? MAX_HANDOVER_ATTEMPTS - previousFailures : Math.max(0, MAX_HANDOVER_ATTEMPTS - previousFailures - 1) };
}

/** Distance maximale (m) entre le livreur et l'adresse pour confirmer une remise : contrôle de proximité. */
export const HANDOVER_MAX_DISTANCE_M = 150;
export const withinHandoverRange = (distanceM: number, addressAccuracyM = 0): boolean => distanceM <= HANDOVER_MAX_DISTANCE_M + Math.max(0, addressAccuracyM);

/** Format d'un QR de colis : `hx1.<colis>.<nonce>.<signature>` ; la signature est calculée et vérifiée par le serveur. */
export function parseParcelQr(text: string): { parcelId: string; nonce: string; signature: string } | null {
  const m = /^hx1\.([A-Za-z0-9_-]{6,64})\.([A-Za-z0-9_-]{8,64})\.([A-Za-z0-9_-]{16,128})$/.exec(text.trim());
  return m ? { parcelId: m[1], nonce: m[2], signature: m[3] } : null;
}
