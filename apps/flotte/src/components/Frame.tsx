'use client';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { formatGnf } from '@hailandx/commerce';
import { AppMark } from '@hailandx/ui';
import { Ico } from './Icons';

/**
 * Cadre commun des écrans de Flotte (maquettes v5 F1–F8 et P).
 * Téléphone : carte plein écran, barre flottante en haut, panneau qui monte du bas.
 * Ordinateur (≥ 1024 px, jamais utilisé pour une mission mais doit rester propre) : panneau fixe à gauche, carte à droite.
 */
export const PANEL_W = 420;
export const MAP_AREA = 'absolute inset-0 lg:left-[420px]';
export const TOP_BAR = 'absolute inset-x-0 top-0 z-20 mx-auto flex max-w-md flex-col gap-2 px-3.5 pt-[max(14px,env(safe-area-inset-top))] lg:left-[420px] lg:max-w-lg';
export const SHEET = 'absolute inset-x-0 bottom-0 z-20 mx-auto flex max-h-[64dvh] max-w-md flex-col gap-3.5 overflow-y-auto rounded-t-[28px] border-t border-night-line bg-night-card px-[18px] pb-[max(22px,env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-14px_34px_rgba(0,0,0,.5)] lg:inset-y-0 lg:right-auto lg:mx-0 lg:w-[420px] lg:max-w-none lg:max-h-none lg:rounded-none lg:border-r lg:border-t-0 lg:px-6 lg:pt-6 lg:shadow-none';
export const CTA = 'flex h-14 w-full shrink-0 items-center justify-center gap-2.5 rounded-[18px] bg-lime text-[16px] font-extrabold text-ink disabled:opacity-40';
export const GHOST = 'flex h-14 w-full shrink-0 items-center justify-center gap-2.5 rounded-[18px] border border-night-line bg-night text-[15px] font-extrabold disabled:opacity-40';
export const FLOAT_BTN = 'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-night-line bg-night-card/95 shadow-[0_6px_18px_rgba(0,0,0,.35)]';
export const CARD = 'rounded-[18px] border border-night-line bg-night';
export const WARN = 'flex items-center gap-2.5 rounded-2xl border border-[#4a3f17] bg-[#2a2412] px-3.5 py-3 text-[13px] font-bold text-[#f3dc8a]';

/** Vrai sur grand écran : le panneau est à gauche, il ne masque plus le bas de la carte. */
export function useWide(): boolean {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const q = window.matchMedia('(min-width: 1024px)');
    const on = () => setWide(q.matches);
    on(); q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);
  return wide;
}

/** Poignée du panneau (téléphone) et en-tête du panneau (ordinateur). */
export function SheetHead() {
  return (
    <>
      <span aria-hidden="true" className="mx-auto mb-0.5 h-1 w-10 shrink-0 rounded-full bg-[#39415e] lg:hidden" />
      <span className="hidden items-center gap-3 pb-2 lg:flex"><AppMark app="flotte" size={40} /><span className="font-display text-[18px] font-semibold">Hailand <span className="text-lime">Flotte</span></span></span>
    </>
  );
}

export function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <span className={`flex min-w-0 flex-1 flex-col gap-1 rounded-2xl border border-night-line bg-night px-3 py-3`}>
      <span className="text-[11.5px] font-bold text-night-muted">{label}</span>
      <span className={`truncate font-display text-[16.5px] font-semibold ${accent ? 'text-lime' : ''}`}>{value}</span>
    </span>
  );
}

/** Lettre d'arrêt : R (retrait, carré blanc) ou D (dépôt, rond vert). */
export function StopBadge({ letter, size = 26 }: { letter: 'R' | 'D'; size?: number }) {
  return <span style={{ width: size, height: size }} className={`flex shrink-0 items-center justify-center text-[13px] font-extrabold text-ink ${letter === 'D' ? 'rounded-full bg-lime' : 'rounded-[8px] bg-white'}`}>{letter}</span>;
}

export interface MenuCourier { full_name: string; vehicle: string; cash_balance_gnf: number }
const VEHICULE: Record<string, string> = { moto: 'Moto', velo: 'Vélo', voiture: 'Voiture', pied: 'À pied' };

/** Menu du livreur (maquette F8) : livraisons et gains, aide, déconnexion. */
export function Menu({ courier, onClose, onSignOut }: { courier: MenuCourier; onClose: () => void; onSignOut: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  const item = 'flex items-center gap-3.5 border-b border-night-line py-3.5 text-left';
  const Line = ({ icon, label, sub }: { icon: ReactNode; label: string; sub?: string }) => (
    <><span className="text-night-text">{icon}</span><span className="flex min-w-0 flex-1 flex-col"><span className="text-[15px] font-extrabold">{label}</span>{sub && <span className="truncate text-[12px] font-semibold text-night-muted">{sub}</span>}</span><span className="text-night-muted">{Ico.chevron(18)}</span></>
  );
  return (
    <div className="fixed inset-0 z-50">
      <button type="button" aria-label="Fermer le menu" onClick={onClose} className="absolute inset-0 bg-[#070b16]/60" />
      <nav aria-label="Menu" className="absolute inset-y-0 left-0 flex w-[min(320px,86vw)] flex-col border-r border-night-line bg-night-card px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-[max(22px,env(safe-area-inset-top))]">
        <div className="flex items-center gap-3 pb-4">
          <AppMark app="flotte" size={44} />
          <span className="flex min-w-0 flex-1 flex-col"><span className="truncate font-display text-[17px] font-semibold">{courier.full_name}</span><span className="text-[12.5px] font-bold text-night-muted">Livreur Hailand · {VEHICULE[courier.vehicle] ?? courier.vehicle}</span></span>
          <button type="button" onClick={onClose} aria-label="Fermer" className="flex h-10 w-10 items-center justify-center rounded-xl text-night-muted">{Ico.close(20)}</button>
        </div>
        <Link href="/livraisons" className={item} onClick={onClose}><Line icon={Ico.route(20)} label="Mes livraisons" sub="Historique et gains" /></Link>
        <Link href="/livraisons#especes" className={item} onClick={onClose}><Line icon={Ico.wallet(20)} label="Espèces à reverser" sub={formatGnf(courier.cash_balance_gnf)} /></Link>
        <Link href="/aide" className={item} onClick={onClose}><Line icon={Ico.help(20)} label="Aide" sub="Client absent, colis refusé, problème de code…" /></Link>
        <button type="button" onClick={onSignOut} className="flex items-center gap-3.5 py-3.5 text-left text-[15px] font-extrabold text-[#ffb4a8]">{Ico.logout(20)}Se déconnecter</button>
        <span className="mt-auto text-[12px] font-semibold leading-relaxed text-night-muted">Nom ou moyen de transport à corriger : demandez à l’équipe Hailand.</span>
      </nav>
    </div>
  );
}
