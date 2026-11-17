'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Wordmark } from '@hailandx/ui';
import { browserClient } from './supabase';
import { Icon } from './Screen';
import { emailValide, erreurCompte, MDP_MIN, problemeMotDePasse } from './motDePasse';
import { TONS, type Tone } from './tons';

/**
 * Mot de passe oublié (§59) : l'adresse e-mail du compte → un code reçu par e-mail → un nouveau mot de passe.
 * Un code plutôt qu'un lien : il marche même si l'e-mail est ouvert sur un autre appareil.
 * On ne dit jamais si une adresse a un compte (« si un compte utilise cette adresse… »).
 */
export function MotDePasseOublie({ tone = 'clair', brand, backHref = '/connexion', doneHref = '/' }: { tone?: Tone; brand?: ReactNode; backHref?: string; doneHref?: string }) {
  const t = TONS[tone];
  const [step, setStep] = useState<'email' | 'code' | 'fini'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [mdp, setMdp] = useState('');
  const [voir, setVoir] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = `h-14 w-full rounded-2xl border px-4 text-[16px] font-semibold outline-none ${t.field}`;
  const cta = `flex h-[54px] w-full items-center justify-center rounded-2xl text-[15px] font-extrabold disabled:opacity-40 ${t.cta}`;

  async function envoyer(e?: React.FormEvent) {
    e?.preventDefault(); setError(null);
    if (!emailValide(email)) return setError('Adresse e-mail invalide.');
    const sb = browserClient(); if (!sb) return setError('Service indisponible pour le moment.');
    setBusy(true);
    const { error: err } = await sb.auth.resetPasswordForEmail(email.trim());
    setBusy(false);
    if (err && /rate|too many|security/i.test(err.message)) return setError(erreurCompte(err.message));
    setStep('code');
  }

  async function changer(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    const pb = problemeMotDePasse(mdp); if (pb) return setError(pb);
    const sb = browserClient(); if (!sb) return;
    setBusy(true);
    const v = await sb.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'recovery' });
    if (v.error) { setBusy(false); return setError(erreurCompte(v.error.message)); }
    const u = await sb.auth.updateUser({ password: mdp });
    setBusy(false);
    if (u.error) return setError(erreurCompte(u.error.message));
    setStep('fini');
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-5 pb-10 pt-8">
      <div className="flex items-center gap-2">
        <Link href={backHref} aria-label="Retour à la connexion" className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full"><Icon name="back" size={22} stroke={2} /></Link>
        {brand ?? <Wordmark />}
      </div>
      {step === 'email' && (
        <form onSubmit={envoyer} className="flex flex-1 flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <h1 className="font-display text-[26px] font-semibold tracking-tight">Mot de passe oublié</h1>
            <p className={`text-[14px] font-medium leading-relaxed ${t.muted}`}>Entrez l’adresse e-mail de votre compte Hailand : vous y recevrez un code pour choisir un nouveau mot de passe.</p>
          </div>
          <input value={email} onChange={(e) => { setError(null); setEmail(e.target.value); }} type="email" inputMode="email" autoComplete="email" autoFocus placeholder="vous@exemple.com" aria-label="Adresse e-mail" className={field} />
          {error && <p role="alert" className={`rounded-2xl px-4 py-3 text-[13.5px] font-semibold ${t.err}`}>{error}</p>}
          <p className={`text-[12.5px] font-semibold ${t.muted}`}>Pas d’e-mail sur votre compte ? Contactez l’équipe Hailand, qui vérifiera votre identité.</p>
          <button type="submit" disabled={busy || !email.trim()} className={`mt-auto ${cta}`}>{busy ? 'Envoi…' : 'Recevoir le code'}</button>
        </form>
      )}
      {step === 'code' && (
        <form onSubmit={changer} className="flex flex-1 flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <h1 className="font-display text-[26px] font-semibold tracking-tight">Nouveau mot de passe</h1>
            <p className={`text-[14px] font-medium leading-relaxed ${t.muted}`}>Si un compte utilise <b className="font-extrabold">{email.trim()}</b>, un code vient d’y être envoyé (pensez aux courriers indésirables).</p>
          </div>
          <label className="flex flex-col gap-1.5 text-[13px] font-bold">Code reçu par e-mail
            <input value={code} onChange={(e) => { setError(null); setCode(e.target.value.replace(/\D/g, '').slice(0, 10)); }} inputMode="numeric" autoComplete="one-time-code" placeholder="••••••" className={`${field} text-center font-display text-[22px] tracking-[0.3em]`} />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-bold">Nouveau mot de passe
            <span className={`flex h-14 items-center gap-2 rounded-2xl border pl-4 pr-1.5 text-[16px] font-semibold ${t.field}`}>
              <input value={mdp} onChange={(e) => { setError(null); setMdp(e.target.value); }} type={voir ? 'text' : 'password'} autoComplete="new-password" placeholder={`${MDP_MIN} caractères minimum`} className="h-full min-w-0 flex-1 bg-transparent outline-none" />
              <button type="button" onClick={() => setVoir((v) => !v)} className={`h-10 shrink-0 rounded-xl px-3 text-[12.5px] font-extrabold ${t.link}`}>{voir ? 'Masquer' : 'Afficher'}</button>
            </span>
            <span className={`text-[12px] font-semibold ${t.muted}`}>{mdp ? problemeMotDePasse(mdp) ?? 'Mot de passe accepté.' : 'Des lettres et des chiffres, sans votre numéro.'}</span>
          </label>
          <button type="button" onClick={() => void envoyer()} disabled={busy} className={`self-start text-[13px] font-extrabold ${t.link}`}>Renvoyer le code</button>
          {error && <p role="alert" className={`rounded-2xl px-4 py-3 text-[13.5px] font-semibold ${t.err}`}>{error}</p>}
          <button type="submit" disabled={busy || code.length < 6 || !mdp} className={`mt-auto ${cta}`}>{busy ? 'Enregistrement…' : 'Changer mon mot de passe'}</button>
        </form>
      )}
      {step === 'fini' && (
        <div className="flex flex-1 flex-col gap-5">
          <span className={`flex h-14 w-14 items-center justify-center rounded-[18px] ${t.soft}`}><Icon name="check" size={26} stroke={2.4} /></span>
          <div className="flex flex-col gap-1.5">
            <h1 className="font-display text-[26px] font-semibold tracking-tight">Mot de passe changé</h1>
            <p className={`text-[14px] font-medium leading-relaxed ${t.muted}`}>Vous êtes connecté. Utilisez ce nouveau mot de passe la prochaine fois.</p>
          </div>
          <Link href={doneHref} className={`mt-auto ${cta}`}>Continuer</Link>
        </div>
      )}
    </main>
  );
}
