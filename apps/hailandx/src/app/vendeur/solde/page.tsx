import { redirect } from 'next/navigation';

/** Ancienne adresse du solde : la page s'appelle maintenant « Argent » (v2). */
export default function BalancePage() {
  redirect('/vendeur/argent');
}
