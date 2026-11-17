/**
 * Compte Hailand par numéro + mot de passe (§59) : solution d'attente tant que la vérification par WhatsApp n'est pas ouverte.
 * Règles du mot de passe, appliquées ici ET à régler dans Supabase (longueur minimale, lettres + chiffres) :
 * au moins 8 caractères, des lettres et des chiffres, ni le numéro de téléphone, ni un mot de passe courant.
 */
export const MDP_MIN = 8;

const COURANTS = new Set([
  'password', 'password1', 'motdepasse', 'azerty123', 'qwerty123', 'abcd1234', 'abc12345', 'hailand1', 'hailand123', 'guinee224',
  'conakry1', 'conakry224', '12345678a', 'a12345678', 'iloveyou1', 'bonjour1', 'bonjour123', 'admin123', 'passw0rd',
]);

/** Ce qui ne va pas dans le mot de passe, en une phrase ; `null` s'il est accepté. */
export function problemeMotDePasse(mdp: string, tel?: string | null): string | null {
  if (mdp.length < MDP_MIN) return `Au moins ${MDP_MIN} caractères.`;
  if (!/\p{L}/u.test(mdp) || !/\d/.test(mdp)) return 'Mélangez des lettres et des chiffres.';
  const chiffres = (tel ?? '').replace(/\D/g, '');
  if (chiffres.length >= 9 && mdp.replace(/\D/g, '').includes(chiffres.slice(-9))) return 'N’utilisez pas votre numéro de téléphone.';
  if (COURANTS.has(mdp.toLowerCase()) || /^(.)\1+$/.test(mdp) || /^(0123456789|123456789|abcdefgh)/i.test(mdp)) return 'Trop facile à deviner : choisissez autre chose.';
  return null;
}

/** Robustesse pour la jauge : 0 (refusé) à 3 (solide). */
export function forceMotDePasse(mdp: string, tel?: string | null): 0 | 1 | 2 | 3 {
  if (problemeMotDePasse(mdp, tel)) return 0;
  let n = 1;
  if (mdp.length >= 12) n++;
  if (/[^\p{L}\d]/u.test(mdp) || (/\p{Lu}/u.test(mdp) && /\p{Ll}/u.test(mdp))) n++;
  return Math.min(n, 3) as 1 | 2 | 3;
}

export const emailValide = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());

/** Messages d'erreur de Supabase Auth traduits pour la personne (jamais le message technique brut). */
export function erreurCompte(message: string | undefined): string {
  const m = (message ?? '').toLowerCase();
  if (/invalid login credentials/.test(m)) return 'Numéro ou mot de passe incorrect.';
  if (/already (registered|exists)|user_already_exists|phone_exists/.test(m)) return 'Ce numéro a déjà un compte Hailand : connectez-vous avec votre mot de passe.';
  if (/rate|too many|security purposes/.test(m)) return 'Trop de tentatives. Patientez une minute avant de réessayer.';
  if (/weak|password should|password is known/.test(m)) return 'Mot de passe trop faible : au moins 8 caractères, avec des lettres et des chiffres.';
  if (/signups? not allowed|phone.*(disabled|not enabled)|provider.*disabled|unsupported phone provider/.test(m)) return 'La connexion par numéro n’est pas encore ouverte. Réessayez plus tard.';
  if (/(token|otp).*(expired|invalid)|expired|invalid/.test(m)) return 'Code incorrect ou expiré. Vérifiez-le ou demandez-en un nouveau.';
  if (/email.*(invalid|address)/.test(m)) return 'Adresse e-mail invalide.';
  return 'Une erreur est survenue. Réessayez dans un instant.';
}
