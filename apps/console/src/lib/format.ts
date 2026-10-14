import { formatGnf } from '@hailandx/commerce';

/** Une ligne du journal des actions, telle que la renvoie fn_console_journal. */
export interface JournalEntry {
  id: number;
  created_at: string;
  actor_name: string;
  actor_role: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  detail: Record<string, unknown>;
  motif: string | null;
}

export const SETTING_LABEL: Record<string, string> = {
  commission_bps: 'Commission Hailand',
  courier_share_bps: 'Part du livreur',
  payment_mode: 'Paiement en ligne',
};

const SHOP_STATUS: Record<string, string> = { preparation: 'en préparation', bientot: 'bientôt', ouverte: 'ouverte', suspendue: 'suspendue' };
const COURIER_STATUS: Record<string, string> = { candidat: 'candidat', valide: 'validé', suspendu: 'suspendu' };
const PAYMENT_MODE: Record<string, string> = { simulation: 'essai', orange_money: 'Orange Money' };

/** « 800 » (points de base) → « 8 % » ; « 825 » → « 8,25 % ». */
export const bpsToPct = (v: string | number | null | undefined): string => {
  const n = Number(v);
  if (v === null || v === undefined || v === '' || !Number.isFinite(n)) return '—';
  return `${(n / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %`;
};

/** Saisie « 7,5 » ou « 7.5 » → « 750 » ; null si hors de 0 à 100 ou illisible. */
export const pctToBps = (input: string): string | null => {
  const t = input.trim().replace(',', '.').replace(/\s*%$/, '');
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(t)) return null;
  const n = Math.round(Number(t) * 100);
  return n >= 0 && n <= 10000 ? String(n) : null;
};

/** Valeur lisible d'un paramètre. */
export const settingText = (key: string, value: unknown): string => {
  const v = value === null || value === undefined ? '' : String(value);
  if (key === 'payment_mode') return PAYMENT_MODE[v] ?? v;
  if (key.endsWith('_bps')) return bpsToPct(v);
  return v;
};

const str = (x: unknown) => (x === null || x === undefined ? '' : String(x));
const quoted = (x: unknown) => (str(x) ? `« ${str(x)} »` : '');

/** Phrase française d'une entrée du journal (sans l'auteur ni la date, affichés à part). */
export function journalText(e: Pick<JournalEntry, 'action' | 'target_id' | 'detail'>): string {
  const d = e.detail ?? {};
  switch (e.action) {
    case 'parametre_modifie':
      return `${SETTING_LABEL[str(e.target_id)] ?? str(e.target_id)} : ${settingText(str(e.target_id), d.avant)} → ${settingText(str(e.target_id), d.apres)}`;
    case 'boutique_statut':
      return `Boutique ${quoted(d.nom)} : ${SHOP_STATUS[str(d.avant)] ?? str(d.avant)} → ${SHOP_STATUS[str(d.apres)] ?? str(d.apres)}`;
    case 'livreur_statut':
      return `Livreur ${str(d.nom)} : ${COURIER_STATUS[str(d.avant)] ?? str(d.avant)} → ${COURIER_STATUS[str(d.apres)] ?? str(d.apres)}`;
    case 'especes_recues':
      return `Espèces reçues de ${str(d.nom)} : ${formatGnf(Number(d.montant) || 0)}`;
    case 'litige_tranche':
      return d.resolution === 'acheteur' ? 'Litige tranché en faveur de l’acheteur (colis annulé)' : d.resolution === 'vendeur' ? 'Litige tranché en faveur du vendeur (livraison confirmée)' : 'Litige tranché';
    case 'avis_modere':
      return d.decision === 'masque' ? 'Avis signalé masqué' : 'Avis signalé maintenu';
    case 'versement_vendeur':
      return `Versement de ${formatGnf(Number(d.montant) || 0)} à une boutique enregistré`;
    case 'remboursement':
      return `Remboursement de ${formatGnf(Number(d.montant) || 0)} enregistré`;
    case 'certification_transmise':
      return `Certification ${quoted(d.boutique)} confirmée, transmise à HailandMap`;
    case 'certification_refusee':
      return `Certification ${quoted(d.boutique)} refusée`;
    case 'equipe_modifiee':
      return `Équipe : ${str(d.nom) || 'un membre'} ${d.actif === false ? 'désactivé' : `(${d.role === 'fondateur' ? 'fondateur' : 'opérateur'})`}`;
    default:
      return e.action.replace(/_/g, ' ');
  }
}

export const TAG: Record<string, string> = {
  parametre: 'Paramètre', boutique: 'Boutique', livreur: 'Livreur', litige: 'Litige', avis: 'Avis',
  acheteur: 'Argent', certification: 'Certification', compte: 'Équipe',
};
/** Étiquette d'une entrée (les versements à une boutique sont rangés sous « Argent »). */
export const journalTag = (e: Pick<JournalEntry, 'action' | 'target_type'>) =>
  e.action === 'versement_vendeur' || e.action === 'remboursement' ? 'Argent' : TAG[e.target_type] ?? e.target_type;

export const roleText = (r: string | null | undefined) => (r === 'fondateur' ? 'fondateur' : r === 'operateur' ? 'opérateur' : '');

/** « 14 oct. 09:02 ». */
export const when = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
};

/** Numéro complet lisible (l'équipe appelle vendeurs et livreurs) : « +224 612 34 56 78 ». */
export const phoneText = (p: string | null | undefined) => {
  const d = (p ?? '').replace(/\D/g, '');
  if (d.length < 9) return p || '—';
  const n = d.slice(-9);
  return `+224 ${n.slice(0, 3)} ${n.slice(3, 5)} ${n.slice(5, 7)} ${n.slice(7)}`;
};
