'use client';
import * as React from 'react';

/**
 * Photos de produit (§54) : le cadre garde son format, mais l'image s'y montre EN ENTIER (jamais rognée). L'espace restant est
 * rempli par la même photo, floutée, pour que le cadre reste beau. Un toucher ouvre la photo en plein écran.
 */
export function FitImage({ src, alt, className = '', eager = false, onOpen }: { src: string; alt: string; className?: string; eager?: boolean; onOpen?: () => void }) {
  const body = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" className="relative h-full w-full object-contain" />
    </>
  );
  return onOpen
    ? <button type="button" onClick={onOpen} aria-label={`${alt} — voir en plein écran`} className={`relative block overflow-hidden bg-[#ebe8e0] ${className}`}>{body}</button>
    : <span className={`relative block overflow-hidden bg-[#ebe8e0] ${className}`}>{body}</span>;
}

/**
 * Visionneuse plein écran : glisser d'une photo à l'autre, toucher la photo pour l'agrandir (et encore pour revenir),
 * fermer par la croix, la touche Échap ou le bouton retour du téléphone.
 */
export function Lightbox({ photos, start = 0, label, onClose }: { photos: string[]; start?: number; label: string; onClose: () => void }) {
  const strip = React.useRef<HTMLDivElement>(null);
  const [at, setAt] = React.useState(start);
  const [zoom, setZoom] = React.useState<{ i: number; x: number; y: number } | null>(null);

  React.useEffect(() => {
    const el = strip.current;
    if (el) el.scrollLeft = start * el.clientWidth;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Le bouton « retour » du téléphone ferme la visionneuse au lieu de quitter la page.
    history.pushState({ hxLightbox: true }, '');
    const onPop = () => onClose();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') history.back(); };
    window.addEventListener('popstate', onPop);
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('popstate', onPop); window.removeEventListener('keydown', onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => history.back();
  const toggleZoom = (i: number, e: React.MouseEvent<HTMLElement>) => {
    if (zoom) return setZoom(null);
    const r = e.currentTarget.getBoundingClientRect();
    setZoom({ i, x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={`Photos de ${label}`} className="fixed inset-0 z-[80] flex flex-col bg-black text-white">
      <div className="flex items-center justify-between px-4 pb-2 pt-[max(12px,env(safe-area-inset-top))]">
        <span className="text-[13px] font-bold text-white/80">{photos.length > 1 ? `${at + 1} / ${photos.length}` : ''}</span>
        <button type="button" onClick={close} aria-label="Fermer" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-[22px] leading-none">×</button>
      </div>
      <div ref={strip} onScroll={(e) => { const el = e.currentTarget; setAt(Math.round(el.scrollLeft / Math.max(1, el.clientWidth))); }}
        className={`flex flex-1 snap-x snap-mandatory [scrollbar-width:none] ${zoom ? 'overflow-hidden' : 'overflow-x-auto'}`}>
        {photos.map((src, i) => (
          <div key={src} className="relative flex h-full w-full shrink-0 snap-center items-center justify-center overflow-hidden" onClick={(e) => toggleZoom(i, e)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`${label}, photo ${i + 1} sur ${photos.length}`} draggable={false}
              className="max-h-full max-w-full select-none object-contain transition-transform duration-200"
              style={zoom?.i === i ? { transform: 'scale(2.5)', transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined} />
          </div>
        ))}
      </div>
      <p className="px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-2 text-center text-[12px] font-semibold text-white/60">{zoom ? 'Touchez pour revenir' : `Touchez pour agrandir${photos.length > 1 ? ' · glissez pour la suivante' : ''}`}</p>
    </div>
  );
}
