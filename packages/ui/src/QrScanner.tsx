'use client';
import * as React from 'react';
import jsQR from 'jsqr';

/**
 * Lecteur de QR : caméra arrière, lecture en continu (≈ 8 images/s), arrêt dès qu'un code est lu.
 * Repli : saisie ou collage du texte du QR (caméra refusée, absente, ou iPhone dans un navigateur intégré).
 */
export const QrScanner: React.FC<{ onResult: (text: string) => void; onClose: () => void; title?: string; dark?: boolean }> = ({ onResult, onClose, title = 'Scanner le QR du colis', dark }) => {
  const video = React.useRef<HTMLVideoElement>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [manual, setManual] = React.useState('');
  const done = React.useRef(false);

  React.useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let last = 0;
    let stopped = false;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return setError('La caméra n’est pas disponible ici : saisissez le code du QR ci-dessous.');
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false });
      } catch {
        return setError('Caméra refusée : autorisez-la dans le navigateur, ou saisissez le code du QR ci-dessous.');
      }
      if (stopped || !video.current) return stream.getTracks().forEach((t) => t.stop());
      video.current.srcObject = stream;
      await video.current.play().catch(() => {});
      const tick = (now: number) => {
        raf = requestAnimationFrame(tick);
        const v = video.current;
        if (!v || !ctx || done.current || now - last < 120 || v.videoWidth === 0) return;
        last = now;
        const scale = Math.min(1, 640 / v.videoWidth);
        canvas.width = Math.round(v.videoWidth * scale);
        canvas.height = Math.round(v.videoHeight * scale);
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
        if (code?.data) { done.current = true; onResult(code.data); }
      };
      raf = requestAnimationFrame(tick);
    })();

    return () => { stopped = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
  }, [onResult]);

  const box = dark ? 'bg-night-card text-night-text border-night-line' : 'bg-card text-ink border-line';
  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 flex flex-col bg-black/90">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3 px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-[max(16px,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between text-white">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="h-11 rounded-full bg-white/15 px-4 text-[13.5px] font-bold">Fermer</button>
        </div>
        <div className="relative flex-1 overflow-hidden rounded-3xl bg-black">
          <video ref={video} playsInline muted className="h-full w-full object-cover" />
          <span className="pointer-events-none absolute inset-[18%] rounded-3xl border-[3px] border-lime/90" aria-hidden="true" />
        </div>
        {error && <p role="alert" className="rounded-2xl bg-white/10 px-4 py-3 text-[13.5px] font-semibold text-white">{error}</p>}
        <form className={`flex gap-2 rounded-2xl border p-2 ${box}`} onSubmit={(e) => { e.preventDefault(); if (manual.trim() && !done.current) { done.current = true; onResult(manual.trim()); } }}>
          <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Ou collez le code du QR" aria-label="Code du QR" autoCapitalize="off" autoCorrect="off" spellCheck={false} className="h-11 min-w-0 flex-1 bg-transparent px-3 text-[15px] outline-none" />
          <button type="submit" className="h-11 rounded-xl bg-lime px-4 text-[13.5px] font-extrabold text-ink">Valider</button>
        </form>
      </div>
    </div>
  );
};
