'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import { Badge, Wordmark } from '@hailandx/ui';
import { formatGnf, type ParcelStatus } from '@hailandx/commerce';
import { browserClient } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';

interface Parcel { orders: { payment_method: string; payment_status: string } | null; id: string; status: ParcelStatus; subtotal_gnf: number; delivery_fee_gnf: number; cod_amount_gnf: number; created_at: string; order_items: { id: string; name_snapshot: string; variant_label: string | null; quantity: number }[] }

const LABEL: Record<ParcelStatus, string> = {
  attente_vendeur: 'À préparer', prepare: 'Prêt', mission_proposee: 'En attente d’un livreur', accepte: 'Livreur en route vers vous',
  retire: 'Parti en livraison', remis: 'Remis', annule: 'Annulé', litige: 'Litige',
};

/** Commandes d'un vendeur : un colis par commande. « Prêt » propose la mission aux livreurs ; le QR du colis se présente au livreur. */
export default function SellerOrdersPage() {
  const session = useSession();
  const sb = browserClient();
  const [parcels, setParcels] = useState<Parcel[] | null>(null);
  const [qr, setQr] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sb) return;
    const { data } = await sb.from('parcels').select('id,status,subtotal_gnf,delivery_fee_gnf,cod_amount_gnf,created_at,orders(payment_method,payment_status),order_items(id,name_snapshot,variant_label,quantity)').order('created_at', { ascending: false }).limit(60);
    setParcels((data as unknown as Parcel[]) ?? []);
  }, [sb]);

  useEffect(() => {
    if (!session) return;
    void load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [session, load]);

  async function run(fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) {
    setMsg(null);
    const { error } = await fn();
    setMsg(error ? error.message.replace(/^.*?:\s*/, '') : ok);
    await load();
  }

  async function showQr(id: string) {
    const r = await sb!.rpc('fn_parcel_qr', { p_parcel: id });
    if (r.error || typeof r.data !== 'string') return setMsg('Le QR n’est pas disponible.');
    setQr((q) => ({ ...q, [id]: '' }));
    const url = await QRCode.toDataURL(r.data, { margin: 1, width: 360, errorCorrectionLevel: 'M' });
    setQr((q) => ({ ...q, [id]: url }));
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-5 pb-10 pt-6">
      <div className="flex items-center justify-between"><Link href="/" aria-label="Accueil"><Wordmark /></Link><Link href="/vendeur" className="text-[13px] font-bold text-blue-ink">Mon espace</Link></div>
      <h1 className="font-display text-[22px] font-semibold tracking-tight">Commandes à préparer</h1>
      {session === null && <Link href="/connexion?next=/vendeur/commandes" className="font-bold text-blue-ink">Se connecter</Link>}
      {msg && <p role="status" className="rounded-2xl bg-sand px-4 py-3 text-[13.5px] font-semibold">{msg}</p>}
      {parcels === null && session && <p className="text-[14px] font-medium text-muted">Chargement…</p>}
      {parcels?.length === 0 && <p className="text-[14px] font-medium text-muted">Aucune commande pour l’instant.</p>}
      {parcels?.map((p) => (
        <section key={p.id} className="flex flex-col gap-2.5 rounded-[22px] border border-line-soft bg-card p-4">
          <div className="flex items-center justify-between"><span className="text-[12.5px] font-bold text-muted">{new Date(p.created_at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span><Badge tone={p.status === 'attente_vendeur' ? 'lime' : p.status === 'remis' ? 'ok' : 'sand'}>{LABEL[p.status]}</Badge></div>
          <ul className="flex flex-col gap-0.5 text-[14px] font-bold">{p.order_items.map((i) => <li key={i.id}>{i.quantity} × {i.name_snapshot}{i.variant_label ? ` · ${i.variant_label}` : ''}</li>)}</ul>
          <div className="flex justify-between text-[13px] font-semibold text-muted"><span>Vos articles</span><span>{formatGnf(p.subtotal_gnf)}</span></div>
          {p.status === 'attente_vendeur' && p.orders?.payment_method === 'orange_money' && p.orders.payment_status === 'en_attente' && <p className="rounded-2xl bg-amber-soft px-3.5 py-2.5 text-[12.5px] font-bold">En attente du paiement de l’acheteur (Orange Money) : vous pourrez préparer le colis dès que l’argent est bloqué.</p>}
          {p.status === 'attente_vendeur' && p.orders?.payment_method === 'orange_money' && p.orders.payment_status === 'bloque' && <p className="rounded-2xl bg-ok-soft px-3.5 py-2.5 text-[12.5px] font-bold text-ok">Payé : l’argent est bloqué par Hailand et vous sera versé à la remise.</p>}
          {p.status === 'attente_vendeur' && (
            <div className="flex gap-2">
              <button type="button" onClick={() => run(() => sb!.rpc('fn_parcel_ready', { p_parcel: p.id }), 'Colis prêt : les livreurs proches sont prévenus.')} className="h-12 flex-1 rounded-2xl bg-ink text-[14.5px] font-extrabold text-white">Colis prêt</button>
              <button type="button" onClick={() => run(() => sb!.rpc('fn_parcel_cancel', { p_parcel: p.id }), 'Colis annulé.')} className="h-12 rounded-2xl border border-line px-4 text-[13.5px] font-bold">Refuser</button>
            </div>
          )}
          {(p.status === 'mission_proposee' || p.status === 'accepte' || p.status === 'prepare') && (
            <>
              <Link href={`/vendeur/commandes/etiquette?colis=${p.id}`} className="flex h-11 items-center justify-center rounded-2xl border border-line text-[13.5px] font-bold">Étiquette imprimable</Link>
              {!qr[p.id] && <button type="button" onClick={() => showQr(p.id)} className="h-12 rounded-2xl bg-lime text-[14.5px] font-extrabold">Afficher le QR du colis</button>}
              {qr[p.id] && (
                <div className="flex flex-col items-center gap-1.5 rounded-2xl bg-white p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qr[p.id]} alt="QR du colis, à faire scanner par le livreur" className="h-[220px] w-[220px]" />
                  <span className="text-[12px] font-bold text-muted">À faire scanner par le livreur au retrait</span>
                </div>
              )}
              <button type="button" onClick={() => run(() => sb!.rpc('fn_parcel_cancel', { p_parcel: p.id }), 'Colis annulé.')} className="h-11 rounded-2xl border border-line text-[13px] font-bold">Annuler ce colis</button>
            </>
          )}
        </section>
      ))}
    </main>
  );
}
