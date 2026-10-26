/** Moyens de versement des boutiques et des livreurs (HAILANDX.md §48). */
export const PAYOUT_METHODS = [
  { id: 'orange_money', label: 'Orange Money' },
  { id: 'mtn_momo', label: 'MTN MoMo' },
  { id: 'kulu', label: 'Kulu' },
  { id: 'soutra_money', label: 'Soutra Money' },
  { id: 'paycard', label: 'PayCard' },
  { id: 'banque', label: 'Compte bancaire' },
] as const;
export type PayoutMethod = (typeof PAYOUT_METHODS)[number]['id'];

export const payoutMethodLabel = (m: string | null | undefined): string => PAYOUT_METHODS.find((x) => x.id === m)?.label ?? 'Moyen inconnu';

/** Numéro affiché masqué : « 620 •• •• 09 » pour un mobile, « •••• 1234 » pour un compte bancaire. */
export function maskAccount(method: string | null | undefined, account: string | null | undefined): string {
  const a = String(account ?? '');
  if (method === 'banque') return `•••• ${a.replace(/\s/g, '').slice(-4)}`;
  const d = a.replace(/\D/g, '');
  const local = d.startsWith('224') ? d.slice(3) : d;
  return local.length >= 5 ? `${local.slice(0, 3)} •• •• ${local.slice(-2)}` : '••';
}
