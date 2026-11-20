'use client';
import { BackHeader, MesInformations, Screen } from '@hailandx/kit';
import { Chargement } from '@hailandx/ui';
import { useMyShop } from '@/lib/useMyShop';

/** Mes informations (§63) : identité du compte et toutes ses adresses, en clair (quartier, commune, code Hailand), boutique marquée. */
export default function InformationsPage() {
  const { state, shop } = useMyShop();
  return (
    <Screen className="gap-4 pt-4">
      <BackHeader href="/plus" title="Mes informations" label="Retour" />
      {state === 'chargement' ? <Chargement /> : <MesInformations securiteHref="/securite" boutique={shop ? { nom: shop.name, declarationId: shop.declaration_id } : null} />}
    </Screen>
  );
}
