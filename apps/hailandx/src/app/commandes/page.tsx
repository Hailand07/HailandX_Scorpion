'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge, Wordmark } from '@hailandx/ui';
import { formatGnf } from '@hailandx/commerce';
import { browserClient } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';

interface Order { id: string; total_gnf: number; created_at: string; payment_method: string }

/** Mes commandes. */
export default function OrdersPage() {
  const session = useSession();
  const [orders, setOrders] = useState<Order[] | null>(null);
  useEffect(() => {
    const sb = browserClient();
    if (!sb || !session) return;
    sb.from('orders').select('id,total_gnf,created_at,payment_method').eq('buyer_id', session.user.id).order('created_at', { ascending: false }).limit(50).then(({ data }) => setOrders((data as Order[]) ?? []));
  }, [session]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-5 pb-10 pt-6">
      <div className="flex items-center justify-between"><Link href="/" aria-label="Accueil"><Wordmark /></Link><h1 className="font-display text-[20px] font-semibold">Mes commandes</h1></div>
      {session === null && <Link href="/connexion?next=/commandes" className="font-bold text-blue-ink">Se connecter pour voir mes commandes</Link>}
      {session && orders === null && <p className="text-[14px] font-medium text-muted">Chargement…</p>}
      {orders?.length === 0 && <p className="text-[14px] font-medium text-muted">Aucune commande pour l’instant.</p>}
      {orders?.map((o) => (
        <Link key={o.id} href={`/commandes/${o.id}`} className="flex items-center justify-between gap-3 rounded-2xl border border-line-soft bg-card px-4 py-3.5">
          <span className="flex flex-col"><span className="text-[14px] font-bold">Commande du {new Date(o.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</span><span className="text-[12px] font-semibold text-muted">{o.payment_method === 'livraison' ? 'Espèces à la livraison' : 'Orange Money'}</span></span>
          <span className="flex items-center gap-2"><span className="font-display text-[14.5px] font-semibold">{formatGnf(o.total_gnf)}</span><Badge>Suivre</Badge></span>
        </Link>
      ))}
    </main>
  );
}
