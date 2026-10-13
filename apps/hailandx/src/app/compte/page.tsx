'use client';
import Link from 'next/link';
import { Wordmark } from '@hailandx/ui';
import { browserClient } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';
import { NotificationBell } from '@/components/NotificationBell';

const ITEMS = [
  ['/commandes', 'Mes commandes', 'Suivre mes colis, signaler un problème, donner un avis'],
  ['/favoris', 'Mes favoris', 'Les produits que j’ai mis de côté'],
  ['/adresse', 'Mes adresses', 'Où me livrer'],
  ['/notifications', 'Notifications', 'Commandes, suivi, avis, litiges'],
  ['/vendeur', 'Mon espace vendeur', 'Boutique, produits, ventes'],
  ['/parametres', 'Paramètres', 'Mon compte, suppression du compte'],
] as const;

/** Mon compte : tout ce qui concerne la personne, au même endroit. */
export default function AccountPage() {
  const session = useSession();
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-5 pb-6 pt-6">
      <div className="flex items-center justify-between"><Link href="/" aria-label="Accueil"><Wordmark /></Link><NotificationBell /></div>
      <h1 className="font-display text-[26px] font-semibold tracking-tight">Mon compte</h1>
      {session === null && (
        <div className="flex flex-col gap-3 rounded-[22px] border border-line-soft bg-card p-5">
          <p className="text-[14px] font-medium text-muted">Connectez-vous avec votre téléphone pour retrouver vos commandes, vos favoris et vos adresses.</p>
          <Link href="/connexion?next=/compte" className="inline-flex h-[54px] items-center justify-center rounded-2xl bg-ink text-[15px] font-extrabold text-white">Me connecter</Link>
        </div>
      )}
      {session && <p className="text-[13px] font-semibold text-muted">Connecté : {session.user.phone ? `+${session.user.phone.replace(/^\+/, '')}` : 'compte HailandX'}</p>}
      <nav aria-label="Mon compte" className="flex flex-col gap-2">
        {ITEMS.map(([href, t, d]) => (
          <Link key={href} href={session ? href : `/connexion?next=${encodeURIComponent(href)}`} className="flex items-center justify-between gap-3 rounded-2xl border border-line-soft bg-card px-4 py-3.5">
            <span className="flex flex-col"><span className="text-[14.5px] font-extrabold">{t}</span><span className="text-[12.5px] font-medium text-muted">{d}</span></span><span aria-hidden="true" className="text-[18px] font-bold text-muted">›</span>
          </Link>
        ))}
      </nav>
      {session && <button type="button" onClick={() => browserClient()?.auth.signOut()} className="h-12 rounded-2xl border border-line text-[14px] font-bold">Me déconnecter</button>}
    </main>
  );
}
