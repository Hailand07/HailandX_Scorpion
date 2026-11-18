/**
 * Installation des applications sur l'écran d'accueil (§60). Où en est le téléphone :
 * - « installee » : l'application est déjà ouverte depuis son icône (rien à proposer) ;
 * - « integre » : navigateur d'une application (WhatsApp, Facebook, TikTok…) qui ne sait pas installer : ouvrir dans Chrome ou Safari ;
 * - « ios » : Safari sur iPhone ou iPad : Partager → « Sur l'écran d'accueil » (Apple ne permet pas de bouton direct) ;
 * - « android » / « autre » : Chrome et compagnie : invitation directe si le navigateur l'a proposée, sinon menu ⋮.
 */
export type Plateforme = 'installee' | 'integre' | 'ios' | 'android' | 'autre';

/** Navigateurs intégrés aux applications (même liste que Scorpion, `geoDiagnostic.ts`). */
export function navigateurIntegre(ua: string, standaloneIos = false): boolean {
  if (/FBAN|FBAV|FB_IAB|Instagram|MicroMessenger|Snapchat|TikTok|musical_ly|LinkedInApp|Twitter|WhatsApp|GSA\/|Line\//i.test(ua)) return true;
  if (/iPhone|iPad|iPod/.test(ua) && !standaloneIos && !/Safari\//.test(ua)) return true;
  if (/Android/.test(ua) && /; wv\)/.test(ua)) return true;
  return false;
}

export function plateforme(ua: string, { standalone = false, standaloneIos = false, touchMac = false } = {}): Plateforme {
  if (standalone || standaloneIos) return 'installee';
  if (navigateurIntegre(ua, standaloneIos)) return 'integre';
  if (/iPhone|iPad|iPod/.test(ua) || (touchMac && /Macintosh/.test(ua))) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'autre';
}

/** Bandeau fermé il y a moins de 14 jours : on ne le remontre pas. */
export const BANDEAU_PAUSE_JOURS = 14;
export const bandeauEnPause = (fermeLe: number | null, now = Date.now()) => fermeLe !== null && now - fermeLe < BANDEAU_PAUSE_JOURS * 864e5;
