'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMyShop } from '@/lib/useMyShop';
import { Onboarding } from '@/components/seller/Onboarding';
import { Screen } from '@/components/Screen';

/** Ouvrir ma boutique : les trois étapes. Une boutique déjà ouverte renvoie vers son tableau de bord. */
export default function OpenShopPage() {
  const router = useRouter();
  const { state, shop, decls, decl, uid, reload } = useMyShop();
  useEffect(() => {
    if (state === 'visiteur') router.replace('/connexion?next=/vendeur/ouvrir');
    if (shop?.status === 'ouverte') router.replace('/vendeur');
  }, [state, shop, router]);
  if (state !== 'pret' || !uid || shop?.status === 'ouverte') return <Screen><p className="pt-4 text-[14px] font-semibold text-muted">Chargement…</p></Screen>;
  return <Onboarding back="/vendeur" shop={shop} decls={decls} decl={decl} uid={uid} reload={reload} />;
}
