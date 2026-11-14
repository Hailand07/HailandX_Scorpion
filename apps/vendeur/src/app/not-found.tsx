import Link from 'next/link';
import { Screen } from '@hailandx/kit';
import { Brand } from '@/components/Brand';

/** Adresse inconnue : un message en français et un chemin de retour (jamais la page d'erreur par défaut, en anglais). */
export default function NotFound() {
  return (
    <Screen className="gap-5 pt-8">
      <Brand />
      <div className="flex flex-1 flex-col justify-center gap-3">
        <h1 className="font-display text-[26px] font-semibold tracking-tight">Cette page n’existe pas</h1>
        <p className="text-[15px] font-medium leading-relaxed text-muted">Le lien est peut-être ancien ou mal recopié.</p>
        <Link href="/" className="mt-2 flex h-[54px] items-center justify-center rounded-2xl bg-ink text-[15px] font-extrabold text-white">Revenir à l’accueil</Link>
      </div>
    </Screen>
  );
}
