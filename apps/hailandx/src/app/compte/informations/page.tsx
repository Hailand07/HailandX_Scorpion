'use client';
import { BackHeader, MesInformations, Screen } from '@hailandx/kit';

/** Mes informations (§63) : identité du compte et adresses de livraison, en clair (quartier, commune, code Hailand). */
export default function InformationsPage() {
  return (
    <Screen className="gap-4 pt-4">
      <BackHeader href="/compte" title="Mes informations" label="Retour à mon compte" />
      <MesInformations securiteHref="/compte/securite" ajouterHref="/adresse" />
    </Screen>
  );
}
