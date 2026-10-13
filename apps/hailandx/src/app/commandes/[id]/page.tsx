'use client';
import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge, Wordmark } from '@hailandx/ui';
import { buyerStep, formatGnf, type ParcelStatus } from '@hailandx/commerce';
import { browserClient } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';

interface Order { id: string; total_gnf: number; subtotal_gnf: number; delivery_fee_gnf: number; payment_method: string; created_at: string }
interface Parcel { id: string; status: ParcelStatus; subtotal_gnf: number; delivery_fee_gnf: number; shops: { name: string; slug: string } | null; order_items: { id: string; name_snapshot: string; quantity: number; price_gnf_snapshot: number }[] }

const STEPS = [
  { key: 'confirmee', label: 'Confirmée', help: 'Le vendeur prépare votre colis.' },
  { key: 'preparee', label: 'Prête', help: 'Un livreur de la Flotte Hailand va le récupérer.' },
  { key: 'en_route', label: 'En route', help: 'Le livreur est en chemin vers votre porte.' },
  { key: 'remise', label: 'Remise', help: 'Colis remis. Merci !' },
] as const;

/** Suivi d'une commande : un bloc par colis (un colis par boutique), code de remise, annulation, avis. */
export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const session = useSession();
  const sb = browserClient();
  const [order, setOrder] = useState<Order | null>(null);
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    if (!sb) return;
    const o = await sb.from('orders').select('id,total_gnf,subtotal_gnf,delivery_fee_gnf,payment_method,created_at').eq('id', id).maybeSingle();
    if (!o.data) { setMissing(true); return; }
    setOrder(o.data as Order);
    const p = await sb.from('parcels').select('id,status,subtotal_gnf,delivery_fee_gnf,shops(name,slug),order_items(id,name_snapshot,quantity,price_gnf_snapshot)').eq('order_id', id).order('created_at');
    const list = (p.data as unknown as Parcel[]) ?? [];
    setParcels(list);
    const c: Record<string, string> = {};
    await Promise.all(list.filter((x) => x.status !== 'annule' && x.status !== 'remis').map(async (x) => { const r = await sb.rpc('fn_my_handover_code', { p_parcel: x.id }); if (typeof r.data === 'string') c[x.id] = r.data; }));
    setCodes(c);
  }, [sb, id]);

  useEffect(() => {
    if (!session) return;
    void load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [session, load]);

  async function act(fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) {
    setMsg(null);
    const { error } = await fn();
    setMsg(error ? error.message.replace(/^.*?:\s*/, '') : ok);
    await load();
  }

  if (session === null) return <main className="mx-auto max-w-md px-5 pt-6"><Link href={`/connexion?next=/commandes/${id}`} className="font-bold text-blue-ink">Se connecter pour suivre la commande</Link></main>;
  if (missing) return <main className="mx-auto max-w-md px-5 pt-6"><p className="text-[14px] font-medium text-muted">Commande introuvable.</p><Link href="/commandes" className="font-bold text-blue-ink">Mes commandes</Link></main>;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-5 pb-10 pt-6">
      <div className="flex items-center justify-between"><Link href="/" aria-label="Accueil"><Wordmark /></Link><Link href="/commandes" className="text-[13px] font-bold text-blue-ink">Mes commandes</Link></div>
      <h1 className="font-display text-[22px] font-semibold tracking-tight">Suivi de commande</h1>
      {msg && <p role="status" className="rounded-2xl bg-sand px-4 py-3 text-[13.5px] font-semibold">{msg}</p>}
      {!order ? <p className="text-[14px] font-medium text-muted">Chargement…</p> : (
        <>
          {parcels.map((p) => {
            const step = buyerStep(p.status);
            const idx = STEPS.findIndex((s) => s.key === step);
            return (
              <section key={p.id} className="flex flex-col gap-3 rounded-[22px] border border-line-soft bg-card p-4">
                <div className="flex items-center justify-between"><h2 className="text-[14px] font-extrabold">{p.shops?.name ?? 'Boutique'}</h2>{step === 'annulee' ? <Badge tone="sand">Annulé</Badge> : step === 'litige' ? <Badge tone="sand">Litige</Badge> : <Badge tone={step === 'remise' ? 'ok' : 'blue'}>{STEPS[idx]!.label}</Badge>}</div>
                {idx >= 0 && (
                  <ol className="flex gap-1.5" aria-label="Étapes">{STEPS.map((s, i) => <li key={s.key} className={`h-1.5 flex-1 rounded-full ${i <= idx ? 'bg-blue' : 'bg-line'}`} aria-current={i === idx ? 'step' : undefined} title={s.label} />)}</ol>
                )}
                {idx >= 0 && <p className="text-[13px] font-medium text-muted">{STEPS[idx]!.help}</p>}
                <ul className="flex flex-col gap-1 text-[13.5px] font-semibold">{p.order_items.map((i) => <li key={i.id} className="flex justify-between gap-3"><span className="truncate">{i.quantity} × {i.name_snapshot}</span><span>{formatGnf(i.quantity * i.price_gnf_snapshot)}</span></li>)}</ul>
                <div className="flex justify-between text-[12.5px] font-semibold text-muted"><span>Livraison</span><span>{formatGnf(p.delivery_fee_gnf)}</span></div>
                {codes[p.id] && (p.status === 'accepte' || p.status === 'retire') && (
                  <div className="flex flex-col items-center gap-1 rounded-2xl bg-lime px-4 py-3">
                    <span className="text-[12px] font-extrabold">Code de remise — à donner au livreur à la porte</span>
                    <span className="font-display text-[34px] font-semibold tracking-[0.3em]" aria-label={`Code ${codes[p.id]!.split('').join(' ')}`}>{codes[p.id]}</span>
                  </div>
                )}
                {p.status === 'attente_vendeur' && <button type="button" onClick={() => act(() => sb!.rpc('fn_parcel_cancel', { p_parcel: p.id }), 'Colis annulé.')} className="h-11 rounded-2xl border border-line text-[13.5px] font-bold">Annuler ce colis</button>}
                {p.status === 'remis' && <Review parcel={p.id} onDone={() => load()} />}
              </section>
            );
          })}
          <div className="flex flex-col gap-1 rounded-2xl bg-sand px-4 py-3 text-[13.5px] font-semibold">
            <div className="flex justify-between"><span className="text-muted">Articles</span><span>{formatGnf(order.subtotal_gnf)}</span></div>
            <div className="flex justify-between"><span className="text-muted">Livraison</span><span>{formatGnf(order.delivery_fee_gnf)}</span></div>
            <div className="flex justify-between text-[15px] font-extrabold"><span>Total {order.payment_method === 'livraison' ? 'à payer en espèces' : ''}</span><span>{formatGnf(order.total_gnf)}</span></div>
          </div>
        </>
      )}
    </main>
  );
}

function Review({ parcel, onDone }: { parcel: string; onDone: () => void }) {
  const sb = browserClient();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [done, setDone] = useState<boolean | null>(null);
  useEffect(() => { sb?.from('reviews').select('id').eq('parcel_id', parcel).maybeSingle().then(({ data }) => setDone(Boolean(data))); }, [sb, parcel]);
  if (done === null) return null;
  if (done || state === 'done') return <p className="rounded-2xl bg-ok-soft px-4 py-3 text-[13px] font-bold text-ok">Merci pour votre avis vérifié ✓</p>;
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-line-soft p-3">
      <span className="text-[13px] font-extrabold">Votre avis (vérifié par la Flotte)</span>
      <div className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" aria-label={`${n} étoile${n > 1 ? 's' : ''}`} aria-pressed={rating === n} onClick={() => setRating(n)} className={`h-11 w-11 rounded-full text-xl ${n <= rating ? 'bg-amber' : 'bg-sand text-muted'}`}>★</button>)}</div>
      <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} rows={2} placeholder="Un commentaire (facultatif)" className="rounded-2xl border border-line bg-card px-3 py-2 text-[15px] outline-none" />
      {state === 'error' && <p role="alert" className="text-[12.5px] font-semibold text-[#8a2a1c]">L’avis n’a pas pu être envoyé.</p>}
      <button type="button" disabled={!rating || state === 'sending'} onClick={async () => { setState('sending'); const { error } = await sb!.rpc('fn_submit_review', { p_parcel: parcel, p_rating: rating, p_comment: comment }); setState(error ? 'error' : 'done'); if (!error) onDone(); }} className="h-11 rounded-2xl bg-ink text-[14px] font-extrabold text-white disabled:opacity-40">Envoyer mon avis</button>
    </div>
  );
}
