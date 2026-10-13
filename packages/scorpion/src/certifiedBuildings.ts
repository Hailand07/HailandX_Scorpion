import { distanceM } from './gpsAcquisition';
import type { CandidateInput } from './buildingDetection';

/** Ce qu'il faut du client Supabase : lecture publique de `buildings`. */
export interface BuildingsClient {
  from(table: 'buildings'): {
    select(columns: string): { eq(column: string, value: unknown): { eq(column: string, value: unknown): PromiseLike<{ data: unknown[] | null; error: unknown }> } };
  };
}

interface Row { id: string; geom: GeoJSON.Polygon | null; has_courtyard: boolean | null; parent_building_id: string | null; landmark_note: string | null; admin_code: string | null }

/**
 * Bâtiments certifiés par Hailand (statut actif, validés) autour d'une position. Lecture publique de `buildings` (aucune écriture).
 * ⚠️ Lit tous les bâtiments certifiés puis filtre sur l'appareil, comme NavigationX : acceptable tant qu'il y en a peu ;
 * 💡 à remplacer par une recherche spatiale en base quand le registre grandira.
 */
export async function certifiedBuildingsNear(sb: BuildingsClient, position: [number, number], radiusM = 300): Promise<CandidateInput[]> {
  try {
    const { data, error } = await sb.from('buildings').select('id, geom, has_courtyard, parent_building_id, landmark_note, admin_code').eq('status', 'actif').eq('is_validated', true);
    if (error || !data) return [];
    return (data as Row[])
      .filter((b) => b.geom?.type === 'Polygon' && Array.isArray(b.geom.coordinates?.[0]) && b.geom.coordinates[0]!.length >= 4)
      .filter((b) => (b.geom!.coordinates[0] as [number, number][]).some((p) => distanceM(position, p) <= radiusM))
      .map((b) => ({ source: 'hailand' as const, id: String(b.id), polygon: b.geom!, courtyard: !!b.has_courtyard, parentId: b.parent_building_id ?? null, label: b.landmark_note ?? null, code: b.admin_code ?? null }));
  } catch {
    return [];
  }
}
