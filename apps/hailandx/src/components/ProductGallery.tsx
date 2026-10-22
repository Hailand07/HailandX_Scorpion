'use client';
import { useRef, useState } from 'react';
import { PhotoSlot } from '@hailandx/ui';

/** Galerie de la fiche produit : photos qu'on fait glisser, points de position et vignettes ; repli sur la vignette de couleur. */
export function ProductGallery({ photos, color, label }: { photos: string[]; color: string; label: string }) {
  const strip = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  if (photos.length === 0) return <PhotoSlot src={null} color={color} className="h-[320px] rounded-3xl" label={label} />;
  const go = (i: number) => { const el = strip.current; if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' }); };
  return (
    <div className="flex flex-col gap-2.5">
      <div className="relative">
        <div ref={strip} onScroll={(e) => { const el = e.currentTarget; setAt(Math.round(el.scrollLeft / Math.max(1, el.clientWidth))); }}
          className="flex snap-x snap-mandatory overflow-x-auto rounded-3xl bg-sand [scrollbar-width:none]" aria-label={`Photos de ${label}`} role="region">
          {photos.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src} alt={`${label}, photo ${i + 1} sur ${photos.length}`} loading={i === 0 ? 'eager' : 'lazy'} className="h-[340px] w-full shrink-0 snap-center object-cover" />
          ))}
        </div>
        {photos.length > 1 && <span className="absolute right-3 top-3 rounded-full bg-ink/75 px-2.5 py-1 text-[11.5px] font-extrabold text-white">{at + 1} / {photos.length}</span>}
      </div>
      {photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]" role="tablist" aria-label="Choisir une photo">
          {photos.map((src, i) => (
            <button key={src} type="button" role="tab" aria-selected={at === i} aria-label={`Photo ${i + 1}`} onClick={() => go(i)}
              className={`h-14 w-14 shrink-0 overflow-hidden rounded-xl border-2 ${at === i ? 'border-ink' : 'border-transparent opacity-70'}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Texte long replié au-delà de quelques lignes, avec « Lire la suite ». */
export function ReadMore({ text, lines = 6 }: { text: string; lines?: number }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 320 || text.split('\n').length > lines;
  return (
    <div className="flex flex-col gap-1.5">
      <p className="whitespace-pre-line text-[14.5px] font-medium leading-relaxed text-ink/90" style={!open && long ? { display: '-webkit-box', WebkitLineClamp: lines, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : undefined}>{text}</p>
      {long && <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="self-start text-[13px] font-extrabold text-blue-ink">{open ? 'Réduire' : 'Lire la suite'}</button>}
    </div>
  );
}
