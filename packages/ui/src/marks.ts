/**
 * Logos des applications Hailand de ce dépôt (maquettes v5, choisis par le fondateur le 2026-10-20).
 * Source UNIQUE : le composant `AppMark`, les écrans d'ouverture et les icônes d'installation (scripts/icones.ts) en dérivent.
 * Construction commune : carré aux coins arrondis (29 %), un seul symbole, deux couleurs au plus.
 * HailandMap et NavigationX ont leur propre logo dans leur dépôt.
 */
export type HailandApp = 'hailandx' | 'vendeur' | 'flotte' | 'console';

const INK = '#12141c';
const LIME = '#c8f25a';
const NIGHT = '#0f1424';
const BLUE = '#3346f0';

/** Symbole de chaque application, dans un carré de 64 × 64 (sans le fond). */
const SYMBOLS: Record<HailandApp, string> = {
  // « X » de HailandX, vert citron sur noir (tracé, pour un rendu identique partout).
  hailandx: `<path d="M22.5 20.5 41.5 43.5M41.5 20.5 22.5 43.5" fill="none" stroke="${LIME}" stroke-width="6.4" stroke-linecap="round"/>`,
  // Devanture à auvent (dessin A) sur fond sombre (fond B).
  vendeur: `<g transform="translate(15 15) scale(1.4167)" fill="none" stroke="${LIME}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 9.5h17l-1.6-5.5H5.1z"/><path d="M3.5 9.5c0 1.6 1.2 2.6 2.8 2.6s2.9-1 2.9-2.6c0 1.6 1.2 2.6 2.8 2.6s2.8-1 2.8-2.6c0 1.6 1.3 2.6 2.9 2.6s2.8-1 2.8-2.6"/><path d="M5 12v8h14v-8"/><path d="M10 20v-4.5h4V20"/></g>`,
  // Itinéraire vert du point de départ (bleu) à la flèche (A).
  flotte: `<g transform="translate(12 12)"><path d="M9 32c0-6 5-8 11-8s11-2 11-8-4-8-9-8" fill="none" stroke="${LIME}" stroke-width="3.6" stroke-linecap="round"/><circle cx="9" cy="32" r="3.4" fill="${BLUE}" stroke="#ffffff" stroke-width="1.6"/><path d="M22 3.5 29 8l-7 4.5z" fill="${LIME}"/></g>`,
  // Bouclier de l'équipe.
  console: `<path transform="translate(18.5 18.5) scale(1.125)" d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" fill="none" stroke="${LIME}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`,
};

export const MARK_BACKGROUND: Record<HailandApp, string> = { hailandx: INK, vendeur: INK, flotte: NIGHT, console: INK };

/** Logo complet (fond arrondi + symbole), en SVG 64 × 64. `plein` : fond carré sans arrondi (icônes « maskable »). */
export function markSvg(app: HailandApp, opts: { plein?: boolean; marge?: number } = {}): string {
  const r = opts.plein ? 0 : 18.5;
  const m = opts.marge ?? 0; // marge intérieure (zone de sécurité des icônes maskable)
  const s = (64 - 2 * m) / 64;
  // Flotte vit sur fond nuit : un liseré garde le carré visible sur l'interface sombre.
  const liseré = app === 'flotte' && !opts.plein ? `<rect x="0.75" y="0.75" width="62.5" height="62.5" rx="${r - 0.75}" fill="none" stroke="#2a3150" stroke-width="1.5"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="${r}" fill="${MARK_BACKGROUND[app]}"/>${liseré}<g transform="translate(${m} ${m}) scale(${s})">${SYMBOLS[app]}</g></svg>`;
}

/** Nom affiché et phrase de l'écran d'ouverture de chaque application. */
export const APP_INFO: Record<HailandApp, { nom: string; phrase: string; nuit: boolean }> = {
  hailandx: { nom: 'HailandX', phrase: 'Acheter près de chez vous, livré à votre porte', nuit: false },
  vendeur: { nom: 'HailandX Vendeur', phrase: 'Votre boutique, vos commandes, votre argent', nuit: false },
  flotte: { nom: 'Hailand Flotte', phrase: 'Missions de livraison', nuit: true },
  console: { nom: 'Hailand Console', phrase: 'Réservé à l’équipe Hailand', nuit: false },
};
