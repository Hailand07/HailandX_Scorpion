'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { bandeauEnPause, plateforme, type Plateforme } from './plateforme';
import { TONS, type Tone } from './tons';

/**
 * Proposer d'installer l'application sur l'écran d'accueil (§60) : un bandeau discret qu'on peut fermer, une ligne dans le menu, et
 * un guide adapté au téléphone (Android : invitation directe ; iPhone : Partager → « Sur l'écran d'accueil » ; WhatsApp : ouvrir dans
 * le navigateur d'abord). Rien n'est montré quand l'application est déjà ouverte depuis son icône.
 */

interface InvitationInstallation extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

// L'invitation de Chrome n'arrive qu'une fois par page : on la garde ici, partagée par tous les boutons.
let invitation: InvitationInstallation | null = null;
let installee = false;
const abonnes = new Set<() => void>();
const prevenir = () => abonnes.forEach((f) => f());
const sAbonner = (f: () => void) => { abonnes.add(f); return () => { abonnes.delete(f); }; };

/**
 * À placer une fois dans la mise en page de l'application : écoute l'invitation d'installation du navigateur et enregistre le petit
 * service hors connexion (`/sw.js` : page « Pas de connexion » au lieu de l'erreur du navigateur), en production seulement.
 */
export function EcouteInstallation() {
  useEffect(() => {
    const surInvitation = (e: Event) => { e.preventDefault(); invitation = e as InvitationInstallation; prevenir(); };
    const surInstallee = () => { installee = true; invitation = null; prevenir(); };
    window.addEventListener('beforeinstallprompt', surInvitation);
    window.addEventListener('appinstalled', surInstallee);
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) void navigator.serviceWorker.register('/sw.js').catch(() => { /* sans service : rien de grave */ });
    return () => { window.removeEventListener('beforeinstallprompt', surInvitation); window.removeEventListener('appinstalled', surInstallee); };
  }, []);
  return null;
}

function lirePlateforme(): Plateforme {
  if (installee) return 'installee';
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches ?? false;
  const standaloneIos = Boolean((navigator as unknown as { standalone?: boolean }).standalone);
  return plateforme(navigator.userAgent, { standalone, standaloneIos, touchMac: navigator.maxTouchPoints > 1 });
}

/** État de l'installation pour ce téléphone ; `null` tant qu'on ne le sait pas (rendu serveur). */
export function useInstallation() {
  /** Le navigateur a proposé une installation directe (Chrome sur Android ou ordinateur). */
  const directe = useSyncExternalStore(sAbonner, () => invitation !== null, () => false);
  const [p, setP] = useState<Plateforme | null>(null);
  useEffect(() => { setP(lirePlateforme()); return sAbonner(() => setP(lirePlateforme())); }, []);
  /** Ouvre l'invitation du navigateur quand il en a donné une ; sinon `false` (montrer le guide). */
  async function installer(): Promise<boolean> {
    if (!invitation) return false;
    const inv = invitation;
    await inv.prompt();
    const { outcome } = await inv.userChoice;
    invitation = null;
    if (outcome === 'accepted') installee = true;
    prevenir();
    return true;
  }
  return { plateforme: p, directe, installer };
}

/** Guide pas à pas quand le navigateur ne propose pas d'invitation directe (iPhone, WhatsApp, Chrome sans invitation). */
export function GuideInstallation({ nom, tone = 'clair', plateforme: p, onClose }: { nom: string; tone?: Tone; plateforme: Plateforme; onClose: () => void }) {
  const t = TONS[tone];
  const [copie, setCopie] = useState(false);
  const fond = tone === 'nuit' ? 'bg-night-card text-night-text' : 'bg-card text-ink';
  const etape = (n: number, texte: ReactNode) => (
    <li className="flex items-start gap-3"><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold ${t.cta}`}>{n}</span><span className="pt-0.5 text-[14px] font-semibold leading-snug">{texte}</span></li>
  );
  const partager = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Partager" className="mx-0.5 inline align-[-3px]"><path d="M12 3v12" /><path d="m8 7 4-4 4 4" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></svg>;
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <button type="button" aria-label="Fermer" onClick={onClose} className="absolute inset-0 bg-black/45" />
      <div role="dialog" aria-modal="true" aria-label={`Installer ${nom}`} className={`relative flex w-full max-w-md flex-col gap-4 rounded-t-[26px] p-5 pb-[max(20px,env(safe-area-inset-bottom))] sm:rounded-[26px] ${fond}`}>
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-[20px] font-semibold tracking-tight">{p === 'integre' ? 'Ouvrez d’abord le navigateur' : `Installer ${nom}`}</h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className={`-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[18px] font-bold ${t.muted}`}>×</button>
        </div>
        {p === 'integre' ? (
          <>
            <p className={`text-[13.5px] font-medium leading-relaxed ${t.muted}`}>Vous êtes dans le navigateur d’une application (WhatsApp, Facebook…), qui ne permet pas d’installer.</p>
            <ol className="flex flex-col gap-3">
              {etape(1, <>Touchez <b>⋮</b> ou <b>⋯</b> en haut de l’écran, puis <b>« Ouvrir dans le navigateur »</b> (Chrome ou Safari).</>)}
              {etape(2, <>Dans le navigateur, touchez de nouveau <b>« Installer l’application »</b>.</>)}
            </ol>
            <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(location.href); setCopie(true); } catch { /* consignes suffisantes */ } }}
              className={`flex h-12 items-center justify-center rounded-2xl border text-[14px] font-extrabold ${t.field}`}>{copie ? 'Lien copié : collez-le dans le navigateur' : 'Copier le lien de la page'}</button>
          </>
        ) : p === 'ios' ? (
          <ol className="flex flex-col gap-3">
            {etape(1, <>Touchez le bouton <b>Partager</b> {partager} en bas de Safari.</>)}
            {etape(2, <>Faites défiler et touchez <b>« Sur l’écran d’accueil »</b>.</>)}
            {etape(3, <>Touchez <b>« Ajouter »</b> : l’icône {nom} apparaît sur votre écran d’accueil.</>)}
          </ol>
        ) : (
          <ol className="flex flex-col gap-3">
            {etape(1, <>Touchez <b>⋮</b> en haut à droite de Chrome.</>)}
            {etape(2, <>Touchez <b>« Installer l’application »</b> ou <b>« Ajouter à l’écran d’accueil »</b>.</>)}
            {etape(3, <>Confirmez : l’icône {nom} apparaît sur votre écran d’accueil.</>)}
          </ol>
        )}
        <button type="button" onClick={onClose} className={`flex h-12 items-center justify-center rounded-2xl text-[14.5px] font-extrabold ${t.cta}`}>J’ai compris</button>
      </div>
    </div>
  );
}

/** Déclencheur commun : invitation directe si possible, sinon le guide. `render` reçoit l'action ; rien si déjà installée. */
export function Installer({ nom, tone = 'clair', render }: { nom: string; tone?: Tone; render: (ouvrir: () => void) => ReactNode }) {
  const { plateforme: p, installer } = useInstallation();
  const [guide, setGuide] = useState(false);
  if (!p || p === 'installee') return null;
  const ouvrir = () => { void installer().then((fait) => { if (!fait) setGuide(true); }); };
  return <>{render(ouvrir)}{guide && <GuideInstallation nom={nom} tone={tone} plateforme={p} onClose={() => setGuide(false)} />}</>;
}

/**
 * Bandeau « Installez … sur votre téléphone » : discret, avec « Plus tard » (revient après 14 jours).
 * `cle` distingue les applications (une fermeture dans HailandX ne cache pas le bandeau de Vendeur).
 */
export function BandeauInstaller({ nom, cle, texte, tone = 'clair', icone }: { nom: string; cle: string; texte: string; tone?: Tone; icone?: ReactNode }) {
  const t = TONS[tone];
  const k = `hx.installer.ferme.${cle}`;
  const [ferme, setFerme] = useState<boolean | null>(null);
  useEffect(() => { let v: number | null = null; try { const s = localStorage.getItem(k); v = s ? Number(s) : null; } catch { /* stockage indisponible */ } setFerme(bandeauEnPause(v)); }, [k]);
  if (ferme !== false) return null;
  const plusTard = () => { try { localStorage.setItem(k, String(Date.now())); } catch { /* ignoré */ } setFerme(true); };
  return (
    <Installer nom={nom} tone={tone} render={(ouvrir) => (
      <section aria-label={`Installer ${nom}`} className={`flex items-center gap-3 rounded-[20px] border p-3.5 ${t.card}`}>
        {icone && <span className="shrink-0">{icone}</span>}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[14px] font-extrabold leading-tight">Installez {nom} sur votre téléphone</span>
          <span className={`text-[12.5px] font-semibold leading-snug ${t.muted}`}>{texte}</span>
          <span className="mt-1.5 flex gap-2">
            <button type="button" onClick={ouvrir} className={`h-9 rounded-xl px-3.5 text-[13px] font-extrabold ${t.cta}`}>Installer</button>
            <button type="button" onClick={plusTard} className={`h-9 rounded-xl px-2 text-[13px] font-bold ${t.muted}`}>Plus tard</button>
          </span>
        </span>
      </section>
    )} />
  );
}
