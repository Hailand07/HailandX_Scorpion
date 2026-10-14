'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Wordmark } from '@hailandx/ui';
import { formatGnPhone, normalizeGnPhone } from '@hailandx/commerce';
import { browserClient } from './supabase';

/** Connexion par téléphone : numéro → code à 6 chiffres (SMS). Un seul compte Hailand par numéro, pour toutes les applications. */
function Form({ defaultNext, brand }: { defaultNext: string; brand?: ReactNode }) {
  const router = useRouter();
  const next = useSearchParams().get('next') ?? defaultNext;
  const [phone, setPhone] = useState('');
  const [e164, setE164] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const n = normalizeGnPhone(phone);
    if (!n) return setError('Entrez un numéro guinéen valide, par exemple 6xx xx xx xx.');
    const sb = browserClient();
    if (!sb) return setError('Connexion indisponible : la base n’est pas configurée.');
    setBusy(true);
    const { error: err } = await sb.auth.signInWithOtp({ phone: n });
    setBusy(false);
    if (err) return setError('Le code n’a pas pu être envoyé. Réessayez dans un instant.');
    setE164(n);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const sb = browserClient();
    if (!sb || !e164) return;
    setBusy(true);
    const { error: err } = await sb.auth.verifyOtp({ phone: e164, token: code.trim(), type: 'sms' });
    setBusy(false);
    if (err) return setError('Code incorrect ou expiré.');
    router.replace(next.startsWith('/') && !next.startsWith('//') ? next : defaultNext);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-5 pb-10 pt-8">
      <Link href="/" aria-label="Accueil">{brand ?? <Wordmark />}</Link>
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-[26px] font-semibold tracking-tight">{e164 ? 'Entrez le code reçu' : 'Connexion'}</h1>
        <p className="text-[14px] font-medium text-muted">
          {e164 ? <>Code envoyé au {formatGnPhone(e164)}.</> : 'Votre numéro de téléphone suffit : un code à 6 chiffres vous est envoyé par SMS.'}
        </p>
      </div>

      {!e164 ? (
        <form onSubmit={sendCode} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-[13px] font-bold">
            Numéro de téléphone
            <span className="flex h-14 items-center gap-2 rounded-2xl border border-line bg-card px-4 text-[16px] font-semibold">
              <span className="text-muted">+224</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel-national" placeholder="6xx xx xx xx" className="h-full min-w-0 flex-1 bg-transparent outline-none" />
            </span>
          </label>
          <Button type="submit" disabled={busy || !phone.trim()}>{busy ? 'Envoi…' : 'Recevoir le code'}</Button>
        </form>
      ) : (
        <form onSubmit={verify} className="flex flex-col gap-3">
          <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" aria-label="Code à 6 chiffres" placeholder="••••••"
            className="h-14 rounded-2xl border border-line bg-card px-4 text-center font-display text-[24px] font-semibold tracking-[0.4em] outline-none" />
          <Button type="submit" disabled={busy || code.length !== 6}>{busy ? 'Vérification…' : 'Se connecter'}</Button>
          <button type="button" onClick={() => { setE164(null); setCode(''); setError(null); }} className="h-11 text-[13.5px] font-bold text-blue-ink">Changer de numéro</button>
        </form>
      )}
      {error && <p role="alert" className="rounded-2xl bg-[#fde8e4] px-4 py-3 text-[13.5px] font-semibold text-[#8a2a1c]">{error}</p>}
    </main>
  );
}

/** Page de connexion prête à l'emploi : `defaultNext` = où aller après la connexion sans paramètre `next`. */
export function PhoneLogin({ defaultNext = '/', brand }: { defaultNext?: string; brand?: ReactNode }) {
  return <Suspense><Form defaultNext={defaultNext} brand={brand} /></Suspense>;
}
