'use client';
import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Badge, Button, Wordmark } from '@hailandx/ui';
import { browserClient } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';
import { AddressError, saveAddress, type AddressLabel } from '@/lib/address';
import { AddressPicker, type Picked } from '@/components/AddressPicker';

interface Decl { id: string; declared_label: string | null; hailand_code: string | null; location_floor: string | null; location_door: string | null; declared_landmark: string | null }
const input = 'h-12 w-full rounded-2xl border border-line bg-card px-4 text-[16px] font-medium outline-none focus:border-blue';
const LABELS: AddressLabel[] = ['Domicile', 'Travail', 'Autre'];

/** Mes adresses de livraison : créer une adresse (Scorpion) ou voir celles déjà enregistrées, y compris depuis NavigationX. */
function Page() {
  const router = useRouter();
  const next = useSearchParams().get('next');
  const session = useSession();
  const sb = browserClient();
  const [list, setList] = useState<Decl[] | null>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState<AddressLabel>('Domicile');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const onPick = useCallback((p: Picked | null) => setPicked(p), []);

  const load = useCallback(async () => {
    if (!sb || !session) return;
    const { data } = await sb.from('declarations').select('id,declared_label,hailand_code,location_floor,location_door,declared_landmark').eq('user_id', session.user.id).eq('status', 'active').order('created_at', { ascending: false });
    setList((data as Decl[]) ?? []);
  }, [sb, session]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (list && list.length === 0) setAdding(true); }, [list]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!sb || !session || !picked) return setError('Placez d’abord votre position : « Me localiser » ou touchez la carte.');
    const f = new FormData(e.currentTarget);
    setBusy(true); setError(null);
    try {
      const r = await saveAddress(sb, session.user.id, { point: picked.point, accuracy: picked.accuracy, label, floor: String(f.get('floor') ?? ''), door: String(f.get('door') ?? ''), landmark: String(f.get('landmark') ?? '') });
      setDone(r.code);
      await load();
      if (next?.startsWith('/')) setTimeout(() => router.replace(next), 1400);
      else setAdding(false);
    } catch (err) { setError(err instanceof AddressError ? err.message : 'Une erreur est survenue.'); }
    setBusy(false);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-5 pb-6 pt-6">
      <Link href="/" aria-label="Accueil"><Wordmark /></Link>
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[26px] font-semibold tracking-tight">Où livrer ?</h1>
        <p className="text-[14px] font-medium text-muted">Votre adresse guide le livreur jusqu’à votre porte, sans appel.</p>
      </div>
      {session === null && <Link href={`/connexion?next=${encodeURIComponent('/adresse' + (next ? `?next=${next}` : ''))}`} className="inline-flex h-[54px] items-center justify-center rounded-2xl bg-ink px-7 text-[15px] font-extrabold text-white">Me connecter pour enregistrer une adresse</Link>}
      {done && <p role="status" className="rounded-2xl bg-ok-soft px-4 py-3 text-[13.5px] font-semibold text-ok">Adresse enregistrée. Votre code Hailand : <b>{done}</b>{next ? ' — retour à votre commande…' : ''}</p>}
      {session && list && list.length > 0 && (
        <section className="flex flex-col gap-2" aria-label="Mes adresses">
          {list.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line-soft bg-card px-4 py-3">
              <span className="flex flex-col"><span className="text-[14px] font-extrabold">{d.declared_label ?? 'Adresse'}</span><span className="text-[12px] font-semibold text-muted">{d.hailand_code}{d.declared_landmark ? ` · ${d.declared_landmark}` : ''}</span></span>
              <Badge tone="sand">{[d.location_floor && `Étage ${d.location_floor}`, d.location_door && `Porte ${d.location_door}`].filter(Boolean).join(' · ') || 'Enregistrée'}</Badge>
            </div>
          ))}
          {!adding && <Button type="button" variant="secondary" onClick={() => { setAdding(true); setDone(null); }}>Ajouter une adresse</Button>}
        </section>
      )}
      {session && adding && (
        <form onSubmit={submit} className="flex flex-col gap-3 rounded-[22px] border border-line-soft bg-card p-4">
          <AddressPicker onChange={onPick} />
          <div className="flex gap-2" role="radiogroup" aria-label="Nom de l’adresse">
            {LABELS.map((l) => <button key={l} type="button" role="radio" aria-checked={label === l} onClick={() => setLabel(l)} className={`h-11 flex-1 rounded-full text-[13.5px] font-bold ${label === l ? 'bg-ink text-white' : 'border border-line'}`}>{l}</button>)}
          </div>
          <div className="grid grid-cols-2 gap-3"><input name="floor" maxLength={10} placeholder="Étage (facultatif)" className={input} /><input name="door" maxLength={10} placeholder="Porte (facultatif)" className={input} /></div>
          <input name="landmark" maxLength={80} placeholder="Repère : portail bleu, boutique en face…" className={input} />
          {error && <p role="alert" className="rounded-2xl bg-[#fde8e4] px-4 py-3 text-[13px] font-semibold text-[#8a2a1c]">{error}</p>}
          <Button type="submit" disabled={busy || !picked}>{busy ? 'Enregistrement…' : 'Enregistrer cette adresse'}</Button>
          <p className="text-[12px] font-medium text-muted">Cette adresse est de niveau 1 (position). Pour la faire certifier au niveau 3, enregistrez votre bâtiment dans NavigationX.</p>
        </form>
      )}
    </main>
  );
}

export default function AdressePage() { return <Suspense><Page /></Suspense>; }
