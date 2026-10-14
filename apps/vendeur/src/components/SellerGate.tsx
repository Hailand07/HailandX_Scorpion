'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useMyShop, type MyDecl, type MyShop } from '@/lib/useMyShop';
import { BackHeader, Screen } from '@hailandx/kit';

export interface SellerCtx { shop: MyShop; decls: MyDecl[]; decl: MyDecl | null; uid: string; reload: () => Promise<void> }

/**
 * Accès aux pages de « Ma boutique » : connecté, une boutique, et la vente ouverte (sauf `allowClosed`, pour les réglages).
 * Sinon, un message clair renvoie vers l'onglet Vendre.
 */
export function SellerGate({ title, allowClosed = false, children }: { title: string; allowClosed?: boolean; children: (ctx: SellerCtx) => ReactNode }) {
  const { state, shop, decls, decl, uid, reload } = useMyShop();
  if (state === 'chargement') return <Screen><BackHeader href="/" title={title} label="Retour au tableau de bord" /><p className="text-[14px] font-semibold text-muted">Chargement…</p></Screen>;
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
  return <>{children({ shop, decls, decl, uid, reload })}</>;
}
