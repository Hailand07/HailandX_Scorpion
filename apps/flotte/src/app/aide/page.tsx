import Link from 'next/link';
import { MAX_HANDOVER_ATTEMPTS } from '@hailandx/commerce';
import { Ico } from '@/components/Icons';

export const metadata = { title: 'Aide' };

const QUESTIONS: [string, string][] = [
  ['Le client ne répond pas ou n’est pas là', 'Appelez-le depuis la mission (bouton « Appeler le client »). Sans réponse, attendez quelques minutes sur place puis prévenez l’équipe Hailand : ne laissez jamais le colis sans le code ou le scan du client.'],
  ['Le client n’a pas le code', `Le code à 4 chiffres est dans son suivi de commande HailandX. Il peut aussi scanner lui-même le QR de l’étiquette. Après ${MAX_HANDOVER_ATTEMPTS} codes faux, le colis est verrouillé : contactez l’équipe.`],
  ['Le vendeur n’a pas le colis prêt ou pas de QR', 'Ne partez pas sans scanner : le scan prouve le retrait. Appelez la boutique ; si le colis n’est pas prêt, vous pouvez rendre la mission (« Je ne peux plus faire cette mission ») avant le retrait.'],
  ['L’adresse est imprécise (niveau 1)', 'La carte vous amène dans la zone : appelez le client pour le dernier mètre. Les adresses certifiées (niveau 3) ont le bâtiment surligné en vert.'],
  ['Espèces encaissées', 'Les espèces des livraisons payées à la remise s’ajoutent à votre solde « à reverser ». Au-delà du plafond, vous ne recevez plus de mission payable à la livraison tant que vous n’avez pas reversé à Hailand.'],
  ['La carte ou le GPS ne marche pas', 'Autorisez la localisation pour Hailand Flotte dans les réglages du téléphone, et gardez l’application ouverte pendant la course. Sans carte, les adresses et les boutons d’appel restent affichés.'],
];

/** Menu → « Aide » : réponses courtes aux situations fréquentes du livreur. */
export default function Aide() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-5 pb-16 pt-[max(18px,env(safe-area-inset-top))]">
      <header className="flex items-center gap-3">
        <Link href="/" aria-label="Retour" className="flex h-12 w-12 items-center justify-center rounded-2xl border border-night-line bg-night-card">{Ico.back()}</Link>
        <h1 className="font-display text-[22px] font-semibold">Aide</h1>
      </header>
      {QUESTIONS.map(([q, r]) => (
        <details key={q} className="group rounded-[18px] border border-night-line bg-night-card px-4 py-3.5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-extrabold">{q}<span className="shrink-0 text-night-muted transition-transform group-open:rotate-90">{Ico.chevron(18)}</span></summary>
          <p className="pt-2.5 text-[13.5px] font-medium leading-relaxed text-night-muted">{r}</p>
        </details>
      ))}
      <p className="text-[12.5px] font-semibold text-night-muted">Pour tout autre problème, contactez votre responsable de l’équipe Hailand.</p>
    </main>
  );
}
