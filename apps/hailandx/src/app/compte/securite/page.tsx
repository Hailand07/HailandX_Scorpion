'use client';
import { BackHeader, Screen, SecuriteCompte } from '@hailandx/kit';

/** Mot de passe et e-mail de récupération du compte Hailand (§59). */
export default function SecuritePage() {
  return (
    <Screen className="gap-4 pt-4">
      <BackHeader href="/compte" title="Mot de passe et e-mail" label="Retour à mon compte" />
      <SecuriteCompte />
    </Screen>
  );
}
