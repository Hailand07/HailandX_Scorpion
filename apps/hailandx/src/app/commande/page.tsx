'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Wordmark } from '@hailandx/ui';
import { formatGnf, formatGnPhone, normalizeGnPhone } from '@hailandx/commerce';
import { browserClient, useSession } from '@hailandx/kit';
import { cartSubtotal, clearCart, useCart } from '@/lib/cart';
import { currentSource } from '@/lib/source';

interface Decl { id: string; declared_label: string | null; hailand_code: string | null; detected_level: number }
const input = 'h-12 w-full rounded-2xl border border-line bg-card px-4 text-[16px] font-medium outline-none focus:border-blue';

/** Commande : adresse (niveau 1 au minimum), téléphone, paiement à la livraison. Le serveur recalcule prix, stock et frais. */
export default function CheckoutPage() {
  const router = useRouter();
  const session = useSession();
  const sb = browserClient();
  const lines = useCart();
  const [decls, setDecls] = useState<Decl[]>([]);
  const [levels, setLevels] = useState<Record<string, number>>({});
  const [decl, setDecl] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [pay, setPay] = useState<'livraison' | 'orange_money'>('livraison');
  const [omAvailable, setOmAvailable] = useState<{ ok: boolean; trial: boolean }>({ ok: false, trial: false });

  useEffect(() => {
    if (!sb || !session) return;
    const uid = session.user.id;
    if (session.user.phone) setPhone(formatGnPhone(session.user.phone.startsWith('+') ? session.user.phone : `+${session.user.phone}`));
    (async () => {
      // Orange Money : ouvert à tous en mode « orange_money » ; en mode « simulation », réservé à l'équipe (essais).
      const [m, a] = await Promise.all([sb.from('settings').select('value').eq('key', 'payment_mode').maybeSingle(), sb.rpc('is_admin')]);
      const mode = (m.data as { value: string } | null)?.value ?? 'simulation';
      setOmAvailable({ ok: mode === 'orange_money' || a.data === true, trial: mode !== 'orange_money' });
      const { data } = await sb.from('declarations').select('id,declared_label,hailand_code,detected_level').eq('user_id', uid).order('created_at', { ascending: false });
      const list = (data as Decl[]) ?? [];
      const lv: Record<string, number> = {};
      await Promise.all(list.map(async (d) => { const r = await sb.rpc('fn_declaration_level', { p_declaration: d.id }); lv[d.id] = typeof r.data === 'number' ? r.data : d.detected_level; }));
      const ok = list.filter((d) => (lv[d.id] ?? 0) >= 1);
      setDecls(ok); setLevels(lv); setDecl(ok[0]?.id ?? ''); setReady(true);
    })();
  }, [sb, session]);

  async function place(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const n = normalizeGnPhone(phone);
    if (!n) return setError('Entrez un numéro guinéen valide pour que le livreur puisse vous joindre.');
    if (!decl) return setError('Choisissez une adresse de livraison.');
    setBusy(true);
    const items = lines.map((l) => ({ offer_id: l.offerId, variant_id: l.variantId, qty: l.qty }));
    const { data, error: err } = await sb!.rpc('fn_place_order', { p_items: items, p_declaration: decl, p_phone: n, p_payment: pay, p_source: currentSource() });
    setBusy(false);
    if (err) return setError(err.message.replace(/^.*?:\s*/, '').slice(0, 200) || 'La commande n’a pas pu être passée.');
    clearCart();
    router.replace(`/commandes/${data as string}`);
  }

  const Head = (
    <div className="flex items-center justify-between"><Link href="/" aria-label="Accueil"><Wordmark /></Link><h1 className="font-display text-[20px] font-semibold">Commande</h1></div>
  );

  if (session === undefined) return <main className="mx-auto max-w-md px-5 pt-6">{Head}</main>;
  if (lines.length === 0) {
    return <main className="mx-auto flex max-w-md flex-col gap-4 px-5 pt-6">{Head}<p className="text-[14px] font-medium text-muted">Votre panier est vide.</p><Link href="/" className="font-bold text-blue-ink">Voir les boutiques</Link></main>;
  }
  if (!session) {
    return (
      <main className="mx-auto flex max-w-md flex-col gap-4 px-5 pt-6">{Head}
        <p className="text-[14px] font-medium text-muted">Connectez-vous avec votre téléphone pour commander.</p>
        <Link href="/connexion?next=/commande" className="inline-flex h-[54px] items-center justify-center rounded-2xl bg-ink px-7 text-[15px] font-extrabold text-white">Se connecter</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-5 pb-10 pt-6">
      {Head}
      <form onSubmit={place} className="flex flex-col gap-4">
        <section className="flex flex-col gap-2 rounded-[22px] border border-line-soft bg-card p-4">
          <h2 className="text-[13px] font-extrabold text-muted">Livraison à</h2>
          {!ready ? <p className="text-[13.5px] font-medium text-muted">Chargement de vos adresses…</p> : decls.length === 0 ? (
            <div className="flex flex-col gap-2"><p className="rounded-2xl bg-amber-soft px-4 py-3 text-[13px] font-semibold">Aucune adresse enregistrée : c’est elle qui guide le livreur jusqu’à votre porte.</p><Link href="/adresse?next=/commande" className="flex h-12 items-center justify-center rounded-2xl bg-ink text-[14.5px] font-extrabold text-white">Où livrer ? Enregistrer mon adresse</Link></div>
          ) : (
            <select value={decl} onChange={(e) => setDecl(e.target.value)} className={input} aria-label="Adresse de livraison">
              {decls.map((d) => <option key={d.id} value={d.id}>{d.declared_label || d.hailand_code || 'Mon adresse'} — niveau {levels[d.id]}</option>)}
            </select>
          )}
          {ready && decls.length > 0 && <Link href="/adresse?next=/commande" className="text-[13px] font-bold text-blue-ink">+ Ajouter une autre adresse</Link>}
        </section>
        <section className="flex flex-col gap-2 rounded-[22px] border border-line-soft bg-card p-4">
          <h2 className="text-[13px] font-extrabold text-muted">Téléphone du livreur</h2>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" className={input} aria-label="Téléphone" />
        </section>
        <section className="flex flex-col gap-2 rounded-[22px] border border-line-soft bg-card p-4">
          <h2 className="text-[13px] font-extrabold text-muted">Paiement</h2>
          <label className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-[14px] font-bold ${pay === 'livraison' ? 'border-2 border-ink' : 'border border-line'}`}><input type="radio" name="pay" checked={pay === 'livraison'} onChange={() => setPay('livraison')} /> Espèces à la livraison</label>
          <label className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-[14px] font-bold ${omAvailable.ok ? (pay === 'orange_money' ? 'border-2 border-ink' : 'border border-line') : 'border border-line text-muted'}`}>
            <input type="radio" name="pay" disabled={!omAvailable.ok} checked={pay === 'orange_money'} onChange={() => setPay('orange_money')} /> Orange Money
            <span className="ml-auto text-[11.5px]">{omAvailable.ok ? (omAvailable.trial ? 'essai équipe' : 'argent bloqué jusqu’à la remise') : 'bientôt'}</span>
          </label>
          {pay === 'orange_money' && <p className="text-[12.5px] font-medium text-muted">Vous payez à l’étape suivante. L’argent reste bloqué par Hailand et n’est versé au vendeur qu’une fois le colis remis ; il vous est rendu si la commande est annulée.</p>}
        </section>
        <section className="flex flex-col gap-1 text-[13.5px] font-semibold">
          <div className="flex justify-between"><span className="text-muted">Articles</span><span>{formatGnf(cartSubtotal(lines))}</span></div>
          <div className="flex justify-between"><span className="text-muted">Livraison</span><span>calculée à la validation</span></div>
        </section>
        {error && <p role="alert" className="rounded-2xl bg-[#fde8e4] px-4 py-3 text-[13.5px] font-semibold text-[#8a2a1c]">{error}</p>}
        <Button type="submit" disabled={busy || !decl}>{busy ? 'Envoi…' : 'Passer la commande'}</Button>
      </form>
    </main>
  );
}
