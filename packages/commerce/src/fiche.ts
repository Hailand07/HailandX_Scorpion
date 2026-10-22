/**
 * Fiche produit détaillée, par catégorie (demande du fondateur, 2026-10-22 : « toutes les infos essentielles, comme les meilleures
 * plateformes de vente »). Les caractéristiques sont rangées dans `catalog_products.attributes` (JSON), la description dans
 * `catalog_products.description` ; ce module dit quelles caractéristiques demander pour chaque catégorie, les nettoie avant
 * enregistrement et prépare l'affichage (« En bref », tableau, points forts).
 */

export type FieldKind = 'texte' | 'choix' | 'nombre' | 'oui_non' | 'long';

export interface FicheField {
  key: string;
  label: string;
  kind: FieldKind;
  /** `choix` : valeurs proposées (le vendeur peut aussi écrire autre chose). */
  options?: string[];
  /** `nombre` : unité affichée après la valeur (Go, mAh, ml…). */
  unit?: string;
  placeholder?: string;
  /** Repris dans « En bref », en haut de la fiche. */
  key_fact?: boolean;
}

export interface CategoryFiche {
  /** Phrase d'aide affichée au vendeur. */
  hint: string;
  fields: FicheField[];
}

const marque: FicheField = { key: 'marque', label: 'Marque', kind: 'texte', placeholder: 'Ex. Samsung, Vlisco, Nivea… (sans marque : laisser vide)', key_fact: true };
const couleur: FicheField = { key: 'couleur', label: 'Couleur', kind: 'texte', placeholder: 'Ex. Bleu nuit' };
const matiere: FicheField = { key: 'matiere', label: 'Matière', kind: 'texte', placeholder: 'Ex. 100 % coton', key_fact: true };
const dimensions: FicheField = { key: 'dimensions', label: 'Dimensions', kind: 'texte', placeholder: 'Ex. 120 × 60 × 75 cm' };
const garantie: FicheField = { key: 'garantie', label: 'Garantie', kind: 'choix', options: ['Sans garantie', '7 jours', '1 mois', '3 mois', '6 mois', '1 an', '2 ans'], key_fact: true };
const contenu: FicheField = { key: 'contenu_boite', label: 'Contenu de la boîte', kind: 'long', placeholder: 'Ex. téléphone, chargeur, câble, coque' };
const origine: FicheField = { key: 'origine', label: 'Origine', kind: 'texte', placeholder: 'Ex. Guinée, Côte d’Ivoire, Chine' };

export const FICHES: Record<string, CategoryFiche> = {
  mode: {
    hint: 'Les acheteurs veulent connaître la matière, la coupe et les tailles avant d’acheter.',
    fields: [
      marque,
      { key: 'type', label: 'Type d’article', kind: 'choix', options: ['Pagne / wax', 'Robe', 'Ensemble', 'Chemise', 'Pantalon', 'Boubou / tenue traditionnelle', 'Chaussures', 'Sac', 'Accessoire'], key_fact: true },
      { key: 'pour', label: 'Pour', kind: 'choix', options: ['Femme', 'Homme', 'Enfant', 'Mixte'], key_fact: true },
      matiere,
      { key: 'coupe', label: 'Coupe / taille', kind: 'texte', placeholder: 'Ex. taille normalement, prendre une taille au-dessus' },
      { key: 'longueur', label: 'Longueur', kind: 'texte', placeholder: 'Ex. 6 yards, mi-longue' },
      couleur,
      { key: 'entretien', label: 'Entretien', kind: 'texte', placeholder: 'Ex. lavage à la main, ne pas sécher au soleil' },
      origine,
    ],
  },
  beaute: {
    hint: 'Indiquez la contenance, à qui le produit convient et comment l’utiliser.',
    fields: [
      marque,
      { key: 'type', label: 'Type de produit', kind: 'choix', options: ['Crème / lait', 'Savon', 'Huile', 'Parfum', 'Maquillage', 'Soin des cheveux', 'Mèches / perruque', 'Ongles'], key_fact: true },
      { key: 'contenance', label: 'Contenance', kind: 'texte', placeholder: 'Ex. 250 ml, 100 g', key_fact: true },
      { key: 'convient_a', label: 'Convient à', kind: 'texte', placeholder: 'Ex. peaux sèches, cheveux crépus' },
      { key: 'ingredients', label: 'Ingrédients principaux', kind: 'long', placeholder: 'Ex. beurre de karité, huile de coco' },
      { key: 'utilisation', label: 'Conseils d’utilisation', kind: 'long' },
      { key: 'precautions', label: 'Précautions', kind: 'long', placeholder: 'Ex. usage externe, éviter le contact avec les yeux' },
      origine,
    ],
  },
  telephones: {
    hint: 'Pour un téléphone, la mémoire, l’état de la batterie et ce qu’il y a dans la boîte décident l’achat.',
    fields: [
      marque,
      { key: 'modele', label: 'Modèle', kind: 'texte', placeholder: 'Ex. Galaxy A15', key_fact: true },
      { key: 'stockage', label: 'Stockage', kind: 'nombre', unit: 'Go', key_fact: true },
      { key: 'memoire', label: 'Mémoire vive (RAM)', kind: 'nombre', unit: 'Go' },
      { key: 'ecran', label: 'Écran', kind: 'nombre', unit: 'pouces' },
      { key: 'batterie', label: 'Batterie', kind: 'nombre', unit: 'mAh' },
      { key: 'photo', label: 'Appareil photo', kind: 'texte', placeholder: 'Ex. 50 Mpx arrière, 13 Mpx avant' },
      { key: 'reseau', label: 'Réseau', kind: 'choix', options: ['3G', '4G', '5G'] },
      { key: 'double_sim', label: 'Double SIM', kind: 'oui_non' },
      couleur,
      garantie,
      contenu,
    ],
  },
  electronique: {
    hint: 'Précisez la puissance, la tension (220 V) et la garantie.',
    fields: [
      marque,
      { key: 'modele', label: 'Modèle', kind: 'texte', key_fact: true },
      { key: 'type', label: 'Type d’appareil', kind: 'texte', placeholder: 'Ex. télévision, ventilateur, ordinateur portable' },
      { key: 'puissance', label: 'Puissance', kind: 'nombre', unit: 'W' },
      { key: 'tension', label: 'Tension', kind: 'choix', options: ['220 V', '110 V', '12 V', 'Batterie / USB'] },
      { key: 'caracteristiques', label: 'Caractéristiques clés', kind: 'long', placeholder: 'Ex. 43 pouces, Full HD, 2 ports HDMI' },
      dimensions,
      couleur,
      garantie,
      contenu,
    ],
  },
  maison: {
    hint: 'Les dimensions et la matière évitent les mauvaises surprises à la livraison.',
    fields: [
      { key: 'type', label: 'Type d’article', kind: 'texte', placeholder: 'Ex. matelas, marmite, rideau', key_fact: true },
      marque,
      matiere,
      dimensions,
      { key: 'poids', label: 'Poids', kind: 'nombre', unit: 'kg' },
      couleur,
      { key: 'montage', label: 'Montage nécessaire', kind: 'oui_non' },
      { key: 'entretien', label: 'Entretien', kind: 'texte' },
      garantie,
    ],
  },
  alimentation: {
    hint: 'Indiquez le poids net, la conservation et l’origine.',
    fields: [
      { key: 'type', label: 'Produit', kind: 'texte', placeholder: 'Ex. riz parfumé, huile de palme, fonio', key_fact: true },
      marque,
      { key: 'poids_net', label: 'Poids ou volume net', kind: 'texte', placeholder: 'Ex. 25 kg, 5 L', key_fact: true },
      origine,
      { key: 'ingredients', label: 'Ingrédients', kind: 'long' },
      { key: 'conservation', label: 'Conservation', kind: 'texte', placeholder: 'Ex. au frais et au sec, après ouverture 7 jours' },
      { key: 'allergenes', label: 'Allergènes', kind: 'texte', placeholder: 'Ex. arachide, gluten' },
    ],
  },
  enfants: {
    hint: 'L’âge conseillé et la sécurité comptent beaucoup pour les parents.',
    fields: [
      { key: 'type', label: 'Type d’article', kind: 'texte', placeholder: 'Ex. jouet, vêtement, poussette', key_fact: true },
      { key: 'age', label: 'Âge conseillé', kind: 'texte', placeholder: 'Ex. 3 à 6 ans', key_fact: true },
      marque,
      matiere,
      { key: 'securite', label: 'Sécurité', kind: 'texte', placeholder: 'Ex. petites pièces : ne convient pas aux moins de 3 ans' },
      couleur,
      dimensions,
    ],
  },
  sante: {
    hint: 'Décrivez l’usage et les précautions. Les médicaments sur ordonnance ne sont pas acceptés.',
    fields: [
      { key: 'type', label: 'Type de produit', kind: 'texte', placeholder: 'Ex. tensiomètre, masque, complément alimentaire', key_fact: true },
      marque,
      { key: 'contenance', label: 'Contenance / quantité', kind: 'texte', key_fact: true },
      { key: 'utilisation', label: 'Utilisation', kind: 'long' },
      { key: 'precautions', label: 'Précautions', kind: 'long' },
      garantie,
    ],
  },
  'auto-moto': {
    hint: 'Pour une pièce, la compatibilité (marque, modèle, année) est essentielle.',
    fields: [
      { key: 'type', label: 'Type de pièce ou d’article', kind: 'texte', placeholder: 'Ex. plaquettes de frein, casque, pneu', key_fact: true },
      marque,
      { key: 'compatible', label: 'Compatible avec', kind: 'long', placeholder: 'Ex. Toyota Corolla 2008–2014, moto TVS 125', key_fact: true },
      { key: 'reference', label: 'Référence', kind: 'texte' },
      dimensions,
      garantie,
    ],
  },
  autres: {
    hint: 'Décrivez l’essentiel : marque, matière, dimensions.',
    fields: [marque, { key: 'type', label: 'Type d’article', kind: 'texte', key_fact: true }, matiere, dimensions, couleur, garantie],
  },
};

/** Fiche de la catégorie (catégorie inconnue ou absente : « Autres »). */
export const ficheOf = (categoryId: string | null | undefined): CategoryFiche => FICHES[categoryId ?? ''] ?? FICHES.autres!;

/** Limites (les mêmes sont vérifiées par la base : HAILANDX.md §33). */
export const FICHE_LIMITS = { description: 4000, value: 300, longValue: 1000, points: 5, point: 120 } as const;

export interface ProductDetails {
  /** Valeurs des caractéristiques, par clé de la fiche. */
  values: Record<string, string>;
  /** Points forts (3 à 5 phrases courtes). */
  points: string[];
}

const clip = (s: unknown, n: number): string => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, n) : typeof s === 'number' && Number.isFinite(s) ? String(s) : '');
const clipLong = (s: unknown, n: number): string => (typeof s === 'string' ? s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, n) : '');

/**
 * Nettoie ce que le vendeur a saisi avant de l'enregistrer dans `attributes` : seules les clés de la fiche de la catégorie,
 * valeurs coupées à la bonne longueur, champs vides retirés, « oui / non » normalisés, au plus 5 points forts.
 */
export function cleanAttributes(categoryId: string | null | undefined, raw: { values?: Record<string, unknown>; points?: unknown[] }): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of ficheOf(categoryId).fields) {
    const v = raw.values?.[f.key];
    let s = f.kind === 'long' ? clipLong(v, FICHE_LIMITS.longValue) : clip(v, FICHE_LIMITS.value);
    if (f.kind === 'oui_non') s = /^(oui|true|1)$/i.test(s) ? 'oui' : /^(non|false|0)$/i.test(s) ? 'non' : '';
    if (f.kind === 'nombre') s = s.replace(',', '.').replace(/[^\d.]/g, '').replace(/^\./, '');
    if (s) out[f.key] = s;
  }
  const points = (raw.points ?? []).map((p) => clip(p, FICHE_LIMITS.point)).filter(Boolean).slice(0, FICHE_LIMITS.points);
  if (points.length) out.points_forts = points;
  return out;
}

/** Relit `attributes` pour le formulaire du vendeur. */
export function readAttributes(attributes: unknown): ProductDetails {
  const a = (attributes && typeof attributes === 'object' ? attributes : {}) as Record<string, unknown>;
  const values: Record<string, string> = {};
  for (const [k, v] of Object.entries(a)) if (k !== 'points_forts' && (typeof v === 'string' || typeof v === 'number')) values[k] = String(v);
  const points = Array.isArray(a.points_forts) ? a.points_forts.filter((p): p is string => typeof p === 'string') : [];
  return { values, points };
}

/** Valeur affichée : unité ajoutée aux nombres, « Oui » / « Non » en toutes lettres. */
function display(f: FicheField, v: string): string {
  if (f.kind === 'oui_non') return v === 'oui' ? 'Oui' : 'Non';
  if (f.kind === 'nombre' && f.unit) return `${v.replace('.', ',')} ${f.unit}`;
  return v;
}

export interface SpecRow { key: string; label: string; value: string; keyFact: boolean; long: boolean }

/** Tableau des caractéristiques, dans l'ordre de la fiche de la catégorie (champs remplis seulement). */
export function specRows(categoryId: string | null | undefined, attributes: unknown): SpecRow[] {
  const { values } = readAttributes(attributes);
  return ficheOf(categoryId).fields.filter((f) => values[f.key]).map((f) => ({ key: f.key, label: f.label, value: display(f, values[f.key]!), keyFact: Boolean(f.key_fact), long: f.kind === 'long' }));
}

/** « En bref » : jusqu'à 4 caractéristiques principales, en libellé + valeur courte. */
export const keyFacts = (categoryId: string | null | undefined, attributes: unknown): SpecRow[] =>
  specRows(categoryId, attributes).filter((r) => r.keyFact && !r.long && r.key !== 'marque').slice(0, 4);

/** Marque, si renseignée. */
export const brandOf = (attributes: unknown): string | null => readAttributes(attributes).values.marque ?? null;

/** Taux de complétude de la fiche (0–100), montré au vendeur pour l'encourager à tout remplir. */
export function ficheCompleteness(categoryId: string | null | undefined, description: string | null | undefined, attributes: unknown, photoCount: number): number {
  const { values, points } = readAttributes(attributes);
  const fields = ficheOf(categoryId).fields;
  const filled = fields.filter((f) => values[f.key]).length;
  const parts = [Math.min(1, photoCount / 3), (description ?? '').trim().length >= 80 ? 1 : (description ?? '').trim().length / 80, Math.min(1, points.length / 3), fields.length ? filled / fields.length : 1];
  const weights = [0.25, 0.25, 0.15, 0.35];
  return Math.round(parts.reduce((n, p, i) => n + p * weights[i]!, 0) * 100);
}
