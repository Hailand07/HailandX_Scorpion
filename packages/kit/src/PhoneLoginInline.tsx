'use client';
import { useEffect, useRef, useState } from 'react';
import { formatGnPhone, normalizeGnPhone } from '@hailandx/commerce';
import type { Session } from '@supabase/supabase-js';
import { APP_COURANTE, browserClient } from './supabase';

/** Compte prêt pour commander : connecté ET nommé (le livreur doit savoir qui demander). */
export const aUnNom = (s: Session | null | undefined): boolean => Boolean((s?.user.user_metadata as { full_name?: string } | undefined)?.full_name?.trim());

/**
 * Connexion « Compte Hailand » dans la page, sans la quitter (maquette v9 « Panier », HAILANDX.md §49) :
 * numéro → code SMS → prénom et nom seulement si le compte n'en a pas. Même compte que `PhoneLogin`.
 * L'écran qui l'affiche la garde tant que `aUnNom(session)` est faux, puis passe à la suite.
 */
export function PhoneLoginInline({ title = 'Votre numéro', hint = 'Pour suivre le colis et recevoir votre code de remise. Pas de mot de passe.' }: { title?: string; hint?: string }) {
  const [step, setStep] = useState<'numero' | 'code' | 'nom'>('numero');
  const [phone, setPhone] = useState('');
  const [e164, setE164] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [nom, setNom] = useState({ prenom: '', nom: '' });
  const [nouveau, setNouveau] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (cooldown <= 0) return; const id = setTimeout(() => setCooldown((c) => c - 1), 1000); return () => clearTimeout(id); }, [cooldown]);
  useEffect(() => { if (step === 'code') codeRef.current?.focus(); }, [step]);
  // Déjà connecté mais sans nom (compte ouvert ailleurs) : on passe directement au nom.
  useEffect(() => {
    void browserClient()?.auth.getSession().then(({ data }) => { if (data.session && !aUnNom(data.session)) setStep('nom'); });
  }, []);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault(); setError(null);
    const n = step === 'code' && e164 ? e164 : normalizeGnPhone(phone);
    if (!n) return setError('Entrez un numéro guinéen valide, par exemple 6xx xx xx xx.');
    const sb = browserClient(); if (!sb) return setError('Connexion indisponible pour le moment.');
    setBusy(true);
    const { error: err } = await sb.auth.signInWithOtp({ phone: n });
    setBusy(false);
    if (err) return setError(/rate|too many/i.test(err.message) ? 'Trop de demandes. Patientez une minute.' : 'Le code n’a pas pu être envoyé. Réessayez dans un instant.');
    setE164(n); setCode(''); setCooldown(45); setStep('code');
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    const sb = browserClient(); if (!sb || !e164) return;
    setBusy(true);
    // Le nom est demandé AVANT que la session ne soit publiée à l'écran : on vérifie, puis on regarde s'il manque.
    const { data, error: err } = await sb.auth.verifyOtp({ phone: e164, token: code.trim(), type: 'sms' });
    setBusy(false);
    if (err || !data.user) return setError('Code incorrect ou expiré. Vérifiez-le ou demandez-en un nouveau.');
    const meta = (data.user.user_metadata ?? {}) as { full_name?: string; first_name?: string; last_name?: string };
    if (!meta.full_name?.trim()) { setNouveau(Date.now() - new Date(data.user.created_at).getTime() < 10 * 60_000); setNom({ prenom: meta.first_name ?? '', nom: meta.last_name ?? '' }); setStep('nom'); }
  }

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    const sb = browserClient(); if (!sb) return;
    const prenom = nom.prenom.trim(); const famille = nom.nom.trim();
    if (!prenom) return setError('Indiquez au moins votre prénom.');
    setBusy(true); setError(null);
    const d: Record<string, string> = { full_name: [prenom, famille].filter(Boolean).join(' '), first_name: prenom, last_name: famille };
    if (nouveau) d.origine = APP_COURANTE;
    const { error: err } = await sb.auth.updateUser({ data: d });
    setBusy(false);
    if (err) setError('Votre nom n’a pas pu être enregistré. Réessayez.');
  }

  const field = 'h-12 w-full rounded-2xl border border-line bg-card px-4 text-[16px] font-semibold outline-none focus:border-blue';
  const cta = 'flex h-12 w-full items-center justify-center rounded-2xl bg-ink text-[14.5px] font-extrabold text-white disabled:opacity-40';
  return (
    <section aria-label={title} className="flex flex-col gap-3 rounded-[22px] border border-line-soft bg-card p-4">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-[15px] font-extrabold">{step === 'nom' ? 'Votre nom, une seule fois' : title}</h2>
        <p className="text-[12.5px] font-semibold leading-snug text-muted">{step === 'nom' ? 'Pour que le livreur sache qui demander. Les autres applications Hailand ne le redemanderont pas.' : hint}</p>
      </div>
      {step === 'numero' && (
        <form onSubmit={sendCode} className="flex flex-col gap-2.5">
          <label className="flex flex-col gap-1.5 text-[12.5px] font-extrabold">Téléphone
            <span className="flex h-12 items-center gap-2 rounded-2xl border border-line bg-card px-4 text-[16px] font-semibold">
              <span className="text-muted">+224</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel-national" placeholder="6xx xx xx xx" className="h-full min-w-0 flex-1 bg-transparent outline-none" />
            </span>
          </label>
          <button type="submit" disabled={busy || !phone.trim()} className={cta}>{busy ? 'Envoi…' : 'Recevoir le code par SMS'}</button>
        </form>
      )}
      {step === 'code' && e164 && (
        <form onSubmit={verify} className="flex flex-col gap-2.5">
          <label className="flex flex-col gap-1.5 text-[12.5px] font-extrabold">Code reçu au {formatGnPhone(e164)}
            <input ref={codeRef} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="••••••" className={`${field} text-center font-display text-[22px] tracking-[0.4em]`} />
          </label>
          <p className="text-[12.5px] font-semibold text-muted">
            {cooldown > 0 ? <>Renvoyer dans 0:{String(cooldown).padStart(2, '0')}</> : <button type="button" onClick={() => void sendCode()} disabled={busy} className="font-extrabold text-blue-ink">Renvoyer le code</button>}
            {' · '}<button type="button" onClick={() => { setStep('numero'); setError(null); }} className="font-extrabold text-blue-ink">Changer de numéro</button>
          </p>
          <button type="submit" disabled={busy || code.length !== 6} className={cta}>{busy ? 'Vérification…' : 'Valider'}</button>
        </form>
      )}
      {step === 'nom' && (
        <form onSubmit={saveName} className="flex flex-col gap-2.5">
          <div className="grid grid-cols-2 gap-2">
            <input value={nom.prenom} onChange={(e) => setNom((n) => ({ ...n, prenom: e.target.value }))} autoComplete="given-name" placeholder="Prénom" aria-label="Prénom" className={field} />
            <input value={nom.nom} onChange={(e) => setNom((n) => ({ ...n, nom: e.target.value }))} autoComplete="family-name" placeholder="Nom" aria-label="Nom" className={field} />
          </div>
          <button type="submit" disabled={busy || !nom.prenom.trim()} className={cta}>{busy ? 'Enregistrement…' : 'Continuer'}</button>
        </form>
      )}
      {error && <p role="alert" className="rounded-2xl bg-[#fde8e4] px-4 py-3 text-[13px] font-semibold text-[#8a2a1c]">{error}</p>}
    </section>
  );
}
