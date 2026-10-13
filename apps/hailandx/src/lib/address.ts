import type { SupabaseClient } from '@supabase/supabase-js';

/** Adresse de livraison créée dans HailandX : niveau 1 (position GPS), même table `declarations` que NavigationX. */
export type AddressLabel = 'Domicile' | 'Travail' | 'Autre';

export interface NewAddress {
  /** Position retenue [lng, lat] (mesures GPS ou point touché sur la carte). */
  point: [number, number];
  /** Précision annoncée en mètres (0 si le point a été choisi à la main). */
  accuracy: number;
  label: AddressLabel;
  floor?: string;
  door?: string;
  landmark?: string;
}

export class AddressError extends Error {}

const wktPoint = (p: [number, number]) => `SRID=4326;POINT(${p[0]} ${p[1]})`;

/**
 * Enregistre l'adresse pour l'utilisateur connecté. Le code Hailand et la chaîne administrative sont attribués PAR LE SERVEUR
 * (déclencheur de la base) ; HailandX ne certifie rien : le niveau 3 reste décidé par Hailand.
 */
export async function saveAddress(sb: SupabaseClient, userId: string, a: NewAddress): Promise<{ id: string; code: string }> {
  const { data, error } = await sb.from('declarations').insert({
    user_id: userId,
    gps_point: wktPoint(a.point),
    gps_accuracy_m: Math.max(0, Math.round(a.accuracy)),
    anchor_point: wktPoint(a.point),
    detected_level: 1,
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
  return { id: row.id, code: row.hailand_code };
}
