/** Adresses des applications de l'écosystème Hailand (modifiables par variable d'environnement publique de chaque projet Vercel). */
export const HAILANDX_URL = process.env.NEXT_PUBLIC_HAILANDX_URL ?? 'https://hailandx-hdxk.vercel.app';
export const VENDEUR_URL = process.env.NEXT_PUBLIC_VENDEUR_URL ?? 'https://hailandx-vendeur-gn.vercel.app';
export const FLOTTE_URL = process.env.NEXT_PUBLIC_FLOTTE_URL ?? 'https://hailandx-flotte-hailand07s-projects.vercel.app';
export const NAVIGATIONX_URL = process.env.NEXT_PUBLIC_NAVIGATIONX_URL ?? 'https://lynx-hailand07s-projects.vercel.app';
/** WhatsApp de l'assistance Hailand (format international sans « + », ex. 224620000000) ; sans valeur, le bouton n'apparaît pas. */
export const SUPPORT_WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? '';

/** Réseaux suivis par les liens partagés des vendeurs. */
export const SOURCES = ['tiktok', 'whatsapp', 'facebook', 'autre'] as const;
export type Source = (typeof SOURCES)[number];

const PALETTE = ['#f6d8bd', '#dbe4ff', '#f9d6e3', '#d7f0dc', '#e8dcf5', '#fbeec1', '#d3edd9', '#f3d3e0'];
/** Couleur stable dérivée du nom (en attendant les vraies photos). */
export const colorOf = (key: string): string => {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length]!;
};
/** Hailand Console : l'outil interne de l'équipe (jamais proposé aux utilisateurs). */
export const CONSOLE_URL = process.env.NEXT_PUBLIC_CONSOLE_URL ?? 'https://hailand-console-gn.vercel.app';

/**
 * Parcours d'enregistrement d'une adresse dans NavigationX (seul endroit où l'on enregistre un emplacement), ouvert directement
 * à la bonne étape. À la fin, NavigationX propose « Revenir à … » et renvoie vers `chemin` de l'application `retour`, avec
 * `?adresse=<identifiant>` (seules les applications Hailand sont acceptées comme retour : jamais une adresse libre).
 */
export function lienEnregistrement(retour: 'vendeur' | 'hailandx', chemin: string): string {
  const u = new URL(NAVIGATIONX_URL);
  u.searchParams.set('enregistrer', '1');
  u.searchParams.set('retour', retour);
  u.searchParams.set('chemin', chemin.startsWith('/') && !chemin.startsWith('//') ? chemin : '/');
  return u.toString();
}
