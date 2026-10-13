import type { SupabaseClient } from '@supabase/supabase-js';

/** Adresse de livraison créée dans HailandX : niveau 1 (position GPS), même table `declarations` que NavigationX. */
export type AddressLabel = 'Domicile' | 'Travail' | 'Autre';

export interface NewAddress {
  /** Point d'ancrage [lng, lat] : le repère posé par l'utilisateur sur la carte (ou la position GPS retenue). */
  point: [number, number];
  /** Position GPS mesurée [lng, lat] si l'utilisateur s'est localisé ; sinon le point d'ancrage tient lieu de position. */
  gps?: [number, number] | null;
  /** Précision de la position GPS en mètres (0 si aucune mesure). */
  accuracy: number;
  /** Bâtiment confirmé par l'utilisateur, le cas échéant. */
  building?: ConfirmedBuilding | null;
  label: AddressLabel;
  floor?: string;
  door?: string;
  landmark?: string;
}

/** Bâtiment que l'utilisateur a confirmé : certifié Hailand (rattachement vérifié par la base) ou contour OSM (niveau 2). */
export type ConfirmedBuilding = { kind: 'certifie'; id: string; code?: string | null } | { kind: 'osm'; id: string; polygon: GeoJSON.Polygon };

export class AddressError extends Error {}

const wktPoint = (p: [number, number]) => `SRID=4326;POINT(${p[0]} ${p[1]})`;
const wktPolygon = (g: GeoJSON.Polygon) => `SRID=4326;POLYGON((${g.coordinates[0]!.map((c) => `${c[0]} ${c[1]}`).join(',')}))`;

/**
 * Enregistre l'adresse pour l'utilisateur connecté. Le code Hailand et la chaîne administrative sont attribués PAR LE SERVEUR
 * (déclencheur de la base) ; HailandX ne certifie rien : le niveau 3 reste décidé par Hailand.
 */
export async function saveAddress(sb: SupabaseClient, userId: string, a: NewAddress): Promise<{ id: string; code: string; level: number }> {
  const { data, error } = await sb.from('declarations').insert({
    user_id: userId,
    gps_point: wktPoint(a.gps ?? a.point),
    gps_accuracy_m: Math.max(0, Math.round(a.accuracy)),
    anchor_point: wktPoint(a.point),
    // Niveau 2 : contour OSM confirmé. Niveau 3 : jamais décidé ici, la base rattache le bâtiment certifié confirmé si les règles sont réunies.
    detected_level: a.building?.kind === 'osm' ? 2 : 1,
    ...(a.building?.kind === 'osm' ? { osm_polygon_id: a.building.id, osm_polygon_geom: wktPolygon(a.building.polygon) } : {}),
    ...(a.building?.kind === 'certifie' ? { certified_building_id: a.building.id } : {}),
    declared_label: a.label,
    location_floor: a.floor?.trim() || null,
    location_door: a.door?.trim() || null,
    declared_landmark: a.landmark?.trim() || null,
  }).select('id,hailand_code').single();
  if (error || !data) {
    const msg = `${error?.message ?? ''} ${error?.hint ?? ''}`;
    if (msg.includes('ADRESSE_ADMINISTRATIVE_INTROUVABLE')) throw new AddressError('Ce point est hors des zones connues : déplacez le repère ou rapprochez-vous de votre quartier.');
    if (error?.code === '23505') throw new AddressError('Vous avez déjà enregistré cette adresse.');
    throw new AddressError('L’adresse n’a pas pu être enregistrée. Réessayez dans un instant.');
  }
  const row = data as { id: string; hailand_code: string };
  // Niveau effectif donné par la base (3 si le bâtiment certifié a été rattaché).
  const lv = await sb.rpc('fn_declaration_level', { p_declaration: row.id });
  return { id: row.id, code: row.hailand_code, level: typeof lv.data === 'number' ? lv.data : a.building?.kind === 'osm' ? 2 : 1 };
}
