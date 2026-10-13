import * as React from 'react';

/** Composants communs (HailandX et Flotte). Pas d'état : ils se composent dans des composants serveur comme client. */

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'lime' }> = ({ variant = 'primary', className = '', ...rest }) => {
  const styles = {
    primary: 'bg-ink text-white',
    secondary: 'bg-card text-ink border border-line',
    lime: 'bg-lime text-ink',
  }[variant];
  return <button {...rest} className={`inline-flex h-[54px] items-center justify-center rounded-2xl px-7 text-[15px] font-extrabold transition active:opacity-80 disabled:opacity-40 ${styles} ${className}`} />;
};

export const Badge: React.FC<{ tone?: 'ink' | 'lime' | 'blue' | 'ok' | 'sand'; children: React.ReactNode }> = ({ tone = 'sand', children }) => {
  const styles = { ink: 'bg-ink text-white', lime: 'bg-lime text-ink', blue: 'bg-blue-soft text-blue-ink', ok: 'bg-ok-soft text-ok', sand: 'bg-sand text-ink' }[tone];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11.5px] font-extrabold ${styles}`}>{children}</span>;
};

/** Marque « vendeur certifié Hailand » (niveau 3). */
export const VerifiedMark: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#3346f0" role="img" aria-label="Vendeur certifié Hailand">
    <path d="M12 2l2.4 2.1 3.2-.3.9 3.1 2.8 1.6-1 3 1 3-2.8 1.6-.9 3.1-3.2-.3L12 22l-2.4-2.1-3.2.3-.9-3.1L2.7 15.5l1-3-1-3 2.8-1.6.9-3.1 3.2.3z" />
    <path d="m8.5 12 2.5 2.5 4.5-5" stroke="#ffffff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Price: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <span className={`font-display font-semibold tracking-tight ${className}`}>{children}</span>
);

/** Photo d'un produit ou d'une boutique ; sans image, un emplacement coloré. */
export const PhotoSlot: React.FC<{ color: string; className?: string; label?: string; src?: string | null }> = ({ color, className = '', label, src }) =>
  src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={label ?? ''} loading="lazy" decoding="async" className={`w-full object-cover ${className}`} style={{ background: color }} />
  ) : (
    <span className={`flex items-center justify-center ${className}`} style={{ background: color }} role={label ? 'img' : undefined} aria-label={label}>
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(18,20,28,0.32)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <circle cx="9" cy="9" r="2" />
        <path d="m21 15-5-5L5 21" />
      </svg>
    </span>
  );

export const Wordmark: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span className={`font-display text-2xl font-bold tracking-[-0.03em] ${className}`}>
    Hailand<span className="text-blue">X</span>
  </span>
);
