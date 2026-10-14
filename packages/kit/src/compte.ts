import { APP_NOMS, type AppHailand } from './passage';

/** Ce que le compte contient déjà (fn_compte_resume). */
export interface CompteResume { adresses: number; niveau: number | null; boutique: string | null; livreur: boolean; equipe: boolean }

/** Un compte est « nouveau » s'il vient d'être créé par ce code SMS (moins de 10 minutes). */
export function estNouveau(createdAt: string | undefined, maintenant = Date.now()): boolean {
  const t = createdAt ? Date.parse(createdAt) : NaN;
  return Number.isFinite(t) && maintenant - t < 10 * 60_000;
}

/** Numéro partiellement masqué : +224 622 •• •• 33. */
export function telMasque(phone: string | null | undefined): string {
  const d = (phone ?? '').replace(/\D/g, '').replace(/^224/, '');
  return /^\d{9}$/.test(d) ? `+224 ${d.slice(0, 3)} •• •• ${d.slice(7)}` : '';
}

/** Lignes « Déjà sur ce compte ». */
export function lignesResume(r: CompteResume | null): { icone: 'pin' | 'shop' | 'truck' | 'shield'; texte: string }[] {
  if (!r) return [];
  const l: { icone: 'pin' | 'shop' | 'truck' | 'shield'; texte: string }[] = [];
  if (r.adresses > 0) l.push({ icone: 'pin', texte: `${r.adresses} adresse${r.adresses > 1 ? 's' : ''} enregistrée${r.adresses > 1 ? 's' : ''}${r.niveau ? ` · niveau ${r.niveau}` : ''}` });
  if (r.boutique) l.push({ icone: 'shop', texte: `Boutique « ${r.boutique} »` });
  if (r.livreur) l.push({ icone: 'truck', texte: 'Livreur de la Flotte Hailand' });
  if (r.equipe) l.push({ icone: 'shield', texte: 'Équipe Hailand' });
  return l;
}

/** « compte créé dans NavigationX » (origine notée à la création du compte). */
export function origineTexte(origine: unknown): string {
  return typeof origine === 'string' && origine in APP_NOMS ? `compte créé dans ${APP_NOMS[origine as AppHailand]}` : '';
}
