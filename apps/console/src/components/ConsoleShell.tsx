'use client';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { browserClient, Icon, ICONS, useSession, signOutHailand } from '@hailandx/kit';
import { phoneText } from '@/lib/format';

/** Chiffres de la vue d'ensemble (fn_console_overview) : servent aussi aux pastilles de la barre latérale. */
export interface Overview {
  orders_today: number; sales_today: number; commission_today: number; couriers_valid: number; couriers_online: number; couriers_pending: number;
  parcels_stuck: number; certifs_pending: number; disputes_open: number; reports_open: number; cash_over_limit: number; shops_open: number;
}

interface Ctx { sb: SupabaseClient; uid: string; role: 'fondateur' | 'operateur'; phone: string | null; overview: Overview | null; refresh: () => Promise<void> }
const ConsoleCtx = createContext<Ctx | null>(null);
/** Accès à la console depuis une page : client Supabase, rôle de la personne connectée, chiffres du jour. */
export function useConsole(): Ctx {
  const c = useContext(ConsoleCtx);
  if (!c) throw new Error('useConsole hors de la console');
  return c;
}

const NAV: { href: string; label: string; icon: keyof typeof ICONS; badge?: (o: Overview) => number }[] = [
  { href: '/', label: 'Vue d’ensemble', icon: 'home' },
  { href: '/certifications', label: 'Certifications', icon: 'shield', badge: (o) => o.certifs_pending },
  { href: '/boutiques', label: 'Boutiques', icon: 'shop' },
  { href: '/livreurs', label: 'Livreurs', icon: 'truck', badge: (o) => o.couriers_pending + o.cash_over_limit },
  { href: '/litiges', label: 'Litiges, avis, questions', icon: 'alert', badge: (o) => o.disputes_open + o.reports_open },
  { href: '/argent', label: 'Argent', icon: 'wallet' },
  { href: '/equipe', label: 'Comptes et équipe', icon: 'user' },
  { href: '/parametres', label: 'Paramètres', icon: 'sliders' },
  { href: '/journal', label: 'Journal', icon: 'clock' },
];

const isActive = (path: string, href: string) => (href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`));

/**
 * Cadre de Hailand Console : réservé à l'équipe (is_admin), rôle fondateur ou opérateur.
 * Barre latérale sur ordinateur, barre défilante en haut sur téléphone.
 */
export function ConsoleShell({ children }: { children: ReactNode }) {
  const path = usePathname() ?? '/';
  const router = useRouter();
  const session = useSession();
  const [sb] = useState(() => browserClient());
  const [access, setAccess] = useState<'chargement' | 'refuse' | 'ok'>('chargement');
  const [role, setRole] = useState<'fondateur' | 'operateur'>('operateur');
  const [overview, setOverview] = useState<Overview | null>(null);

  const refresh = useCallback(async () => {
    if (!sb) return;
    const { data } = await sb.rpc('fn_console_overview');
    const row = Array.isArray(data) ? data[0] : data;
    if (row) setOverview(row as Overview);
  }, [sb]);

  useEffect(() => {
    if (!sb || !session) return;
    void (async () => {
      const { data } = await sb.rpc('fn_console_role');
      if (data !== 'fondateur' && data !== 'operateur') { setAccess('refuse'); return; }
      setRole(data); setAccess('ok'); await refresh();
    })();
  }, [sb, session, refresh]);
  useEffect(() => { if (access !== 'ok') return; const t = setInterval(refresh, 60_000); return () => clearInterval(t); }, [access, refresh]);
  useEffect(() => { if (session === null && path !== '/connexion') router.replace(`/connexion?next=${encodeURIComponent(path)}`); }, [session, path, router]);

  if (path === '/connexion') return <>{children}</>;
  if (!sb) return <Center title="Base non configurée" text="Les variables publiques Supabase manquent sur ce déploiement." />;
  if (session === undefined || session === null || access === 'chargement') return <Center title="Hailand Console" text="Chargement…" />;
  if (access === 'refuse') {
    return (
      <Center title="Réservé à l’équipe Hailand" text="Ce numéro n’a pas accès à la console. Si vous faites partie de l’équipe, demandez au fondateur de vous ajouter.">
        <button type="button" onClick={async () => { await signOutHailand(sb); window.location.replace('/connexion'); }} className="h-12 rounded-2xl border border-line bg-card px-5 text-[14px] font-extrabold">Changer de numéro</button>
      </Center>
    );
  }

  const phone = session.user.phone ?? null;
  return (
    <ConsoleCtx.Provider value={{ sb, uid: session.user.id, role, phone, overview, refresh }}>
      <div className="flex min-h-dvh flex-col lg:flex-row">
        <nav aria-label="Console" className="sticky top-0 z-30 flex shrink-0 flex-col bg-ink text-white lg:h-dvh lg:w-[240px] lg:px-3.5 lg:py-[22px]">
          <div className="flex items-center gap-2.5 px-4 pb-2 pt-3 lg:px-2 lg:pb-[18px] lg:pt-0">
            <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[11px] bg-lime text-ink"><Icon name="shield" size={18} stroke={2.2} /></span>
            <span className="flex flex-col"><span className="font-display text-[16px] font-semibold">Hailand Console</span><span className="text-[11.5px] font-semibold text-night-muted">Équipe Hailand</span></span>
          </div>
          <div className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
            {NAV.map((n) => {
              const on = isActive(path, n.href);
              const b = overview && n.badge ? n.badge(overview) : 0;
              return (
                <Link key={n.href} href={n.href} aria-current={on ? 'page' : undefined}
                  className={`flex h-[42px] shrink-0 items-center gap-2.5 rounded-xl px-3 text-[14px] ${on ? 'bg-lime font-extrabold text-ink' : 'font-bold text-[#c9cede] hover:bg-night-card'}`}>
                  <Icon name={n.icon} size={18} className="hidden lg:block" />
                  <span className="lg:flex-1">{n.label}</span>
                  {b > 0 && <span className={`flex h-[22px] min-w-[22px] items-center justify-center rounded-full px-1.5 text-[11.5px] font-extrabold ${on ? 'bg-ink text-white' : 'bg-night-line text-white'}`}>{b > 99 ? '99+' : b}</span>}
                </Link>
              );
            })}
          </div>
          <div className="mt-auto hidden flex-col gap-0.5 rounded-[14px] bg-night-card p-3 lg:flex">
            <span className="text-[13px] font-extrabold">{phoneText(phone)}</span>
            <span className="text-[11.5px] font-bold text-lime">Rôle : {role === 'fondateur' ? 'fondateur' : 'opérateur'}</span>
            <button type="button" onClick={async () => { await signOutHailand(sb); window.location.replace('/connexion'); }} className="mt-1.5 h-9 self-start rounded-lg text-[12.5px] font-bold text-night-muted hover:text-white">Se déconnecter</button>
          </div>
        </nav>
        <main className="flex min-w-0 flex-1 flex-col gap-5 px-4 py-5 lg:px-8 lg:py-7">{children}</main>
      </div>
    </ConsoleCtx.Provider>
  );
}

function Center({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-start justify-center gap-4 px-6">
      <span className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-ink text-lime"><Icon name="shield" size={26} stroke={2} /></span>
      <h1 className="font-display text-[24px] font-semibold tracking-tight">{title}</h1>
      <p className="text-[14.5px] font-semibold leading-relaxed text-muted">{text}</p>
      {children}
    </main>
  );
}

/** En-tête de page. */
export function PageHead({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-col gap-0.5">
        {sub && <span className="text-[13px] font-bold text-muted">{sub}</span>}
        <h1 className="font-display text-[26px] font-semibold tracking-tight lg:text-[28px]">{title}</h1>
      </div>
      {right}
    </header>
  );
}

/** Bloc blanc arrondi, avec titre facultatif. */
export function Panel({ title, right, children, className = '', label }: { title?: string; right?: ReactNode; children: ReactNode; className?: string; label?: string }) {
  return (
    <section aria-label={label ?? title} className={`rounded-[22px] border border-line-soft bg-card ${className}`}>
      {title && <div className="flex items-center justify-between gap-3 px-[18px] pb-3 pt-4"><h2 className="font-display text-[17px] font-semibold">{title}</h2>{right}</div>}
      {children}
    </section>
  );
}

/** Message de retour après une action (succès ou erreur). */
export function Flash({ msg }: { msg: { tone: 'ok' | 'err'; text: string } | null }) {
  if (!msg) return null;
  return <p role={msg.tone === 'err' ? 'alert' : 'status'} className={`rounded-2xl px-4 py-3 text-[13.5px] font-bold ${msg.tone === 'err' ? 'bg-[#fbeae5] text-[#a3321f]' : 'bg-ok-soft text-ok'}`}>{msg.text}</p>;
}

export const btn = {
  dark: 'inline-flex h-11 items-center justify-center rounded-[14px] bg-ink px-4 text-[13.5px] font-extrabold text-white disabled:opacity-50',
  line: 'inline-flex h-11 items-center justify-center rounded-[14px] border border-line bg-card px-4 text-[13.5px] font-extrabold disabled:opacity-50',
  danger: 'inline-flex h-11 items-center justify-center rounded-[14px] border border-line bg-card px-4 text-[13.5px] font-extrabold text-[#a3321f] disabled:opacity-50',
  small: 'inline-flex h-9 items-center justify-center rounded-[11px] border border-line bg-card px-3 text-[13px] font-extrabold disabled:opacity-50',
};

/** Exécute une action de la console et renvoie le message à afficher. */
export function useAction() {
  const { refresh } = useConsole();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const run = useCallback(async (p: PromiseLike<{ error: { message: string } | null }>, ok: string, after?: () => Promise<void> | void) => {
    setBusy(true); setMsg(null);
    const { error } = await p;
    setMsg(error ? { tone: 'err', text: error.message.replace(/^[^:]{0,60}:\s*/, '') } : { tone: 'ok', text: ok });
    if (!error) { await after?.(); await refresh(); }
    setBusy(false);
    return !error;
  }, [refresh]);
  return { busy, msg, setMsg, run };
}
