'use client';
import { useEffect, useRef, useState } from 'react';

export interface Fix { lat: number; lng: number; accuracy: number; at: number }

/** Position du livreur en continu (haute précision). `error` explique un refus ou une indisponibilité. */
export function useGeo(active = true): { fix: Fix | null; error: string | null } {
  const [fix, setFix] = useState<Fix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const id = useRef<number | null>(null);
  useEffect(() => {
    if (!active) return;
    if (!navigator.geolocation) { setError('La localisation n’est pas disponible sur cet appareil.'); return; }
    id.current = navigator.geolocation.watchPosition(
      (p) => { setError(null); setFix({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, at: Date.now() }); },
      (e) => setError(e.code === 1 ? 'Localisation refusée : autorisez-la pour recevoir des missions.' : 'Position introuvable pour l’instant.'),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );
    return () => { if (id.current !== null) navigator.geolocation.clearWatch(id.current); };
  }, [active]);
  return { fix, error };
}

export const mapsUrl = (lat: number, lng: number) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
