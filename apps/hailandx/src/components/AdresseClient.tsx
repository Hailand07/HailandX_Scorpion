'use client';
import dynamic from 'next/dynamic';
import { browserClient, mediaUrl, uploadPhoto } from '@hailandx/kit';

/** Parcours d'adresse sur place (§49 étape 3), chargé seulement dans le navigateur (carte Mapbox). */
const Parcours = dynamic(() => import('@hailandx/scorpion/parcours').then((m) => m.AdresseSurPlace), { ssr: false });
const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

/** Domicile du client, enregistré sur place (écrit `declarations`, comme NavigationX). Jamais montré à distance. */
export function AdresseClient({ cta, onDone, onClose, temporary = false, draftKey = 'client' }: { cta: string; onDone: (declarationId: string) => void; onClose: () => void; /** Client hors de chez lui (§53) : adresse temporaire, pas son domicile. */ temporary?: boolean; /** Brouillon repris après un rechargement (§55). */ draftKey?: string }) {
  const sb = browserClient();
  if (!sb) return null;
  return (
    <Parcours
      sb={sb}
      token={TOKEN}
      uploadPhoto={async (file) => { const uid = (await sb.auth.getSession()).data.session?.user.id; if (!uid) throw new Error('connexion requise'); return uploadPhoto(sb, uid, file); }}
      usage="client"
      // Le domicile s'enregistre sur place (§53) : pas de « Je ne suis pas sur place » ici.
      allowRemote={false}
      temporary={temporary}
      draftKey={draftKey}
      photoUrl={mediaUrl}
      guide={temporary
        ? { kicker: 'COMMANDE · LIVRAISON ICI', title: 'Repérons le bâtiment où vous êtes', intro: 'Le livreur viendra ici, là où vous êtes maintenant. Cette adresse est temporaire : elle ne remplace pas votre domicile. Trois conseils pour un résultat solide.' }
        : { kicker: 'COMMANDE · ADRESSE', title: 'Enregistrons votre domicile', intro: 'Nous retrouvons votre bâtiment à partir de votre position, une seule fois pour toutes vos commandes. Trois conseils pour un résultat solide.' }}
      done={{ cta, note: <p className="rounded-2xl bg-card px-4 py-3 text-[13px] font-semibold leading-snug text-muted">Elle est gardée dans votre Compte Hailand : la prochaine commande la propose directement. Le livreur est guidé jusqu’à ce bâtiment.</p> }}
      onDone={(d) => onDone(d.id)}
      onClose={onClose}
    />
  );
}
