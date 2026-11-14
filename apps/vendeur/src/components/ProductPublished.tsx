'use client';
import { useState } from 'react';
import { HAILANDX_URL, Icon, Screen } from '@hailandx/kit';
import type { MyShop } from '@/lib/useMyShop';
import { ShareSheet } from './ShareSheet';
import { Btn, BtnLink } from './ui';

/** Écran « Produit en vente » : le produit vient d'être publié, le geste suivant est de partager son lien. */
export function ProductPublished({ shop, published, priceGnf, onAnother }: { shop: MyShop; published: { slug: string; name: string; offerId?: string }; priceGnf: number; onAnother: () => void }) {
  const [sharing, setSharing] = useState(false);
  const url = `${HAILANDX_URL}/p/${published.slug}?b=${shop.slug}`;
  return (
    <Screen className="items-center justify-center gap-3.5 px-7 pb-20 text-center">
      <span role="status" className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-lime"><Icon name="check" size={30} stroke={2.4} /></span>
      <h1 className="font-display text-[20px] font-semibold">Produit en vente</h1>
      <p className="text-[15px] font-semibold leading-relaxed text-muted">Il apparaît dans votre boutique. Partagez son lien pour vos premières ventes.</p>
      <Btn onClick={() => setSharing(true)}><Icon name="share" size={18} stroke={2} />Partager le lien du produit</Btn>
      <p className="w-full truncate rounded-xl bg-sand px-3 py-2 text-[12px] font-semibold text-muted">{url.replace(/^https?:\/\//, '')}</p>
      {sharing && published.offerId && <ShareSheet target={{ shopId: shop.id, shopSlug: shop.slug, shopName: shop.name, offerId: published.offerId, productSlug: published.slug, name: published.name, priceGnf }} onClose={() => setSharing(false)} />}
      <Btn variant="secondary" size="md" onClick={onAnother}>Ajouter un autre produit</Btn>
      <BtnLink href="/produits" variant="quiet" size="md">Retour aux produits</BtnLink>
    </Screen>
  );
}
