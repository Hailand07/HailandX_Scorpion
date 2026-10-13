import { createClient, type SupabaseClient } from '@supabase/supabase-js';

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
