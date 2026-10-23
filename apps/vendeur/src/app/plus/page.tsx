'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { maskPhone } from '@hailandx/commerce';
import { browserClient, GroupTitle, HAILANDX_URL, Icon, LienHailand, ListRow, Screen, unreadNotifications, signOutHailand } from '@hailandx/kit';
import { useMyShop } from '@/lib/useMyShop';
import { Chargement } from '@hailandx/ui';

/** Menu (ex-« Plus ») : les pages rangées de la boutique (argent, statistiques, avis, réglages) et le compte du vendeur. */
export default function PlusPage() {
  const router = useRouter();
  const { state, session, shop } = useMyShop();
  const [unread, setUnread] = useState(0);
  useEffect(() => { if (state === 'visiteur') router.replace('/connexion?next=/plus'); }, [state, router]);
  useEffect(() => { const sb = browserClient(); if (sb && session) void unreadNotifications(sb, 'vendeur').then(setUnread); }, [session]);
  if (state !== 'pret' || !session) return <Screen className="pt-6"><Chargement /></Screen>;

  const open = shop?.status === 'ouverte';
  const owner = shop?.role === 'proprietaire';
  const since = new Date(session.user.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return (
    <Screen className="gap-[18px] pt-6">
      <h1 className="font-display text-[26px] font-semibold tracking-tight">Menu</h1>

      {shop && (
        <section aria-label="Ma boutique" className="flex flex-col gap-2">
          <GroupTitle>{shop.name}{owner ? '' : ' · employé'}</GroupTitle>
          <div className="overflow-hidden rounded-[20px] border border-line-soft bg-card">
            {open && owner && <ListRow href="/argent" icon="wallet" label="Argent" />}
            {open && <ListRow href="/statistiques" icon="chart" label="Statistiques et liens suivis" />}
            {open && <ListRow href="/clients" icon="users" label="Clients" />}
            {open && <ListRow href="/avis" icon="star" label="Avis des clients" />}
            {open && <ListRow href="/questions" icon="help" label="Questions des clients" />}
            {owner && <ListRow href="/boutique" icon="shop" label="Boutique en ligne" value={<span className="text-[12px] font-bold text-muted">horaires, congés</span>} />}
            {owner && <ListRow href="/equipe" icon="users" label="Équipe" />}
            {owner && <ListRow href="/reglages" icon="sliders" label="Réglages de la boutique" />}
            <LienHailand app="hailandx" href={`${HAILANDX_URL}/b/${shop.slug}`} target="_blank" className="flex min-h-[58px] items-center gap-3 px-4">
              <Icon name="eye" /><span className="flex-1 text-[15px] font-bold">Voir ma boutique sur HailandX</span><span aria-hidden="true" className="font-extrabold text-[#9a9db0]">↗</span>
            </LienHailand>
          </div>
        </section>
      )}
      {!open && <Link href="/" className="flex h-12 items-center justify-center rounded-2xl bg-ink text-[14.5px] font-extrabold text-white">{shop ? 'Continuer l’ouverture de ma boutique' : 'Ouvrir ma boutique'}</Link>}

      <section aria-label="Mon compte" className="flex flex-col gap-2">
        <GroupTitle>Mon compte</GroupTitle>
        <div className="overflow-hidden rounded-[20px] border border-line-soft bg-card">
          <div className="flex min-h-[58px] items-center gap-3 border-b border-[#f0ede6] px-4">
            <Icon name="user" /><span className="flex flex-col"><span className="text-[15px] font-bold">{maskPhone(session.user.phone)}</span><span className="text-[12px] font-semibold text-muted">Compte Hailand depuis {since}</span></span>
          </div>
          <ListRow href="/notifications" icon="bell" label="Notifications" value={unread ? <span className="rounded-full bg-blue-soft px-2 py-0.5 text-[12px] font-extrabold text-blue">{unread} nouvelle{unread > 1 ? 's' : ''}</span> : null} />
          <ListRow href="/aide" icon="help" label="Aide aux vendeurs" last />
        </div>
      </section>

      <div className="flex flex-col items-center gap-1.5">
        <button type="button" onClick={async () => { await signOutHailand(browserClient()); window.location.replace('/'); }} className="h-[52px] w-full rounded-2xl border border-line bg-card text-[15px] font-extrabold">Se déconnecter</button>
        <Link href="/compte/supprimer" className="flex h-11 items-center text-[13px] font-bold text-[#a3321f]">Supprimer mon compte</Link>
      </div>
    </Screen>
  );
}
