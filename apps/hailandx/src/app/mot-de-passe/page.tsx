import { MotDePasseOublie } from '@hailandx/kit';

/** Mot de passe oublié (§59) : code reçu sur l'e-mail du compte, puis nouveau mot de passe. Page ouverte sans session. */
export default async function MotDePassePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const n = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
  return <MotDePasseOublie backHref={`/connexion?next=${encodeURIComponent(n)}`} doneHref={n} />;
}
