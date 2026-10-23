'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { WelcomeScreen } from './WelcomeScreen';

const KEY = 'hx-welcome-v1';

/**
 * Écran de bienvenue : à la première visite seulement (mémorisé dans le navigateur, jamais bloquant), et SEULEMENT
 * quand on ouvre l'accueil. Un visiteur arrivé par un lien (produit, boutique, lien suivi /s/…, commande) va droit
 * à ce qu'il a cliqué : l'écran est alors marqué comme vu, pour ne pas l'interrompre plus tard.
 */
export function WelcomeGate() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem(KEY)) return;
      if (pathname === '/' && !window.location.search) setOpen(true);
      else localStorage.setItem(KEY, '1');
    } catch { /* navigation privée : on n'affiche pas l'écran */ }
    // Une seule décision, à l'arrivée sur le site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!open) return null;
  const close = () => { try { localStorage.setItem(KEY, '1'); } catch { /* ignoré */ } setOpen(false); };
  return <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-label="Bienvenue sur HailandX"><WelcomeScreen onClose={close} /></div>;
}
