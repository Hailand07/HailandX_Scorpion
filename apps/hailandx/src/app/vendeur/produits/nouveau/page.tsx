'use client';
import { SellerGate } from '@/components/seller/SellerGate';
import { ProductEditor } from '@/components/seller/ProductEditor';

/** Nouveau produit (plein écran). */
export default function NewProductPage() {
  return <SellerGate title="Nouveau produit">{({ shop, uid }) => <ProductEditor shop={shop} uid={uid} />}</SellerGate>;
}
