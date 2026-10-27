import type { SupabaseClient } from '@supabase/supabase-js';
import type { AddressLevel } from '../levels';

/**
 * Enregistrement d'une adresse dans `declarations` (niveaux 1 et 2), repris de NavigationX (`src/lib/declarationService.ts`)
 * sans changement de règle : le code Hailand et l'adresse administrative sont fabriqués PAR LA BASE à l'insertion ; rien n'est
 * jamais écrit dans `buildings` (cadastre certifié) ; le niveau 3 ne vient que d'un rattachement à un bâtiment certifié.
 * Le client Supabase est fourni par l'application (HailandX, HailandX Vendeur).
 */
export type DeclaredLevel = Exclude<AddressLevel, 3>;

export interface AdminAddress {
  region_nom?: string | null;
  prefecture_nom?: string | null;
  commune_nom?: string | null;
  quartier_nom?: string | null;
  source?: 'quartier' | 'commune' | null;
}

export interface DeclarationRecord {
  id: string;
  level: DeclaredLevel;
  gps: [number, number];
  accuracy: number;
  osmPolygonId: string | null;
  polygon: GeoJSON.Polygon | null;
  admin: AdminAddress;
  certifiedBuildingId: string | null;
  hailandCode: string;
  declared: { label?: string; buildingType?: string; floors?: number; floor?: string; door?: string; landmark?: string };
  createdAt: string;
}

export const effectiveLevelOf = (d: Pick<DeclarationRecord, 'level' | 'certifiedBuildingId'>): AddressLevel => (d.certifiedBuildingId ? 3 : d.level);

export class DeclarationError extends Error {
  constructor(public kind: 'auth' | 'outside' | 'duplicate' | 'network' | 'other', message: string) { super(message); }
}

const SELECT = '*, regions(nom), prefectures(nom), communes(nom), quartiers(nom)';
const wktPoint = (p: [number, number]) => `SRID=4326;POINT(${p[0]} ${p[1]})`;
const wktPolygon = (g: GeoJSON.Polygon) => `SRID=4326;POLYGON((${g.coordinates[0]!.map((c) => `${c[0]} ${c[1]}`).join(',')}))`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromRow(r: any): DeclarationRecord {
  return {
    id: r.id,
    level: r.detected_level === 2 ? 2 : 1,
    gps: (r.gps_point?.coordinates as [number, number]) || [0, 0],
    accuracy: Math.round(r.gps_accuracy_m || 0),
    osmPolygonId: r.osm_polygon_id ?? null,
    polygon: r.osm_polygon_geom ?? null,
    admin: { region_nom: r.regions?.nom ?? null, prefecture_nom: r.prefectures?.nom ?? null, commune_nom: r.communes?.nom ?? null, quartier_nom: r.quartiers?.nom ?? null, source: r.admin_source ?? null },
    certifiedBuildingId: r.certified_building_id ?? null,
    hailandCode: r.hailand_code,
    declared: { label: r.declared_label ?? undefined, floor: r.location_floor ?? undefined, door: r.location_door ?? undefined, landmark: r.declared_landmark ?? undefined, buildingType: r.declared_building_type ?? undefined, floors: r.declared_floor_count ?? undefined },
    createdAt: r.created_at,
  };
}

/** Hiérarchie administrative d'un point (fonction `fn_resolve_admin_address`, lecture seule). */
export async function resolveAdminAddress(sb: SupabaseClient, lng: number, lat: number): Promise<AdminAddress> {
  try {
    const { data, error } = await sb.rpc('fn_resolve_admin_address', { p_lng: lng, p_lat: lat });
    const r = (data as AdminAddress[] | null)?.[0];
    return error || !r ? {} : { region_nom: r.region_nom, prefecture_nom: r.prefecture_nom, commune_nom: r.commune_nom, quartier_nom: r.quartier_nom, source: r.source };
  } catch { return {}; }
}

/** Adresses actives du compte connecté (filtre explicite sur le compte, comme NavigationX). */
export async function myDeclarations(sb: SupabaseClient): Promise<DeclarationRecord[]> {
  try {
    const { data: s } = await sb.auth.getSession();
    const uid = s.session?.user.id;
    if (!uid) return [];
    const { data } = await sb.from('declarations').select(SELECT).eq('user_id', uid).eq('status', 'active').order('created_at', { ascending: false });
    return (data ?? []).map(fromRow);
  } catch { return []; }
}

export interface SubmitInput {
  gps: [number, number];
  accuracy: number;
  osmPolygonId: string | null;
  polygon: GeoJSON.Polygon | null;
  anchor?: [number, number] | null;
  certifiedBuildingId?: string | null;
  declared: DeclarationRecord['declared'];
}

/** Enregistre la déclaration du compte connecté ; la base attribue le code et l'adresse administrative. */
export async function submitDeclaration(sb: SupabaseClient, input: SubmitInput): Promise<DeclarationRecord> {
  const { data: s } = await sb.auth.getSession();
  const user = s.session?.user;
  if (!user || user.is_anonymous) throw new DeclarationError('auth', 'Connectez-vous pour enregistrer votre adresse.');
  const { data, error } = await sb
    .from('declarations')
    .insert({
      user_id: user.id,
      gps_point: wktPoint(input.gps),
      gps_accuracy_m: input.accuracy,
      osm_polygon_id: input.osmPolygonId,
      osm_polygon_geom: input.polygon ? wktPolygon(input.polygon) : null,
      ...(input.anchor ? { anchor_point: wktPoint(input.anchor) } : {}),
      ...(input.certifiedBuildingId ? { certified_building_id: input.certifiedBuildingId } : {}),
      detected_level: input.polygon ? 2 : 1,
      declared_label: input.declared.label ?? null,
      location_floor: input.declared.floor || null,
      location_door: input.declared.door || null,
      declared_landmark: input.declared.landmark || null,
      declared_building_type: input.declared.buildingType ?? null,
      declared_floor_count: input.declared.floors ?? null,
    })
    .select(SELECT)
    .single();
  if (error || !data) {
    const msg = `${error?.message || ''} ${(error as { hint?: string } | null)?.hint || ''}`;
    if (msg.includes('ADRESSE_ADMINISTRATIVE_INTROUVABLE')) throw new DeclarationError('outside', 'Votre position est hors des zones administratives connues : impossible d’attribuer un code.');
    if ((error as { code?: string } | null)?.code === '23505') throw new DeclarationError('duplicate', 'Vous avez déjà enregistré ce bâtiment.');
    if ((typeof navigator !== 'undefined' && !navigator.onLine) || /fetch|network/i.test(msg)) throw new DeclarationError('network', 'Pas de connexion. Réessayez dès que le réseau revient.');
    throw new DeclarationError('other', 'L’enregistrement a échoué. Réessayez dans un instant.');
  }
  return fromRow(data);
}
