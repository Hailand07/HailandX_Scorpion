'use client';
import { useState } from 'react';

/** Partager un lien de HailandX : feuille de partage du téléphone, sinon copie du lien. */
export function ShareButton({ title, path }: { title: string; path: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = `${window.location.origin}${path}`;
    try {
      if (navigator.share) { await navigator.share({ title, url }); return; }
      await navigator.clipboard.writeText(url);
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    } catch { /* partage annulé */ }
  };
  return <button type="button" onClick={share} className="flex h-11 items-center rounded-full border border-line bg-card px-4 text-[13.5px] font-extrabold">{copied ? 'Lien copié' : 'Partager'}</button>;
}
