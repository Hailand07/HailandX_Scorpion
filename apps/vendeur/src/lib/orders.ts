import { ago, type ParcelStatus } from '@hailandx/commerce';

/** Numéro court d'une commande, lu au téléphone et imprimé sur l'étiquette : « HX-2041 ». */
export const orderCode = (id: string) => `HX-${id.slice(0, 4).toUpperCase()}`;

/** Statut d'un colis tel que le vendeur le lit : classes de couleur + mot court. */
export function statusPill(s: ParcelStatus, createdAt: string): [string, string] {
  switch (s) {
    case 'attente_vendeur': return ['bg-lime text-ink', `à préparer · ${ago(createdAt)}`];
    case 'remis': return ['bg-ok-soft text-ok', 'remis'];
    case 'annule': return ['bg-sand text-muted', 'annulé'];
    case 'litige': return ['bg-[#fde8e4] text-[#a3321f]', 'litige'];
    case 'retire': return ['bg-blue-soft text-blue-ink', 'en route'];
    default: return ['bg-blue-soft text-blue-ink', 'prêt · attend le livreur'];
  }
}

/** Libellé du paiement d'une commande. */
export function payLabel(method: string | undefined, status: string | undefined): { text: string; paid: boolean } {
  if (method === 'hailandpay') return { text: 'HailandPay · payé (Syli, test)', paid: true };
  if (method !== 'orange_money') return { text: 'Espèces à la remise', paid: false };
  return status === 'en_attente' ? { text: 'Paiement en ligne · en attente', paid: false } : { text: 'Payé en ligne', paid: true };
}
