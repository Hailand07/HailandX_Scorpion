'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Wordmark } from '@hailandx/ui';
import { formatGnPhone, normalizeGnPhone } from '@hailandx/commerce';
import { APP_COURANTE, browserClient } from './supabase';
import { Icon } from './Screen';
import { passageEchoue } from './passage';
import { estNouveau, lignesResume, origineTexte, telMasque, type CompteResume } from './compte';

/**
 * Connexion « Compte Hailand », identique dans toutes les applications (maquettes v4, K1 à K4) :
 * numéro → code SMS → « Ce numéro a déjà un compte Hailand » (avec ce que le compte contient déjà) ou « Compte Hailand créé »
 * (prénom et nom demandés une seule fois, pour toutes les applications). On ne dit qu'APRÈS le code si un numéro est inscrit :
 * personne ne peut deviner qui a un compte.
 */
type Tone = 'clair' | 'nuit';
const T = {
  clair: {
    muted: 'text-muted', field: 'border-line bg-card', cta: 'bg-ink text-white', link: 'text-blue-ink', card: 'border-line-soft bg-card',
    chip: 'border-line bg-card', soft: 'bg-ok-soft text-ok', err: 'bg-[#fde8e4] text-[#8a2a1c]', info: 'bg-blue-soft text-blue-ink',
  },
  nuit: {
    muted: 'text-night-muted', field: 'border-night-line bg-night-card', cta: 'bg-lime text-ink', link: 'text-lime', card: 'border-night-line bg-night-card',
    chip: 'border-night-line bg-night-card', soft: 'bg-[#16301f] text-lime', err: 'bg-[#3a1a1a] text-[#ffb4a8]', info: 'bg-night-card text-lime',
  },
} as const;

type Step = 'numero' | 'code' | 'existant' | 'nom';

function Form({ defaultNext, brand, tone }: { defaultNext: string; brand?: ReactNode; tone: Tone }) {
  const t = T[tone];
  const router = useRouter();
  const nextParam = useSearchParams().get('next');
  const next = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : defaultNext;
  const [step, setStep] = useState<Step>('numero');
  const [phone, setPhone] = useState('');
  const [e164, setE164] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [nouveau, setNouveau] = useState(false);
  const [nom, setNom] = useState({ prenom: '', nom: '' });
  const [compte, setCompte] = useState<{ nom: string; tel: string; origine: string; resume: CompteResume | null } | null>(null);
  const [echec, setEchec] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setEchec(passageEchoue()); }, []);
  useEffect(() => { if (cooldown <= 0) return; const id = setTimeout(() => setCooldown((c) => c - 1), 1000); return () => clearTimeout(id); }, [cooldown]);
  useEffect(() => { if (step !== 'code') return; const id = setTimeout(() => codeRef.current?.focus(), 80); return () => clearTimeout(id); }, [step]);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    const n = e164 && step === 'code' ? e164 : normalizeGnPhone(phone);
    if (!n) return setError('Entrez un numéro guinéen valide, par exemple 6xx xx xx xx.');
    const sb = browserClient();
    if (!sb) return setError('Connexion indisponible : la base n’est pas configurée.');
    setBusy(true);
    const { error: err } = await sb.auth.signInWithOtp({ phone: n });
    setBusy(false);
    if (err) return setError(/rate|too many/i.test(err.message) ? 'Trop de demandes. Patientez une minute avant de réessayer.' : 'Le code n’a pas pu être envoyé. Réessayez dans un instant.');
    setE164(n); setCode(''); setCooldown(45); setStep('code');
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const sb = browserClient();
    if (!sb || !e164) return;
    setBusy(true);
    const { data, error: err } = await sb.auth.verifyOtp({ phone: e164, token: code.trim(), type: 'sms' });
    if (err || !data.user) { setBusy(false); return setError('Code incorrect ou expiré. Vérifiez-le ou demandez-en un nouveau.'); }
    const u = data.user;
    const meta = (u.user_metadata ?? {}) as { full_name?: string; first_name?: string; last_name?: string; origine?: string };
    const { data: resume } = await sb.rpc('fn_compte_resume');
    setBusy(false);
    setNouveau(estNouveau(u.created_at));
    setCompte({ nom: meta.full_name ?? '', tel: telMasque(u.phone), origine: origineTexte(meta.origine), resume: (resume as CompteResume | null) ?? null });
    if (meta.full_name?.trim()) setStep('existant');
    else { setNom({ prenom: meta.first_name ?? '', nom: meta.last_name ?? '' }); setStep('nom'); }
  }

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    const sb = browserClient();
    if (!sb) return;
    const prenom = nom.prenom.trim();
    const famille = nom.nom.trim();
    if (!prenom) return setError('Indiquez au moins votre prénom.');
    setBusy(true); setError(null);
    const data: Record<string, string> = { full_name: [prenom, famille].filter(Boolean).join(' '), first_name: prenom, last_name: famille };
    if (nouveau) data.origine = APP_COURANTE;
    const { error: err } = await sb.auth.updateUser({ data });
    setBusy(false);
    if (err) return setError('Votre nom n’a pas pu être enregistré. Réessayez.');
    router.replace(next);
  }

  const input = `h-14 w-full rounded-2xl border px-4 text-[16px] font-semibold outline-none ${t.field}`;
  const cta = `flex h-[54px] w-full items-center justify-center rounded-2xl text-[15px] font-extrabold disabled:opacity-40 ${t.cta}`;
  const lignes = lignesResume(compte?.resume ?? null);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-5 pb-10 pt-8">
      <Link href="/" aria-label="Accueil">{brand ?? <Wordmark />}</Link>

      {step === 'numero' && (
        <form onSubmit={sendCode} className="flex flex-1 flex-col gap-5">
          {echec && <p role="status" className={`rounded-2xl px-4 py-3 text-[13.5px] font-semibold ${t.info}`}>Le passage depuis l’autre application a expiré. Entrez votre numéro : c’est le même compte, vous retrouverez tout.</p>}
          <div className="flex flex-col gap-1.5">
            <span className={`text-[12px] font-extrabold uppercase tracking-[0.08em] ${t.muted}`}>Compte Hailand</span>
            <h1 className="font-display text-[26px] font-semibold tracking-tight">Votre numéro suffit</h1>
            <p className={`text-[14px] font-medium leading-relaxed ${t.muted}`}>Un code par SMS, sans mot de passe. Si vous avez déjà utilisé NavigationX ou HailandX, c’est le même compte : vous retrouvez tout.</p>
          </div>
          <label className="flex flex-col gap-1.5 text-[13px] font-bold">
            Numéro de téléphone
            <span className={`flex h-14 items-center gap-2 rounded-2xl border px-4 text-[16px] font-semibold ${t.field}`}>
              <span className={t.muted}>🇬🇳 +224</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel-national" placeholder="6xx xx xx xx" className="h-full min-w-0 flex-1 bg-transparent outline-none" />
            </span>
          </label>
          <div className="flex flex-col gap-2">
            <span className={`text-[12.5px] font-bold ${t.muted}`}>Le même compte dans</span>
            <div className="flex flex-wrap gap-2">
              {['NavigationX', 'HailandX', 'HailandX Vendeur'].map((a) => <span key={a} className={`rounded-full border px-3 py-1.5 text-[12.5px] font-extrabold ${t.chip}`}>{a}</span>)}
            </div>
          </div>
          {error && <p role="alert" className={`rounded-2xl px-4 py-3 text-[13.5px] font-semibold ${t.err}`}>{error}</p>}
          <div className="mt-auto flex flex-col gap-3">
            <button type="submit" disabled={busy || !phone.trim()} className={cta}>{busy ? 'Envoi…' : 'Recevoir le code'}</button>
            <p className={`text-center text-[12px] font-medium ${t.muted}`}>En continuant, vous acceptez les conditions d’utilisation de Hailand.</p>
          </div>
        </form>
      )}

      {step === 'code' && e164 && (
        <form onSubmit={verify} className="flex flex-1 flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <h1 className="font-display text-[26px] font-semibold tracking-tight">Entrez le code reçu</h1>
            <p className={`text-[14px] font-medium ${t.muted}`}>Envoyé par SMS au <b className="font-extrabold">{formatGnPhone(e164)}</b>.</p>
          </div>
          <input ref={codeRef} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" aria-label="Code à 6 chiffres" placeholder="••••••"
            className={`${input} text-center font-display text-[24px] tracking-[0.4em]`} />
          <p className={`text-[13px] font-semibold ${t.muted}`}>
            {cooldown > 0 ? <>Renvoyer le code dans 0:{String(cooldown).padStart(2, '0')}</> : <button type="button" onClick={() => void sendCode()} disabled={busy} className={`font-extrabold ${t.link}`}>Renvoyer le code</button>}
            {' · '}
            <button type="button" onClick={() => { setStep('numero'); setCode(''); setError(null); }} className={`font-extrabold ${t.link}`}>Changer de numéro</button>
          </p>
          <p className={`rounded-2xl px-4 py-3 text-[12.5px] font-semibold ${t.info}`}>Nous ne disons qu’après le code si ce numéro a déjà un compte : personne ne peut deviner qui est inscrit.</p>
          {error && <p role="alert" className={`rounded-2xl px-4 py-3 text-[13.5px] font-semibold ${t.err}`}>{error}</p>}
          <button type="submit" disabled={busy || code.length !== 6} className={`mt-auto ${cta}`}>{busy ? 'Vérification…' : 'Valider'}</button>
        </form>
      )}

      {step === 'existant' && compte && (
        <div className="flex flex-1 flex-col gap-5">
          <span className={`flex h-14 w-14 items-center justify-center rounded-[18px] ${t.soft}`}><Icon name="check" size={26} stroke={2.4} /></span>
          <div className="flex flex-col gap-1.5">
            <h1 className="font-display text-[26px] font-semibold tracking-tight">Ce numéro a déjà un compte Hailand</h1>
            <p className={`text-[14px] font-medium leading-relaxed ${t.muted}`}>Vous êtes connecté. Vos adresses, vos commandes et votre boutique vous suivent dans chaque application Hailand.</p>
          </div>
          <div className={`flex items-center gap-3.5 rounded-[22px] border p-4 ${t.card}`}>
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${t.info}`}><Icon name="user" size={22} /></span>
            <span className="flex min-w-0 flex-col">
              <span className="text-[16px] font-extrabold">{compte.nom}</span>
              <span className={`text-[12.5px] font-bold ${t.muted}`}>{[compte.tel, compte.origine].filter(Boolean).join(' · ')}</span>
            </span>
          </div>
          {lignes.length > 0 && (
            <div className={`flex flex-col gap-2.5 rounded-[22px] border p-4 ${t.card}`}>
              <span className={`text-[11.5px] font-extrabold uppercase tracking-[0.08em] ${t.muted}`}>Déjà sur ce compte</span>
              {lignes.map((l) => <span key={l.texte} className="flex items-center gap-2.5 text-[14px] font-bold"><Icon name={l.icone} size={17} />{l.texte}</span>)}
            </div>
          )}
          <button type="button" onClick={() => router.replace(next)} className={`mt-auto ${cta}`}>Continuer</button>
        </div>
      )}

      {step === 'nom' && (
        <form onSubmit={saveName} className="flex flex-1 flex-col gap-5">
          <span className={`flex h-14 w-14 items-center justify-center rounded-[18px] ${t.soft}`}><Icon name="check" size={26} stroke={2.4} /></span>
          <div className="flex flex-col gap-1.5">
            <h1 className="font-display text-[26px] font-semibold tracking-tight">{nouveau ? 'Compte Hailand créé' : 'Ce numéro a déjà un compte Hailand'}</h1>
            <p className={`text-[14px] font-medium leading-relaxed ${t.muted}`}>
              {nouveau ? 'Il servira dans toutes les applications Hailand. Une seule question, posée une seule fois :' : 'Vous êtes connecté. Il manque seulement votre nom, demandé une seule fois pour toutes les applications :'}
            </p>
          </div>
          <label className="flex flex-col gap-1.5 text-[13px] font-bold">Prénom
            <input value={nom.prenom} onChange={(e) => setNom((n) => ({ ...n, prenom: e.target.value }))} autoComplete="given-name" placeholder="Votre prénom" className={input} />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-bold">Nom
            <input value={nom.nom} onChange={(e) => setNom((n) => ({ ...n, nom: e.target.value }))} autoComplete="family-name" placeholder="Votre nom" className={input} />
          </label>
          <p className={`text-[12.5px] font-semibold ${t.muted}`}>Les autres applications ne vous le redemanderont pas.</p>
          {error && <p role="alert" className={`rounded-2xl px-4 py-3 text-[13.5px] font-semibold ${t.err}`}>{error}</p>}
          <button type="submit" disabled={busy || !nom.prenom.trim()} className={`mt-auto ${cta}`}>{busy ? 'Enregistrement…' : 'Continuer'}</button>
        </form>
      )}
    </main>
  );
}

/** Page de connexion « Compte Hailand » prête à l'emploi : `defaultNext` = où aller après la connexion sans paramètre `next`. */
export function PhoneLogin({ defaultNext = '/', brand, tone = 'clair' }: { defaultNext?: string; brand?: ReactNode; tone?: Tone }) {
  return <Suspense><Form defaultNext={defaultNext} brand={brand} tone={tone} /></Suspense>;
}
