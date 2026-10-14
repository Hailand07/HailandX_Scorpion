'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

import { browserClient, GroupTitle, Icon, LienHailand, ListRow, Screen, unreadNotifications, useSession, VENDEUR_URL, signOutHailand } from '@hailandx/kit';
import { maskPhone } from '@hailandx/commerce';

/** Compte de l'acheteur : moi, et rien d'autre. La vente se fait dans HailandX Vendeur ; l'équipe a sa console à part. */
export default function AccountPage() {
  const session = useSession();
  const [counts, setCounts] = useState<{ fav: number; addr: number; unread: number } | null>(null);

  useEffect(() => {
    const sb = browserClient(); const uid = session?.user.id;
    if (!sb || !uid) return;
    Promise.all([
      sb.from('product_favorites').select('product_id', { count: 'exact', head: true }).eq('user_id', uid),
      sb.from('declarations').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('status', 'active'),
      unreadNotifications(sb, 'acheteur'),
    ]).then(([f, a, n]) => setCounts({ fav: f.count ?? 0, addr: a.count ?? 0, unread: n }));
  }, [session]);

  if (session === undefined) return <Screen className="pt-6"><p className="text-[14px] font-semibold text-muted">Chargement…</p></Screen>;

  if (session === null) {
    return (
      <Screen className="justify-center gap-6 px-6 pb-28">
        <span className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-ink text-lime"><Icon name="phone" size={30} stroke={1.8} /></span>
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-[26px] font-semibold leading-tight tracking-tight">Votre numéro suffit</h1>
          <p className="text-[15px] font-semibold leading-relaxed text-muted">Un code par SMS, et vous retrouvez vos commandes, vos favoris et vos adresses. Pas de mot de passe.</p>
        </div>
        <Link href="/connexion?next=/compte" className="flex h-14 items-center justify-center rounded-[18px] bg-ink text-[16px] font-extrabold text-white">Me connecter</Link>
        <Link href="/aide" className="flex h-11 items-center self-center text-[13.5px] font-bold text-muted">Aide et contact</Link>
      </Screen>
    );
  }

  const since = new Date(session.user.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return (
    <Screen className="gap-[18px] pt-6">
      <h1 className="font-display text-[26px] font-semibold tracking-tight">Compte</h1>

      <section aria-label="Mon profil" className="flex items-center gap-3.5 rounded-[22px] border border-line-soft bg-card p-4">
        <span className="flex h-[52px] w-[52px] items-center justify-center rounded-[18px] bg-blue-soft text-blue"><Icon name="user" size={24} /></span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="font-display text-[17px] font-semibold">{maskPhone(session.user.phone)}</span>
          <span className="text-[12.5px] font-semibold text-muted">Client depuis {since}</span>
        </span>
      </section>

      <section aria-label="Mes achats" className="flex flex-col gap-2">
        <GroupTitle>Mes achats</GroupTitle>
        <div className="overflow-hidden rounded-[20px] border border-line-soft bg-card">
          <ListRow href="/favoris" icon="heart" label="Favoris" value={counts ? <span className="text-[13px] font-bold text-muted">{counts.fav}</span> : null} />
          <ListRow href="/adresse" icon="pin" label="Adresses de livraison" value={counts ? <span className="text-[13px] font-bold text-muted">{counts.addr}</span> : null} last />
        </div>
      </section>

      <section aria-label="Application" className="flex flex-col gap-2">
        <GroupTitle>Application</GroupTitle>
        <div className="overflow-hidden rounded-[20px] border border-line-soft bg-card">
          <ListRow href="/notifications" icon="bell" label="Notifications" value={counts?.unread ? <span className="rounded-full bg-blue-soft px-2 py-0.5 text-[12px] font-extrabold text-blue">{counts.unread} nouvelle{counts.unread > 1 ? 's' : ''}</span> : null} />
          <ListRow href="/aide" icon="help" label="Aide et contact" last />
        </div>
      </section>

      <LienHailand app="vendeur" href={VENDEUR_URL} className="flex items-center gap-3.5 rounded-[22px] bg-ink p-4 text-white">
        <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[15px] bg-lime text-ink"><Icon name="shop" size={22} /></span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5"><span className="font-display text-[16px] font-semibold">Vendre sur HailandX</span><span className="text-[12.5px] font-semibold text-white/70">Ouvrez votre boutique avec l’application HailandX Vendeur</span></span>
        <span aria-hidden="true" className="text-[20px] font-extrabold text-lime">↗</span>
      </LienHailand>

      <div className="flex flex-col items-center gap-1.5">
        <button type="button" onClick={async () => { await signOutHailand(browserClient()); window.location.replace('/'); }} className="h-[52px] w-full rounded-2xl border border-line bg-card text-[15px] font-extrabold">Se déconnecter</button>
        <Link href="/compte/supprimer" className="flex h-11 items-center text-[13px] font-bold text-[#a3321f]">Supprimer mon compte</Link>
      </div>
    </Screen>
  );
}
