'use client';
import { useEffect, useState } from 'react';
import { formatGnf } from '@hailandx/commerce';
import { browserClient, useSession } from '@hailandx/kit';
import { myAddresses } from '@/lib/addresses';

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
      // Le domicile d'abord ; à défaut, une adresse temporaire encore valable (§53).
      const list = await myAddresses(sb, uid);
      const decl = (list.find((x) => !x.temporary_until) ?? list[0])?.id;
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
