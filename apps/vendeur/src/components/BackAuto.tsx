'use client';
import { BackHeader, useSession } from '@hailandx/kit';

/** En-tête avec retour vers l'onglet Boutique ; pour un visiteur (pas connecté), le retour mène à l'accueil, pas à la connexion. */
export function BackAuto({ title }: { title: string }) {
  const session = useSession();
  return <BackHeader href={session ? '/plus' : '/'} title={title} label="Retour" />;
}
