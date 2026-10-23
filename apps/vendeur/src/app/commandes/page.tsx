'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { formatGnf, type ParcelStatus, sellerTab, type SellerTab } from '@hailandx/commerce';
import { browserClient, Chips, Icon, Screen } from '@hailandx/kit';
import { SellerGate } from '@/components/SellerGate';
import { orderCode, payLabel, statusPill } from '@/lib/orders';
import { Chargement } from '@hailandx/ui';

interface Parcel { id: string; status: ParcelStatus; subtotal_gnf: number; discount_gnf: number; created_at: string; orders: { payment_method: string; payment_status: string } | null; order_items: { id: string; name_snapshot: string; quantity: number }[] }

const TABS: SellerTab[] = ['preparer', 'route', 'terminees', 'problemes'];

/** Commandes (maquette v6 A2) : quatre onglets, recherche ; chaque carte ouvre la fiche du colis (préparer, QR, annuler avec motif). */
export default function SellerOrdersPage() {
  return <SellerGate title="Commandes">{({ shop }) => <Orders shopId={shop.id} />}</SellerGate>;
}

function Orders({ shopId }: { shopId: string }) {
  const sb = browserClient();
  const [parcels, setParcels] = useState<Parcel[] | null>(null);
  const [tab, setTab] = useState<SellerTab>('preparer');
  const [search, setSearch] = useState('');

  useEffect(() => { const t = new URLSearchParams(window.location.search).get('onglet'); if (TABS.includes(t as SellerTab)) setTab(t as SellerTab); }, []);

  const load = useCallback(async () => {
    if (!sb) return;
    const { data } = await sb.from('parcels').select('id,status,subtotal_gnf,discount_gnf,created_at,orders(payment_method,payment_status),order_items(id,name_snapshot,quantity)').eq('shop_id', shopId).order('created_at', { ascending: false }).limit(200);
    setParcels((data as unknown as Parcel[]) ?? []);
  }, [sb, shopId]);
  useEffect(() => { void load(); const t = setInterval(load, 10_000); return () => clearInterval(t); }, [load]);

  const all = parcels ?? [];
  const count = (t: SellerTab) => all.filter((p) => sellerTab(p.status) === t).length;
  const needle = search.trim().toLowerCase().replace(/^hx-?/, '');
  const list = all
    .filter((p) => (needle ? p.id.startsWith(needle) || p.order_items.some((i) => i.name_snapshot.toLowerCase().includes(needle)) : sellerTab(p.status) === tab))
    .sort((a, b) => (tab === 'preparer' && !needle ? a.created_at.localeCompare(b.created_at) : 0));

  return (
    <Screen className="pt-5">
      <h1 className="font-display text-[26px] font-semibold tracking-tight">Commandes</h1>
      <label className="flex h-12 items-center gap-2.5 rounded-2xl border border-line bg-card px-3.5 text-muted focus-within:border-blue">
        <Icon name="search" size={18} stroke={2} />
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Numéro HX-… ou nom de produit" aria-label="Chercher une commande" className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-ink outline-none" />
      </label>
      {!needle && <Chips label="Filtrer les commandes" value={tab} onChange={setTab} items={[
        { id: 'preparer', label: `À préparer${count('preparer') ? ` · ${count('preparer')}` : ''}` }, { id: 'route', label: `En livraison${count('route') ? ` · ${count('route')}` : ''}` },
        { id: 'terminees', label: 'Terminées' }, { id: 'problemes', label: `Problèmes${count('problemes') ? ` · ${count('problemes')}` : ''}` },
      ]} />}
      {parcels === null && <Chargement />}
      {parcels && list.length === 0 && (
        <p className="mt-2 rounded-[20px] border border-dashed border-line px-4 py-6 text-center text-[13.5px] font-bold text-muted">
          {needle ? 'Aucune commande ne correspond.' : tab === 'problemes' ? 'Aucun problème signalé. Bravo.' : tab === 'preparer' ? 'Rien à préparer pour l’instant. Partagez un produit depuis Marketing pour attirer des clients.' : 'Rien ici pour l’instant.'}
        </p>
      )}
      {list.map((p) => {
        const [pillClass, pillText] = statusPill(p.status, p.created_at);
        const pay = payLabel(p.orders?.payment_method, p.orders?.payment_status);
        const items = p.order_items.map((i) => (i.quantity > 1 ? `${i.name_snapshot} ×${i.quantity}` : i.name_snapshot)).join(' · ');
        return (
          <Link key={p.id} href={`/commandes/${p.id}`} className="flex flex-col gap-2 rounded-[20px] border border-line-soft bg-card p-4 active:bg-bg">
            <span className="flex items-center justify-between gap-2">
              <span className="text-[12.5px] font-extrabold text-muted">{orderCode(p.id)}</span>
              <span className="font-display text-[15px] font-semibold">{formatGnf(p.subtotal_gnf)}</span>
            </span>
            <span className="line-clamp-2 text-[14.5px] font-extrabold leading-snug">{items}</span>
            <span className="flex flex-wrap items-center gap-1.5">
              <span className={`rounded-full px-2.5 py-1 text-[11.5px] font-extrabold ${pillClass}`}>{pillText}</span>
              <span className={`rounded-full px-2.5 py-1 text-[11.5px] font-extrabold ${pay.paid ? 'bg-ok-soft text-ok' : 'bg-sand'}`}>{pay.text}</span>
              {p.discount_gnf > 0 && <span className="rounded-full bg-blue-soft px-2.5 py-1 text-[11.5px] font-extrabold text-blue-ink">code promo</span>}
            </span>
          </Link>
        );
      })}
    </Screen>
  );
}
