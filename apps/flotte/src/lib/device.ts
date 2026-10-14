'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Écran maintenu allumé pendant le guidage (Screen Wake Lock). Le verrou tombe quand l'application passe en arrière-plan :
 * il est redemandé au retour. Sans prise en charge par le navigateur, rien ne se passe.
 */
export function useWakeLock(active: boolean): boolean {
  const lock = useRef<WakeLockSentinel | null>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    let stop = false;
    const take = async () => {
      try {
        if (document.visibilityState !== 'visible' || lock.current) return;
        lock.current = await navigator.wakeLock.request('screen');
        setOn(true);
        lock.current.addEventListener('release', () => { lock.current = null; setOn(false); });
        if (stop) void lock.current.release();
      } catch { setOn(false); }
    };
    void take();
    const onVis = () => { if (document.visibilityState === 'visible') void take(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { stop = true; document.removeEventListener('visibilitychange', onVis); void lock.current?.release(); lock.current = null; };
  }, [active]);
  return on;
}

const VOICE_KEY = 'flotte-voix';

/** Consignes vocales en français (synthèse vocale du téléphone). Le choix « voix coupée » est mémorisé sur l'appareil. */
export function useVoice() {
  const [on, setOn] = useState(true);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  useEffect(() => { try { if (localStorage.getItem(VOICE_KEY) === 'non') setOn(false); } catch { /* stockage indisponible */ } }, []);
  const toggle = useCallback(() => setOn((v) => {
    try { localStorage.setItem(VOICE_KEY, v ? 'non' : 'oui'); } catch { /* stockage indisponible */ }
    if (v && supported) window.speechSynthesis.cancel();
    return !v;
  }), [supported]);
  const say = useCallback((text: string, urgent = false) => {
    if (!on || !supported || !text) return;
    const s = window.speechSynthesis;
    if (urgent) s.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'fr-FR';
    const fr = s.getVoices().find((v) => v.lang.toLowerCase().startsWith('fr'));
    if (fr) u.voice = fr;
    u.rate = 1.02;
    s.speak(u);
  }, [on, supported]);
  return { on, supported, toggle, say };
}

/** Lien d'appel : « tel:+224… ». */
export const telHref = (phone: string | null | undefined) => {
  const d = (phone ?? '').replace(/[^\d+]/g, '');
  if (!d) return null;
  return `tel:${d.startsWith('+') ? d : `+${d}`}`;
};

/** Hauteur affichée d'un élément (panneau du bas) : sert à cadrer la carte au-dessus de lui. */
export function useHeight<T extends HTMLElement>(): [(el: T | null) => void, number] {
  const [h, setH] = useState(0);
  const obs = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: T | null) => {
    obs.current?.disconnect();
    if (!el) return;
    obs.current = new ResizeObserver(() => setH(Math.round(el.getBoundingClientRect().height)));
    obs.current.observe(el);
    setH(Math.round(el.getBoundingClientRect().height));
  }, []);
  useEffect(() => () => obs.current?.disconnect(), []);
  return [ref, h];
}
