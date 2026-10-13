'use client';
import { useEffect, useState } from 'react';
import { WelcomeScreen } from './WelcomeScreen';

const KEY = 'hx-welcome-v1';

/** Affiche l'écran d'ouverture à la première visite seulement (mémorisé dans le navigateur, jamais bloquant). */
export function WelcomeGate() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try { if (!localStorage.getItem(KEY)) setOpen(true); } catch { /* navigation privée : on n'affiche pas l'écran */ }
  }, []);
  if (!open) return null;
  const close = () => { try { localStorage.setItem(KEY, '1'); } catch { /* ignoré */ } setOpen(false); };
  return <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-label="Bienvenue sur HailandX"><WelcomeScreen onClose={close} /></div>;
}
