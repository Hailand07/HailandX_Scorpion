import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { controlerInactivite, recevoirPassage, type AppHailand } from './passage';

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** La base est-elle configurée ? Sinon l'application montre les données d'exemple. */
export const hasBase = Boolean(URL_ && KEY);

/** Client « visiteur » côté serveur : lecture de la vitrine publique, aucune session conservée. */
export function serverClient(): SupabaseClient | null {
  if (!URL_ || !KEY) return null;
  return createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

let browser: SupabaseClient | null = null;

/** Client navigateur : garde la session du compte connecté (téléphone + code). */
export function browserClient(): SupabaseClient | null {
  if (!URL_ || !KEY) return null;
  browser ??= createClient(URL_, KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
  return browser;
}

/** Application en cours (fixée dans next.config.ts de chaque application : NEXT_PUBLIC_HAILAND_APP). */
export const APP_COURANTE = (process.env.NEXT_PUBLIC_HAILAND_APP ?? 'hailandx') as AppHailand;

let pret: Promise<void> | null = null;
/**
 * Session prête à être lue (une fois par chargement de page) : code de passage reçu d'une autre application Hailand échangé
 * contre une session, puis contrôle des 30 jours d'inactivité. Toute lecture de la session attend cette étape.
 */
export function sessionPrete(): Promise<void> {
  const sb = browserClient();
  if (!sb || !URL_ || !KEY || typeof window === 'undefined') return Promise.resolve();
  pret ??= (async () => {
    await recevoirPassage(sb, APP_COURANTE, `${URL_}/functions/v1/passage`, KEY);
    await controlerInactivite(sb);
  })().catch(() => undefined);
  return pret;
}
