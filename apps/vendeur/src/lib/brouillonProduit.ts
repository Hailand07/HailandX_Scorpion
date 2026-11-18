/**
 * Brouillon de l'éditeur de produit (§61). Installée sur l'écran d'accueil, l'application est souvent fermée par Android pendant
 * que l'appareil photo est ouvert, puis rechargée au retour : sans brouillon, la photo et tout ce qui était saisi disparaissaient.
 * Les photos étant envoyées dès qu'elles sont prises, le brouillon ne garde que leurs chemins (`kept`), jamais les fichiers.
 * Valable 24 heures, sur ce téléphone seulement.
 */
export interface BrouillonProduit {
  name: string; desc: string; points: string[]; values: Record<string, string>; condition: 'neuf' | 'occasion'; note: string;
  price: string; compareAt: string; variants: { key: number; id: string; label: string; stock: number }[]; removed: string[];
  section: string | null; cat: string | null; active: boolean; kept: string[];
  linked: { id: string; name: string; category_id: string | null; description: string | null; attributes: Record<string, unknown> | null } | null;
}

const PREFIX = 'hx.vendeur.produit.';
export const BROUILLON_MAX_MS = 24 * 3600_000;

/** Une clé par boutique et par produit (« nouveau », copie d'un produit, ou produit modifié). */
export const cleBrouillon = (shopId: string, offerId?: string, copyFrom?: string) => `${shopId}.${offerId ? `modif.${offerId}` : copyFrom ? `copie.${copyFrom}` : 'nouveau'}`;

export function lireBrouillon(cle: string, now = Date.now()): BrouillonProduit | null {
  try {
    const raw = localStorage.getItem(PREFIX + cle);
    if (!raw) return null;
    const d = JSON.parse(raw) as { at?: number; data?: BrouillonProduit };
    if (!d.data || typeof d.at !== 'number' || now - d.at > BROUILLON_MAX_MS) { localStorage.removeItem(PREFIX + cle); return null; }
    return d.data;
  } catch { return null; }
}

export function ecrireBrouillon(cle: string, data: BrouillonProduit, now = Date.now()): void {
  try { localStorage.setItem(PREFIX + cle, JSON.stringify({ at: now, data })); } catch { /* stockage plein ou indisponible */ }
}

export function effacerBrouillon(cle: string): void {
  try { localStorage.removeItem(PREFIX + cle); } catch { /* ignoré */ }
}

/** Le brouillon contient-il quelque chose qui vaut d'être repris ? */
export const brouillonUtile = (d: BrouillonProduit) => Boolean(d.name.trim() || d.price.trim() || d.kept.length || d.desc.trim() || d.note.trim());
