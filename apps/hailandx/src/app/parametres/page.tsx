import { redirect } from 'next/navigation';

/** Ancienne adresse des paramètres : tout est maintenant dans « Compte » (v2). */
export default function SettingsPage() {
  redirect('/compte/supprimer');
}
