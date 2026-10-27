'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { browserClient, Icon, useSession } from '@hailandx/kit';

/** Écrans plein écran : une barre d'action y remplace la barre du bas. */
const HIDDEN = ['/p/', '/panier', '/commande', '/connexion', '/bienvenue', '/compte/supprimer'];

const TABS = [
  { href: '/', label: 'Accueil', icon: 'home', match: (p: string) => p === '/' || ['/b/', '/panier'].some((x) => p.startsWith(x)) },
  { href: '/commandes', label: 'Commandes', icon: 'box', match: (p: string) => p.startsWith('/commandes') },
  { href: '/compte', label: 'Compte', icon: 'user', match: (p: string) => ['/compte', '/notifications', '/adresse', '/aide'].some((x) => p.startsWith(x)) },
] as const;

/** Barre du bas de HailandX (acheteurs) : Accueil, Commandes, Compte. Une pastille signale les colis en cours. La vente a son application. */
export function BottomNav() {
  const path = usePathname() ?? '/';
  const session = useSession();
  const [inProgress, setInProgress] = useState(0);

  const refresh = useCallback(async () => {
    const sb = browserClient(); const uid = session?.user.id;
    if (!sb || !uid) { setInProgress(0); return; }
    const { count } = await sb.from('parcels').select('id, orders!inner(buyer_id)', { count: 'exact', head: true }).eq('orders.buyer_id', uid).not('status', 'in', '(remis,annule)');
    setInProgress(count ?? 0);
  }, [session]);
  useEffect(() => { void refresh(); }, [refresh, path]);
  useEffect(() => { const t = setInterval(refresh, 60_000); return () => clearInterval(t); }, [refresh]);

  if (HIDDEN.some((h) => (h.endsWith('/') ? path.startsWith(h) : path === h || path.startsWith(`${h}/`)))) return null;
  return (
    <>
      <div aria-hidden="true" className="h-[88px]" />
      <nav aria-label="Navigation principale" className="fixed inset-x-0 bottom-0 z-40 mx-auto grid max-w-md grid-cols-3 border-t border-line bg-card/[0.97] px-2 pb-[max(14px,env(safe-area-inset-bottom))] pt-2 backdrop-blur">
        {TABS.map((t) => {
          const active = t.match(path);
          const badge = t.href === '/commandes' ? inProgress : 0;
          return (
            <Link key={t.href} href={t.href} aria-current={active ? 'page' : undefined} aria-label={badge ? `${t.label}, ${badge} en cours` : undefined}
              className={`relative flex min-h-[52px] flex-col items-center justify-center gap-[3px] text-[11px] ${active ? 'font-extrabold text-blue' : 'font-bold text-muted'}`}>
              <Icon name={t.icon} size={22} stroke={active ? 2 : 1.8} />
              {t.label}
              {badge > 0 && <span aria-hidden="true" className="absolute left-[56%] top-0 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-card bg-blue px-1 text-[10.5px] font-extrabold text-white">{badge > 9 ? '9+' : badge}</span>}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
