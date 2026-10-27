'use client';
import React, { useEffect, useState } from 'react';

/**
 * Animation vectorielle plein écran de la récupération (croquis du fondateur) : contours de bâtiments un peu partout,
 * lignes de précision en « + » avec un petit cercle au centre, qui se déplacent d'un bâtiment à l'autre puis se verrouillent.
 * Purement illustrative : les chiffres réels sont affichés à côté (`GpsAcquisitionView`).
 */

const W = 400;
const H = 800;

/** Contours stylisés (repère 400 × 800), dessinés une fois pour toutes. */
const SHAPES: { d: string; cx: number; cy: number }[] = [
  { d: 'M60 120 h70 v45 h-70 z', cx: 95, cy: 142 },
  { d: 'M150 90 h40 v30 h25 v40 h-65 z', cx: 180, cy: 125 },
  { d: 'M270 110 h80 v60 h-80 z', cx: 310, cy: 140 },
  { d: 'M40 240 h55 v70 h-55 z', cx: 67, cy: 275 },
  { d: 'M120 230 h60 v35 h-25 v35 h-35 z', cx: 148, cy: 258 },
  { d: 'M235 250 h90 v55 h-90 z', cx: 280, cy: 277 },
  { d: 'M330 330 h45 v60 h-45 z', cx: 352, cy: 360 },
  { d: 'M70 380 h75 v55 h-75 z', cx: 107, cy: 407 },
  { d: 'M175 370 h70 v30 h-30 v45 h-40 z', cx: 205, cy: 400 },
  { d: 'M265 420 h55 v50 h-55 z', cx: 292, cy: 445 },
  { d: 'M45 500 h65 v40 h-65 z', cx: 77, cy: 520 },
  { d: 'M150 495 h50 v65 h-50 z', cx: 175, cy: 527 },
  { d: 'M240 520 h85 v45 h-85 z', cx: 282, cy: 542 },
  { d: 'M80 620 h60 v50 h-60 z', cx: 110, cy: 645 },
  { d: 'M200 610 h45 v35 h30 v35 h-75 z', cx: 232, cy: 640 },
  { d: 'M300 630 h60 v55 h-60 z', cx: 330, cy: 657 },
];
/** Ordre de visite du réticule (le dernier est celui du « verrouillage », au centre). */
const TOUR = [2, 9, 4, 13, 6, 0, 11, 5, 15, 3, 8];
const LOCK = 8;

interface Props {
  /** Fin de la récupération : le réticule se pose sur le bâtiment central et se verrouille. */
  locked: boolean;
  /** Couleur du verrouillage (confiance suffisante ou non). */
  lockColor: string;
}

export const ScanAnimation: React.FC<Props> = ({ locked, lockColor }) => {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (locked) return;
    const t = setInterval(() => setI((n) => (n + 1) % TOUR.length), 1700);
    return () => clearInterval(t);
  }, [locked]);

  const target = SHAPES[locked ? LOCK : TOUR[i]];
  const accent = locked ? lockColor : '#38bdf8';

  return (
    <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {/* Trame et routes */}
      <g stroke="#ffffff" strokeOpacity={0.06}>
        {Array.from({ length: 11 }, (_, k) => (
          <line key={`v${k}`} x1={k * 40} y1={0} x2={k * 40} y2={H} />
        ))}
        {Array.from({ length: 21 }, (_, k) => (
          <line key={`h${k}`} x1={0} y1={k * 40} x2={W} y2={k * 40} />
        ))}
      </g>
      <path d="M-20 210 C 120 200, 230 330, 420 300" fill="none" stroke="#ffffff" strokeOpacity={0.14} strokeWidth={14} />
      <path d="M215 -20 C 205 250, 250 480, 230 820" fill="none" stroke="#ffffff" strokeOpacity={0.1} strokeWidth={11} />
      <path d="M-20 590 C 140 575, 260 600, 420 585" fill="none" stroke="#ffffff" strokeOpacity={0.1} strokeWidth={9} />

      {/* Contours de bâtiments ; celui visé s'allume */}
      {SHAPES.map((s, k) => {
        const on = s === target;
        return (
          <path
            key={k}
            d={s.d}
            fill={on ? accent : '#ffffff'}
            fillOpacity={on ? 0.16 : 0.03}
            stroke={on ? accent : '#ffffff'}
            strokeOpacity={on ? 1 : 0.4}
            strokeWidth={on ? 2 : 1.1}
            className="transition-[fill-opacity,stroke-opacity] duration-500"
          />
        );
      })}

      {/* Réticule : lignes en « + », petit cercle, arc tournant et crochets ; il glisse d'un bâtiment à l'autre */}
      <g
        style={{ transform: `translate(${target.cx}px, ${target.cy}px)`, transition: 'transform 1.1s cubic-bezier(.6,.05,.3,1)' }}
        className="motion-reduce:!transition-none"
      >
        <g stroke={accent} strokeWidth={1.2} strokeOpacity={0.85}>
          <line x1={-900} y1={0} x2={-16} y2={0} />
          <line x1={16} y1={0} x2={900} y2={0} />
          <line x1={0} y1={-1700} x2={0} y2={-16} />
          <line x1={0} y1={16} x2={0} y2={1700} />
          {[-80, -60, -40, 40, 60, 80].map((t) => (
            <g key={t}>
              <line x1={t} y1={-4} x2={t} y2={4} />
              <line x1={-4} y1={t} x2={4} y2={t} />
            </g>
          ))}
        </g>
        <circle r={11} fill="none" stroke={accent} strokeWidth={2} />
        <circle r={2.5} fill={accent} />
        {!locked && (
          <g className="motion-safe:animate-[spin_2.2s_linear_infinite]">
            <path d="M 0 -26 A 26 26 0 0 1 22.5 13" fill="none" stroke={accent} strokeWidth={2} strokeLinecap="round" />
          </g>
        )}
        <g fill="none" stroke={accent} strokeWidth={2.2} className={locked ? '' : 'motion-safe:animate-pulse'}>
          <path d="M-48 -34 v-14 h14" />
          <path d="M48 -34 v-14 h-14" />
          <path d="M-48 34 v14 h14" />
          <path d="M48 34 v14 h-14" />
        </g>
      </g>
    </svg>
  );
};
