'use client';
import { useEffect, useState } from 'react';
import { acquisitionVerdict, summarize, type GpsSample, type GpsSummary } from '../gpsAcquisition';
import { describeGeoError, describeImprecise, type GeoHelp } from '../geoDiagnostic';

export type AcquisitionStatus = 'running' | 'done' | 'error';

export interface Acquisition {
  status: AcquisitionStatus;
  samples: GpsSample[];
  summary: GpsSummary | null;
  /** Temps écoulé depuis le début (ms). */
  elapsed: number;
  error: string;
  /** Cause probable et gestes à faire (réglages iPhone, navigateur intégré…) quand la position n'arrive pas ou reste très imprécise. */
  help: GeoHelp | null;
  /** Le téléphone n'a encore rien répondu : la fenêtre « Autoriser la localisation » attend sans doute une réponse. */
  waitingPermission: boolean;
  /** Temps de mesure depuis la première position reçue (ms) : c'est lui que montre le décompte. */
  sampling: number;
}

const NO_FIX = 'Impossible d’obtenir votre position GPS. Rapprochez-vous d’une fenêtre ou sortez un instant, puis réessayez.';

/**
 * Recueille des mesures GPS (règles d'arrêt : `acquisitionVerdict`). La haute précision n'est jamais abandonnée ; si rien n'arrive après 10 s,
 * une écoute en précision réduite s'y ajoute (les deux se combinent, la meilleure précision l'emporte).
 * `attempt` relance une récupération complète. Jamais de position inventée : sans mesure, on le dit.
 */
export function useGpsAcquisition(active: boolean, attempt: number): Acquisition {
  const [state, setState] = useState<Acquisition>({ status: 'running', samples: [], summary: null, elapsed: 0, error: '', help: null, waitingPermission: false, sampling: 0 });

  useEffect(() => {
    if (!active) return;
    const start = Date.now();
    const samples: GpsSample[] = [];
    let finished = false;
    let respondedAt: number | null = null;
    let firstSampleAt: number | null = null;
    setState({ status: 'running', samples: [], summary: null, elapsed: 0, error: '', help: null, waitingPermission: false, sampling: 0 });

    if (!navigator.geolocation) {
      setState((s) => ({ ...s, status: 'error', error: 'La géolocalisation n’est pas disponible sur cet appareil.', help: describeGeoError(2) }));
      return;
    }

    // Autorisation déjà accordée (Android, Chrome) : le temps compte tout de suite. Sinon, il compte à la première réponse.
    try {
      void navigator.permissions?.query({ name: 'geolocation' as PermissionName }).then((p) => { if (p.state === 'granted' && respondedAt === null) respondedAt = start; }).catch(() => {});
    } catch { /* Safari ancien : pas de permissions.query */ }

    const watchIds: number[] = [];
    let lowStarted = false;
    let lastErrorCode = 0;
    const stop = (status: AcquisitionStatus, error = '', code = 0) => {
      if (finished) return;
      finished = true;
      watchIds.forEach((id) => navigator.geolocation.clearWatch(id));
      clearInterval(tick);
      const summary = summarize(samples);
      const failed = status === 'error' || (status === 'done' && !summary);
      setState({
        status: status === 'done' && !summary ? 'error' : status,
        samples: [...samples],
        summary,
        elapsed: Date.now() - start,
        error: status === 'done' && !summary ? NO_FIX : error,
        help: failed ? describeGeoError(code || lastErrorCode || 3) : summary && summary.bestAccuracy > 200 ? describeImprecise(summary.bestAccuracy) : null,
        waitingPermission: false,
        sampling: firstSampleAt === null ? 0 : Date.now() - firstSampleAt,
      });
    };

    const onSample = (pos: GeolocationPosition) => {
      if (finished) return;
      const now = Date.now();
      if (respondedAt === null) respondedAt = now;
      if (firstSampleAt === null) firstSampleAt = now;
      samples.push({ lng: pos.coords.longitude, lat: pos.coords.latitude, accuracy: pos.coords.accuracy || 9999, t: pos.timestamp || now });
      setState((s) => ({ ...s, samples: [...samples], summary: summarize(samples), elapsed: now - start, waitingPermission: false }));
    };
    const onError = (err: GeolocationPositionError) => {
      if (finished) return;
      lastErrorCode = err.code;
      if (err.code === err.PERMISSION_DENIED) { stop('error', 'L’accès à votre position est refusé.', err.code); return; }
      if (respondedAt === null) respondedAt = Date.now();
      // Délai ou signal absent : la haute précision continue ; on ajoute l'écoute en précision réduite.
      startLow();
    };
    const startLow = () => {
      if (lowStarted || finished) return;
      lowStarted = true;
      watchIds.push(navigator.geolocation.watchPosition(onSample, () => {}, { enableHighAccuracy: false, timeout: 30000, maximumAge: 20000 }));
    };

    // Horloge : temps écoulé, attente de l'autorisation, arrêt, même si le téléphone n'envoie plus de mesure.
    const tick = setInterval(() => {
      const now = Date.now();
      const summary = summarize(samples);
      if (respondedAt !== null && firstSampleAt === null && now - respondedAt > 10000) startLow();
      const v = acquisitionVerdict({ now, start, respondedAt, firstSampleAt, summary });
      if (v === 'done') stop('done');
      else if (v === 'no-fix') stop('done');
      else if (v === 'no-answer') stop('error', 'Le téléphone n’a pas répondu : la localisation n’a pas été autorisée.', 1);
      else setState((s) => (finished ? s : { ...s, elapsed: now - start, waitingPermission: respondedAt === null && now - start > 2500, sampling: firstSampleAt === null ? 0 : now - firstSampleAt }));
    }, 250);

    watchIds.push(navigator.geolocation.watchPosition(onSample, onError, { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }));

    return () => {
      finished = true;
      watchIds.forEach((id) => navigator.geolocation.clearWatch(id));
      clearInterval(tick);
    };
  }, [active, attempt]);

  return state;
}
