import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APP_INFO, markSvg, type HailandApp } from './marks';

const APPS: HailandApp[] = ['hailandx', 'vendeur', 'flotte', 'console'];

describe('logos des applications', () => {
  it('chaque application a un logo et un écran d’ouverture', () => {
    for (const app of APPS) {
      const svg = markSvg(app);
      expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 64 64">/);
      expect(svg).not.toMatch(/<text/); // tracés seulement : rendu identique sans police installée (icônes PNG)
      expect(APP_INFO[app].nom.length).toBeGreaterThan(3);
    }
  });
  it('icône « maskable » : fond plein et symbole réduit dans la zone de sécurité', () => {
    const svg = markSvg('flotte', { plein: true, marge: 10 });
    expect(svg).toContain('rx="0"');
    expect(svg).toContain('translate(10 10) scale(0.6875)');
    expect(svg).not.toContain('#2a3150'); // pas de liseré sur une icône plein cadre
  });
  it('les icônes servies sont à jour avec la source (relancer scripts/icones.ts sinon)', () => {
    for (const [app, dir] of [['hailandx', 'hailandx'], ['vendeur', 'vendeur'], ['flotte', 'flotte'], ['console', 'console']] as const) {
      expect(readFileSync(new URL(`../../../apps/${dir}/src/app/icon.svg`, import.meta.url), 'utf8')).toBe(markSvg(app));
    }
  });
});
