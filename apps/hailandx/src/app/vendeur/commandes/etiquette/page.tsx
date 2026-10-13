'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import QRCode from 'qrcode';
import { formatGnf } from '@hailandx/commerce';
import { browserClient } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';

interface Item { id: string; name_snapshot: string; variant_label: string | null; quantity: number }
interface Parcel { id: string; status: string; cod_amount_gnf: number; created_at: string; shops: { name: string } | null; order_items: Item[] }

/** Étiquette de colis (A6) : QR à faire scanner au retrait, contenu, montant à encaisser. S'imprime depuis le navigateur. */
function Label() {
  const id = useSearchParams().get('colis');
  const session = useSession();
  const [p, setP] = useState<Parcel | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const sb = browserClient();
    if (!sb || !session || !id) return;
    (async () => {
      const r = await sb.from('parcels').select('id,status,cod_amount_gnf,created_at,shops(name),order_items(id,name_snapshot,variant_label,quantity)').eq('id', id).maybeSingle();
      if (!r.data) return setError('Colis introuvable.');
      setP(r.data as unknown as Parcel);
      const q = await sb.rpc('fn_parcel_qr', { p_parcel: id });
      if (q.error || typeof q.data !== 'string') return setError('Le QR n’est pas disponible : le colis doit d’abord être marqué « prêt ».');
      setQr(await QRCode.toDataURL(q.data, { margin: 1, width: 420, errorCorrectionLevel: 'M' }));
    })();
  }, [session, id]);
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-5 pb-10 pt-6 print:max-w-none print:p-0">
      <div className="flex items-center justify-between print:hidden"><Link href="/vendeur/commandes" className="text-[13px] font-bold text-blue-ink">← Commandes</Link><button type="button" onClick={() => window.print()} disabled={!qr} className="h-11 rounded-2xl bg-ink px-5 text-[14px] font-extrabold text-white disabled:opacity-40">Imprimer</button></div>
      {session === null && <Link href={`/connexion?next=${encodeURIComponent(`/vendeur/commandes/etiquette?colis=${id ?? ''}`)}`} className="font-bold text-blue-ink">Se connecter</Link>}
      {error && <p role="alert" className="rounded-2xl bg-[#fde8e4] px-4 py-3 text-[13.5px] font-semibold text-[#8a2a1c] print:hidden">{error}</p>}
      {p && qr && (
        <section className="mx-auto flex w-full max-w-[380px] flex-col gap-3 rounded-2xl border-2 border-ink bg-white p-4 text-ink print:max-w-[105mm] print:break-inside-avoid" aria-label="Étiquette du colis">
          <div className="flex items-baseline justify-between"><span className="font-display text-[20px] font-bold">Hailand<span className="text-blue">X</span></span><span className="text-[11px] font-bold text-muted">{new Date(p.created_at).toLocaleDateString('fr-FR')}</span></div>
          <div className="text-[15px] font-extrabold">{p.shops?.name}</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR du colis" className="mx-auto h-[210px] w-[210px]" />
          <div className="text-center font-mono text-[13px] font-bold tracking-wider">N° {p.id.slice(0, 8).toUpperCase()}</div>
          <ul className="flex flex-col gap-0.5 border-t border-dashed border-ink/40 pt-2 text-[13.5px] font-bold">{p.order_items.map((i) => <li key={i.id}>{i.quantity} × {i.name_snapshot}{i.variant_label ? ` · ${i.variant_label}` : ''}</li>)}</ul>
          <div className="rounded-xl bg-ink px-3 py-2 text-center text-[15px] font-extrabold text-white">{p.cod_amount_gnf > 0 ? `À ENCAISSER : ${formatGnf(p.cod_amount_gnf)}` : 'DÉJÀ PAYÉ — rien à encaisser'}</div>
          <p className="text-center text-[11px] font-semibold text-muted">Le livreur scanne ce QR au retrait. Collez l’étiquette sur le colis.</p>
        </section>
      )}
    </main>
  );
}
export default function LabelPage() { return <Suspense><Label /></Suspense>; }
