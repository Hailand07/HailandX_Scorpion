'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { browserClient, useSession } from '@hailandx/kit';

/**
 * Accès aux commandes pour le client venu par un lien (§49, §53, §56) : pas de menu, mais dès qu'il est connecté et a déjà commandé,
 * un bouton « Mes commandes » sur chaque fiche et chaque boutique. Il mène toujours à la liste (chaque commande s'y ouvre en « Aperçu »).
 */
export function SuiviCommande({ className = '' }: { className?: string }) {
  const session = useSession();
  const [has, setHas] = useState(false);
  useEffect(() => {
    const sb = browserClient(); const uid = session?.user.id;
    if (!sb || !uid) { setHas(false); return; }
    void sb.from('orders').select('id').eq('buyer_id', uid).limit(1).then(({ data }) => setHas(Boolean(data?.length)));
  }, [session]);
  if (!has) return null;
  return <Link href="/commandes" className={`flex h-11 items-center rounded-2xl border border-line bg-card px-3.5 text-[13px] font-extrabold ${className}`}>Mes commandes</Link>;
}
