import { describe, expect, it } from 'vitest';
import { combineAttempts, guidanceFor, liveHint } from './attempts';
import type { GpsSummary } from './gpsAcquisition';

const at = (lng: number, lat: number, accuracy: number): GpsSummary => ({ received: 5, kept: 5, rejected: 0, position: [lng, lat], bestAccuracy: accuracy, dispersion: 1, accuracy, confidence: accuracy <= 10 ? 'elevee' : accuracy <= 25 ? 'moyenne' : 'faible', keptSamples: [] });
// ≈ 111 m par 0,001° de latitude
const A = at(-13.6773, 9.537, 30);
const A2 = at(-13.6773, 9.53705, 8); // ≈ 5,5 m de A
const FAR = at(-13.6773, 9.54, 6); // ≈ 333 m de A

describe('tentatives GPS cumulées', () => {
  it('une seule tentative : retenue telle quelle', () => {
    expect(combineAttempts([])).toBeNull();
    expect(combineAttempts([A])).toMatchObject({ best: A, verdict: 'unique', count: 1 });
  });
  it('deux tentatives au même endroit se confirment ; la plus précise est retenue', () => {
    const r = combineAttempts([A, A2])!;
    expect(r.verdict).toBe('confirme'); expect(r.best).toBe(A2); expect(r.spread).toBeLessThan(10);
  });
  it('deux tentatives éloignées : GPS instable', () => {
    const r = combineAttempts([A, FAR])!;
    expect(r.verdict).toBe('instable'); expect(r.spread).toBeGreaterThan(300);
  });
  it('une mesure qui a sauté, même annoncée précise, perd contre deux mesures qui s’accordent', () => {
    const r = combineAttempts([FAR, A, A2])!;
    expect(r.verdict).toBe('confirme'); expect(r.best).toBe(A2);
  });
});

describe('consignes selon la tentative', () => {
  it('fenêtre, puis balcon, puis dehors', () => {
    expect(guidanceFor(1, null).tips[1]!.title).toMatch(/fenêtre/);
    expect(guidanceFor(2, 'faible').title).toMatch(/sortez un peu/i);
    expect(guidanceFor(2, 'faible').intro).toMatch(/trop faible/);
    expect(guidanceFor(3, 'hors_cercle').tips[0]!.title).toMatch(/Dehors/);
    expect(guidanceFor(4, 'instable').intro).toMatch(/instable/);
    expect([1, 2, 3].map(liveHint).join('|')).toMatch(/fenêtre.*balcon.*dehors/);
  });
});
