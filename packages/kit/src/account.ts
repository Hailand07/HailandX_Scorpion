import type { SupabaseClient } from '@supabase/supabase-js';

/** Données de l'appareil qui appartiennent à la personne connectée (effacées à la déconnexion). */
export const ACCOUNT_KEYS = ['hx.cart', 'hx.recherches'];

/** Efface de l'appareil tout ce qui appartient au compte : panier, recherches récentes, session Supabase mémorisée. */
export function clearAccountDevice(storage: Pick<Storage, 'length' | 'key' | 'removeItem'> | null = typeof localStorage === 'undefined' ? null : localStorage): void {
  if (!storage) return;
  try {
    const doomed: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i) ?? '';
      if (ACCOUNT_KEYS.includes(k) || /^sb-.+-auth-token(-code-verifier)?$/.test(k)) doomed.push(k);
    }
    doomed.forEach((k) => storage.removeItem(k));
  } catch { /* stockage indisponible : rien à effacer */ }
}

/**
 * Déconnexion réelle, identique dans toutes les applications Hailand : la session est révoquée côté serveur (toutes les sessions
 * du compte, donc aussi celles des autres applications), puis l'appareil est vidé. Hors ligne, la session est au moins effacée ici.
 */
export async function signOutHailand(sb: SupabaseClient | null): Promise<void> {
  if (sb) {
    try {
      const { error } = await sb.auth.signOut({ scope: 'global' });
      if (error) await sb.auth.signOut({ scope: 'local' });
    } catch {
      await sb.auth.signOut({ scope: 'local' }).catch(() => undefined);
    }
  }
  clearAccountDevice();
}
