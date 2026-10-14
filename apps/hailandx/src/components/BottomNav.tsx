'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { browserClient } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';
import { Icon } from './Screen';

/** Écrans plein écran : une barre d'action y remplace la barre du bas. */
const HIDDEN = ['/p/', '/commande', '/connexion', '/bienvenue', '/admin', '/vendeur/produits/', '/vendeur/commandes/etiquette', '/compte/supprimer'];

const TABS = [
  { href: '/', id: 'accueil', icon: 'home', match: (p: string) => p === '/' || ['/recherche', '/b/', '/panier'].some((x) => p.startsWith(x)) },
  { href: '/commandes', id: 'commandes', icon: 'box', match: (p: string) => p.startsWith('/commandes') },
  { href: '/vendeur', id: 'boutique', icon: 'shop', match: (p: string) => p.startsWith('/vendeur') },
  { href: '/compte', id: 'compte', icon: 'user', match: (p: string) => ['/compte', '/favoris', '/notifications', '/adresse', '/aide', '/parametres'].some((x) => p.startsWith(x)) },
] as const;

/** Barre du bas (v2) : Accueil, Commandes, Vendre / Ma boutique, Compte. Une pastille signale ce qui attend une action. */
export function BottomNav() {
  const path = usePathname() ?? '/';
  const session = useSession();
  const [open, setOpen] = useState(false);
  const [toPrepare, setToPrepare] = useState(0);
  const [inProgress, setInProgress] = useState(0);

  const refresh = useCallback(async () => {
    const sb = browserClient(); const uid = session?.user.id;
    if (!sb || !uid) { setOpen(false); setToPrepare(0); setInProgress(0); return; }
    const [shop, mine] = await Promise.all([
      sb.from('shops').select('id,status').eq('owner_id', uid).limit(1).maybeSingle(),
      sb.from('parcels').select('id, orders!inner(buyer_id)', { count: 'exact', head: true }).eq('orders.buyer_id', uid).not('status', 'in', '(remis,annule)'),
    ]);
    const s = shop.data as { id: string; status: string } | null;
    setOpen(s?.status === 'ouverte');
    setInProgress(mine.count ?? 0);
    if (s) {
      const { count } = await sb.from('parcels').select('id', { count: 'exact', head: true }).eq('shop_id', s.id).eq('status', 'attente_vendeur');
      setToPrepare(count ?? 0);
    } else setToPrepare(0);
  }, [session]);

  useEffect(() => { void refresh(); }, [refresh, path]);
  useEffect(() => { const t = setInterval(refresh, 60_000); return () => clearInterval(t); }, [refresh]);

  if (HIDDEN.some((h) => (h.endsWith('/') ? path.startsWith(h) : path === h || path.startsWith(`${h}/`)))) return null;
  return (
    <>
      <div aria-hidden="true" className="h-[88px]" />
      <nav aria-label="Navigation principale" className="fixed inset-x-0 bottom-0 z-40 mx-auto grid max-w-md grid-cols-4 border-t border-line bg-card/[0.97] px-2 pb-[max(14px,env(safe-area-inset-bottom))] pt-2 backdrop-blur">
        {TABS.map((t) => {
          const active = t.match(path);
          const badge = t.id === 'commandes' ? inProgress : t.id === 'boutique' ? toPrepare : 0;
          const label = t.id === 'accueil' ? 'Accueil' : t.id === 'commandes' ? 'Commandes' : t.id === 'compte' ? 'Compte' : open ? 'Ma boutique' : 'Vendre';
          const shopTab = t.id === 'boutique';
          return (
            <Link key={t.id} href={t.href} aria-current={active ? 'page' : undefined} aria-label={badge ? `${label}, ${badge} en attente` : undefined}
              className={`relative flex min-h-[52px] flex-col items-center justify-center gap-[3px] text-[11px] ${active ? 'font-extrabold text-blue' : 'font-bold text-muted'}`}>
              {shopTab
                ? <span className={`flex h-7 w-[46px] items-center justify-center rounded-full ${active ? 'bg-blue text-white' : 'bg-lime text-ink'}`}><Icon name="shop" /></span>
                : <Icon name={t.icon} size={22} stroke={active ? 2 : 1.8} />}
              {label}
              {badge > 0 && <span aria-hidden="true" className={`absolute top-0 left-[58%] flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-card px-1 text-[10.5px] font-extrabold text-white ${shopTab ? 'bg-ink' : 'bg-blue'}`}>{badge > 9 ? '9+' : badge}</span>}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
