import { describe, expect, it, vi } from 'vitest';
import { ACTIVITE_KEY, adresseAvecSession, avecPassage, controlerInactivite, inactiviteDepassee, INACTIVITE_MAX_MS, lirePassage } from './passage';

const mem = (init: Record<string, string> = {}) => {
  const m = new Map(Object.entries(init));
  return { m, s: { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) } };
};

describe('adresse de passage', () => {
  it('ajoute puis retire le code sans toucher au reste de l’adresse', () => {
    const url = avecPassage('https://vendeur.example/ouvrir?etape=2#haut', 'abc_DEF-123');
    expect(url).toBe('https://vendeur.example/ouvrir?etape=2&passage=abc_DEF-123#haut');
    expect(lirePassage(url)).toEqual({ code: 'abc_DEF-123', propre: '/ouvrir?etape=2#haut' });
    expect(lirePassage('https://x.example/?passage=zz')).toEqual({ code: 'zz', propre: '/' });
    expect(lirePassage('https://x.example/compte')).toBeNull();
  });
});

describe('30 jours d’inactivité', () => {
  const now = Date.UTC(2026, 9, 14);
  it('seuil', () => {
    expect(inactiviteDepassee(null, now)).toBe(false);
    expect(inactiviteDepassee(now - INACTIVITE_MAX_MS + 1000, now)).toBe(false);
    expect(inactiviteDepassee(now - INACTIVITE_MAX_MS - 1000, now)).toBe(true);
  });
  it('au-delà : session de l’appareil fermée, panier effacé ; en deçà : date rafraîchie seulement', async () => {
    const signOut = vi.fn(async () => ({ error: null }));
    const sb = { auth: { getSession: async () => ({ data: { session: { user: { id: 'u' } } } }), signOut } };
    const vieux = mem({ [ACTIVITE_KEY]: String(now - 31 * 86400_000), 'hx.cart': '[1]', 'hx-welcome-v1': '1' });
    expect(await controlerInactivite(sb as never, vieux.s, now)).toBe(true);
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(vieux.m.get('hx.cart')).toBeUndefined();
    expect(vieux.m.get('hx-welcome-v1')).toBe('1');
    expect(vieux.m.get(ACTIVITE_KEY)).toBe(String(now));
    signOut.mockClear();
    const recent = mem({ [ACTIVITE_KEY]: String(now - 5 * 86400_000) });
    expect(await controlerInactivite(sb as never, recent.s, now)).toBe(false);
    expect(signOut).not.toHaveBeenCalled();
    expect(recent.m.get(ACTIVITE_KEY)).toBe(String(now));
  });
});

describe('lien vers une autre application', () => {
  it('connecté : code ajouté ; visiteur ou session anonyme : adresse inchangée', async () => {
    const rpc = vi.fn(async () => ({ data: 'CODE', error: null }));
    const co = { auth: { getSession: async () => ({ data: { session: { user: { id: 'u', is_anonymous: false } } } }) }, rpc };
    expect(await adresseAvecSession(co as never, 'vendeur', 'https://v.example/')).toBe('https://v.example/?passage=CODE');
    expect(rpc).toHaveBeenCalledWith('fn_passage_creer', { p_cible: 'vendeur' });
    const anon = { auth: { getSession: async () => ({ data: { session: { user: { id: 'a', is_anonymous: true } } } }) }, rpc };
    expect(await adresseAvecSession(anon as never, 'vendeur', 'https://v.example/')).toBe('https://v.example/');
    const vis = { auth: { getSession: async () => ({ data: { session: null } }) }, rpc };
    expect(await adresseAvecSession(vis as never, 'vendeur', 'https://v.example/')).toBe('https://v.example/');
    expect(await adresseAvecSession(null, 'vendeur', 'https://v.example/')).toBe('https://v.example/');
  });
});

describe('parcours d’enregistrement dans NavigationX', () => {
  it('adresse profonde avec application et chemin de retour (jamais une adresse libre)', async () => {
    const { lienEnregistrement, NAVIGATIONX_URL } = await import('./links');
    const u = new URL(lienEnregistrement('vendeur', '/ouvrir'));
    expect(u.origin).toBe(new URL(NAVIGATIONX_URL).origin);
    expect(Object.fromEntries(u.searchParams)).toEqual({ enregistrer: '1', retour: 'vendeur', chemin: '/ouvrir' });
    expect(new URL(lienEnregistrement('hailandx', '//pirate.example')).searchParams.get('chemin')).toBe('/');
  });
});
