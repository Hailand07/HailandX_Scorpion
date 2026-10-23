import Link from 'next/link';
import type { ReactNode } from 'react';

/** Briques d'écran communes de la v2 (maquettes « Proposition v2 », validées le 2026-10-14). */

const svg = (d: ReactNode, size = 20, stroke = 1.9) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);

export const ICONS = {
  home: <><path d="M3 11 12 3l9 8" /><path d="M5 10v10h14V10" /></>,
  box: <><path d="M21 8 12 3 3 8v8l9 5 9-5z" /><path d="m3 8 9 5 9-5" /><path d="M12 13v8" /></>,
  shop: <><path d="M4 9h16l-1.4-5H5.4z" /><path d="M5 9v11h14V9" /><path d="M10 20v-5h4v5" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  tag: <><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" /><path d="M7.5 7.5h.01" /></>,
  wallet: <><path d="M3 7h18v12H3z" /><path d="M3 11h18" /><path d="M7 15h3" /></>,
  chart: <><path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M22 20H2" /></>,
  star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z" />,
  sliders: <><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" /><path d="M16 4v4M10 10v4M18 16v4" /></>,
  eye: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z" />,
  pin: <><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>,
  bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14" /><path d="M12 17.5h.01" /></>,
  shield: <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  back: <path d="m15 6-6 6 6 6" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  chevron: <path d="m9 6 6 6-6 6" />,
  check: <path d="m5 12 5 5 9-10" />,
  alert: <><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5h.01" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  truck: <><path d="M3 7h13v10H3z" /><path d="M16 10h3l2 3v4h-5" /><circle cx="7" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></>,
  phone: <><rect x="6" y="2" width="12" height="20" rx="3" /><path d="M11 18h2" /></>,
  camera: <><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>,
  mega: <><path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></>,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  percent: <><path d="M19 5 5 19" /><circle cx="7" cy="7" r="2.5" /><circle cx="17" cy="17" r="2.5" /></>,
  image: <><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
  qr: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3" /></>,
  print: <><path d="M6 9V3h12v6" /><rect x="3" y="9" width="18" height="8" rx="2" /><path d="M6 14h12v7H6z" /></>,
  download: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></>,
};

export function Icon({ name, size = 20, stroke = 1.9, className = '' }: { name: keyof typeof ICONS; size?: number; stroke?: number; className?: string }) {
  return <span className={`inline-flex shrink-0 ${className}`}>{svg(ICONS[name], size, stroke)}</span>;
}

/** Page d'écran : fond, largeur de téléphone, place pour la barre du bas. */
export function Screen({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <main className={`mx-auto flex min-h-dvh max-w-md flex-col gap-3.5 px-5 pb-8 pt-4 ${className}`}>{children}</main>;
}

/** En-tête d'une page secondaire : retour, titre, élément à droite. */
export function BackHeader({ href, title, label = 'Retour', right, icon = 'back' }: { href: string; title: string; label?: string; right?: ReactNode; icon?: 'back' | 'close' }) {
  return (
    <header className="-ml-3 flex items-center gap-1">
      <Link href={href} aria-label={label} className="flex h-11 w-11 shrink-0 items-center justify-center"><Icon name={icon} size={22} stroke={2} /></Link>
      <h1 className="min-w-0 flex-1 truncate font-display text-[20px] font-semibold tracking-tight">{title}</h1>
      {right}
    </header>
  );
}

/** Titre de groupe en petites capitales. */
export const GroupTitle = ({ children }: { children: ReactNode }) => <h2 className="mx-1 text-[12.5px] font-extrabold uppercase tracking-[0.05em] text-muted">{children}</h2>;

/** Ligne d'une liste groupée (compte, réglages). */
export function ListRow({ href, icon, label, value, onClick, last }: { href?: string; icon?: keyof typeof ICONS; label: ReactNode; value?: ReactNode; onClick?: () => void; last?: boolean }) {
  const cls = `flex min-h-[58px] w-full items-center gap-3 px-4 text-left ${last ? '' : 'border-b border-[#f0ede6]'}`;
  const body = (
    <>
      {icon && <Icon name={icon} />}
      <span className="min-w-0 flex-1 text-[15px] font-bold">{label}</span>
      {value}
      <Icon name="chevron" size={16} stroke={2} className="text-[#9a9db0]" />
    </>
  );
  return href ? <Link href={href} className={cls}>{body}</Link> : <button type="button" onClick={onClick} className={cls}>{body}</button>;
}

/** Message de retour d'une action (succès ou erreur). */
export function Notice({ msg }: { msg: { tone: 'ok' | 'err'; text: string } | null }) {
  if (!msg) return null;
  return <p role={msg.tone === 'err' ? 'alert' : 'status'} className={`rounded-2xl px-4 py-3 text-[13.5px] font-semibold ${msg.tone === 'err' ? 'bg-[#fde8e4] text-[#8a2a1c]' : 'bg-ok-soft text-ok'}`}>{msg.text}</p>;
}

/** Puces de filtre (onglets) défilant horizontalement. */
export function Chips<T extends string>({ items, value, onChange, label }: { items: { id: T; label: string }[]; value: T; onChange: (id: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-0.5 [scrollbar-width:none]">
      {items.map((it) => (
        <button key={it.id} type="button" role="tab" aria-selected={it.id === value} onClick={() => onChange(it.id)}
          className={`h-[38px] shrink-0 rounded-full px-3.5 text-[13px] font-extrabold ${it.id === value ? 'bg-ink text-white' : 'border border-line bg-card'}`}>{it.label}</button>
      ))}
    </div>
  );
}

/** Contrôle segmenté (deux ou trois choix de même poids). */
export function Segmented<T extends string>({ items, value, onChange, label, dark = false }: { items: { id: T; label: string }[]; value: T; onChange: (id: T) => void; label: string; dark?: boolean }) {
  return (
    <div role="tablist" aria-label={label} className={`grid gap-1 rounded-[14px] p-1 ${dark ? 'bg-white/10' : 'bg-[#ebe8e0]'}`} style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((it) => {
        const on = it.id === value;
        return (
          <button key={it.id} type="button" role="tab" aria-selected={on} onClick={() => onChange(it.id)}
            className={`h-9 rounded-[11px] text-[13px] font-extrabold ${on ? (dark ? 'bg-white text-ink' : 'bg-card text-ink shadow-[0_1px_2px_rgba(18,20,28,0.12)]') : dark ? 'text-white/70' : 'text-muted'}`}>{it.label}</button>
        );
      })}
    </div>
  );
}

/** Carte blanche standard. */
export const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => <section className={`rounded-[22px] border border-line-soft bg-card ${className}`}>{children}</section>;

/** Interrupteur accessible (visible / masqué). */
export function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
      className={`flex h-7 w-12 shrink-0 rounded-full p-[3px] transition-colors disabled:opacity-50 ${on ? 'justify-end bg-[#0f7a5c]' : 'justify-start bg-[#d6d1c4]'}`}>
      <span className="block h-[22px] w-[22px] rounded-full bg-white" />
    </button>
  );
}

/** Message d'erreur de la base, sans son préfixe technique (« boutique : … » → « … »). */
export const errText = (e: { message: string } | null | undefined) => (e ? e.message.replace(/^[^:]{0,60}:\s*/, '') : '');
