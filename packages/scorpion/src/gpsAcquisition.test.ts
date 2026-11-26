import { describe, expect, it } from 'vitest';
import { distanceM, shouldStop, summarize, toLocal, MAX_DURATION_MS, type GpsSample } from './gpsAcquisition';

// Conakry (Kaloum) : origine des essais.
const O: [number, number] = [-13.7122, 9.5092];
/** Mesure décalée de (est, nord) mètres depuis l'origine. */
function at(east: number, north: number, accuracy: number, t = 0): GpsSample {
  const lat = O[1] + north / 111194.9;
  const lng = O[0] + east / (111194.9 * Math.cos((O[1] * Math.PI) / 180));
  return { lng, lat, accuracy, t };
}

describe('distances', () => {
  it('mesure un décalage de 100 m à 1 % près', () => {
    const p = at(60, 80, 5);
    expect(distanceM(O, [p.lng, p.lat])).toBeGreaterThan(99);
    expect(distanceM(O, [p.lng, p.lat])).toBeLessThan(101);
    const [x, y] = toLocal(O, [p.lng, p.lat]);
    expect(Math.round(x)).toBe(60);
    expect(Math.round(y)).toBe(80);
  });
});

describe('summarize', () => {
  it('ne renvoie rien sans mesure valide', () => {
    expect(summarize([])).toBeNull();
    expect(summarize([{ lng: NaN, lat: 1, accuracy: 5, t: 0 }])).toBeNull();
  });

  it('une seule mesure : position et précision de la mesure', () => {
    const s = summarize([at(0, 0, 12)])!;
    expect(s.kept).toBe(1);
    expect(s.dispersion).toBe(0);
    expect(s.accuracy).toBe(12);
    expect(s.confidence).toBe('moyenne');
  });

  it('pondère par la précision : la mesure à ±5 m pèse 4 fois plus que celle à ±10 m', () => {
    const s = summarize([at(0, 0, 5), at(10, 0, 10)])!;
    const [x] = toLocal(O, s.position);
    expect(x).toBeCloseTo(2, 0); // (0×4 + 10×1) / 5
  });

  it('écarte une mesure très imprécise', () => {
    const s = summarize([at(0, 0, 6), at(1, 1, 7), at(-1, 0, 6), at(80, 0, 60)])!;
    expect(s.received).toBe(4);
    expect(s.rejected).toBe(1);
    expect(distanceM(O, s.position)).toBeLessThan(2);
  });

  it('écarte une valeur aberrante pourtant annoncée précise', () => {
    const s = summarize([at(0, 0, 6), at(1, 0, 6), at(0, 1, 6), at(-1, 0, 6), at(40, 40, 6)])!;
    expect(s.rejected).toBe(1);
    expect(distanceM(O, s.position)).toBeLessThan(2);
  });

  it('précision prudente : jamais meilleure que la dispersion observée', () => {
    const s = summarize([at(0, 0, 4), at(12, 0, 5), at(-12, 0, 5), at(0, 12, 5), at(0, -12, 5)])!;
    expect(s.dispersion).toBeGreaterThan(4);
    expect(s.accuracy).toBe(s.dispersion);
  });

  it('niveaux de confiance', () => {
    expect(summarize([at(0, 0, 8)])!.confidence).toBe('elevee');
    expect(summarize([at(0, 0, 40)])!.confidence).toBe('faible');
  });
});

describe('shouldStop', () => {
  const good = summarize([at(0, 0, 6), at(1, 0, 6), at(0, 1, 7), at(1, 1, 6)]);
  it('attend la durée minimale', () => expect(shouldStop(good, 2000)).toBe(false));
  it('s’arrête quand la précision est atteinte', () => expect(shouldStop(good, 5000)).toBe(true));
  it('continue si la précision est insuffisante', () => expect(shouldStop(summarize([at(0, 0, 30)]), 8000)).toBe(false));
  it('s’arrête au bout du temps maximal', () => expect(shouldStop(null, MAX_DURATION_MS)).toBe(true));
});

describe('horloge de la récupération (§66)', () => {
  it('le temps passé sur la fenêtre d’autorisation ne compte pas ; démarrage à froid 30 s ; mesures imprécises 25 s', async () => {
    const { acquisitionVerdict, summarize } = await import('./gpsAcquisition');
    const fine = summarize([1, 2, 3, 4, 5].map((i) => ({ lng: -13.6, lat: 9.6, accuracy: 6, t: i })));
    const weak = summarize([{ lng: -13.6, lat: 9.6, accuracy: 900, t: 1 }]);
    expect(acquisitionVerdict({ now: 20000, start: 0, respondedAt: null, firstSampleAt: null, summary: null })).toBe('continue');
    expect(acquisitionVerdict({ now: 61000, start: 0, respondedAt: null, firstSampleAt: null, summary: null })).toBe('no-answer');
    expect(acquisitionVerdict({ now: 25000, start: 0, respondedAt: 10000, firstSampleAt: null, summary: null })).toBe('continue');
    expect(acquisitionVerdict({ now: 41000, start: 0, respondedAt: 10000, firstSampleAt: null, summary: null })).toBe('no-fix');
    expect(acquisitionVerdict({ now: 15000, start: 0, respondedAt: 10000, firstSampleAt: 10000, summary: fine })).toBe('done');
    expect(acquisitionVerdict({ now: 30000, start: 0, respondedAt: 10000, firstSampleAt: 10000, summary: weak })).toBe('continue');
    expect(acquisitionVerdict({ now: 36000, start: 0, respondedAt: 10000, firstSampleAt: 10000, summary: weak })).toBe('done');
  });
});
