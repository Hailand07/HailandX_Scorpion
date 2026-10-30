'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { browserClient, useSession } from '@hailandx/kit';

/**
 * « Ma commande » : le seul chemin pour retrouver son colis, montré seulement quand le client connecté a un colis en cours
 * (phase de lancement, §49 : pas de menu, le client reste sur la fiche du vendeur). Mène droit à la commande la plus récente.
 */
export function SuiviCommande() {
  const session = useSession();
  const [order, setOrder] = useState<string | null>(null);
  useEffect(() => {
    const sb = browserClient(); const uid = session?.user.id;
    if (!sb || !uid) { setOrder(null); return; }
    void sb.from('parcels').select('order_id, orders!inner(buyer_id)').eq('orders.buyer_id', uid).not('status', 'in', '(remis,annule)').order('created_at', { ascending: false }).limit(1)
      .then(({ data }) => setOrder((data as { order_id: string }[] | null)?.[0]?.order_id ?? null));
  }, [session]);
  if (!order) return null;
  return <Link href={`/commandes/${order}`} className="flex h-11 items-center rounded-2xl border border-line bg-card px-3.5 text-[13px] font-extrabold">Ma commande</Link>;
}
