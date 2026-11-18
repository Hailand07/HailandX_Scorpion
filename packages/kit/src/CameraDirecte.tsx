'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * Appareil photo DANS l'application (§61) : la caméra s'affiche dans la page, sans ouvrir l'application Appareil photo.
 * Sur Android, ouvrir l'appareil photo externe depuis une application installée la fait souvent fermer faute de mémoire
 * (« Impossible de terminer l'opération précédente. Mémoire insuffisante ») et la photo est perdue.
 * Plusieurs photos d'affilée possibles ; chaque photo est rendue tout de suite par `onPhoto`.
 * Si la caméra est refusée ou absente, `onRepli` est appelé : l'écran revient à l'ancien bouton (appareil photo du téléphone).
 */
export function CameraDirecte({ onPhoto, onClose, onRepli, restantes = 5, maxSide = 1600 }: {
  onPhoto: (file: File) => void; onClose: () => void; onRepli: () => void; restantes?: number; maxSide?: number;
}) {
  // Nombre de photos permises, fixé à l'ouverture (la page compte aussi les photos ajoutées entre-temps).
  const max = useRef(restantes).current;
  const video = useRef<HTMLVideoElement>(null);
  const flux = useRef<MediaStream | null>(null);
  const [pret, setPret] = useState(false);
  const [prises, setPrises] = useState(0);
  const [flash, setFlash] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let fini = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) { onRepli(); return; }
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false });
        if (fini) { s.getTracks().forEach((t) => t.stop()); return; }
        flux.current = s;
        if (video.current) { video.current.srcObject = s; await video.current.play().catch(() => undefined); }
        setPret(true);
      } catch (e) {
        if (fini) return;
        const nom = e instanceof DOMException ? e.name : '';
        // Refus de l'autorisation : on l'explique ; autre souci (pas de caméra, déjà utilisée) : retour à l'appareil photo du téléphone.
        if (nom === 'NotAllowedError' || nom === 'SecurityError') setErreur('L’accès à la caméra est refusé. Autorisez-le dans les réglages du navigateur (icône à gauche de l’adresse), ou utilisez l’appareil photo du téléphone.');
        else onRepli();
      }
    })();
    const k = (ev: KeyboardEvent) => { if (ev.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { fini = true; flux.current?.getTracks().forEach((t) => t.stop()); window.removeEventListener('keydown', k); document.body.style.overflow = prev; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function prendre() {
    const v = video.current;
    if (!v || !v.videoWidth || prises >= max) return;
    const scale = Math.min(1, maxSide / Math.max(v.videoWidth, v.videoHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(v.videoWidth * scale); c.height = Math.round(v.videoHeight * scale);
    c.getContext('2d')?.drawImage(v, 0, 0, c.width, c.height);
    c.toBlob((b) => {
      if (!b) return;
      onPhoto(new File([b], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' }));
      setPrises((n) => n + 1);
      setFlash(true); setTimeout(() => setFlash(false), 140);
      if (prises + 1 >= max) onClose();
    }, 'image/jpeg', 0.85);
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Prendre une photo" className="fixed inset-0 z-[80] flex flex-col bg-black text-white">
      <div className="flex items-center justify-between px-4 pb-2 pt-[max(12px,env(safe-area-inset-top))]">
        <span className="text-[13px] font-bold text-white/80">{prises > 0 ? `${prises} photo${prises > 1 ? 's' : ''} ajoutée${prises > 1 ? 's' : ''}` : 'Cadrez le produit'}</span>
        <button type="button" onClick={onClose} className="h-11 rounded-full bg-white/15 px-4 text-[14px] font-extrabold">{prises > 0 ? 'Terminé' : 'Fermer'}</button>
      </div>
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={video} playsInline muted autoPlay className="h-full w-full object-contain" />
        {flash && <span aria-hidden="true" className="absolute inset-0 bg-white/70" />}
        {!pret && !erreur && <span className="absolute text-[14px] font-semibold text-white/70">Ouverture de la caméra…</span>}
        {erreur && (
          <div className="absolute inset-x-5 flex flex-col gap-3 rounded-2xl bg-white/10 p-4">
            <p className="text-[14px] font-semibold leading-snug">{erreur}</p>
            <button type="button" onClick={onRepli} className="h-12 rounded-2xl bg-white text-[14px] font-extrabold text-black">Appareil photo du téléphone</button>
          </div>
        )}
      </div>
      <div className="flex items-center justify-center pb-[max(24px,env(safe-area-inset-bottom))] pt-4">
        <button type="button" onClick={prendre} disabled={!pret || prises >= max} aria-label="Prendre la photo"
          className="flex h-[76px] w-[76px] items-center justify-center rounded-full border-4 border-white disabled:opacity-40">
          <span className="h-[60px] w-[60px] rounded-full bg-white active:scale-90" />
        </button>
      </div>
    </div>
  );
}
