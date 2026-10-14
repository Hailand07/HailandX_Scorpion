'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import { formatGnf, type ParcelStatus } from '@hailandx/commerce';
import { browserClient } from '@/lib/supabase';
import { ago, sellerTab, type SellerTab } from '@/lib/seller';
import { DisputeThread } from '@/components/DisputeThread';
import { ProofPhoto } from '@/components/ProofPhoto';
import { BackHeader, Chips, errText, Icon, Notice, Screen } from '@/components/Screen';
import { SellerGate } from '@/components/seller/SellerGate';

interface Parcel { orders: { payment_method: string; payment_status: string } | null; id: string; status: ParcelStatus; subtotal_gnf: number; created_at: string; ready_at: string | null; delivered_at: string | null; order_items: { id: string; name_snapshot: string; variant_label: string | null; quantity: number }[] }

const TABS: SellerTab[] = ['preparer', 'route', 'terminees', 'problemes'];
const NOTE: Partial<Record<ParcelStatus, string>> = {
  prepare: 'Colis prêt : Hailand cherche un livreur proche.',
  mission_proposee: 'Mission proposée aux livreurs proches. Gardez le colis à portée de main.',
  accepte: 'Un livreur Hailand arrive. Il scanne le QR de l’étiquette.',
  retire: 'Le livreur a récupéré le colis : il est en route vers le client.',
};

/** Commandes de ma boutique (v2) : quatre onglets ; un colis reste « à préparer » tant que le livreur ne l'a pas retiré. */
export default function SellerOrdersPage() {
  return <SellerGate title="Commandes">{({ shop }) => <Orders shopId={shop.id} />}</SellerGate>;
}

function Orders({ shopId }: { shopId: string }) {
  const sb = browserClient();
  const [parcels, setParcels] = useState<Parcel[] | null>(null);
  const [tab, setTab] = useState<SellerTab>('preparer');
  const [qr, setQr] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => { const t = new URLSearchParams(window.location.search).get('onglet'); if (TABS.includes(t as SellerTab)) setTab(t as SellerTab); }, []);

  const load = useCallback(async () => {
    if (!sb) return;
    const { data } = await sb.from('parcels').select('id,status,subtotal_gnf,created_at,ready_at,delivered_at,orders(payment_method,payment_status),order_items(id,name_snapshot,variant_label,quantity)').eq('shop_id', shopId).order('created_at', { ascending: false }).limit(100);
    setParcels((data as unknown as Parcel[]) ?? []);
  }, [sb, shopId]);

  useEffect(() => { void load(); const t = setInterval(load, 10_000); return () => clearInterval(t); }, [load]);

  async function run(fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) {
    setMsg(null);
    const { error } = await fn();
    setMsg(error ? { tone: 'err', text: errText(error) } : { tone: 'ok', text: ok });
    await load();
  }

  async function showQr(id: string) {
    const r = await sb!.rpc('fn_parcel_qr', { p_parcel: id });
    if (r.error || typeof r.data !== 'string') return setMsg({ tone: 'err', text: 'Le QR n’est pas disponible.' });
    const url = await QRCode.toDataURL(r.data, { margin: 1, width: 360, errorCorrectionLevel: 'M' });
    setQr((q) => ({ ...q, [id]: url }));
  }

  const count = (t: SellerTab) => (parcels ?? []).filter((p) => sellerTab(p.status) === t).length;
  const prep = (parcels ?? []).filter((p) => p.status === 'attente_vendeur').length;
  const list = (parcels ?? []).filter((p) => sellerTab(p.status) === tab).sort((a, b) => (tab === 'preparer' ? a.created_at.localeCompare(b.created_at) : 0));

  return (
    <Screen>
      <BackHeader href="/vendeur" title="Commandes" label="Retour à Ma boutique" />
      <Chips label="Filtrer les commandes" value={tab} onChange={setTab} items={[
        { id: 'preparer', label: `À préparer · ${prep}` }, { id: 'route', label: `En route${count('route') ? ` · ${count('route')}` : ''}` },
        { id: 'terminees', label: 'Terminées' }, { id: 'problemes', label: `Problèmes${count('problemes') ? ` · ${count('problemes')}` : ''}` },
      ]} />
      <Notice msg={msg} />
      {parcels === null && <p className="text-[14px] font-semibold text-muted">Chargement…</p>}
      {parcels && list.length === 0 && <p className="mt-8 text-center text-[14px] font-semibold text-muted">{tab === 'problemes' ? 'Aucun problème signalé. Bravo.' : tab === 'preparer' ? 'Rien à préparer pour l’instant.' : 'Rien ici pour l’instant.'}</p>}
      {list.map((p) => {
        const paid = p.orders?.payment_method === 'orange_money';
        const waitingPay = p.status === 'attente_vendeur' && paid && p.orders?.payment_status === 'en_attente';
        const pill = p.status === 'attente_vendeur' ? ['bg-lime text-ink', ago(p.created_at)]
          : p.status === 'remis' ? ['bg-ok-soft text-ok', 'remis']
          : p.status === 'annule' ? ['bg-sand text-muted', 'annulé']
          : p.status === 'litige' ? ['bg-[#fde8e4] text-[#a3321f]', 'litige']
          : p.status === 'retire' ? ['bg-blue-soft text-blue-ink', 'en route'] : ['bg-blue-soft text-blue-ink', 'prêt'];
        return (
          <article key={p.id} className="flex flex-col gap-3 rounded-[22px] border border-line-soft bg-card p-4">
            <div className="flex items-center justify-between gap-2.5">
              <span className="text-[13px] font-extrabold">Commande HX-{p.id.slice(0, 4).toUpperCase()}</span>
              <span className={`rounded-full px-2.5 py-1 text-[11.5px] font-extrabold ${pill[0]}`}>{pill[1]}</span>
            </div>
            <ul className="flex flex-col gap-1.5">
              {p.order_items.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-2.5">
                  <span className="flex min-w-0 flex-col"><span className="truncate text-[14px] font-extrabold">{i.name_snapshot}</span>{i.variant_label && <span className="text-[12px] font-semibold text-muted">{i.variant_label}</span>}</span>
                  <span className="shrink-0 text-[13px] font-extrabold">× {i.quantity}</span>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-[#f0ede6] pt-2.5 text-[12.5px] font-bold text-muted">
              <span>{paid ? (p.orders?.payment_status === 'en_attente' ? 'Orange Money · paiement attendu' : 'Payée par Orange Money') : 'Espèces à la livraison'}</span>
              <span className="font-display text-[15px] font-semibold text-ink">{formatGnf(p.subtotal_gnf)}</span>
            </div>

            {waitingPay && <p className="rounded-[14px] bg-amber-soft px-3 py-2.5 text-[12.5px] font-bold">Attendez le paiement de l’acheteur : vous pourrez préparer dès que l’argent est bloqué par Hailand.</p>}
            {p.status === 'attente_vendeur' && !waitingPay && (
              <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                <Link href={`/vendeur/commandes/etiquette?colis=${p.id}`} className="flex h-[46px] items-center justify-center rounded-[14px] border border-line text-[13.5px] font-extrabold">Étiquette</Link>
                <button type="button" onClick={() => run(() => sb!.rpc('fn_parcel_ready', { p_parcel: p.id }), 'Colis prêt : les livreurs proches sont prévenus.')} className="h-[46px] rounded-[14px] bg-ink text-[13.5px] font-extrabold text-white">Colis prêt</button>
                <button type="button" aria-label="Refuser la commande" onClick={() => { if (confirm('Refuser cette commande ? Elle sera annulée et le client prévenu.')) void run(() => sb!.rpc('fn_parcel_cancel', { p_parcel: p.id }), 'Commande refusée.'); }} className="flex h-[46px] w-[46px] items-center justify-center rounded-[14px] border border-line text-muted"><Icon name="close" size={18} stroke={2.2} /></button>
              </div>
            )}
            {NOTE[p.status] && (
              <div className="flex items-center gap-2.5 rounded-[14px] bg-blue-soft px-3 py-2.5 text-[12.5px] font-bold leading-snug text-blue-ink"><Icon name="truck" size={18} stroke={2} />{NOTE[p.status]}</div>
            )}
            {(p.status === 'prepare' || p.status === 'mission_proposee' || p.status === 'accepte') && (
              <>
                {!qr[p.id] ? <button type="button" onClick={() => showQr(p.id)} className="h-12 rounded-[14px] bg-lime text-[14px] font-extrabold">Afficher le QR du colis</button> : (
                  <div className="flex flex-col items-center gap-1.5 rounded-2xl bg-white p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qr[p.id]} alt="QR du colis, à faire scanner par le livreur" className="h-[220px] w-[220px]" />
                    <span className="text-[12px] font-bold text-muted">À faire scanner par le livreur au retrait</span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Link href={`/vendeur/commandes/etiquette?colis=${p.id}`} className="flex h-11 items-center justify-center rounded-[14px] border border-line text-[13px] font-extrabold">Étiquette</Link>
                  <button type="button" onClick={() => { if (confirm('Annuler ce colis ? La commande sera annulée et le client prévenu.')) void run(() => sb!.rpc('fn_parcel_cancel', { p_parcel: p.id }), 'Colis annulé.'); }} className="h-11 rounded-[14px] border border-line text-[13px] font-bold">Annuler le colis</button>
                </div>
              </>
            )}
            {p.status === 'litige' && <SellerDispute parcel={p.id} />}
            {(p.status === 'remis' || p.status === 'litige') && <ProofPhoto parcelId={p.id} />}
          </article>
        );
      })}
    </Screen>
  );
}

/** Litige ouvert par l'acheteur sur ce colis : le vendeur répond dans le fil ; l'équipe tranche. */
function SellerDispute({ parcel }: { parcel: string }) {
  const [d, setD] = useState<{ id: string; status: string; reason: string } | null | undefined>(undefined);
  useEffect(() => { browserClient()?.from('disputes').select('id,status,reason').eq('parcel_id', parcel).maybeSingle().then(({ data }) => setD((data as { id: string; status: string; reason: string } | null) ?? null)); }, [parcel]);
  if (!d) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="rounded-[14px] bg-amber-soft px-3 py-2.5 text-[12.5px] font-bold">L’acheteur a signalé un problème. Expliquez votre version : l’équipe Hailand tranche.</p>
      <DisputeThread disputeId={d.id} open={d.status === 'ouvert'} mine="vendeur" />
    </div>
  );
}
