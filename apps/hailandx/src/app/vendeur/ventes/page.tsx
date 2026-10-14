import { redirect } from 'next/navigation';

/** Ancienne adresse des ventes : elles sont dans « Statistiques » (v2). */
export default function SalesPage() {
  redirect('/vendeur/statistiques');
}
