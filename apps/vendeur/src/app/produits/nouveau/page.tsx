'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { SellerGate } from '@/components/SellerGate';
import { ProductEditor } from '@/components/ProductEditor';

/** Nouveau produit (plein écran) ; `?depuis=<offre>` duplique un produit existant de la boutique. */
function NewProduct() {
  const from = useSearchParams().get('depuis') ?? undefined;
  return <SellerGate title="Nouveau produit">{({ shop, uid }) => <ProductEditor key={from ?? 'neuf'} shop={shop} uid={uid} copyFrom={from} />}</SellerGate>;
}

export default function NewProductPage() { return <Suspense><NewProduct /></Suspense>; }
