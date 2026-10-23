'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatGnf } from '@hailandx/commerce';
import { BackHeader, browserClient, Chips, Icon, Screen } from '@hailandx/kit';
import { SellerGate } from '@/components/SellerGate';

interface Client { client: string; quartier: string | null; orders: number; total_gnf: number; first_at: string; last_at: string }
type Filter = 'tous' | 'fideles' | 'partis';
const DAY = 86_400_000;
const since = (iso: string) => {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / DAY);
  return d === 0 ? 'aujourd’hui' : d === 1 ? 'hier' : d < 14 ? `il y a ${d} j` : d < 60 ? `il y a ${Math.round(d / 7)} sem.` : `il y a ${Math.round(d / 30)} mois`;
};

/**
 * Clients (maquette v6 B4) : pseudonymes (« Client 7F3A ») calculés par la base, quartier, commandes, total, dernière commande.
 * Jamais de nom, de numéro ni d'adresse exacte : Hailand les protège (`fn_shop_clients`).
 */
export default function ClientsPage() {
  return <SellerGate title="Clients">{({ shop }) => <Clients shopId={shop.id} />}</SellerGate>;
}

function Clients({ shopId }: { shopId: string }) {
  const [rows, setRows] = useState<Client[] | null>(null);
  const [filter, setFilter] = useState<Filter>('tous');
  useEffect(() => {
    browserClient()?.rpc('fn_shop_clients', { p_shop: shopId }).then(({ data }) =>
      setRows(((data as Client[]) ?? []).map((c) => ({ ...c, orders: Number(c.orders), total_gnf: Number(c.total_gnf) }))));
  }, [shopId]);

  const all = rows ?? [];
  const loyal = all.filter((c) => c.orders >= 2);
  const gone = all.filter((c) => Date.now() - new Date(c.last_at).getTime() > 30 * DAY);
  const list = filter === 'fideles' ? loyal : filter === 'partis' ? gone : all;
  const back = all.length ? Math.round((loyal.length / all.length) * 100) : 0;

  return (
    <Screen>
      <BackHeader href="/plus" title="Clients" />
      <div className="grid grid-cols-3 gap-2">
        {[[all.length, 'clients'], [loyal.length, 'fidèles'], [`${back} %`, 'reviennent']].map(([v, l]) => (
          <span key={String(l)} className="flex flex-col rounded-2xl border border-line-soft bg-card p-3"><span className="font-display text-[19px] font-semibold">{rows ? v : '…'}</span><span className="text-[11.5px] font-bold text-muted">{l}</span></span>
        ))}
      </div>
      <Chips label="Filtrer les clients" value={filter} onChange={setFilter} items={[{ id: 'tous', label: 'Tous' }, { id: 'fideles', label: `Fidèles · ${loyal.length}` }, { id: 'partis', label: `Pas revenus depuis 30 j · ${gone.length}` }]} />
      {rows === null && <p className="text-[14px] font-semibold text-muted">Chargement…</p>}
      {rows && list.length === 0 && <p className="rounded-[20px] border border-dashed border-line px-4 py-6 text-center text-[13.5px] font-bold text-muted">{all.length === 0 ? 'Vos clients apparaîtront ici après leur première commande.' : 'Personne dans ce filtre.'}</p>}
      {list.length > 0 && (
        <section className="overflow-hidden rounded-[22px] border border-line-soft bg-card">
          {list.map((c, i) => (
            <div key={c.client} className={`flex items-center gap-3 px-4 py-3 ${i < list.length - 1 ? 'border-b border-[#f0ede6]' : ''}`}>
              <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-soft text-[13px] font-extrabold text-blue">{c.client.slice(-4, -2)}</span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-1.5"><span className="text-[14.5px] font-extrabold">{c.client}</span>{c.orders >= 2 && <span className="rounded-full bg-lime px-2 py-0.5 text-[11px] font-extrabold">Fidèle</span>}</span>
                <span className="truncate text-[12px] font-semibold text-muted">{c.orders} commande{c.orders > 1 ? 's' : ''} · {c.quartier ?? 'quartier ?'} · {since(c.last_at)}</span>
              </span>
              <span className="shrink-0 text-[13px] font-extrabold">{formatGnf(c.total_gnf)}</span>
            </div>
          ))}
        </section>
      )}
      {gone.length > 0 && (
        <Link href="/marketing/codes" className="flex items-center gap-3 rounded-[20px] border border-line-soft bg-card p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-soft text-blue"><Icon name="percent" size={19} /></span>
          <span className="flex min-w-0 flex-1 flex-col"><span className="text-[14px] font-extrabold">Faire revenir {gone.length} client{gone.length > 1 ? 's' : ''}</span><span className="text-[12px] font-semibold text-muted">Créez un code promo et publiez-le sur votre statut WhatsApp.</span></span>
          <Icon name="chevron" size={16} stroke={2} className="text-[#9a9db0]" />
        </Link>
      )}
      <p className="text-[11.5px] font-semibold leading-snug text-muted">Vous voyez un pseudonyme, le quartier et l’historique d’achat. Le nom, le numéro et l’adresse exacte restent protégés par Hailand.</p>
    </Screen>
  );
}
