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
