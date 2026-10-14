'use client';
import { useMyShop } from '@/lib/useMyShop';
import { Discovery } from '@/components/Discovery';
import { Onboarding } from '@/components/Onboarding';
import { Dashboard } from '@/components/Dashboard';
import { Screen } from '@hailandx/kit';

/**
 * Accueil de HailandX Vendeur, deux temps qui ne se mélangent jamais :
 * avant l'ouverture, les trois étapes (adresse, boutique, certification) ; après, le tableau de bord.
 */
export default function SellerPage() {
  const { state, shop, decls, decl, cert, uid, reload } = useMyShop();
  if (state === 'chargement') return <Screen><p className="pt-4 text-[14px] font-semibold text-muted">Chargement…</p></Screen>;
  if (state === 'visiteur' || !uid) return <Discovery cta="/connexion?next=/ouvrir" logged={false} />;
  if (!shop) return <Discovery cta="/ouvrir" logged />;
  if (shop.status !== 'ouverte') return <Onboarding shop={shop} decls={decls} decl={decl} cert={cert} uid={uid} reload={reload} />;
  return <Dashboard shop={shop} />;
}
