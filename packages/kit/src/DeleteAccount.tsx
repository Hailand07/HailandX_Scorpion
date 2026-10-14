'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { signOutHailand } from './account';

import { browserClient } from './supabase';
import { useSession } from './useSession';
import { BackHeader, Icon, Screen } from './Screen';

interface Reason { code: string; message: string }
const CHECKS = ['Aucune commande en cours', 'Aucun argent en attente', 'Pas de livraison à terminer'];

/**
 * Supprimer mon compte (v2, depuis « Compte ») : commun à HailandX, Flotte, NavigationX et HailandMap.
 * La base vérifie d'abord ce qui l'empêche (fn_account_delete_check), puis efface tout et libère le numéro (fn_delete_my_account).
 */
export function DeleteAccount({ backHref, doneHref }: { backHref: string; doneHref: string }) {
  const session = useSession();
  const sb = browserClient();
  const [reasons, setReasons] = useState<Reason[] | null>(null);
  const [staff, setStaff] = useState(false);
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sb || !session) return;
    sb.rpc('fn_account_delete_check').then(({ data, error: e }) => setReasons(e ? [] : ((data as Reason[]) ?? [])));
    sb.rpc('is_admin').then(({ data }) => setStaff(data === true));
  }, [sb, session]);

  /** Les images du compte (logo, photos de produits) sont retirées du stockage avant la suppression : la base ne le fait pas. */
  async function wipeMedia(uid: string) {
    try {
      const { data } = await sb!.storage.from('hx-media').list(uid, { limit: 1000 });
      const paths = (data ?? []).filter((f) => f.name).map((f) => `${uid}/${f.name}`);
      if (paths.length) await sb!.storage.from('hx-media').remove(paths);
    } catch { /* images non retirées : sans effet sur la suppression du compte */ }
  }

  async function remove() {
    if (!sb || !session || word.trim().toUpperCase() !== 'SUPPRIMER') return;
    setBusy(true); setError(null);
    await wipeMedia(session.user.id);
    const { error: e } = await sb.rpc('fn_delete_my_account', { p_confirm: 'SUPPRIMER' });
    if (e) {
      setBusy(false);
      return setError(e.code === 'PGRST202' || /Could not find the function/i.test(e.message) ? 'La suppression de compte n’est pas encore activée sur la base. Réessayez bientôt.' : e.message.replace(/^.*?:\s*/, ''));
    }
    await signOutHailand(sb);
    window.location.replace(doneHref);
  }

  const blocked = (reasons ?? []).length > 0;
  const ok = word.trim().toUpperCase() === 'SUPPRIMER' && !blocked && reasons !== null;
  return (
    <Screen className="gap-4">
      <BackHeader href={backHref} title="Supprimer mon compte" label="Retour" />
      {session === null && <Link href={`/connexion?next=${encodeURIComponent('/compte/supprimer')}`} className="flex h-[52px] items-center justify-center rounded-2xl bg-ink text-[15px] font-extrabold text-white">Me connecter</Link>}
      {session && (
        <>
          <section className="flex flex-col gap-2.5 rounded-[20px] border border-line-soft bg-card p-4">
            <h2 className="text-[15px] font-extrabold">Ce qui sera effacé</h2>
            <ul className="flex list-disc flex-col gap-1.5 pl-[18px] text-[13.5px] font-semibold leading-snug text-[#3d404c]">
              <li>Votre profil, vos adresses et leurs codes, vos favoris</li>
              <li>Votre boutique, ses produits, ses images et ses liens</li>
              <li>Votre profil de livreur, s’il existe</li>
              <li>Votre numéro est libéré : vous pourrez recommencer à zéro</li>
              {staff && <li className="font-extrabold text-[#a3321f]">Vos droits d’équipe Hailand : ils ne reviennent pas si vous vous reconnectez</li>}
            </ul>
          </section>

          <section className="flex flex-col gap-2.5 rounded-[20px] border border-line-soft bg-card p-4">
            <h2 className="text-[15px] font-extrabold">Vérifications</h2>
            {reasons === null && <p className="text-[13px] font-semibold text-muted">Vérification de votre compte…</p>}
            {reasons && !blocked && CHECKS.map((c) => (
              <div key={c} className="flex items-center gap-2.5 text-[13.5px] font-bold"><span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-ok-soft text-ok"><Icon name="check" size={13} stroke={3} /></span>{c}</div>
            ))}
            {blocked && reasons!.map((r) => (
              <div key={r.code} role="alert" className="flex items-start gap-2.5 text-[13.5px] font-bold text-[#a3321f]"><span className="mt-px flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-[#fde8e4]"><Icon name="close" size={12} stroke={3} /></span>{r.message}</div>
            ))}
            <span className="text-[12px] font-semibold leading-snug text-muted">Si une commande est en cours ou si de l’argent vous est dû, la suppression attend que ce soit réglé.</span>
          </section>

          <form onSubmit={(e) => { e.preventDefault(); void remove(); }} className="flex flex-col gap-3">
            <label className="flex flex-col gap-2 text-[13.5px] font-extrabold">Pour confirmer, écrivez SUPPRIMER
              <input value={word} onChange={(e) => setWord(e.target.value)} autoComplete="off" autoCapitalize="characters" placeholder="SUPPRIMER" disabled={blocked} className="h-[52px] rounded-2xl border border-line bg-card px-4 text-[16px] font-bold tracking-[0.06em] outline-none focus:border-[#a3321f]" />
            </label>
            {error && <p role="alert" className="text-[13px] font-semibold text-[#a3321f]">{error}</p>}
            <button type="submit" disabled={!ok || busy} className="h-[54px] rounded-[18px] bg-[#a3321f] text-[15px] font-extrabold text-white disabled:bg-[#ebe8e0] disabled:text-[#8a8d9c]">{busy ? 'Suppression…' : 'Supprimer définitivement'}</button>
            <Link href={backHref} className="flex h-11 items-center self-center text-[14px] font-extrabold">Annuler</Link>
          </form>
        </>
      )}
    </Screen>
  );
}
