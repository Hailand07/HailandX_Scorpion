import { describe, expect, it, vi } from 'vitest';
import { clearAccountDevice, signOutHailand } from './account';

const store = (init: Record<string, string>) => {
  const m = new Map(Object.entries(init));
  return { m, s: { get length() { return m.size; }, key: (i: number) => [...m.keys()][i] ?? null, removeItem: (k: string) => void m.delete(k) } };
};

describe('déconnexion Hailand', () => {
  it('efface panier, recherches et session ; garde les préférences de l’appareil', () => {
    const { m, s } = store({ 'hx.cart': '[1]', 'hx.recherches': '["pagne"]', 'sb-abc-auth-token': '{}', 'hx-welcome-v1': '1', 'flotte-voix': 'non', 'hx.src': 'tiktok' });
    clearAccountDevice(s);
    expect([...m.keys()].sort()).toEqual(['flotte-voix', 'hx-welcome-v1', 'hx.src']);
  });
  it('révoque toutes les sessions, et à défaut (hors ligne) efface au moins celle de l’appareil', async () => {
    const calls: string[] = [];
    const ok = { auth: { signOut: vi.fn(async ({ scope }: { scope: string }) => { calls.push(scope); return { error: null }; }) } };
    await signOutHailand(ok as never);
    expect(calls).toEqual(['global']);
    calls.length = 0;
    const offline = { auth: { signOut: vi.fn(async ({ scope }: { scope: string }) => { calls.push(scope); return { error: scope === 'global' ? new Error('réseau') : null }; }) } };
    await signOutHailand(offline as never);
    expect(calls).toEqual(['global', 'local']);
  });
});
