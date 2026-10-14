'use client';
import { useEffect, useRef, useState } from 'react';
import { bearing, haversine } from './nav';

/** Position du livreur. `heading` : cap donné par le GPS, sinon calculé d'après le déplacement (null à l'arrêt). */
export interface Fix { lat: number; lng: number; accuracy: number; heading: number | null; speed: number | null; at: number }

/** Position du livreur en continu (haute précision). `error` explique un refus ou une indisponibilité. */
export function useGeo(active = true): { fix: Fix | null; error: string | null } {
  const [fix, setFix] = useState<Fix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const id = useRef<number | null>(null);
  const moved = useRef<{ lng: number; lat: number; heading: number | null } | null>(null);
  useEffect(() => {
    if (!active) return;
    if (!navigator.geolocation) { setError('La localisation n’est pas disponible sur cet appareil.'); return; }
    id.current = navigator.geolocation.watchPosition(
      (p) => {
        setError(null);
        const here = { lng: p.coords.longitude, lat: p.coords.latitude };
        let heading = typeof p.coords.heading === 'number' && !Number.isNaN(p.coords.heading) && (p.coords.speed ?? 0) > 0.5 ? p.coords.heading : null;
        // Sans cap du GPS : celui du dernier déplacement d'au moins 8 m.
        const last = moved.current;
        if (heading === null && last && haversine([last.lng, last.lat], [here.lng, here.lat]) >= 8) heading = bearing([last.lng, last.lat], [here.lng, here.lat]);
        if (!last || haversine([last.lng, last.lat], [here.lng, here.lat]) >= 8) moved.current = { ...here, heading: heading ?? last?.heading ?? null };
        setFix({ ...here, accuracy: p.coords.accuracy, heading: heading ?? moved.current?.heading ?? null, speed: p.coords.speed ?? null, at: Date.now() });
      },
      (e) => setError(e.code === 1 ? 'Localisation refusée : autorisez-la pour recevoir des missions et être guidé.' : 'Position introuvable pour l’instant.'),
      { enableHighAccuracy: true, maximumAge: 3_000, timeout: 20_000 },
    );
    return () => { if (id.current !== null) navigator.geolocation.clearWatch(id.current); };
  }, [active]);
  return { fix, error };
}
