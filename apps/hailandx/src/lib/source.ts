/** Provenance d'une visite (TikTok, WhatsApp, Facebook…) : conservée dans le navigateur jusqu'à la commande. */
import { SOURCES, type Source } from '@hailandx/kit';
export { SOURCES, type Source };
const KEY = 'hx.src';

export const isSource = (s: unknown): s is Source => typeof s === 'string' && (SOURCES as readonly string[]).includes(s);

export function rememberSource(s: string | null) {
  if (!isSource(s)) return;
  try { localStorage.setItem(KEY, s); } catch { /* stockage refusé */ }
}
export function currentSource(): Source | 'application' {
  try { const s = localStorage.getItem(KEY); return isSource(s) ? s : 'application'; } catch { return 'application'; }
}
