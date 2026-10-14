import type { SupabaseClient } from '@supabase/supabase-js';
import { ACCOUNT_KEYS } from './account';

/**
 * Compte Hailand unique — passage de session entre applications (solution provisoire tant qu'il n'y a pas de nom de domaine
 * commun, HAILANDX.md §31 phase 3). L'application de départ crée un code à usage unique (2 min, lié à l'application d'arrivée)
 * et l'ajoute à l'adresse (`?passage=…`) ; l'application d'arrivée l'échange, via la fonction serveur `passage`, contre une
 * session neuve du même compte. Sans session au départ, le lien s'ouvre normalement (connexion classique à l'arrivée).
 */
export type AppHailand = 'navigationx' | 'hailandx' | 'vendeur' | 'console' | 'flotte';
export const APP_NOMS: Record<AppHailand, string> = {
  navigationx: 'NavigationX',
  hailandx: 'HailandX',
  vendeur: 'HailandX Vendeur',
  console: 'Hailand Console',
  flotte: 'Hailand Flotte',
};

const PARAM = 'passage';
/** Marque laissée quand un passage a échoué : la page de connexion explique alors pourquoi il faut ressaisir le numéro. */
export const PASSAGE_ECHEC_KEY = 'hx.passage.echec';
/** Dernière activité sur cet appareil (préférence de l'appareil, pas une donnée du compte). */
export const ACTIVITE_KEY = 'hx.activite';
export const INACTIVITE_MAX_MS = 30 * 24 * 3600 * 1000;

/** Code de passage présent dans l'adresse, et l'adresse nettoyée (le code ne doit jamais rester dans l'historique). */
export function lirePassage(href: string): { code: string; propre: string } | null {
  const u = new URL(href);
  const code = u.searchParams.get(PARAM);
  if (!code) return null;
  u.searchParams.delete(PARAM);
  return { code, propre: u.pathname + (u.search === '?' ? '' : u.search) + u.hash };
}

/** Ajoute le code de passage à une adresse d'une autre application Hailand. */
export function avecPassage(url: string, code: string): string {
  const u = new URL(url);
  u.searchParams.set(PARAM, code);
  return u.toString();
}

/** Plus de 30 jours sans ouvrir l'application : il faut se reconnecter. */
export function inactiviteDepassee(derniere: number | null, maintenant: number, max = INACTIVITE_MAX_MS): boolean {
  return derniere !== null && Number.isFinite(derniere) && maintenant - derniere > max;
}

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const store = (): Store | null => {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
};

/**
 * Contrôle d'inactivité au démarrage : au-delà de 30 jours sans activité, la session de cet appareil est fermée (révoquée côté
 * serveur si possible). Sinon la date d'activité est rafraîchie. Renvoie true si la session a été fermée.
 */
export async function controlerInactivite(sb: SupabaseClient, s: Store | null = store(), maintenant = Date.now()): Promise<boolean> {
  if (!s) return false;
  let fermee = false;
  try {
    const derniere = Number(s.getItem(ACTIVITE_KEY) ?? NaN);
    if (inactiviteDepassee(Number.isNaN(derniere) ? null : derniere, maintenant)) {
      const { data } = await sb.auth.getSession();
      if (data.session) {
        await sb.auth.signOut({ scope: 'local' }).catch(() => undefined);
        ACCOUNT_KEYS.forEach((k) => s.removeItem(k));
        fermee = true;
      }
    }
    s.setItem(ACTIVITE_KEY, String(maintenant));
  } catch { /* stockage indisponible : pas de contrôle */ }
  return fermee;
}

/**
 * À l'arrivée : échange le code de passage de l'adresse contre une session (une seule fois par chargement de page).
 * - L'adresse est nettoyée tout de suite (le code ne reste ni dans l'historique ni dans un partage).
 * - Une session déjà ouverte ici est fermée et remplacée ; si c'était un autre compte, son panier et ses recherches sont effacés.
 * - Échec (code expiré, déjà utilisé, réseau) : la session éventuelle reste, et une marque explique l'échec à la page de connexion.
 */
export async function recevoirPassage(sb: SupabaseClient, cible: AppHailand, fonctionUrl: string, cleAnon: string): Promise<'aucun' | 'ok' | 'echec'> {
  if (typeof window === 'undefined') return 'aucun';
  const p = lirePassage(window.location.href);
  if (!p) return 'aucun';
  window.history.replaceState(window.history.state, '', p.propre);
  const s = store();
  try {
    const res = await fetch(fonctionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: cleAnon },
      body: JSON.stringify({ code: p.code, cible }),
    });
    const body = (await res.json().catch(() => ({}))) as { token_hash?: string };
    if (!res.ok || !body.token_hash) throw new Error('passage refusé');
    const avant = (await sb.auth.getSession()).data.session?.user.id ?? null;
    if (avant) await sb.auth.signOut({ scope: 'local' }).catch(() => undefined);
    const { data, error } = await sb.auth.verifyOtp({ token_hash: body.token_hash, type: 'magiclink' });
    if (error || !data.session) throw error ?? new Error('session absente');
    if (avant && avant !== data.session.user.id) ACCOUNT_KEYS.forEach((k) => s?.removeItem(k));
    s?.removeItem(PASSAGE_ECHEC_KEY);
    s?.setItem(ACTIVITE_KEY, String(Date.now()));
    return 'ok';
  } catch {
    try { sessionStorage.setItem(PASSAGE_ECHEC_KEY, '1'); } catch { /* sans effet */ }
    return 'echec';
  }
}

/** Le dernier passage reçu a-t-il échoué ? (lu une fois par la page de connexion) */
export function passageEchoue(): boolean {
  try {
    const v = sessionStorage.getItem(PASSAGE_ECHEC_KEY) === '1';
    sessionStorage.removeItem(PASSAGE_ECHEC_KEY);
    return v;
  } catch { return false; }
}

/** Adresse d'une autre application Hailand, avec un code de passage si un compte est connecté (sinon l'adresse telle quelle). */
export async function adresseAvecSession(sb: SupabaseClient | null, cible: AppHailand, url: string): Promise<string> {
  if (!sb) return url;
  const { data } = await sb.auth.getSession();
  if (!data.session || data.session.user.is_anonymous) return url;
  const { data: code, error } = await sb.rpc('fn_passage_creer', { p_cible: cible });
  return error || typeof code !== 'string' ? url : avecPassage(url, code);
}
