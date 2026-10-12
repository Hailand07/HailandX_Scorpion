import { describe, expect, it } from 'vitest';
import { detectAtTap, detectBuilding, snapRadius, type CandidateInput } from './buildingDetection';

const O: [number, number] = [-13.6436, 9.5498];
const M = 111194.9;
const kx = Math.cos((O[1] * Math.PI) / 180);
/** Carré de `size` m dont le coin sud-ouest est à (est, nord) mètres de l'origine. */
function square(east: number, north: number, size: number): GeoJSON.Polygon {
  const p = (e: number, n: number) => [O[0] + e / (M * kx), O[1] + n / M];
  return { type: 'Polygon', coordinates: [[p(east, north), p(east + size, north), p(east + size, north + size), p(east, north + size), p(east, north)]] };
}
const osm = (id: string, poly: GeoJSON.Polygon): CandidateInput => ({ source: 'osm', id, polygon: poly });
const hailand = (id: string, poly: GeoJSON.Polygon, courtyard = false): CandidateInput => ({ source: 'hailand', id, polygon: poly, courtyard });

describe('detectBuilding', () => {
  it('préfère un bâtiment certifié Hailand contenant la position', () => {
    const d = detectBuilding(O, 8, [osm('o1', square(-5, -5, 10)), hailand('h1', square(-6, -6, 12))]);
    expect(d.method).toBe('hailand');
    expect(d.chosen?.id).toBe('h1');
    expect(d.hailandCount).toBe(1);
    expect(d.osmCount).toBe(1);
  });

  it('dans une concession certifiée, choisit le bâtiment plutôt que la cour', () => {
    const d = detectBuilding(O, 8, [hailand('cour', square(-20, -20, 40), true), hailand('bat', square(-4, -4, 8))]);
    expect(d.chosen?.id).toBe('bat');
  });

  it('sinon, le plus petit contour OSM contenant la position', () => {
    const d = detectBuilding(O, 8, [osm('grand', square(-30, -30, 60)), osm('petit', square(-5, -5, 10))]);
    expect(d.method).toBe('osm_dedans');
    expect(d.chosen?.id).toBe('petit');
    expect(d.chosen?.area).toBeGreaterThan(95);
    expect(d.chosen?.area).toBeLessThan(105);
  });

  it('accepte un contour OSM tout proche (GPS juste à côté des murs)', () => {
    const d = detectBuilding(O, 8, [osm('voisin', square(4, -5, 10))]);
    expect(d.method).toBe('osm_proche');
    expect(d.chosen?.distance).toBeCloseTo(4, 0);
  });

  it('sans contour contenant la position, verrouille le plus proche du rayon d’examen', () => {
    const d = detectBuilding(O, 8, [osm('loin', square(25, 25, 10)), osm('plus-loin', square(40, 40, 10))]);
    expect(d.method).toBe('osm_proche');
    expect(d.chosen?.id).toBe('loin');
    expect(d.examined).toHaveLength(2);
  });

  it('un bâtiment certifié proche est proposé (rattachement après confirmation visuelle)', () => {
    const d = detectBuilding(O, 8, [hailand('h', square(3, 3, 10))]);
    expect(d.method).toBe('hailand_proche');
    expect(d.chosen?.id).toBe('h');
  });

  it('à distance presque égale, le bâtiment certifié l’emporte sur le contour OSM', () => {
    const d = detectBuilding(O, 8, [osm('o', square(4, -5, 10)), hailand('h', square(-11, -5, 5))]);
    expect(d.chosen?.id).toBe('h');
  });

  it('rien dans le rayon d’examen : identification manuelle', () => {
    const d = detectBuilding(O, 8, [osm('tres-loin', square(80, 80, 10))]);
    expect(d.method).toBe('aucun');
    expect(d.chosen).toBeNull();
  });

  it('calcule le recouvrement du cercle de précision', () => {
    const d = detectBuilding(O, 5, [osm('o', square(-50, -50, 100))]);
    expect(d.chosen?.overlap).toBeGreaterThan(0.99);
    const half = detectBuilding(O, 5, [osm('o', square(0, -50, 100))]);
    expect(half.chosen?.overlap).toBeGreaterThan(0.45);
    expect(half.chosen?.overlap).toBeLessThan(0.55);
  });

  it('ignore les contours au-delà du rayon d’examen', () => {
    expect(detectBuilding(O, 8, [osm('tres-loin', square(200, 200, 10))]).examined).toHaveLength(0);
  });

  it('rayon d’accroche borné entre 5 et 15 m', () => {
    expect(snapRadius(2)).toBe(5);
    expect(snapRadius(9)).toBe(9);
    expect(snapRadius(40)).toBe(15);
  });
});

describe('detectAtTap', () => {
  const tapAt = (e: number, n: number): [number, number] => [O[0] + e / (M * kx), O[1] + n / M];

  it('refuse un point touché trop loin de la position GPS', () => {
    const r = detectAtTap(tapAt(150, 0), O, 8, []);
    expect(r.kind).toBe('trop_loin');
    if (r.kind === 'trop_loin') expect(r.max).toBe(100);
  });

  it('tolère plus loin quand la précision est mauvaise', () => {
    expect(detectAtTap(tapAt(150, 0), O, 180, []).kind).toBe('zone');
  });

  it('retient le contour OSM touché', () => {
    const r = detectAtTap(tapAt(30, 0), O, 8, [osm('o', square(25, -5, 10))]);
    expect(r.kind).toBe('osm');
    if (r.kind === 'osm') {
      expect(r.method).toBe('dedans');
      expect(r.distance).toBeCloseTo(30, 0);
    }
  });

  it('accroche un contour OSM touché à côté (moins de 8 m)', () => {
    const r = detectAtTap(tapAt(30, 0), O, 8, [osm('o', square(35, -5, 10))]);
    expect(r.kind === 'osm' && r.method).toBe('proche');
  });

  it('sinon, la zone touchée (niveau 1)', () => {
    expect(detectAtTap(tapAt(30, 0), O, 8, [osm('o', square(60, 0, 10))]).kind).toBe('zone');
  });

  it('une touche à côté d’un bâtiment certifié ne le sélectionne pas (la touche fait foi)', () => {
    // Bâtiment certifié à 20 m du point touché, maison OSM sous le doigt.
    const r = detectAtTap(tapAt(30, 0), O, 8, [hailand('h', square(45, -5, 10)), osm('maison', square(26, -4, 8))]);
    expect(r.kind).toBe('osm');
    if (r.kind === 'osm') expect(r.candidate.id).toBe('maison');
  });

  it('une touche dans un terrain vide près d’un bâtiment certifié donne la zone touchée', () => {
    expect(detectAtTap(tapAt(30, 0), O, 8, [hailand('h', square(42, -5, 10))]).kind).toBe('zone');
  });

  it('la tolérance du doigt suit le zoom (plus petite quand on est très près)', () => {
    const cands = [osm('o', square(33, -5, 10))]; // bord à 3 m du point touché
    expect(detectAtTap(tapAt(30, 0), O, 8, cands, 6).kind).toBe('osm');
    expect(detectAtTap(tapAt(30, 0), O, 8, cands, 2).kind).toBe('zone');
  });

  it('dans une concession certifiée, la maison touchée l’emporte sur la cour', () => {
    const r = detectAtTap(tapAt(30, 0), O, 8, [hailand('cour', square(10, -20, 40), true), osm('maison', square(26, -4, 8))]);
    expect(r.kind === 'osm' && r.candidate.id).toBe('maison');
  });

  it('touche dans la cour d’une concession certifiée, hors des bâtiments : la concession', () => {
    const r = detectAtTap(tapAt(30, 0), O, 8, [hailand('cour', square(10, -20, 40), true)]);
    expect(r.kind === 'certifie' && r.candidate.id).toBe('cour');
  });

  it('signale un bâtiment certifié touché sans que le GPS y soit', () => {
    const r = detectAtTap(tapAt(30, 0), O, 8, [hailand('h', square(25, -5, 10)), osm('o', square(25, -5, 10))]);
    expect(r.kind).toBe('certifie');
  });
});
