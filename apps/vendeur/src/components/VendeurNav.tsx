'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { browserClient, Icon, useSession } from '@hailandx/kit';

/** Écrans plein écran ou de démarrage : pas de barre du bas. */
const HIDDEN = ['/connexion', '/ouvrir', '/produits/', '/commandes/etiquette', '/compte/supprimer'];

const svg = (d: React.ReactNode, active: boolean) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
const TABS = [
  { href: '/', label: 'Tableau de bord', match: (p: string) => p === '/', icon: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></> },
  { href: '/commandes', label: 'Commandes', match: (p: string) => p.startsWith('/commandes'), icon: <><path d="M21 8 12 3 3 8v8l9 5 9-5z" /><path d="m3 8 9 5 9-5" /><path d="M12 13v8" /></> },
  { href: '/produits', label: 'Produits', match: (p: string) => p.startsWith('/produits'), icon: <><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" /><path d="M7.5 7.5h.01" /></> },
  { href: '/plus', label: 'Plus', match: (p: string) => ['/plus', '/argent', '/statistiques', '/avis', '/reglages', '/notifications', '/aide'].some((x) => p.startsWith(x)), icon: <><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></> },
];

/**
 * Barre du bas de HailandX Vendeur : Tableau de bord, Commandes, Produits, Plus.
 * Elle n'apparaît qu'une fois la vente ouverte ; avant, l'application est un seul parcours (ouvrir ma boutique).
 */
export function VendeurNav() {
  const path = usePathname() ?? '/';
  const session = useSession();
  const [open, setOpen] = useState(false);
  const [toPrepare, setToPrepare] = useState(0);

  const refresh = useCallback(async () => {
    const sb = browserClient(); const uid = session?.user.id;
    if (!sb || !uid) { setOpen(false); return; }
    const { data } = await sb.from('shops').select('id,status').eq('owner_id', uid).limit(1).maybeSingle();
    const s = data as { id: string; status: string } | null;
    setOpen(s?.status === 'ouverte');
    if (s?.status === 'ouverte') {
      const { count } = await sb.from('parcels').select('id', { count: 'exact', head: true }).eq('shop_id', s.id).eq('status', 'attente_vendeur');
      setToPrepare(count ?? 0);
    }
  }, [session]);
  useEffect(() => { void refresh(); }, [refresh, path]);
  useEffect(() => { const t = setInterval(refresh, 60_000); return () => clearInterval(t); }, [refresh]);

  if (!open || HIDDEN.some((h) => (h.endsWith('/') ? path.startsWith(h) : path === h || path.startsWith(`${h}/`)))) return null;
  return (
    <>
      <div aria-hidden="true" className="h-[88px]" />
      <nav aria-label="Navigation de HailandX Vendeur" className="fixed inset-x-0 bottom-0 z-40 mx-auto grid max-w-md grid-cols-4 border-t border-line bg-card/[0.97] px-2 pb-[max(14px,env(safe-area-inset-bottom))] pt-2 backdrop-blur">
        {TABS.map((t) => {
          const active = t.match(path);
          const badge = t.href === '/commandes' ? toPrepare : 0;
          return (
            <Link key={t.href} href={t.href} aria-current={active ? 'page' : undefined} aria-label={badge ? `${t.label}, ${badge} à préparer` : undefined}
              className={`relative flex min-h-[52px] flex-col items-center justify-center gap-[3px] text-[11px] ${active ? 'font-extrabold text-blue' : 'font-bold text-muted'}`}>
              {svg(t.icon, active)}{t.label}
              {badge > 0 && <span aria-hidden="true" className="absolute left-[56%] top-0 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-card bg-ink px-1 text-[10.5px] font-extrabold text-white">{badge > 9 ? '9+' : badge}</span>}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
