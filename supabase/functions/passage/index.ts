// Fonction serveur « passage » (Supabase Edge Function, Deno) — Compte Hailand unique, phase 3 (HAILANDX.md §31).
//
// L'application d'arrivée envoie { code, cible } reçus dans son adresse (?passage=…). La fonction :
//   1. consomme le code (fn_passage_consommer : usage unique, 2 minutes, lié à l'application d'arrivée) ;
//   2. prépare une connexion NEUVE pour ce compte (lien de connexion administrateur, jamais envoyé par e-mail) ;
//   3. renvoie seulement l'empreinte du jeton, que l'application échange elle-même contre sa propre session
//      (supabase.auth.verifyOtp({ token_hash, type: 'magiclink' })).
// Chaque application garde ainsi sa session indépendante : la déconnexion de l'une n'est pas cassée par l'autre, et aucun jeton
// de session ne circule dans une adresse.
//
// Les comptes Hailand n'ont qu'un numéro de téléphone ; le lien de connexion exige une adresse e-mail. Une adresse technique
// non distribuable (domaine réservé « .invalid », RFC 2606) est donc posée une fois sur le compte : elle ne reçoit jamais rien
// et ne s'affiche nulle part.
//
// Déploiement : verify_jwt = false (l'appel est protégé par le code à usage unique ; les applications peuvent utiliser une clé
// publique non JWT). Variables fournies par Supabase : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
import { createClient } from 'npm:@supabase/supabase-js@2.49.4';

const CIBLES = new Set(['navigationx', 'hailandx', 'vendeur', 'console', 'flotte']);
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json(405, { erreur: 'methode' });

  let code = '';
  let cible = '';
  try {
    const b = await req.json();
    code = typeof b?.code === 'string' ? b.code : '';
    cible = typeof b?.cible === 'string' ? b.cible : '';
  } catch {
    return json(400, { erreur: 'requete' });
  }
  if (!/^[A-Za-z0-9_-]{32}$/.test(code) || !CIBLES.has(cible)) return json(400, { erreur: 'requete' });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: uid, error: e1 } = await admin.rpc('fn_passage_consommer', { p_code: code, p_cible: cible });
  if (e1) return json(500, { erreur: 'base' });
  if (!uid) return json(410, { erreur: 'expire' });

  const { data: u, error: e2 } = await admin.auth.admin.getUserById(uid as string);
  if (e2 || !u?.user) return json(410, { erreur: 'compte' });

  let email = u.user.email;
  if (!email) {
    email = `${uid}@compte.hailand.invalid`;
    const { error: e3 } = await admin.auth.admin.updateUserById(uid as string, { email, email_confirm: true });
    if (e3) return json(500, { erreur: 'preparation' });
  }

  const { data: link, error: e4 } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  const token_hash = link?.properties?.hashed_token;
  if (e4 || !token_hash) return json(500, { erreur: 'lien' });

  return json(200, { token_hash });
});
