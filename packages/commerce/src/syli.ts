import { formatGnf } from './money';

/**
 * HailandPay et le Syli, argent de test (HAILANDX.md §42) : 1 Syli = 1 GNF, sans valeur réelle.
 * Les montants s'écrivent comme des GNF (espaces fines), suivis de « Syli ».
 */
export const formatSyli = (amount: number | bigint, withUnit = true): string => `${formatGnf(Number(amount), false)}${withUnit ? ' Syli' : ''}`;

/** Plafond par défaut de la recharge de test en libre-service (cumulé, par compte). */
export const SYLI_TOPUP_CAP = 50_000_000;
/** Montants proposés à la recharge. */
export const SYLI_TOPUP_STEPS = [1_000_000, 5_000_000, 10_000_000, 20_000_000] as const;

export type WalletMovementKind =
  | 'recharge_test' | 'credit_equipe' | 'debit_equipe' | 'paiement' | 'remboursement' | 'reglement_vente' | 'gain_livraison'
  | 'reprise_vente' | 'envoi' | 'reception' | 'retrait' | 'vers_proprietaire' | 'depuis_boutique';

/** Libellé d'un mouvement du portefeuille (historique). */
export const MOVEMENT_LABEL: Record<WalletMovementKind, string> = {
  recharge_test: 'Recharge de test',
  credit_equipe: 'Crédit de l’équipe Hailand',
  debit_equipe: 'Débit de l’équipe Hailand',
  paiement: 'Paiement d’une commande',
  remboursement: 'Remboursement',
  reglement_vente: 'Vente — colis remis',
  gain_livraison: 'Gain de livraison',
  reprise_vente: 'Rendu au client (litige)',
  envoi: 'Envoyé',
  reception: 'Reçu',
  retrait: 'Retrait (simulé)',
  vers_proprietaire: 'Vers mon portefeuille',
  depuis_boutique: 'Depuis ma boutique',
};

/** Il reste combien à recharger soi-même ? (jamais négatif) */
export const topupRemaining = (toppedUp: number, cap = SYLI_TOPUP_CAP): number => Math.max(0, cap - toppedUp);

/** Contenu du QR de réception : « hailandpay:<numéro> » ; lecture tolérante (QR ou numéro tapé). */
export const receiveQr = (phoneDigits: string): string => `hailandpay:${phoneDigits.replace(/\D/g, '')}`;
export const phoneFromQr = (text: string): string | null => {
  const m = /^hailandpay:(\d{9,12})$/.exec(text.trim());
  return m ? m[1]! : null;
};
