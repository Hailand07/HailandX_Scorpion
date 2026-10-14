'use client';
import { SellerGate } from '@/components/SellerGate';
import { ProductEditor } from '@/components/ProductEditor';

/** Nouveau produit (plein écran). */
export default function NewProductPage() {
  return <SellerGate title="Nouveau produit">{({ shop, uid }) => <ProductEditor shop={shop} uid={uid} />}</SellerGate>;
}
