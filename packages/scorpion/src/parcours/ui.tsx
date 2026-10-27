import React from 'react';
import type { AddressLevel } from '../levels';

/** Petites icônes du parcours (traits SVG, sans dépendance). */
const P: Record<string, React.ReactNode> = {
  x: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  chevron: <path d="M9 5l7 7-7 7" />,
  house: <><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></>,
  window: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M12 4v16M4 12h16" /></>,
  phone: <><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M11 18.5h2" /></>,
  scan: <><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" /><circle cx="11.5" cy="11.5" r="3.5" /><path d="M14 14l2.5 2.5" /></>,
  building: <><rect x="5" y="3" width="14" height="18" rx="1.5" /><path d="M9 7h2M13 7h2M9 11h2M13 11h2M10 21v-4h4v4" /></>,
  hand: <path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11m0-1V4.5a1.5 1.5 0 0 1 3 0V11m0-4.5a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-1a6 6 0 0 1-4.6-2.2L4 15.5a1.6 1.6 0 0 1 2.4-2.1L8 15" />,
};
export const Ico: React.FC<{ name: keyof typeof P | string; size?: number; stroke?: number; className?: string }> = ({ name, size = 20, stroke = 2, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>{P[name]}</svg>
);

const PILL: Record<AddressLevel, string> = { 1: 'bg-[#fde8e4] text-[#a3321f]', 2: 'bg-amber-soft text-[#7a5500]', 3: 'bg-ok-soft text-ok' };
const TEXT: Record<AddressLevel, string> = { 1: 'Niveau 1', 2: 'Niveau 2', 3: 'Niveau 3' };

/** Pastille de niveau (même règle que NavigationX : 3 = bâtiment certifié Hailand). */
export const LevelBadge: React.FC<{ level: AddressLevel; text?: string }> = ({ level, text }) => (
  <span className={`inline-flex h-[30px] items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[13px] font-extrabold ${PILL[level]}`}>
    {level === 3 && <Ico name="check" size={13} stroke={3} />}
    {text ?? TEXT[level]}
  </span>
);
