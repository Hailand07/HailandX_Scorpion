'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { browserClient, useSession } from '@hailandx/kit';

/**
 * Accès au suivi pour le client venu par un lien (§49, §53) : pas de menu, mais dès qu'il est connecté et a déjà commandé,
 * un bouton en haut de chaque fiche et de chaque boutique : « Ma commande » (la plus récente en cours) ou « Mes commandes ».
 */
export function SuiviCommande() {
  const session = useSession();
  const [target, setTarget] = useState<{ href: string; label: string } | null>(null);
  useEffect(() => {
    const sb = browserClient(); const uid = session?.user.id;
    if (!sb || !uid) { setTarget(null); return; }
    void sb.from('parcels').select('order_id,status, orders!inner(buyer_id)').eq('orders.buyer_id', uid).order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => {
        const rows = (data as { order_id: string; status: string }[] | null) ?? [];
        const live = rows.find((r) => !['remis', 'annule'].includes(r.status));
        setTarget(live ? { href: `/commandes/${live.order_id}`, label: 'Ma commande' } : rows.length ? { href: '/commandes', label: 'Mes commandes' } : null);
      });
  }, [session]);
  if (!target) return null;
  return <Link href={target.href} className="flex h-11 items-center rounded-2xl border border-line bg-card px-3.5 text-[13px] font-extrabold">{target.label}</Link>;
}
