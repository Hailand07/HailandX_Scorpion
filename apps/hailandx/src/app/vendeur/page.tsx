'use client';
import { useMyShop } from '@/lib/useMyShop';
import { Discovery } from '@/components/seller/Discovery';
import { Onboarding } from '@/components/seller/Onboarding';
import { Dashboard } from '@/components/seller/Dashboard';
import { Screen } from '@/components/Screen';

/**
 * Onglet Vendre / Ma boutique (v2), deux temps qui ne se mélangent jamais :
 * avant l'ouverture, les trois étapes (adresse, boutique, certification) ; après, le tableau de bord.
 */
export default function SellerPage() {
  const { state, shop, decls, decl, uid, reload } = useMyShop();
  if (state === 'chargement') return <Screen><p className="pt-4 text-[14px] font-semibold text-muted">Chargement…</p></Screen>;
  if (state === 'visiteur' || !uid) return <Discovery cta="/connexion?next=/vendeur/ouvrir" />;
  if (!shop) return <Discovery cta="/vendeur/ouvrir" />;
  if (shop.status !== 'ouverte') return <Onboarding shop={shop} decls={decls} decl={decl} uid={uid} reload={reload} />;
  return <Dashboard shop={shop} />;
}
