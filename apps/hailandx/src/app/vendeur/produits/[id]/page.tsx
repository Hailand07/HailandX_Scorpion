'use client';
import { use } from 'react';
import { SellerGate } from '@/components/seller/SellerGate';
import { ProductEditor } from '@/components/seller/ProductEditor';

/** Modifier un produit (plein écran). */
export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <SellerGate title="Modifier le produit">{({ shop, uid }) => <ProductEditor shop={shop} uid={uid} offerId={id} />}</SellerGate>;
}
