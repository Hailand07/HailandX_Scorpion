'use client';
import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMyShop } from '@/lib/useMyShop';
import { Onboarding } from '@/components/Onboarding';
import { Screen } from '@hailandx/kit';

/**
 * Ouvrir ma boutique : les trois étapes. Une boutique déjà ouverte renvoie vers son tableau de bord.
 * `?adresse=<id>` : adresse choisie dans NavigationX (retour du parcours d'enregistrement, ou « Vendre depuis mon emplacement »
 * avec `&depuis=navigationx`). Rien n'est créé d'office : la personne choisit encore le nom de sa boutique.
 */
function Page() {
  const router = useRouter();
  const params = useSearchParams();
  const { state, shop, decls, decl, cert, uid, reload } = useMyShop();
  const recue = params.get('adresse');
  const depuis = params.get('depuis') === 'navigationx' ? 'vente' : recue ? 'retour' : null;
  useEffect(() => {
    if (state === 'visiteur') router.replace(`/connexion?next=${encodeURIComponent('/ouvrir' + (recue ? `?adresse=${recue}${depuis === 'vente' ? '&depuis=navigationx' : ''}` : ''))}`);
    if (shop?.status === 'ouverte') router.replace('/');
  }, [state, shop, router, recue, depuis]);
  if (state !== 'pret' || !uid || shop?.status === 'ouverte') return <Screen><p className="pt-4 text-[14px] font-semibold text-muted">Chargement…</p></Screen>;
  return <Onboarding back="/" shop={shop} decls={decls} decl={decl} cert={cert} uid={uid} reload={reload} recue={recue} depuis={depuis} />;
}

export default function OpenShopPage() { return <Suspense><Page /></Suspense>; }
