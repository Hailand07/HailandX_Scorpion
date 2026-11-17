import { describe, expect, it } from 'vitest';
import { addrName, isLive } from './addresses';

describe('adresses temporaires (§53)', () => {
  it('une adresse temporaire expirée n’est plus proposée ; une adresse durable l’est toujours', () => {
    const now = Date.parse('2026-11-14T12:00:00Z');
    expect(isLive({ temporary_until: null }, now)).toBe(true);
    expect(isLive({ temporary_until: '2026-12-14T12:00:00Z' }, now)).toBe(true);
    expect(isLive({ temporary_until: '2026-11-13T12:00:00Z' }, now)).toBe(false);
  });
  it('nom affiché : jamais « Domicile » pour une adresse temporaire', () => {
    expect(addrName({ declared_label: 'Autre', hailand_code: 'GN-1', temporary_until: '2026-12-14T12:00:00Z' })).toMatch(/^Adresse temporaire · jusqu’au 14 déc/);
    expect(addrName({ declared_label: 'Domicile', hailand_code: 'GN-1', temporary_until: null })).toBe('Domicile');
    expect(addrName({ declared_label: 'Autre', hailand_code: 'GN-1', temporary_until: null }, 'Chez Maman')).toBe('Chez Maman');
  });
});

describe('addrPlace / addrDetails', () => {
  it('montre le quartier et la commune, ou rien', async () => {
    const { addrPlace, addrDetails } = await import('./addresses');
    expect(addrPlace({ quartier_nom: 'Kipé', commune_nom: 'Ratoma' })).toBe('Kipé · Ratoma');
    expect(addrPlace({ quartier_nom: null, commune_nom: 'Ratoma' })).toBe('Ratoma');
    expect(addrPlace({ quartier_nom: null, commune_nom: null })).toBe('');
    expect(addrDetails({ location_floor: '2', location_door: null, declared_landmark: 'face à la pharmacie' })).toBe('Étage 2 · face à la pharmacie');
  });
});
