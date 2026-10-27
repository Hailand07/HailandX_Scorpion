'use client';
import dynamic from 'next/dynamic';
import { browserClient } from '@hailandx/kit';

/** Parcours d'adresse sur place (§49 étape 3), chargé seulement dans le navigateur (carte Mapbox). */
const Parcours = dynamic(() => import('@hailandx/scorpion/parcours').then((m) => m.AdresseSurPlace), { ssr: false });
const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

/** Adresse de livraison du client, enregistrée sur place (écrit `declarations`, comme NavigationX). */
export function AdresseClient({ cta, onDone, onClose }: { cta: string; onDone: (declarationId: string) => void; onClose: () => void }) {
  const sb = browserClient();
  if (!sb) return null;
  return (
    <Parcours
      sb={sb}
      token={TOKEN}
      usage="client"
      guide={{ kicker: 'COMMANDE · ADRESSE', title: 'Où livrer ? Repérons votre bâtiment', intro: 'Nous allons retrouver votre bâtiment à partir de votre position. Pour un résultat solide, suivez ces trois conseils.' }}
      done={{ cta, note: <p className="rounded-2xl bg-card px-4 py-3 text-[13px] font-semibold leading-snug text-muted">Elle est gardée dans votre Compte Hailand : la prochaine commande la propose directement. Le livreur est guidé jusqu’à ce bâtiment.</p> }}
      onDone={(d) => onDone(d.id)}
      onClose={onClose}
    />
  );
}
