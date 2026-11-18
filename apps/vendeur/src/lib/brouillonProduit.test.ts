import { beforeEach, describe, expect, it } from 'vitest';
import { BROUILLON_MAX_MS, brouillonUtile, cleBrouillon, ecrireBrouillon, effacerBrouillon, lireBrouillon, type BrouillonProduit } from './brouillonProduit';

const mem = new Map<string, string>();
beforeEach(() => {
  mem.clear();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(), key: () => null, length: 0,
  } as Storage;
});

const d: BrouillonProduit = { name: 'Souris', desc: '', points: ['', '', ''], values: {}, condition: 'neuf', note: '', price: '25000', compareAt: '', variants: [{ key: 0, id: '', label: '', stock: 1 }], removed: [], section: null, cat: null, active: true, kept: ['u/1.jpg'], linked: null };

describe('brouillon du produit (§61)', () => {
  it('garde la saisie et les photos déjà envoyées, puis l’efface', () => {
    const k = cleBrouillon('shop', undefined, undefined);
    expect(k).toBe('shop.nouveau');
    ecrireBrouillon(k, d, 1000);
    expect(lireBrouillon(k, 2000)).toEqual(d);
    effacerBrouillon(k);
    expect(lireBrouillon(k, 2000)).toBeNull();
  });
  it('oublie un brouillon de plus de 24 heures', () => {
    ecrireBrouillon('k', d, 0);
    expect(lireBrouillon('k', BROUILLON_MAX_MS + 1)).toBeNull();
  });
  it('distingue nouveau produit, copie et modification ; ignore un brouillon vide', () => {
    expect(cleBrouillon('s', 'o1')).toBe('s.modif.o1');
    expect(cleBrouillon('s', undefined, 'o2')).toBe('s.copie.o2');
    expect(brouillonUtile({ ...d, name: '', price: '', kept: [] })).toBe(false);
    expect(brouillonUtile(d)).toBe(true);
  });
});
