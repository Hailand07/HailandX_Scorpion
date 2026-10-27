'use client';
import dynamic from 'next/dynamic';
import { browserClient } from '@hailandx/kit';

/** Parcours d'adresse sur place (§49 étape 4), chargé seulement dans le navigateur (carte Mapbox). */
const Parcours = dynamic(() => import('@hailandx/scorpion/parcours').then((m) => m.AdresseSurPlace), { ssr: false });
const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

/**
 * Adresse de la boutique repérée ici même (maquette v9 « VendeurAdresse ») : même parcours que les clients de HailandX,
 * recopié de NavigationX ; écrit `declarations`. La certification (niveau 3) reste demandée ensuite à l'équipe Hailand.
 */
export function AdresseBoutique({ kicker, onDone, onClose }: { kicker: string; onDone: (declarationId: string) => void; onClose: () => void }) {
  const sb = browserClient();
  if (!sb) return null;
  return (
    <Parcours
      sb={sb}
      token={TOKEN}
      usage="boutique"
      guide={{
        kicker,
        title: 'Où est votre boutique ?',
        intro: 'Les livreurs viennent y chercher les colis. On repère le bâtiment ici même, comme pour les clients : position GPS, vue satellite, vous confirmez.',
        startLabel: 'Localiser ma boutique',
        aside: <p className="rounded-[18px] bg-blue-soft px-4 py-3 text-[13px] font-semibold leading-snug text-blue-ink"><b className="font-extrabold">Vente ouverte au niveau 3.</b> Ensuite, demandez la certification : l’équipe Hailand la traite en priorité, un agent passe confirmer. En attendant, préparez votre boutique.</p>,
      }}
      done={{ cta: 'Continuer', note: <p className="rounded-2xl bg-card px-4 py-3 text-[13px] font-semibold leading-snug text-muted">Prochaine étape : demander la certification de cette adresse. La vente s’ouvre quand elle est certifiée (niveau 3).</p> }}
      onDone={(d) => onDone(d.id)}
      onClose={onClose}
    />
  );
}
