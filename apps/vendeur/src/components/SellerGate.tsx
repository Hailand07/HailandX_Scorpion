'use client';
import { BtnLink, EmptyState } from '@/components/ui';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useMyShop, type MyDecl, type MyShop } from '@/lib/useMyShop';
import { BackHeader, Screen } from '@hailandx/kit';
import { Chargement } from '@hailandx/ui';

export interface SellerCtx { shop: MyShop; decls: MyDecl[]; decl: MyDecl | null; uid: string; reload: () => Promise<void> }

/**
 * Accès aux pages de « Ma boutique » : connecté, une boutique, et la vente ouverte (sauf `allowClosed`, pour les réglages) ;
 * `ownerOnly` réserve la page au propriétaire (un employé ne voit ni l'argent, ni les réglages, ni l'équipe).
 * Sinon, un message clair renvoie vers l'onglet Vendre.
 */
export function SellerGate({ title, allowClosed = false, ownerOnly = false, children }: { title: string; allowClosed?: boolean; ownerOnly?: boolean; children: (ctx: SellerCtx) => ReactNode }) {
  const { state, shop, decls, decl, uid, reload } = useMyShop();
  const path = usePathname() ?? '/';
  if (state === 'chargement') return <Screen><BackHeader href="/" title={title} label="Retour au tableau de bord" /><Chargement /></Screen>;
  if (state === 'visiteur' || !uid) {
    return (
      <Screen><BackHeader href="/" title={title} label="Retour" />
        <EmptyState icon="user" title="Connectez-vous" text="Cette page fait partie de votre espace vendeur." action={<BtnLink href={`/connexion?next=${encodeURIComponent(path)}`}>Me connecter</BtnLink>} />
      </Screen>
    );
  }
  if (!shop || (!allowClosed && shop.status !== 'ouverte')) {
    return (
      <Screen><BackHeader href="/" title={title} label="Retour" />
        <EmptyState icon="shop" title={!shop ? 'Ouvrez d’abord votre boutique' : shop.status === 'suspendue' ? 'Boutique suspendue' : 'Bientôt disponible'}
          text={!shop ? 'Trois étapes : votre adresse, votre boutique, la certification.' : shop.status === 'suspendue' ? 'Votre boutique est suspendue par l’équipe Hailand.' : 'Cette page s’ouvre avec la vente, dès que l’adresse de votre boutique est certifiée.'}
          action={<BtnLink href={!shop ? '/ouvrir' : '/'}>{!shop ? 'Ouvrir ma boutique' : 'Voir où j’en suis'}</BtnLink>} />
      </Screen>
    );
  }
  // Pages du propriétaire (argent, réglages, boutique en ligne, équipe) : un employé est renvoyé vers l'accueil.
  if (ownerOnly && shop.role !== 'proprietaire') {
    return (
      <Screen><BackHeader href="/" title={title} label="Retour" />
        <EmptyState icon="user" title="Réservé au propriétaire" text="Cette page est réservée au propriétaire de la boutique." />
      </Screen>
    );
  }
  return <>{children({ shop, decls, decl, uid, reload })}</>;
}
