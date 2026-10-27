import { BackHeader, Screen, SUPPORT_WHATSAPP } from '@hailandx/kit';

export const metadata = { title: 'Aide aux vendeurs' };

const FAQ: [string, string][] = [
  ['Comment ouvrir ma boutique ?', 'Trois étapes : repérez votre bâtiment ici même (position GPS et vue satellite), créez votre boutique, puis demandez la certification. Un agent Hailand vérifie votre emplacement ; la vente s’ouvre ensuite.'],
  ['Pourquoi je ne peux pas encore ajouter de produits ?', 'Les produits s’ajoutent dès que la vente est ouverte, c’est-à-dire quand l’adresse de votre boutique est certifiée par Hailand.'],
  ['Une commande arrive : que faire ?', 'Onglet Commandes : préparez le colis, imprimez l’étiquette si vous voulez, puis touchez « Colis prêt ». Un livreur Hailand vient le chercher et scanne le QR.'],
  ['Quand suis-je payé ?', 'L’argent d’une vente vous revient quand le colis est remis au client, commission Hailand déduite. Hailand vous verse ce qui vous est dû ; tout est visible dans Menu, « Argent ».'],
  ['Un client signale un problème ?', 'Onglet Commandes, « Problèmes » : donnez votre version. L’équipe Hailand lit les deux versions et tranche.'],
  ['Comment avoir plus de ventes ?', 'Des photos réelles, un stock à jour, une préparation rapide, et des liens suivis partagés sur TikTok et WhatsApp (onglet Marketing : liens suivis, codes promo, visuels prêts à publier).'],
];

/** Aide aux vendeurs : réponses courtes. */
export default function HelpPage() {
  return (
    <Screen className="gap-4">
      <BackHeader href="/plus" title="Aide aux vendeurs" label="Retour" />
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
