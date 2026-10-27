'use client';
import React, { useEffect } from 'react';
import { Ico } from './ui';
import { CONFIDENCE_LABELS, MAX_DURATION_MS, TARGET_ACCURACY_M, fmtCoord, fmtM, type GpsSummary } from '../gpsAcquisition';
import type { Acquisition } from './useGpsAcquisition';
import { ScanAnimation } from './ScanAnimation';

interface Props {
  acq: Acquisition;
  /** Passe à l'identification du bâtiment avec la position retenue. */
  onContinue: (summary: GpsSummary) => void;
  onRetry: () => void;
  onClose: () => void;
}

const OK = '#22c55e';
const WEAK = '#f5a524';

/** Ligne de la colonne des calculs (étiquette discrète, valeur en chasse fixe). */
const Row: React.FC<{ label: string; value: string; sub?: string; strong?: boolean }> = ({ label, value, sub, strong }) => (
  <div className="border-l-2 border-white/25 py-1 pl-2.5">
    <div className="text-[10px] font-bold tracking-[0.1em] text-white/55">{label}</div>
    <div className={`font-mono text-[15px] font-bold tabular-nums leading-tight ${strong ? 'text-[#38bdf8]' : 'text-white'}`}>{value}</div>
    {sub && <div className="font-mono text-[10.5px] text-white/50">{sub}</div>}
  </div>
);

/**
 * Étape « Récupération » : animation plein écran (réticule qui passe d'un bâtiment à l'autre) et, à côté, les calculs réels
 * (`gpsAcquisition.ts`) mis à jour à chaque mesure. Confiance faible → recommencer près d'une fenêtre, ou continuer.
 */
export const GpsAcquisitionView: React.FC<Props> = ({ acq, onContinue, onRetry, onClose }) => {
  const s = acq.summary;
  const done = acq.status === 'done' && s;
  const weak = done && s.confidence === 'faible';

  // Résultat suffisant : on enchaîne seul sur l'identification après un court instant (le temps de voir le verrouillage).
  useEffect(() => {
    if (!done || weak) return;
    const t = setTimeout(() => onContinue(s), 1600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, weak]);

  const progress = Math.min(acq.elapsed / MAX_DURATION_MS, 1);
  const seconds = Math.max(0, Math.ceil((MAX_DURATION_MS - acq.elapsed) / 1000));
  const title =
    acq.status === 'error' ? 'Position introuvable' : done ? (weak ? 'Précision insuffisante' : 'Position verrouillée') : s ? 'Mesures en cours…' : 'Recherche du signal GPS…';

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden bg-[#0b1220] font-sans text-white">
      <ScanAnimation locked={!!done || acq.status === 'error'} lockColor={acq.status === 'error' || weak ? WEAK : OK} />
      {/* Voile pour la lisibilité des calculs à gauche et des actions en bas */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-[58%] bg-gradient-to-r from-[#0b1220]/90 via-[#0b1220]/55 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-[#0b1220] to-transparent" />

      <div className="absolute inset-x-0 top-0 flex items-center gap-3 px-4 pt-5">
        <button type="button" onClick={onClose} aria-label="Fermer" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur">
          <Ico name="x" />
        </button>
        <div className="flex h-8 items-center rounded-full bg-white/10 px-3 text-[12.5px] font-bold backdrop-blur">Adresse · 2 sur 5 · Récupération</div>
      </div>

      {/* Colonne des calculs, à côté de l'animation */}
      <div className="absolute left-4 top-[84px] w-[46%] max-w-[210px]">
        <h1 className="text-[19px] font-bold leading-tight" role="status">
          {title}
        </h1>
        {acq.status === 'error' ? (
          <p className="mt-2 text-[13.5px] font-medium leading-snug text-white/75">{acq.error}</p>
        ) : (
          <div className="mt-3 flex flex-col gap-1.5">
            <Row label="MESURES GPS" value={s ? String(s.received) : '0'} sub={!s ? 'en attente…' : s.rejected > 0 ? `${s.rejected} écartée${s.rejected > 1 ? 's' : ''}` : 'aucune écartée'} />
            <Row label="PRÉCISION RETENUE" value={s ? `±${fmtM(s.accuracy)} m` : '—'} sub={`objectif ±${TARGET_ACCURACY_M} m`} strong />
            <Row label="MEILLEURE MESURE" value={s ? `±${fmtM(s.bestAccuracy)} m` : '—'} />
            <Row label="DISPERSION" value={s ? `${fmtM(s.dispersion)} m` : '—'} sub="écart-type" />
            <Row label="LATITUDE" value={s ? fmtCoord(s.position[1]) : '—'} />
            <Row label="LONGITUDE" value={s ? fmtCoord(s.position[0]) : '—'} sub={s ? 'moyenne pondérée' : undefined} />
            <Row label="CONFIANCE" value={s ? CONFIDENCE_LABELS[s.confidence] : '—'} />
          </div>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 px-5 pb-[max(20px,env(safe-area-inset-bottom))]">
        {acq.status === 'error' && acq.help && (
          <div className="mb-3 max-h-[40dvh] overflow-y-auto rounded-2xl bg-white/10 px-4 py-3 backdrop-blur" role="note" aria-label="Comment activer la localisation">
            <div className="text-[14px] font-bold text-white">{acq.help.title}</div>
            <ol className="mt-2 flex list-none flex-col gap-2 p-0">
              {acq.help.steps.map((st, i) => (
                <li key={st} className="flex gap-2.5 text-[13.5px] font-medium leading-snug text-white/85">
                  <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20 text-[11px] font-bold">{i + 1}</span>
                  <span>{st}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
        {weak && (
          <p className="mb-3 rounded-2xl bg-[#f5a524]/15 px-4 py-3 text-[14px] font-semibold leading-snug text-[#fcd38a]">
            Votre position n’est connue qu’à ±{Math.round(s.accuracy)} m. Approchez-vous d’une fenêtre et recommencez pour un résultat plus solide.
          </p>
        )}
        {acq.status === 'error' || weak ? (
          <>
            <button
              type="button"
              onClick={onRetry}
              className="flex h-[56px] w-full items-center justify-center rounded-[18px] bg-blue text-[16px] font-bold text-white active:opacity-80"
            >
              Recommencer
            </button>
            {weak ? (
              <button type="button" onClick={() => onContinue(s)} className="mt-1 flex h-12 w-full items-center justify-center text-[15px] font-bold text-white/70">
                Continuer quand même
              </button>
            ) : (
              <button type="button" onClick={onClose} className="mt-1 flex h-12 w-full items-center justify-center text-[15px] font-bold text-white/70">
                Fermer
              </button>
            )}
          </>
        ) : (
          <div>
            <div className="h-[5px] overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-[#38bdf8] transition-[width] duration-200" style={{ width: `${(done ? 1 : progress) * 100}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-[13px] font-semibold text-white/70">
              <span>{done ? 'Passage à la vue satellite…' : 'Restez immobile, près d’une fenêtre.'}</span>
              {!done && <span className="tabular-nums">{seconds} s</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
