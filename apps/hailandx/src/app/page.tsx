import Link from 'next/link';
import { LienHailand, VENDEUR_URL } from '@hailandx/kit';

/**
 * Accueil de la phase de lancement « à la Shopify » (décision du 2026-10-26, HAILANDX.md §49, maquette v9 A1).
 * Pas de vitrine ni de catalogue : le client arrive par le lien d'un produit partagé par un vendeur.
 * Cette page s'adresse aux commerçants et renvoie vers HailandX Vendeur.
 */
export default async function Home({ searchParams }: { searchParams: Promise<{ compte?: string }> }) {
  const { compte } = await searchParams;
  const steps = [
    ['Ouvrez votre boutique', 'Adresse repérée sur place, certifiée par Hailand'],
    ['Ajoutez vos produits', 'Photos, prix, tailles et couleurs, sans limite. L’assistant peut écrire la fiche pour vous.'],
    ['Partagez un lien, on s’occupe du reste', 'Paiement, livraison, versement chaque semaine'],
  ];
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-5 pb-6 pt-5">
      {compte === 'supprime' && <p role="status" className="rounded-2xl bg-ok-soft px-4 py-3 text-[13.5px] font-bold text-ok">Votre compte a été supprimé. Vous pouvez recommencer avec le même numéro quand vous voulez.</p>}
      <header className="flex items-center justify-between">
        <span className="font-display text-[22px] font-bold tracking-tight">Hailand<span className="text-blue">X</span></span>
        <Link href="/commandes" className="flex h-10 items-center rounded-full border border-line bg-card px-4 text-[13px] font-extrabold">Mes commandes</Link>
      </header>
      <section className="flex flex-col gap-3">
        <span className="w-fit rounded-full bg-lime px-3 py-1 text-[12px] font-extrabold">Pour les commerçants de Conakry</span>
        <h1 className="font-display text-[32px] font-semibold leading-[1.08] tracking-tight [text-wrap:balance]">Vendez en ligne.<br />On livre pour vous.</h1>
        <p className="text-[15px] font-semibold leading-relaxed text-muted">Créez votre boutique, ajoutez vos produits et partagez leurs liens sur WhatsApp, TikTok et Facebook. Le client paie, l’argent est bloqué jusqu’à la remise, la Flotte Hailand livre à sa porte.</p>
      </section>
      <ol className="flex flex-col gap-2.5">
        {steps.map(([t, d], i) => (
          <li key={t} className="flex items-start gap-3 rounded-[20px] border border-line-soft bg-card p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink font-display text-[15px] font-semibold text-lime">{i + 1}</span>
            <span className="flex flex-col gap-0.5"><b className="text-[15px] font-extrabold">{t}</b><span className="text-[13px] font-semibold text-muted">{d}</span></span>
          </li>
        ))}
      </ol>
      <div className="mt-auto flex flex-col gap-3">
        <LienHailand app="vendeur" href={VENDEUR_URL} className="flex h-14 items-center justify-center rounded-[18px] bg-blue text-[16px] font-extrabold text-white">Ouvrir ma boutique</LienHailand>
        <p className="text-center text-[12.5px] font-semibold text-muted">Vous avez reçu un lien de produit ? Ouvrez-le directement : il mène à la fiche du produit.</p>
      </div>
    </main>
  );
}
