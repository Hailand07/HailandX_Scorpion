'use client';
import React from 'react';
import { Ico } from './ui';

interface Props {
  /** Titre et texte d'introduction (client : « Où livrer ? » ; vendeur : « Où est votre boutique ? »). */
  title: string;
  intro: string;
  /** Petite ligne au-dessus du titre (« Commande · étape 2 », « Ouvrir ma boutique · 2 sur 4 »). */
  kicker?: string;
  /** Encadré propre à l'application (ex. « Vente ouverte au niveau 3 »). */
  aside?: React.ReactNode;
  startLabel?: string;
  onStart: () => void;
  onClose: () => void;
}

const TIPS = [
  { icon: 'house', title: 'Restez dans le bâtiment', text: 'Placez-vous à l’intérieur du bâtiment à enregistrer.' },
  { icon: 'window', title: 'Approchez-vous d’une fenêtre', text: 'Le signal GPS traverse mal les murs : près d’une fenêtre, la position est bien plus précise.' },
  { icon: 'phone', title: 'Ne bougez plus', text: 'Gardez le téléphone immobile pendant la récupération (15 secondes au plus).' },
];
const STEPS = [
  { icon: 'scan', label: 'Plusieurs mesures GPS' },
  { icon: 'building', label: 'Votre bâtiment trouvé sur la vue satellite' },
  { icon: 'hand', label: 'Vous validez, ou vous montrez le bon bâtiment' },
];

/** Écran d'entrée de l'enregistrement guidé (repris de NavigationX, maquette v9 « AdrGuide ») : comment s'y prendre. */
export const RegistrationGuide: React.FC<Props> = ({ title, intro, kicker, aside, startLabel = 'Je suis prêt, localiser', onStart, onClose }) => (
  <div className="fixed inset-0 z-[60] mx-auto flex max-w-md flex-col bg-bg font-sans text-ink">
    <div className="flex items-center justify-between px-5 pt-5">
      <button type="button" onClick={onClose} aria-label="Fermer" className="flex h-11 w-11 items-center justify-center rounded-full bg-card shadow-[0_2px_8px_rgba(0,0,0,0.08)]"><Ico name="x" /></button>
      <span className="text-[12.5px] font-bold tracking-[0.06em] text-muted">{kicker ?? 'ENREGISTREMENT GUIDÉ'}</span>
      <span className="w-11" />
    </div>
    <div className="flex-1 overflow-y-auto px-6 pb-4 pt-6">
      <h1 className="font-display text-[26px] font-semibold leading-tight tracking-[-0.02em]">{title}</h1>
      <p className="mt-2 text-[15px] font-medium leading-snug text-muted">{intro}</p>
      <ol className="mt-5 flex flex-col gap-3">
        {TIPS.map((t, i) => (
          <li key={t.title} className="flex gap-3.5 rounded-[20px] bg-card p-4 shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-soft text-blue-ink">
              <Ico name={t.icon} size={22} />
              <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-[11px] font-bold text-white">{i + 1}</span>
            </div>
            <div><div className="text-[15.5px] font-bold">{t.title}</div><p className="mt-0.5 text-[13.5px] font-medium leading-snug text-muted">{t.text}</p></div>
          </li>
        ))}
      </ol>
      <div className="mt-6 text-[12px] font-bold tracking-[0.07em] text-muted">CE QUI VA SE PASSER</div>
      <ul className="mt-2 flex flex-col gap-2.5">
        {STEPS.map((s) => (
          <li key={s.label} className="flex items-center gap-3 text-[14px] font-semibold">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line text-muted"><Ico name={s.icon} size={17} /></span>{s.label}
          </li>
        ))}
      </ul>
      {aside && <div className="mt-5">{aside}</div>}
    </div>
    <div className="px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-2">
      <button type="button" onClick={onStart} className="flex h-[58px] w-full items-center justify-center gap-2.5 rounded-[18px] bg-blue text-[16.5px] font-bold text-white active:opacity-80">
        {startLabel}<Ico name="chevron" size={20} stroke={2.6} />
      </button>
    </div>
  </div>
);
