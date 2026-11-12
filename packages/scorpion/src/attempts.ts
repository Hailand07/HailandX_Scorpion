import { distanceM, type GpsSummary } from './gpsAcquisition';

/**
 * Tentatives successives de récupération GPS (HAILANDX.md §51). Une mesure seule peut « sauter » (position annoncée précise
 * mais fausse, fréquent à l'intérieur) : on garde donc toutes les tentatives, on retient la meilleure, et on compare.
 *  - deux tentatives qui tombent au même endroit se confirment ;
 *  - deux tentatives éloignées l'une de l'autre signalent un GPS instable : on le dit et on demande de sortir.
 */
export type AttemptsVerdict = 'unique' | 'confirme' | 'instable';

export interface AttemptsResult {
  /** Tentative retenue : la plus précise parmi celles qui s'accordent (ou la plus précise tout court). */
  best: GpsSummary;
  verdict: AttemptsVerdict;
  /** Écart maximal entre la position retenue et les autres tentatives (m). */
  spread: number;
  count: number;
}

/** Deux tentatives s'accordent si elles sont à moins de la somme de leurs précisions (au moins 25 m de tolérance). */
const agree = (a: GpsSummary, b: GpsSummary) => distanceM(a.position, b.position) <= Math.max(25, a.accuracy + b.accuracy);

export function combineAttempts(attempts: GpsSummary[]): AttemptsResult | null {
  if (attempts.length === 0) return null;
  const sorted = [...attempts].sort((a, b) => a.accuracy - b.accuracy);
  if (sorted.length === 1) return { best: sorted[0]!, verdict: 'unique', spread: 0, count: 1 };
  // La tentative confirmée par le plus d'autres l'emporte ; à égalité, la plus précise (ordre du tri).
  let best = sorted[0]!; let support = -1;
  for (const a of sorted) {
    const n = sorted.filter((b) => b !== a && agree(a, b)).length;
    if (n > support) { best = a; support = n; }
  }
  const spread = Math.max(...sorted.map((b) => distanceM(best.position, b.position)));
  return { best, verdict: support > 0 ? 'confirme' : 'instable', spread, count: sorted.length };
}

export type RetryCause = 'faible' | 'erreur' | 'instable' | 'hors_cercle' | 'choix';

export interface Guidance { title: string; intro: string; tips: { icon: 'window' | 'door' | 'sky' | 'still' | 'settings'; title: string; text: string }[]; cta: string }

/**
 * Consignes adaptées au numéro de la tentative (1 = première) et à la raison de la reprise :
 * 1 → près d'une fenêtre ; 2 → balcon, terrasse ou pas de la porte ; 3 et plus → dehors, à ciel ouvert.
 */
export function guidanceFor(attempt: number, cause: RetryCause | null): Guidance {
  const why =
    cause === 'hors_cercle' ? 'Votre bâtiment n’est pas dans le cercle : la position reçue était sans doute fausse.'
    : cause === 'instable' ? 'Les mesures ne tombent pas au même endroit : le signal est instable ici.'
    : cause === 'erreur' ? 'Le téléphone n’a pas reçu de position.'
    : cause === 'faible' ? 'Le signal était trop faible pour un résultat solide.'
    : '';
  if (attempt <= 1) {
    return {
      title: 'Avant de commencer',
      intro: 'Nous allons retrouver votre bâtiment à partir de votre position. Trois conseils pour un résultat solide.',
      tips: [
        { icon: 'door', title: 'Restez dans le bâtiment', text: 'Placez-vous à l’intérieur du bâtiment à enregistrer.' },
        { icon: 'window', title: 'Approchez-vous d’une fenêtre', text: 'Le signal GPS traverse mal les murs et les toits.' },
        { icon: 'still', title: 'Ne bougez plus', text: 'Gardez le téléphone immobile pendant 15 secondes au plus.' },
      ],
      cta: 'Je suis prêt, localiser',
    };
  }
  if (attempt === 2) {
    return {
      title: 'Deuxième essai : sortez un peu',
      intro: `${why} Cette fois, une fenêtre ne suffit pas.`.trim(),
      tips: [
        { icon: 'door', title: 'Balcon, terrasse ou pas de la porte', text: 'Mettez-vous à un endroit d’où vous voyez le ciel, sans quitter le bâtiment.' },
        { icon: 'sky', title: 'Téléphone face au ciel', text: 'Tenez-le à plat dans la main, loin des murs et des tôles.' },
        { icon: 'still', title: 'Attendez sans bouger', text: 'Laissez les mesures arriver, 15 secondes au plus.' },
      ],
      cta: 'J’y suis, relancer',
    };
  }
  return {
    title: 'Sortez complètement',
    intro: `${why} Le signal ne passe pas à l’intérieur : il faut être dehors.`.trim(),
    tips: [
      { icon: 'sky', title: 'Dehors, à ciel ouvert', text: 'Devant le portail ou dans la cour, sans toit ni arbre au-dessus de vous.' },
      { icon: 'settings', title: 'Localisation précise activée', text: 'Dans les réglages du téléphone : localisation activée, « position exacte » autorisée pour le navigateur.' },
      { icon: 'still', title: 'Restez devant votre bâtiment', text: 'Vous montrerez ensuite votre bâtiment sur la carte s’il n’est pas trouvé.' },
    ],
    cta: 'Je suis dehors, relancer',
  };
}

/** Phrase courte affichée pendant la mesure, selon la tentative. */
export const liveHint = (attempt: number): string =>
  attempt <= 1 ? 'Restez immobile, près d’une fenêtre.' : attempt === 2 ? 'Restez immobile, au balcon ou à la porte.' : 'Restez immobile, dehors, à ciel ouvert.';
