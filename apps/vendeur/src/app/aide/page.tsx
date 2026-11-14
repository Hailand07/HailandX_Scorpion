import { Screen, SUPPORT_WHATSAPP } from '@hailandx/kit';
import { BackAuto } from '@/components/BackAuto';

export const metadata = { title: 'Aide aux vendeurs' };

const FAQ: [string, string][] = [
  ['Comment ouvrir ma boutique ?', 'Trois étapes : repérez votre bâtiment ici même (position GPS et vue satellite), créez votre boutique, puis demandez la certification. Un agent Hailand vérifie votre emplacement ; la vente s’ouvre ensuite.'],
  ['Pourquoi je ne peux pas encore ajouter de produits ?', 'Les produits s’ajoutent dès que la vente est ouverte, c’est-à-dire quand l’adresse de votre boutique est certifiée par Hailand.'],
  ['Une commande arrive : que faire ?', 'Onglet Commandes : préparez le colis, imprimez l’étiquette si vous voulez, puis touchez « Colis prêt ». Un livreur Hailand vient le chercher et scanne le QR.'],
  ['Quand suis-je payé ?', 'Le client paie en ligne et l’argent est gardé par Hailand. Votre part (prix des articles moins la commission) devient disponible 48 heures après la remise du colis, le temps d’une éventuelle réclamation, puis Hailand vous la verse. Tout est visible dans l’onglet Boutique, « Argent ».'],
  ['Un client signale un problème ?', 'Onglet Commandes, « Problèmes » : donnez votre version. L’équipe Hailand lit les deux versions et tranche.'],
  ['Comment avoir plus de ventes ?', 'Des photos réelles, un stock à jour, une préparation rapide, et le lien de chaque produit partagé sur WhatsApp et TikTok : onglet Produits, bouton de partage à côté du produit.'],
];

/** Aide aux vendeurs : réponses courtes. */
export default function HelpPage() {
  return (
    <Screen className="gap-4">
      <BackAuto title="Aide aux vendeurs" />
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
