import Link from 'next/link';
import { Icon, Screen } from '../Screen';

const STEPS: [string, string][] = [
  ['Votre adresse', 'Repérez votre bâtiment sur la carte, avec NavigationX.'],
  ['Votre boutique', 'Un nom, une catégorie, un logo si vous voulez.'],
  ['La certification', 'Un agent Hailand vérifie votre emplacement. Ensuite, vous ajoutez vos produits et vous vendez.'],
];

/** Vendre — découvrir (v2) : ce que HailandX apporte au vendeur, et les trois étapes pour ouvrir. */
export function Discovery({ cta }: { cta: string }) {
  return (
    <Screen className="gap-[18px] pt-6">
      <section className="flex flex-col gap-3.5 rounded-[26px] bg-ink px-[22px] py-6 text-white">
        <span className="flex h-[52px] w-[52px] items-center justify-center rounded-[18px] bg-lime text-ink"><Icon name="shop" size={26} /></span>
        <h1 className="font-display text-[27px] font-semibold leading-[1.15] tracking-tight">Votre boutique en ligne, livrée par la Flotte Hailand</h1>
        <p className="text-[14.5px] font-semibold leading-relaxed text-white/75">Partagez-la sur TikTok et WhatsApp. Vos clients paient, un livreur Hailand récupère le colis chez vous.</p>
      </section>
      <section aria-label="Les trois étapes" className="flex flex-col gap-2.5">
        <h2 className="mx-1 font-display text-[18px] font-semibold">Trois étapes pour ouvrir</h2>
        <ol className="rounded-[22px] border border-line-soft bg-card px-4 py-1.5">
          {STEPS.map(([t, d], i) => (
            <li key={t} className={`flex gap-3.5 py-3 ${i < STEPS.length - 1 ? 'border-b border-[#f0ede6]' : ''}`}>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-[14px] font-extrabold text-white">{i + 1}</span>
              <span className="flex flex-col gap-0.5"><span className="text-[15px] font-extrabold">{t}</span><span className="text-[13px] font-semibold leading-snug text-muted">{d}</span></span>
            </li>
          ))}
        </ol>
      </section>
      <Link href={cta} className="flex h-14 items-center justify-center rounded-[18px] bg-ink text-[16px] font-extrabold text-white">Ouvrir ma boutique</Link>
      <p className="text-center text-[12.5px] font-semibold text-muted">Gratuit. Hailand prend une commission seulement sur les ventes livrées.</p>
    </Screen>
  );
}
