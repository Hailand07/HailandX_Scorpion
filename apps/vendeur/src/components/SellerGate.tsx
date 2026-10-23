'use client';
import Link from 'next/link';
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
  if (state === 'chargement') return <Screen><BackHeader href="/" title={title} label="Retour au tableau de bord" /><Chargement /></Screen>;
  if (state === 'visiteur' || !uid) {
    return (
      <Screen><BackHeader href="/" title={title} label="Retour" />
        <Link href={`/connexion?next=/`} className="flex h-[52px] items-center justify-center rounded-2xl bg-ink text-[15px] font-extrabold text-white">Me connecter</Link>
      </Screen>
    );
  }
  if (!shop || (!allowClosed && shop.status !== 'ouverte')) {
    return (
      <Screen><BackHeader href="/" title={title} label="Retour" />
        <section className="flex flex-col gap-3 rounded-[22px] border border-dashed border-line bg-sand p-5">
          <p className="text-[14px] font-semibold text-muted">{!shop ? 'Ouvrez d’abord votre boutique.' : shop.status === 'suspendue' ? 'Votre boutique est suspendue par l’équipe Hailand.' : 'Cette page s’ouvre avec la vente, dès que l’adresse de votre boutique est certifiée.'}</p>
          <Link href="/" className="flex h-12 items-center justify-center rounded-2xl bg-ink text-[14.5px] font-extrabold text-white">{!shop ? 'Ouvrir ma boutique' : 'Voir où j’en suis'}</Link>
        </section>
      </Screen>
    );
  }
  // Pages du propriétaire (argent, réglages, boutique en ligne, équipe) : un employé est renvoyé vers l'accueil.
  if (ownerOnly && shop.role !== 'proprietaire') {
    return (
      <Screen><BackHeader href="/" title={title} label="Retour" />
        <p className="rounded-[22px] border border-dashed border-line bg-sand p-5 text-[14px] font-semibold text-muted">Cette page est réservée au propriétaire de la boutique.</p>
      </Screen>
    );
  }
  return <>{children({ shop, decls, decl, uid, reload })}</>;
}
