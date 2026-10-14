import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
let client: SupabaseClient | null = null;

/** Client navigateur : garde la session du livreur (téléphone + code). */
export function browserClient(): SupabaseClient | null {
  if (!URL_ || !KEY) return null;
  client ??= createClient(URL_, KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
  return client;
}

/** Déconnexion réelle (comme dans les autres applications Hailand) : révocation côté serveur, puis appareil vidé. */
export async function signOutFlotte(): Promise<void> {
  const sb = browserClient();
  if (sb) {
    const { error } = await sb.auth.signOut({ scope: 'global' }).catch((e: Error) => ({ error: e }));
    if (error) await sb.auth.signOut({ scope: 'local' }).catch(() => undefined);
  }
  try {
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i) ?? ''; if (/^sb-.+-auth-token(-code-verifier)?$/.test(k)) doomed.push(k); }
    doomed.forEach((k) => localStorage.removeItem(k));
  } catch { /* stockage indisponible */ }
  window.location.replace('/connexion');
}
