'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const HIDDEN = ['/p/', '/commande', '/connexion', '/bienvenue', '/admin'];
const icon = (d: React.ReactNode) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
const TABS = [
  { href: '/', label: 'Accueil', match: (p: string) => p === '/' || p.startsWith('/b/'), svg: icon(<><path d="M3 11 12 3l9 8" /><path d="M5 10v10h14V10" /></>) },
  { href: '/recherche', label: 'Chercher', match: (p: string) => p.startsWith('/recherche'), svg: icon(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>) },
  { href: '/vendeur', label: 'Vendre', match: (p: string) => p.startsWith('/vendeur'), svg: icon(<><path d="M4 9h16l-1.4-5H5.4z" /><path d="M5 9v11h14V9" /><path d="M10 20v-5h4v5" /></>) },
  { href: '/compte', label: 'Compte', match: (p: string) => ['/compte', '/commandes', '/panier', '/favoris', '/notifications', '/adresse', '/parametres'].some((x) => p.startsWith(x)), svg: icon(<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>) },
];

/** Barre de navigation du bas : Accueil, Chercher, Vendre, Commandes. Masquée là où une barre d'action la remplace. */
export function BottomNav() {
  const path = usePathname() ?? '/';
  if (HIDDEN.some((h) => (h.endsWith('/') ? path.startsWith(h) : path === h || path.startsWith(`${h}/`)))) return null;
  return (
    <>
      <div aria-hidden="true" className="h-[84px]" />
      <nav aria-label="Navigation principale" className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-md items-stretch justify-around border-t border-line-soft bg-card/95 px-2 pb-[max(10px,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur">
        {TABS.map((t) => {
          const active = t.match(path);
          const vendre = t.href === '/vendeur';
          return (
            <Link key={t.href} href={t.href} aria-current={active ? 'page' : undefined} className={`flex min-w-[64px] flex-col items-center justify-center gap-0.5 rounded-2xl px-2 py-1.5 text-[11px] font-bold ${active ? 'text-blue' : 'text-muted'}`}>
              <span className={vendre ? `flex h-8 w-11 items-center justify-center rounded-full ${active ? 'bg-blue text-white' : 'bg-lime text-ink'}` : ''}>{t.svg}</span>
              {t.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
