'use client';
import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { browserClient } from './supabase';
import { emailValide, erreurCompte, MDP_MIN, problemeMotDePasse } from './motDePasse';

/**
 * Sécurité du compte (§59), dans « Mon compte » de chaque application : l'e-mail de récupération (seul moyen de retrouver un mot
 * de passe oublié) et le mot de passe (le créer pour un compte ouvert avec un code SMS, ou le changer).
 */
export function SecuriteCompte() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [mdp, setMdp] = useState('');
  const [voir, setVoir] = useState(false);
  const [busy, setBusy] = useState<'email' | 'mdp' | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => { void browserClient()?.auth.getUser().then(({ data }) => setUser(data.user)); }, []);
  if (!user) return null;
  const field = 'h-12 w-full rounded-2xl border border-line bg-card px-4 text-[16px] font-semibold outline-none focus:border-blue';
  const btn = 'flex h-12 items-center justify-center rounded-2xl bg-ink px-4 text-[14px] font-extrabold text-white disabled:opacity-40';

  async function saveEmail(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    if (!emailValide(email)) return setMsg({ ok: false, text: 'Adresse e-mail invalide.' });
    setBusy('email');
    const { data, error } = await browserClient()!.auth.updateUser({ email: email.trim() });
    setBusy(null);
    if (error) return setMsg({ ok: false, text: erreurCompte(error.message) });
    if (data.user) setUser(data.user);
    setEmail('');
    setMsg({ ok: true, text: `Un e-mail de confirmation a été envoyé à ${email.trim()}. Confirmez-le pour l’activer.` });
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    const pb = problemeMotDePasse(mdp, user?.phone); if (pb) return setMsg({ ok: false, text: pb });
    setBusy('mdp');
    const { error } = await browserClient()!.auth.updateUser({ password: mdp });
    setBusy(null);
    if (error) return setMsg({ ok: false, text: erreurCompte(error.message) });
    setMdp('');
    setMsg({ ok: true, text: 'Mot de passe enregistré.' });
  }

  return (
    <section aria-labelledby="securite" className="flex flex-col gap-4 rounded-[22px] border border-line-soft bg-card p-4">
      <h2 id="securite" className="text-[15px] font-extrabold">Sécurité du compte</h2>
      <form onSubmit={saveEmail} className="flex flex-col gap-2">
        <span className="text-[13px] font-bold">E-mail de récupération</span>
        <span className="text-[12.5px] font-semibold text-muted">
          {user.email ? <>Actuel : <b className="text-ink">{user.email}</b>.</> : 'Aucun : sans e-mail, un mot de passe oublié ne peut pas être récupéré.'}
          {user.new_email ? <> En attente de confirmation : <b className="text-ink">{user.new_email}</b>.</> : null}
        </span>
        <div className="flex gap-2">
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" inputMode="email" autoComplete="email" placeholder={user.email ? 'Nouvelle adresse' : 'vous@exemple.com'} aria-label="E-mail de récupération" className={field} />
          <button type="submit" disabled={busy !== null || !email.trim()} className={btn}>{busy === 'email' ? '…' : 'Enregistrer'}</button>
        </div>
      </form>
      <form onSubmit={savePassword} className="flex flex-col gap-2 border-t border-line-soft pt-4">
        <span className="text-[13px] font-bold">Mot de passe</span>
        <span className="flex h-12 items-center gap-2 rounded-2xl border border-line bg-card pl-4 pr-1.5 text-[16px] font-semibold">
          <input value={mdp} onChange={(e) => setMdp(e.target.value)} type={voir ? 'text' : 'password'} autoComplete="new-password" placeholder={`Nouveau mot de passe (${MDP_MIN} caractères min.)`} aria-label="Nouveau mot de passe" className="h-full min-w-0 flex-1 bg-transparent outline-none" />
          <button type="button" onClick={() => setVoir((v) => !v)} className="h-10 shrink-0 rounded-xl px-3 text-[12.5px] font-extrabold text-blue-ink">{voir ? 'Masquer' : 'Afficher'}</button>
        </span>
        <span className="text-[12px] font-semibold text-muted">{mdp ? problemeMotDePasse(mdp, user.phone) ?? 'Mot de passe accepté.' : 'Des lettres et des chiffres, sans votre numéro.'}</span>
        <button type="submit" disabled={busy !== null || !mdp} className={btn}>{busy === 'mdp' ? 'Enregistrement…' : 'Enregistrer le mot de passe'}</button>
      </form>
      {msg && <p role="status" className={`rounded-2xl px-4 py-3 text-[13px] font-semibold ${msg.ok ? 'bg-ok-soft text-ok' : 'bg-[#fde8e4] text-[#8a2a1c]'}`}>{msg.text}</p>}
    </section>
  );
}
