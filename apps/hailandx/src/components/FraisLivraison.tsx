'use client';
import { useEffect, useState } from 'react';
import { formatGnf } from '@hailandx/commerce';
import { browserClient, useSession } from '@hailandx/kit';

/**
 * Frais de livraison dès la fiche (refonte §51) : le client connecté qui a déjà une adresse voit le montant exact
 * (même calcul que la commande, `fn_delivery_quote`) ; les autres lisent « calculée à l'adresse ». Aucune surprise au paiement.
 */
export function FraisLivraison({ offerId }: { offerId?: string }) {
  const session = useSession();
  const [fee, setFee] = useState<{ gnf: number; km: number } | null>(null);
  useEffect(() => {
    const sb = browserClient(); const uid = session?.user.id;
    if (!sb || !uid || !offerId) { setFee(null); return; }
    let live = true;
    void (async () => {
      const { data: d } = await sb.from('declarations').select('id').eq('user_id', uid).eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle();
      const decl = (d as { id: string } | null)?.id;
      if (!decl) return;
      const { data, error } = await sb.rpc('fn_delivery_quote', { p_declaration: decl, p_offers: [offerId] });
      const q = (data as { fee_gnf: number; distance_km: number }[] | null)?.[0];
      if (live && !error && q) setFee({ gnf: q.fee_gnf, km: Number(q.distance_km) });
    })();
    return () => { live = false; };
  }, [session, offerId]);
  if (!fee) return <span className="text-[12px] font-bold text-muted">calculée à l’adresse</span>;
  return <span className="text-[13px] font-extrabold">{formatGnf(fee.gnf)} <span className="text-[11.5px] font-bold text-muted">· {fee.km.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km</span></span>;
}
