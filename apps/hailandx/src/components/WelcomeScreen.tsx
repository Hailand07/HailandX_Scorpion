'use client';
import Link from 'next/link';
import { Wordmark } from '@hailandx/ui';
import { FLOTTE_URL, VENDEUR_URL } from '@/lib/links';

const POINTS = [
  ['Vendeurs certifiés', 'Chaque boutique est liée à une adresse vérifiée par Hailand.'],
  ['Livré à votre porte', 'La Flotte Hailand vous trouve à l’adresse exacte, sans explication.'],
  ['Payé à la remise', 'Votre argent reste en séquestre jusqu’à ce que vous receviez le colis.'],
] as const;

/** Écran d'ouverture : présente HailandX en trois phrases et oriente vers les trois usages (acheter, vendre, livrer). */
export function WelcomeScreen({ onClose }: { onClose?: () => void }) {
  const go = () => onClose?.();
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-night px-6 pb-[max(28px,env(safe-area-inset-bottom))] pt-[max(28px,env(safe-area-inset-top))] text-night-text">
      <div aria-hidden="true" className="hx-glow pointer-events-none absolute -right-24 -top-24 h-[420px] w-[420px] rounded-full" />
      <div aria-hidden="true" className="hx-glow2 pointer-events-none absolute -bottom-32 -left-28 h-[360px] w-[360px] rounded-full" />
      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="hx-rise flex flex-1 flex-col justify-center gap-5 pt-4">
          <span className="hx-rise-1 inline-flex w-fit items-center gap-2 rounded-full border border-night-line bg-night-card px-3 py-1.5 text-[12px] font-bold text-night-muted">
            <span className="h-2 w-2 rounded-full bg-lime" /> Guinée · bientôt dans votre quartier
          </span>
          <h1 className="hx-rise-2 font-display text-[44px] font-bold leading-[1.02] tracking-[-0.04em]">
            <span className="text-night-text">Hailand</span><span className="text-lime">X</span>
            <span className="mt-3 block text-[26px] font-semibold leading-tight tracking-[-0.02em] text-night-text">La place du marché, <span className="text-lime">adressée.</span></span>
          </h1>
          <p className="hx-rise-3 max-w-[34ch] text-[15.5px] font-medium leading-relaxed text-night-muted">Achetez auprès de vendeurs vérifiés. Recevez chez vous, à l’adresse exacte, par la Flotte Hailand.</p>
          <ul className="hx-rise-4 flex flex-col gap-2">
            {POINTS.map(([t, d]) => (
              <li key={t} className="flex items-start gap-3 rounded-2xl border border-night-line bg-night-card px-4 py-3">
                <span aria-hidden="true" className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-lime text-[13px] font-extrabold text-ink">✓</span>
                <span className="flex flex-col"><span className="text-[14px] font-extrabold">{t}</span><span className="text-[12.5px] font-medium text-night-muted">{d}</span></span>
              </li>
            ))}
          </ul>
        </div>
        <div className="hx-rise-5 flex flex-col gap-2.5 pt-6">
          <Link href="/" onClick={go} className="flex h-[56px] items-center justify-center rounded-2xl bg-lime text-[16px] font-extrabold text-ink active:opacity-80">Explorer la rue</Link>
          <a href={VENDEUR_URL} onClick={go} className="flex h-[56px] items-center justify-center rounded-2xl border border-night-line bg-night-card text-[15.5px] font-extrabold active:opacity-80">Vendre : HailandX Vendeur ↗</a>
          <a href={FLOTTE_URL} className="flex h-12 items-center justify-center text-[14px] font-bold text-night-muted">Je veux livrer avec la Flotte Hailand →</a>
          <div className="flex justify-center pt-1 opacity-70"><Wordmark className="text-[15px] text-night-muted" /></div>
        </div>
      </div>
    </div>
  );
}
