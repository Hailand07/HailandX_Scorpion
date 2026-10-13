import { describe, expect, it } from 'vitest';
import { detectAtTap, detectBuilding, type CandidateInput } from './buildingDetection';
import { certifiedBuildingsNear, type BuildingsClient } from './certifiedBuildings';
import { proposalFromDetection, proposalFromTap } from './addressDecision';
import { osmPolygonsAround, type MapLike } from './osmDetection';

// Carrés de ~20 m autour de points de Kaloum (1° de latitude ≈ 111 km).
const square = (lng: number, lat: number, half = 0.0001): GeoJSON.Polygon => ({ type: 'Polygon', coordinates: [[[lng - half, lat - half], [lng + half, lat - half], [lng + half, lat + half], [lng - half, lat + half], [lng - half, lat - half]]] });
const HOME: [number, number] = [-13.6775, 9.5307];
const certified: CandidateInput = { source: 'hailand', id: 'b-1', polygon: square(HOME[0], HOME[1]), code: 'GN-CKY-01-03-007-0001' };
const osm: CandidateInput = { source: 'osm', id: 'osm-9', polygon: square(HOME[0], HOME[1]) };
const far: CandidateInput = { source: 'osm', id: 'osm-far', polygon: square(HOME[0] + 0.01, HOME[1]) };

describe('proposition après détection', () => {
  it('position dans un bâtiment certifié : proposition de niveau 3 avec le code', () => {
    const p = proposalFromDetection(detectBuilding(HOME, 5, [osm, certified]));
    expect(p.kind).toBe('certifie');
    expect(p.level).toBe(3);
    expect(p.text).toContain('GN-CKY-01-03-007-0001');
  });
  it('position dans un contour OSM seulement : niveau 2', () => {
    const p = proposalFromDetection(detectBuilding(HOME, 5, [osm, far]));
    expect(p).toMatchObject({ kind: 'osm', level: 2 });
  });
  it('aucun contour à moins de 60 m : zone, niveau 1', () => {
    expect(proposalFromDetection(detectBuilding(HOME, 5, [far]))).toMatchObject({ kind: 'zone', level: 1 });
  });
});

describe('proposition après une touche', () => {
  it('touche dans le bâtiment certifié : niveau 3 à confirmer', () => {
    expect(proposalFromTap(detectAtTap(HOME, HOME, 5, [certified, osm]))).toMatchObject({ kind: 'certifie', level: 3 });
  });
  it('touche trop loin du GPS (> 100 m) : refus avec la distance', () => {
    const p = proposalFromTap(detectAtTap([HOME[0] + 0.01, HOME[1]], HOME, 5, [far]));
    expect(p.kind).toBe('trop_loin');
    expect(p.text).toMatch(/trop loin/);
  });
  it('touche hors de tout bâtiment : zone', () => {
    expect(proposalFromTap(detectAtTap([HOME[0] + 0.0005, HOME[1]], HOME, 5, [certified]))).toMatchObject({ kind: 'zone', level: 1 });
  });
});

describe('bâtiments certifiés autour d’une position', () => {
  const fake = (rows: unknown[]): BuildingsClient => ({ from: () => ({ select: () => ({ eq: () => ({ eq: async () => ({ data: rows, error: null }) }) }) }) });
  it('ne garde que les contours à moins de 300 m et les polygones valides', async () => {
    const rows = [
      { id: 'near', geom: square(HOME[0], HOME[1]), has_courtyard: false, parent_building_id: null, landmark_note: 'Portail bleu', admin_code: 'GN-1' },
      { id: 'far', geom: square(HOME[0] + 0.05, HOME[1]), has_courtyard: false, parent_building_id: null, landmark_note: null, admin_code: null },
      { id: 'bad', geom: null, has_courtyard: false, parent_building_id: null, landmark_note: null, admin_code: null },
    ];
    const list = await certifiedBuildingsNear(fake(rows), HOME);
    expect(list.map((b) => b.id)).toEqual(['near']);
    expect(list[0]).toMatchObject({ source: 'hailand', label: 'Portail bleu', code: 'GN-1' });
  });
  it('erreur de lecture : liste vide, pas de plantage', async () => {
    const broken: BuildingsClient = { from: () => ({ select: () => ({ eq: () => ({ eq: async () => ({ data: null, error: new Error('hors ligne') }) }) }) }) };
    expect(await certifiedBuildingsNear(broken, HOME)).toEqual([]);
  });
});

describe('contours OSM lus sur la carte', () => {
  const map = (features: { id?: number; geometry: GeoJSON.Geometry }[], hasLayer = true): MapLike => ({ project: () => ({ x: 200, y: 200 }), getZoom: () => 18, getLayer: () => (hasLayer ? {} : undefined), queryRenderedFeatures: () => features });
  it('une entité coupée par les tuiles revient en un seul contour ; les points sont ignorés', () => {
    const half = 0.0001;
    const left: GeoJSON.Polygon = { type: 'Polygon', coordinates: [[[HOME[0] - half, HOME[1] - half], [HOME[0], HOME[1] - half], [HOME[0], HOME[1] + half], [HOME[0] - half, HOME[1] + half], [HOME[0] - half, HOME[1] - half]]] };
    const right: GeoJSON.Polygon = { type: 'Polygon', coordinates: [[[HOME[0], HOME[1] - half], [HOME[0] + half, HOME[1] - half], [HOME[0] + half, HOME[1] + half], [HOME[0], HOME[1] + half], [HOME[0], HOME[1] - half]]] };
    const out = osmPolygonsAround(map([{ id: 7, geometry: left }, { id: 7, geometry: right }, { id: 8, geometry: { type: 'Point', coordinates: HOME } }]), HOME, 60, ['osm']);
    expect(out.map((o) => o.id)).toEqual(['7']);
  });
  it('couche absente (tuiles pas chargées) : rien', () => {
    expect(osmPolygonsAround(map([], false), HOME, 60, ['osm'])).toEqual([]);
  });
});
