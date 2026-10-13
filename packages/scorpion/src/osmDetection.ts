import * as turf from '@turf/turf';

/**
 * Contours de bâtiments OSM affichés par une carte Mapbox, pour l'identification de « son » bâtiment (niveau 2).
 * Repris de NavigationX (`src/lib/osmDetection.ts`) sans changement de logique ; la carte est décrite par une interface minimale
 * pour que ce paquet ne dépende pas de mapbox-gl. La carte doit être affichée à zoom ≥ 17 pour que les bâtiments soient chargés.
 */
export interface MapLike {
  project(lngLat: [number, number]): { x: number; y: number };
  getZoom(): number;
  getLayer(id: string): unknown;
  queryRenderedFeatures(box: [[number, number], [number, number]], options?: { layers?: string[] }): { id?: string | number; geometry: GeoJSON.Geometry }[];
}

export interface OsmPolygon { id: string; polygon: GeoJSON.Polygon }

/** Contours OSM autour d'une position (rayon en mètres). Les morceaux d'une même entité coupée par les tuiles sont réunis. */
export function osmPolygonsAround(map: MapLike, lngLat: [number, number], radiusM: number, layers: string[]): OsmPolygon[] {
  const px = map.project(lngLat);
  const mPerPx = (40075016.686 * Math.cos((lngLat[1] * Math.PI) / 180)) / (512 * 2 ** map.getZoom());
  const r = radiusM / mPerPx;
  const present = layers.filter((l) => map.getLayer(l));
  if (!present.length) return [];
  const features = map.queryRenderedFeatures([[px.x - r, px.y - r], [px.x + r, px.y + r]], { layers: present });
  const pieces = new Map<string, GeoJSON.Polygon[]>();
  features.forEach((f, i) => {
    const g = f.geometry;
    if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) return;
    const polys: GeoJSON.Polygon[] = g.type === 'Polygon' ? [g] : g.coordinates.map((c) => ({ type: 'Polygon', coordinates: c }));
    const id = f.id != null ? String(f.id) : `osm-${i}`;
    pieces.set(id, [...(pieces.get(id) ?? []), ...polys]);
  });
  const out = new Map<string, GeoJSON.Polygon>();
  pieces.forEach((list, id) => {
    let merged: GeoJSON.Polygon | null = list.length === 1 ? list[0]! : null;
    if (!merged) {
      try {
        const u = turf.union(turf.featureCollection(list.map((p) => turf.polygon(p.coordinates))));
        if (u?.geometry.type === 'Polygon') merged = u.geometry;
        else if (u?.geometry.type === 'MultiPolygon') merged = { type: 'Polygon', coordinates: [...u.geometry.coordinates].sort((x, y) => y[0]!.length - x[0]!.length)[0]! };
      } catch { /* morceaux invalides : repli ci-dessous */ }
    }
    out.set(id, merged ?? list.reduce((best, p) => (turf.area(turf.polygon(p.coordinates)) > turf.area(turf.polygon(best.coordinates)) ? p : best)));
  });
  return [...out.entries()].map(([id, polygon]) => ({ id, polygon }));
}
