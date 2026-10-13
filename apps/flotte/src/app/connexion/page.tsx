'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatGnPhone, normalizeGnPhone } from '@hailandx/commerce';
import { browserClient } from '@/lib/supabase';

const field = 'h-14 w-full rounded-2xl border border-night-line bg-night-card px-4 text-[16px] font-semibold outline-none focus:border-lime';
const cta = 'flex h-[54px] w-full items-center justify-center rounded-2xl bg-lime text-[15px] font-extrabold text-ink disabled:opacity-40';

/** Connexion du livreur : même compte Hailand que HailandX et NavigationX (téléphone + code à 6 chiffres). */
function Form() {
  const router = useRouter();
  const next = useSearchParams().get('next') ?? '/';
  const [phone, setPhone] = useState('');
  const [e164, setE164] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    const n = normalizeGnPhone(phone);
    if (!n) return setError('Entrez un numéro guinéen valide, par exemple 6xx xx xx xx.');
    const sb = browserClient(); if (!sb) return setError('Connexion indisponible.');
    setBusy(true);
    const { error: err } = await sb.auth.signInWithOtp({ phone: n });
    setBusy(false);
    if (err) return setError('Le code n’a pas pu être envoyé. Réessayez dans un instant.');
    setE164(n);
  }
  async function verify(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    const sb = browserClient(); if (!sb || !e164) return;
    setBusy(true);
    const { error: err } = await sb.auth.verifyOtp({ phone: e164, token: code.trim(), type: 'sms' });
    setBusy(false);
    if (err) return setError('Code incorrect ou expiré.');
    router.replace(next.startsWith('/') ? next : '/');
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-5 pb-10 pt-8">
      <div className="font-display text-2xl font-bold tracking-[-0.03em]">Hailand <span className="text-lime">Flotte</span></div>
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-[26px] font-semibold tracking-tight">{e164 ? 'Entrez le code reçu' : 'Connexion livreur'}</h1>
        <p className="text-[14px] font-medium text-night-muted">{e164 ? <>Code envoyé au {formatGnPhone(e164)}.</> : 'Votre numéro suffit : un code à 6 chiffres vous est envoyé par SMS.'}</p>
      </div>
      {!e164 ? (
        <form onSubmit={send} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-[13px] font-bold">Numéro de téléphone
            <span className="flex h-14 items-center gap-2 rounded-2xl border border-night-line bg-night-card px-4 text-[16px] font-semibold"><span className="text-night-muted">+224</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel-national" placeholder="6xx xx xx xx" className="h-full min-w-0 flex-1 bg-transparent outline-none" /></span></label>
          <button type="submit" disabled={busy || !phone.trim()} className={cta}>{busy ? 'Envoi…' : 'Recevoir le code'}</button>
        </form>
      ) : (
        <form onSubmit={verify} className="flex flex-col gap-3">
          <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" aria-label="Code à 6 chiffres" placeholder="••••••" className={`${field} text-center font-display text-[24px] tracking-[0.4em]`} />
          <button type="submit" disabled={busy || code.length !== 6} className={cta}>{busy ? 'Vérification…' : 'Se connecter'}</button>
          <button type="button" onClick={() => { setE164(null); setCode(''); setError(null); }} className="h-11 text-[13.5px] font-bold text-lime">Changer de numéro</button>
        </form>
      )}
      {error && <p role="alert" className="rounded-2xl bg-[#3a1a1a] px-4 py-3 text-[13.5px] font-semibold text-[#ffb4a8]">{error}</p>}
    </main>
  );
}

export default function Page() { return <Suspense><Form /></Suspense>; }
