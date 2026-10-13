'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Wordmark } from '@hailandx/ui';
import { browserClient } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';

interface Reason { code: string; message: string }

/** Paramètres : compte, et suppression définitive du compte (commun à HailandX, Flotte, NavigationX et HailandMap). */
export default function SettingsPage() {
  const router = useRouter();
  const session = useSession();
  const sb = browserClient();
  const [reasons, setReasons] = useState<Reason[] | null>(null);
  const [staff, setStaff] = useState(false);
  const [open, setOpen] = useState(false);
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
    if (!sb || !session) return;
    setBusy(true); setError(null);
    await wipeMedia(session.user.id);
    const { error: e } = await sb.rpc('fn_delete_my_account', { p_confirm: word });
    if (e) {
      setBusy(false);
      const m = e.message.replace(/^.*?:\s*/, '');
      return setError(e.code === 'PGRST202' || /Could not find the function/i.test(e.message) ? 'La suppression de compte n’est pas encore activée sur la base. Réessayez bientôt.' : m);
    }
    await sb.auth.signOut();
    try { localStorage.removeItem('hx.cart'); } catch { /* ignoré */ }
    router.replace('/?compte=supprime');
  }

  const blocked = (reasons ?? []).length > 0;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-5 pb-6 pt-6">
      <div className="flex items-center justify-between"><Link href="/" aria-label="Accueil"><Wordmark /></Link><Link href="/compte" className="text-[13px] font-bold text-blue-ink">Mon compte</Link></div>
      <h1 className="font-display text-[26px] font-semibold tracking-tight">Paramètres</h1>
      {session === null && <Link href="/connexion?next=/parametres" className="inline-flex h-[54px] items-center justify-center rounded-2xl bg-ink text-[15px] font-extrabold text-white">Me connecter</Link>}
      {session && (
        <>
          <section className="flex flex-col gap-1 rounded-[22px] border border-line-soft bg-card p-4">
            <span className="text-[12px] font-bold text-muted">Compte</span>
            <span className="text-[15px] font-extrabold">{session.user.phone ? `+${session.user.phone.replace(/^\+/, '')}` : 'Compte HailandX'}</span>
            <span className="text-[12.5px] font-medium text-muted">Un seul compte pour HailandX, Flotte, NavigationX et HailandMap.</span>
          </section>

          <section className="flex flex-col gap-3 rounded-[22px] border border-[#e9c4bc] bg-[#fdf3f1] p-4" aria-label="Supprimer mon compte">
            <h2 className="font-display text-[18px] font-semibold text-[#8a2a1c]">Supprimer mon compte</h2>
            <p className="text-[13px] font-medium">La suppression est <b>définitive</b> et concerne tout l’écosystème Hailand : votre numéro n’est plus rattaché à aucun compte, et vous pourrez recommencer de zéro avec le même numéro.</p>
            <ul className="list-disc pl-5 text-[12.5px] font-medium text-muted">
              <li>Vos adresses et leurs codes (NavigationX, HailandX)</li>
              <li>Votre boutique, ses produits, rayons, liens et abonnés</li>
              <li>Vos favoris, abonnements, notifications et commandes sans livraison</li>
              <li>Votre candidature ou profil de livreur</li>
              {staff && <li className="font-bold text-[#8a2a1c]">Vos droits d’équipe Hailand (administrateur) : ils ne sont pas rétablis si vous vous reconnectez avec ce numéro.</li>}
            </ul>
            {reasons === null && <p className="text-[12.5px] font-semibold text-muted">Vérification de votre compte…</p>}
            {blocked && (
              <div role="alert" className="flex flex-col gap-1.5 rounded-2xl bg-white px-3.5 py-3 text-[13px] font-semibold text-[#8a2a1c]">
                <span className="font-extrabold">Suppression impossible pour l’instant :</span>
                <ul className="list-disc pl-5">{reasons!.map((r) => <li key={r.code}>{r.message}</li>)}</ul>
              </div>
            )}
            {!blocked && reasons !== null && !open && <button type="button" onClick={() => setOpen(true)} className="h-12 rounded-2xl border border-[#c9594a] text-[14px] font-extrabold text-[#8a2a1c]">Supprimer mon compte…</button>}
            {!blocked && open && (
              <form onSubmit={(e) => { e.preventDefault(); void remove(); }} className="flex flex-col gap-2.5">
                <label className="flex flex-col gap-1.5 text-[13px] font-bold">Pour confirmer, tapez SUPPRIMER
                  <input value={word} onChange={(e) => setWord(e.target.value)} autoComplete="off" autoCapitalize="characters" aria-label="Confirmation" className="h-12 rounded-2xl border border-line bg-white px-4 text-[16px] font-semibold outline-none focus:border-[#c9594a]" />
                </label>
                {error && <p role="alert" className="text-[12.5px] font-semibold text-[#8a2a1c]">{error}</p>}
                <div className="flex gap-2">
                  <button type="submit" disabled={busy || word !== 'SUPPRIMER'} className="h-12 flex-1 rounded-2xl bg-[#c9594a] text-[14px] font-extrabold text-white disabled:opacity-40">{busy ? 'Suppression…' : 'Supprimer définitivement'}</button>
                  <button type="button" onClick={() => { setOpen(false); setWord(''); setError(null); }} className="h-12 rounded-2xl border border-line bg-white px-4 text-[14px] font-bold">Annuler</button>
                </div>
              </form>
            )}
          </section>
        </>
      )}
    </main>
  );
}
