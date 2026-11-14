import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Adresses de livraison du compte connecté (§53) : les adresses durables (domicile, travail) et les adresses temporaires encore
 * valables (client hors de chez lui). Une adresse temporaire expirée n'est plus proposée.
 * Tant que la colonne `temporary_until` n'existe pas en base (migration 2026-11-11), on lit sans elle : tout est durable.
 */
export interface Addr { id: string; declared_label: string | null; hailand_code: string | null; detected_level: number; location_floor: string | null; location_door: string | null; declared_landmark: string | null; temporary_until: string | null }
const COLS = 'id,declared_label,hailand_code,detected_level,location_floor,location_door,declared_landmark';

export const isLive = (a: Pick<Addr, 'temporary_until'>, now = Date.now()) => !a.temporary_until || Date.parse(a.temporary_until) > now;

export async function myAddresses(sb: SupabaseClient, uid: string): Promise<Addr[]> {
  const q = (cols: string) => sb.from('declarations').select(cols).eq('user_id', uid).eq('status', 'active').order('created_at', { ascending: false });
  let r = await q(`${COLS},temporary_until`);
  if (r.error && /temporary_until/.test(r.error.message)) r = await q(COLS);
  return ((r.data as unknown as Addr[] | null) ?? []).map((a) => ({ ...a, temporary_until: a.temporary_until ?? null })).filter((a) => isLive(a));
}

/** Nom affiché : « Adresse temporaire · jusqu'au 14 déc. » pour une adresse temporaire, sinon son nom (Domicile, Travail…). */
export function addrName(a: Pick<Addr, 'declared_label' | 'hailand_code' | 'temporary_until'>, alias?: string): string {
  if (a.temporary_until) return `Adresse temporaire · jusqu’au ${new Date(a.temporary_until).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
  return alias || a.declared_label || a.hailand_code || 'Mon adresse';
}
