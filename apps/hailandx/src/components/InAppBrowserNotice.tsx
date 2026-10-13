'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { isInAppBrowser, isIOS } from '@hailandx/scorpion';

const DISMISS_KEY = 'hx-inapp-dismissed';
/** Pages où la localisation compte : on ne dérange pas ailleurs que sur ce qui mène à la commande. */
const CONCERNED = ['/b/', '/p/', '/s/', '/panier', '/commande', '/adresse'];

/**
 * Avertit quand le lien est ouvert dans le navigateur d'une application (WhatsApp, TikTok, Facebook…) : la localisation n'y marche pas
 * (constaté le 2026-10-12). La commande reste possible (on peut toucher la carte), mais l'ouvrir dans Safari ou Chrome est plus simple.
 */
export function InAppBrowserNotice() {
  const path = usePathname() ?? '/';
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let dismissed = false;
    try { dismissed = sessionStorage.getItem(DISMISS_KEY) === '1'; } catch { /* stockage indisponible */ }
    setShow(!dismissed && isInAppBrowser());
    setIos(isIOS());
  }, []);
  if (!show || !CONCERNED.some((c) => path === c.replace(/\/$/, '') || path.startsWith(c))) return null;

  const close = () => { try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignoré */ } setShow(false); };
  const copy = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); } catch { /* presse-papiers indisponible : les consignes restent affichées */ }
  };
  const browser = ios ? 'Safari' : 'Chrome';
  return (
    <div role="alert" aria-label="Ouvrir dans le navigateur" className="fixed inset-x-3 top-[max(12px,env(safe-area-inset-top))] z-[60] mx-auto max-w-md rounded-[20px] bg-ink p-4 text-white shadow-[0_12px_36px_rgba(0,0,0,0.35)]">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-bold leading-tight">Ouvrez ce lien dans {browser}</div>
          <p className="mt-1 text-[13.5px] font-medium leading-snug opacity-85">
            Vous êtes dans le navigateur d’une application : la localisation n’y fonctionne pas, et vos livraisons en dépendent. {ios ? 'Touchez « ⋯ » ou l’icône boussole, puis « Ouvrir dans Safari ».' : 'Touchez « ⋮ », puis « Ouvrir dans le navigateur ».'}
          </p>
        </div>
        <button type="button" onClick={close} aria-label="Fermer" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-[16px] font-bold">×</button>
      </div>
      <button type="button" onClick={copy} className="mt-3 flex h-11 w-full items-center justify-center rounded-[14px] bg-bg text-[14.5px] font-bold text-ink active:opacity-80">
        {copied ? `Lien copié : collez-le dans ${browser}` : 'Copier le lien'}
      </button>
    </div>
  );
}
