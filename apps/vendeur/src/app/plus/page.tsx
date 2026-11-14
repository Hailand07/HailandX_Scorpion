'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatGnf, maskPhone } from '@hailandx/commerce';
import { BackHeader, browserClient, GroupTitle, HAILANDX_URL, Icon, LienHailand, ListRow, Screen, unreadNotifications, signOutHailand } from '@hailandx/kit';
import { useMyShop } from '@/lib/useMyShop';
import { Btn, BtnLink, PageTitle } from '@/components/ui';
import { Chargement } from '@hailandx/ui';

/**
 * Onglet « Boutique » (design §52) : l'argent en tête (ce que le vendeur regarde le plus), puis trois blocs courts —
 * ce que disent les clients, ma boutique, mon compte. Clients, équipe et marketing ne sont plus proposés (§51).
 */
export default function PlusPage() {
  const router = useRouter();
  const { state, session, shop } = useMyShop();
  const [unread, setUnread] = useState(0);
  const [balance, setBalance] = useState<number | null>(null);
  /** Déconnexion en deux temps : un toucher par erreur ne ferme pas la session. */
  const [leaving, setLeaving] = useState(false);
  useEffect(() => { if (state === 'visiteur') router.replace('/connexion?next=/plus'); }, [state, router]);
  useEffect(() => { const sb = browserClient(); if (sb && session) void unreadNotifications(sb, 'vendeur').then(setUnread); }, [session]);

  const open = shop?.status === 'ouverte';
  const owner = shop?.role === 'proprietaire';
  useEffect(() => {
    const sb = browserClient();
    if (!sb || !shop || !open || !owner) return;
    void sb.from('ledger_entries').select('amount_gnf').eq('account', 'shop').eq('account_id', shop.id)
      .then(({ data }) => setBalance(((data as { amount_gnf: number }[] | null) ?? []).reduce((n, e) => n + e.amount_gnf, 0)));
  }, [shop, open, owner]);

  if (state !== 'pret' || !session) return <Screen className="pt-6"><Chargement /></Screen>;
  const since = new Date(session.user.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const hint = (t: string) => <span className="text-[12px] font-bold text-muted">{t}</span>;
  const group = 'overflow-hidden rounded-[20px] border border-line-soft bg-card';

  return (
    <Screen className="gap-4 pt-5">
      {open ? <PageTitle>{shop!.name}</PageTitle> : <BackHeader href="/" title="Mon compte" label="Retour" />}

      {open && owner && (
        <Link href="/argent" className="flex items-end justify-between gap-3 rounded-[24px] bg-ink p-5 text-white">
          <span className="flex flex-col gap-1">
            <span className="text-[12px] font-bold text-white/65">Hailand vous doit</span>
            <span className="font-display text-[30px] font-semibold leading-none tracking-tight">{balance === null ? '…' : formatGnf(balance, false)} <span className="text-[14px] text-white/65">GNF</span></span>
          </span>
          <span className="flex h-10 items-center gap-1 rounded-full bg-white/10 px-3.5 text-[13px] font-extrabold">Argent<Icon name="chevron" size={15} stroke={2.2} /></span>
        </Link>
      )}

      {open && (
        <section aria-label="Activité" className="flex flex-col gap-2">
          <GroupTitle>Activité</GroupTitle>
          <div className={group}>
            <ListRow href="/statistiques" icon="chart" label="Ventes et visites" />
            <ListRow href="/avis" icon="star" label="Avis des clients" />
            <ListRow href="/questions" icon="help" label="Questions des clients" last />
          </div>
        </section>
      )}

      {shop && (
        <section aria-label="Ma boutique" className="flex flex-col gap-2">
          <GroupTitle>Ma boutique{owner ? '' : ' · employé'}</GroupTitle>
          <div className={group}>
            {owner && <ListRow href="/reglages" icon="sliders" label="Nom, logo, adresse" />}
            {owner && <ListRow href="/boutique" icon="shop" label="Horaires et congés" />}
            {open && <ListRow href="/affiche" icon="print" label="Affiche avec QR code" value={hint('à imprimer')} />}
            <LienHailand app="hailandx" href={`${HAILANDX_URL}/b/${shop.slug}`} target="_blank" className="flex min-h-[58px] items-center gap-3 px-4">
              <Icon name="eye" /><span className="flex-1 text-[15px] font-bold">Voir ma boutique comme un client</span><span aria-hidden="true" className="font-extrabold text-faint">↗</span>
            </LienHailand>
          </div>
        </section>
      )}
      {!open && <BtnLink href={shop ? '/' : '/ouvrir'}>{shop ? 'Continuer l’ouverture de ma boutique' : 'Ouvrir ma boutique'}</BtnLink>}

      <section aria-label="Mon compte" className="flex flex-col gap-2">
        <GroupTitle>Mon compte</GroupTitle>
        <div className={group}>
          <div className="flex min-h-[58px] items-center gap-3 border-b border-line-soft px-4">
            <Icon name="user" /><span className="flex flex-col"><span className="text-[15px] font-bold">{maskPhone(session.user.phone)}</span><span className="text-[12px] font-semibold text-muted">Compte Hailand depuis {since}</span></span>
          </div>
          <ListRow href="/notifications" icon="bell" label="Notifications" value={unread ? <span className="rounded-full bg-blue-soft px-2 py-0.5 text-[12px] font-extrabold text-blue">{unread} nouvelle{unread > 1 ? 's' : ''}</span> : null} />
          <ListRow href="/aide" icon="help" label="Aide aux vendeurs" last />
        </div>
      </section>

      <div className="flex flex-col items-center gap-1.5">
        {leaving ? (
          <div role="alertdialog" aria-label="Confirmer la déconnexion" className="flex w-full flex-col gap-3 rounded-[20px] border border-line-soft bg-card p-4">
            <p className="text-[14px] font-bold leading-snug">Se déconnecter de HailandX Vendeur ?<span className="mt-0.5 block text-[13px] font-semibold text-muted">Votre boutique reste ouverte. Vous ne verrez plus les nouvelles commandes sur ce téléphone tant que vous n’êtes pas reconnecté.</span></p>
            <div className="grid grid-cols-2 gap-2">
              <Btn variant="secondary" size="md" onClick={() => setLeaving(false)}>Rester</Btn>
              <Btn size="md" onClick={async () => { await signOutHailand(browserClient()); window.location.replace('/'); }}>Me déconnecter</Btn>
            </div>
          </div>
        ) : <Btn variant="secondary" onClick={() => setLeaving(true)}>Se déconnecter</Btn>}
        <Link href="/compte/supprimer" className="flex h-11 items-center text-[13px] font-bold text-danger">Supprimer mon compte</Link>
      </div>
    </Screen>
  );
}
