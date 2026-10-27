'use client';
import { useEffect, useState } from 'react';
import { MAX_DURATION_MS, shouldStop, summarize, type GpsSample, type GpsSummary } from '../gpsAcquisition';
import { describeGeoError, type GeoHelp } from '../geoDiagnostic';

export type AcquisitionStatus = 'running' | 'done' | 'error';

export interface Acquisition {
  status: AcquisitionStatus;
  samples: GpsSample[];
  summary: GpsSummary | null;
  /** Temps écoulé depuis le début (ms). */
  elapsed: number;
  error: string;
  /** Cause probable et gestes à faire (réglages iPhone, navigateur intégré…) quand la position n'arrive pas. */
  help: GeoHelp | null;
}

const NO_FIX = 'Impossible d’obtenir votre position GPS. Rapprochez-vous d’une fenêtre ou sortez un instant, puis réessayez.';

/**
 * Recueille des mesures GPS pendant 15 s au plus (arrêt anticipé quand la précision est atteinte).
 * `attempt` relance une récupération complète. Jamais de position inventée : sans mesure, on le dit.
 */
export function useGpsAcquisition(active: boolean, attempt: number): Acquisition {
  const [state, setState] = useState<Acquisition>({ status: 'running', samples: [], summary: null, elapsed: 0, error: '', help: null });

  useEffect(() => {
    if (!active) return;
    const start = Date.now();
    const samples: GpsSample[] = [];
    let finished = false;
    setState({ status: 'running', samples: [], summary: null, elapsed: 0, error: '', help: null });

    if (!navigator.geolocation) {
      setState((s) => ({ ...s, status: 'error', error: 'La géolocalisation n’est pas disponible sur cet appareil.', help: describeGeoError(2) }));
      return;
    }

    let watchId = 0;
    let lastErrorCode = 0;
    const stop = (status: AcquisitionStatus, error = '', code = 0) => {
      if (finished) return;
      finished = true;
      navigator.geolocation.clearWatch(watchId);
      clearInterval(tick);
      const summary = summarize(samples);
      const failed = status === 'error' || (status === 'done' && !summary);
      setState({
        status: status === 'done' && !summary ? 'error' : status,
        samples: [...samples],
        summary,
        elapsed: Date.now() - start,
        error: status === 'done' && !summary ? NO_FIX : error,
        help: failed ? describeGeoError(code || lastErrorCode || 3) : null,
      });
    };

    // Horloge : met à jour le temps écoulé et décide de l'arrêt, même si le téléphone n'envoie plus de mesure.
    const tick = setInterval(() => {
      const elapsed = Date.now() - start;
      const summary = summarize(samples);
      if (shouldStop(summary, elapsed)) stop('done');
      else setState((s) => (finished ? s : { ...s, elapsed }));
    }, 250);

    // Précision maximale d'abord ; si le téléphone ne répond pas (signal absent ou délai, fréquent à l'intérieur sur iPhone), repli UNE fois sur une
    // précision réduite (réseau, Wi-Fi) : mieux vaut une mesure grossière, honnêtement signalée, qu'aucune.
    let lowAccuracy = false;
    const watch = (highAccuracy: boolean) =>
      navigator.geolocation.watchPosition(
        (pos) => {
          if (finished) return;
          samples.push({ lng: pos.coords.longitude, lat: pos.coords.latitude, accuracy: pos.coords.accuracy || 9999, t: pos.timestamp || Date.now() });
          setState((s) => ({ ...s, samples: [...samples], summary: summarize(samples), elapsed: Date.now() - start }));
        },
        (err) => {
          if (finished) return;
          lastErrorCode = err.code;
          if (err.code === err.PERMISSION_DENIED) {
            stop('error', 'L’accès à votre position est refusé.', err.code);
          } else if (highAccuracy && !lowAccuracy && samples.length === 0) {
            lowAccuracy = true;
            navigator.geolocation.clearWatch(watchId);
            watchId = watch(false);
          }
          // Sinon : délai pour une mesure, on continue d'attendre jusqu'à la fin.
        },
        { enableHighAccuracy: highAccuracy, timeout: highAccuracy ? 8000 : MAX_DURATION_MS, maximumAge: highAccuracy ? 0 : 20000 }
      );
    watchId = watch(true);

    return () => {
      finished = true;
      navigator.geolocation.clearWatch(watchId);
      clearInterval(tick);
    };
  }, [active, attempt]);

  return state;
}
