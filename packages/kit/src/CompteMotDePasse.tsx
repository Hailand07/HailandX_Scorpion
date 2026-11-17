'use client';
import { useState } from 'react';
import Link from 'next/link';
import { normalizeGnPhone } from '@hailandx/commerce';
import { APP_COURANTE, browserClient } from './supabase';
import { groupPhone } from './phone';
import { emailValide, erreurCompte, forceMotDePasse, MDP_MIN, problemeMotDePasse } from './motDePasse';
import { TONS, type Tone } from './tons';

/**
 * Compte Hailand par numéro + mot de passe (§59), commun à HailandX, Vendeur, Flotte et Console.
 * « J'ai un compte » : numéro + mot de passe. « Créer un compte » : prénom, nom, numéro, mot de passe robuste, e-mail facultatif
 * (seul moyen de récupérer un mot de passe oublié). Le code par SMS reste accessible par un lien (équipe, puis WhatsApp).
 */
export function CompteMotDePasse({ tone = 'clair', compact = false, resetHref, onDone, onCode }: {
  tone?: Tone; compact?: boolean; resetHref: string; onDone: () => void; onCode?: () => void;
}) {
  const t = TONS[tone];
  const [mode, setMode] = useState<'connexion' | 'creation'>('connexion');
  const [phone, setPhone] = useState('');
  const [mdp, setMdp] = useState('');
  const [voir, setVoir] = useState(false);
  const [nom, setNom] = useState({ prenom: '', nom: '' });
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cree, setCree] = useState<string | null>(null);

  const h = compact ? 'h-12' : 'h-14';
  const field = `${h} w-full rounded-2xl border px-4 text-[16px] font-semibold outline-none ${t.field}`;
  const cta = `flex ${compact ? 'h-12' : 'h-[54px]'} w-full items-center justify-center rounded-2xl text-[15px] font-extrabold disabled:opacity-40 ${t.cta}`;
  const label = `flex flex-col gap-1.5 ${compact ? 'text-[12.5px]' : 'text-[13px]'} font-bold`;
  const e164 = normalizeGnPhone(phone);
  const force = forceMotDePasse(mdp, e164);

  async function connexion(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    if (!e164) return setError('Entrez un numéro guinéen valide, par exemple 6xx xx xx xx.');
    const sb = browserClient(); if (!sb) return setError('Connexion indisponible pour le moment.');
    setBusy(true);
    const { error: err } = await sb.auth.signInWithPassword({ phone: e164, password: mdp });
    setBusy(false);
    if (err) return setError(erreurCompte(err.message));
    onDone();
  }

  async function creation(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    const prenom = nom.prenom.trim(); const famille = nom.nom.trim(); const mail = email.trim();
    if (!prenom) return setError('Indiquez au moins votre prénom.');
    if (!e164) return setError('Entrez un numéro guinéen valide, par exemple 6xx xx xx xx.');
    const pb = problemeMotDePasse(mdp, e164); if (pb) return setError(pb);
    if (mail && !emailValide(mail)) return setError('Adresse e-mail invalide.');
    const sb = browserClient(); if (!sb) return setError('Connexion indisponible pour le moment.');
    setBusy(true);
    const { data, error: err } = await sb.auth.signUp({ phone: e164, password: mdp, options: { data: { full_name: [prenom, famille].filter(Boolean).join(' '), first_name: prenom, last_name: famille, origine: APP_COURANTE } } });
    if (err) { setBusy(false); if (/already|exists/i.test(err.message)) setMode('connexion'); return setError(erreurCompte(err.message)); }
    // Sans session : Supabase exige encore la confirmation du numéro par SMS (réglage à couper le temps de la vérification WhatsApp).
    if (!data.session) { setBusy(false); return setError('La création de compte par mot de passe n’est pas encore ouverte. Réessayez plus tard.'); }
    if (mail) {
      const { error: errMail } = await sb.auth.updateUser({ email: mail });
      setBusy(false);
      setCree(errMail ? '' : mail);
      return;
    }
    setBusy(false);
    onDone();
  }

  if (cree !== null) {
    return (
      <div className="flex flex-col gap-4">
        <p className={`rounded-2xl px-4 py-3 text-[13.5px] font-semibold leading-snug ${t.soft}`}>Compte Hailand créé.</p>
        <p className={`text-[13.5px] font-medium leading-relaxed ${t.muted}`}>
          {cree ? <>Un e-mail de confirmation a été envoyé à <b className="font-extrabold">{cree}</b>. Confirmez-le : c’est lui qui vous permettra de récupérer votre mot de passe si vous l’oubliez.</>
            : 'L’adresse e-mail n’a pas pu être enregistrée. Vous pourrez l’ajouter plus tard dans votre compte, pour pouvoir récupérer votre mot de passe.'}
        </p>
        <button type="button" onClick={onDone} className={cta}>Continuer</button>
      </div>
    );
  }

  const motDePasse = (nouveau: boolean) => (
    <label className={label}>{nouveau ? 'Choisissez un mot de passe' : 'Mot de passe'}
      <span className={`flex ${h} items-center gap-2 rounded-2xl border pl-4 pr-1.5 text-[16px] font-semibold ${t.field}`}>
        <input value={mdp} onChange={(e) => { setError(null); setMdp(e.target.value); }} type={voir ? 'text' : 'password'} autoComplete={nouveau ? 'new-password' : 'current-password'}
          placeholder={nouveau ? `${MDP_MIN} caractères minimum` : 'Votre mot de passe'} className="h-full min-w-0 flex-1 bg-transparent outline-none" />
        <button type="button" onClick={() => setVoir((v) => !v)} aria-pressed={voir} className={`h-10 shrink-0 rounded-xl px-3 text-[12.5px] font-extrabold ${t.link}`}>{voir ? 'Masquer' : 'Afficher'}</button>
      </span>
      {nouveau && (
        <span className="flex flex-col gap-1.5">
          <span className="grid grid-cols-3 gap-1" aria-hidden="true">{[1, 2, 3].map((i) => <span key={i} className={`h-1.5 rounded-full ${mdp && force >= i ? t.barOn[force] : mdp && force === 0 && i === 1 ? t.barOn[0] : t.bar}`} />)}</span>
          <span className={`text-[12px] font-semibold ${t.muted}`}>{!mdp ? 'Des lettres et des chiffres, sans votre numéro.' : (problemeMotDePasse(mdp, e164) ?? ['', 'Correct.', 'Bon mot de passe.', 'Mot de passe solide.'][force])}</span>
        </span>
      )}
    </label>
  );

  const numero = (
    <label className={label}>Numéro de téléphone
      <span className={`flex ${h} items-center gap-2 rounded-2xl border px-4 text-[16px] font-semibold ${t.field}`}>
        <span className={t.muted}>+224</span>
        <input value={phone} onChange={(e) => { setError(null); setPhone(groupPhone(e.target.value)); }} inputMode="tel" autoComplete="tel-national" placeholder="6xx xx xx xx" className="h-full min-w-0 flex-1 bg-transparent outline-none" />
      </span>
    </label>
  );

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Connexion ou création de compte" className={`grid grid-cols-2 gap-1 rounded-2xl p-1 ${t.tabs}`}>
        {([['connexion', 'J’ai un compte'], ['creation', 'Créer un compte']] as const).map(([m, l]) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setError(null); }}
            className={`h-10 rounded-xl text-[13.5px] font-extrabold ${mode === m ? t.tabOn : t.muted}`}>{l}</button>
        ))}
      </div>

      {mode === 'connexion' ? (
        <form onSubmit={connexion} className="flex flex-col gap-3.5">
          {numero}
          {motDePasse(false)}
          <Link href={resetHref} className={`self-start text-[13px] font-extrabold ${t.link}`}>Mot de passe oublié ?</Link>
          {error && <p role="alert" className={`rounded-2xl px-4 py-3 text-[13.5px] font-semibold ${t.err}`}>{error}</p>}
          <button type="submit" disabled={busy || !phone.trim() || !mdp} className={cta}>{busy ? 'Connexion…' : 'Se connecter'}</button>
        </form>
      ) : (
        <form onSubmit={creation} className="flex flex-col gap-3.5">
          <div className="grid grid-cols-2 gap-2">
            <label className={label}>Prénom<input value={nom.prenom} onChange={(e) => setNom((n) => ({ ...n, prenom: e.target.value }))} autoComplete="given-name" className={field} /></label>
            <label className={label}>Nom<input value={nom.nom} onChange={(e) => setNom((n) => ({ ...n, nom: e.target.value }))} autoComplete="family-name" className={field} /></label>
          </div>
          {numero}
          {motDePasse(true)}
          <label className={label}><span>E-mail <span className={`font-semibold ${t.muted}`}>(facultatif)</span></span>
            <input value={email} onChange={(e) => { setError(null); setEmail(e.target.value); }} type="email" inputMode="email" autoComplete="email" placeholder="vous@exemple.com" className={field} />
            <span className={`text-[12px] font-semibold ${t.muted}`}>Seul moyen de récupérer votre mot de passe si vous l’oubliez.</span>
          </label>
          {error && <p role="alert" className={`rounded-2xl px-4 py-3 text-[13.5px] font-semibold ${t.err}`}>{error}</p>}
          <button type="submit" disabled={busy || !phone.trim() || !mdp || !nom.prenom.trim()} className={cta}>{busy ? 'Création…' : 'Créer mon compte'}</button>
        </form>
      )}

      {onCode && <button type="button" onClick={onCode} className={`self-center text-[12.5px] font-bold underline underline-offset-4 ${t.muted}`}>Recevoir plutôt un code par SMS</button>}
    </div>
  );
}
