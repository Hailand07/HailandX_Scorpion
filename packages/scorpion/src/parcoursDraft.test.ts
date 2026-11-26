import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearDraft, hasDraft, readDraft, writeDraft } from './parcoursDraft';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) });
});
const base = { gps: { lngLat: [-13.56, 9.69] as [number, number], accuracy: 12 }, polygon: null, osmId: null, tapPoint: null, certifiedId: 'b-1', admin: {}, level: 2 as const, locatedBy: 'gps' as const, label: 'Domicile', buildingType: 'R', floor: '', door: '', landmark: 'Portail bleu', gatePath: 'u/1.jpg' };

describe('brouillon du parcours d’adresse (§55)', () => {
  it('l’étape infos est reprise après un rechargement', () => {
    writeDraft('client', base);
    expect(hasDraft('client')).toBe(true);
    expect(readDraft('client')?.landmark).toBe('Portail bleu');
    expect(readDraft('client')?.gatePath).toBe('u/1.jpg');
  });
  it('un brouillon de plus de 30 minutes est oublié ; effacé après enregistrement', () => {
    writeDraft('client', base);
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 31 * 60_000);
    expect(readDraft('client')).toBeNull();
    vi.restoreAllMocks();
    writeDraft('boutique', base);
    clearDraft('boutique');
    expect(hasDraft('boutique')).toBe(false);
  });
});

describe('reprise après rechargement (iPhone, §66)', () => {
  it('note, lit puis efface la reprise ; expire après 10 minutes', async () => {
    const { markResume, peekResume, clearResume, hasParcours } = await import('./parcoursDraft');
    markResume('essai', { temporary: true });
    expect(peekResume('essai')?.extra).toEqual({ temporary: true });
    expect(hasParcours('essai')).toBe(true);
    clearResume('essai');
    expect(peekResume('essai')).toBeNull();
    localStorage.setItem('hx.parcours.reprise.vieux', JSON.stringify({ at: Date.now() - 11 * 60_000 }));
    expect(peekResume('vieux')).toBeNull();
  });
});
