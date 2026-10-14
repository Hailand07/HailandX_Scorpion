import { SUPPORT_WHATSAPP } from '@/lib/links';
import { BackHeader, Screen } from '@hailandx/kit';

export const metadata = { title: 'Aide' };

const FAQ: [string, string][] = [
  ['Comment suivre ma commande ?', 'Onglet « Commandes » : la commande en cours est en haut, avec son étape. Touchez « Suivre » pour la carte et les détails.'],
  ['À quoi sert le code à 4 chiffres ?', 'Vous le donnez au livreur seulement quand vous avez le colis en main. C’est ce qui confirme la remise.'],
  ['Comment se passe le paiement ?', 'Orange Money : l’argent est bloqué par Hailand et versé au vendeur à la remise. Espèces : vous payez le livreur à la remise.'],
  ['Un problème avec un colis ?', 'Ouvrez la commande, puis « Signaler un problème ». L’équipe Hailand lit les deux versions et tranche.'],
  ['Comment vendre sur HailandX ?', 'Avec l’application HailandX Vendeur (Compte, « Vendre sur HailandX ») : votre adresse, votre boutique, puis la certification par un agent Hailand. Vos produits s’ajoutent ensuite dans votre tableau de bord.'],
  ['Comment supprimer mon compte ?', 'Compte, puis « Supprimer mon compte » en bas de l’écran. Votre numéro est alors libéré.'],
];

/** Aide et contact : les réponses courtes aux questions fréquentes. */
export default function HelpPage() {
  return (
    <Screen className="gap-4">
      <BackHeader href="/compte" title="Aide et contact" label="Retour au compte" />
      <div className="flex flex-col gap-2">
        {FAQ.map(([q, a]) => (
          <details key={q} className="rounded-[18px] border border-line-soft bg-card">
            <summary className="flex min-h-[54px] cursor-pointer list-none items-center px-4 text-[14.5px] font-extrabold">{q}</summary>
            <p className="px-4 pb-4 text-[13.5px] font-semibold leading-relaxed text-muted">{a}</p>
          </details>
        ))}
      </div>
      {SUPPORT_WHATSAPP && <a href={`https://wa.me/${SUPPORT_WHATSAPP}`} target="_blank" rel="noreferrer" className="flex h-[52px] items-center justify-center rounded-2xl bg-ink text-[15px] font-extrabold text-white">Écrire à Hailand sur WhatsApp</a>}
    </Screen>
  );
}
