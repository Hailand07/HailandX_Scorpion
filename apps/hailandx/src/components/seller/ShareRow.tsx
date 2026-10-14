'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

/** Partager ma boutique : WhatsApp, TikTok (lien copié pour la bio ou une vidéo) et copie du lien. */
export function ShareRow({ slug, name }: { slug: string; name: string }) {
  const [origin, setOrigin] = useState('');
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => setOrigin(window.location.origin), []);
  const url = `${origin}/b/${slug}`;
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(url); setNote(text); } catch { setNote('Copie refusée par le navigateur : appuyez longuement sur le lien.'); }
    setTimeout(() => setNote(null), 3000);
  };
  return (
    <section aria-label="Partager" className="flex flex-col gap-3 rounded-[22px] border border-line-soft bg-card px-4 py-3.5">
      <div className="flex items-center justify-between gap-2.5">
        <span className="flex min-w-0 flex-col"><span className="text-[14.5px] font-extrabold">Partager ma boutique</span><span className="truncate text-[12px] font-semibold text-muted">{url.replace(/^https?:\/\//, '')}</span></span>
        <Link href="/vendeur/statistiques#liens" className="shrink-0 text-[12.5px] font-extrabold text-blue">Liens suivis</Link>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <a href={`https://wa.me/?text=${encodeURIComponent(`Ma boutique ${name} sur HailandX : ${url}`)}`} target="_blank" rel="noreferrer" className="flex h-11 items-center justify-center rounded-[14px] bg-ink text-[13px] font-extrabold text-white">WhatsApp</a>
        <button type="button" onClick={() => copy('Lien copié : collez-le dans votre bio ou sous votre vidéo TikTok.')} className="h-11 rounded-[14px] bg-ink text-[13px] font-extrabold text-white">TikTok</button>
        <button type="button" onClick={() => copy('Lien copié.')} className="h-11 rounded-[14px] border border-line text-[13px] font-extrabold">Copier</button>
      </div>
      {note && <p role="status" className="text-[12.5px] font-bold text-ok">{note}</p>}
    </section>
  );
}
