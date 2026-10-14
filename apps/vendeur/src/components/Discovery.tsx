import Link from 'next/link';
import { Icon, Screen } from '@hailandx/kit';
import { Brand } from './Brand';

const STEPS: [string, string][] = [
  ['Votre adresse', 'Repérez votre bâtiment sur la carte, avec NavigationX.'],
  ['Votre boutique', 'Un nom, une catégorie, un logo si vous voulez.'],
  ['La certification', 'Un agent Hailand vérifie votre emplacement. Ensuite, vous ajoutez vos produits et vous vendez.'],
];

/** HailandX Vendeur — accueil d'un vendeur sans boutique : ce que HailandX lui apporte, et les trois étapes pour ouvrir. */
export function Discovery({ cta, logged }: { cta: string; logged: boolean }) {
  return (
    <Screen className="gap-[18px] pt-5">
      <header className="flex items-center justify-between">
        <Brand />
        <Link href={logged ? '/plus' : '/connexion?next=/'} className="flex h-11 items-center rounded-2xl border border-line bg-card px-3.5 text-[13px] font-extrabold">{logged ? 'Mon compte' : 'Se connecter'}</Link>
      </header>
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
