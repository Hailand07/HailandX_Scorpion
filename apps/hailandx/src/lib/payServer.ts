import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Côté serveur seulement (routes /api/paiement/*) : clients Supabase « au nom de l'acheteur » (son jeton) et « serveur
 * de paiement » (clé de service). Secrets lus dans les variables de Vercel, jamais dans le dépôt.
 */
export interface PayEnv { url: string; anon: string; service: string; ccpKey?: string; ccpEnc?: string; djomyId?: string; djomySecret?: string }
/** Base et clé de service obligatoires ; les clés de chaque fournisseur (Chap Chap Pay, Djomy) sont vérifiées par sa route. */
export function payEnv(): PayEnv | null {
  const e = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL, anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, service: process.env.SUPABASE_SERVICE_ROLE_KEY,
    ccpKey: process.env.CCP_API_KEY, ccpEnc: process.env.CCP_ENCRYPTION_KEY, djomyId: process.env.DJOMY_CLIENT_ID, djomySecret: process.env.DJOMY_CLIENT_SECRET,
  };
  return e.url && e.anon && e.service ? (e as PayEnv) : null;
}
export const hasCcp = (e: PayEnv): e is PayEnv & { ccpKey: string; ccpEnc: string } => Boolean(e.ccpKey && e.ccpEnc);
export const hasDjomy = (e: PayEnv): e is PayEnv & { djomyId: string; djomySecret: string } => Boolean(e.djomyId && e.djomySecret);
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
export const serviceClient = (e: PayEnv): SupabaseClient => createClient(e.url, e.service, opts);
/** Client au nom de l'acheteur : la base vérifie elle-même ses droits (RLS, fonctions). */
export function buyerClient(e: PayEnv, req: Request): SupabaseClient | null {
  const token = /^Bearer\s+(.+)$/i.exec(req.headers.get('authorization') ?? '')?.[1];
  return token ? createClient(e.url, e.anon, { ...opts, global: { headers: { Authorization: `Bearer ${token}` } } }) : null;
}
export const clean = (m: string) => m.replace(/^.*?:\s*/, '').slice(0, 200);
