import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buyerOrderText, e164, notifyBuyerOfOrder, notifyShopsOfOrder, vendorOrderText } from './sms';

describe('SMS au vendeur (§51)', () => {
  it('numéros guinéens mis au format international', () => {
    expect(e164('621 00 00 00')).toBe('+224621000000');
    expect(e164('+224 621000000')).toBe('+224621000000');
    expect(e164('224621000000')).toBe('+224621000000');
    expect(e164('')).toBeNull();
    expect(e164(null)).toBeNull();
  });
  it('texte court : boutique, articles, montant, lien des commandes', () => {
    const t = vendorOrderText('Chez Awa', 5000, 2);
    expect(t).toContain('Chez Awa');
    expect(t).toContain('2 articles');
    expect(t).toContain('/commandes');
    expect(t.length).toBeLessThanOrEqual(160);
  });
  it('sans fournisseur configuré : rien n’est lu ni envoyé', async () => {
    const from = vi.fn();
    expect(await notifyShopsOfOrder({ from } as unknown as SupabaseClient, 'o-1', null)).toBe(0);
    expect(from).not.toHaveBeenCalled();
  });
  it('texte au client : un seul SMS, avec le lien du suivi', () => {
    const t = buyerOrderText('3d464913-0000-4000-8000-000000000000');
    expect(t).toContain('/commandes/3d464913-0000-4000-8000-000000000000');
    expect(t.length).toBeLessThanOrEqual(160);
  });
  it('client : sans fournisseur configuré, rien n’est envoyé', async () => {
    const from = vi.fn();
    expect(await notifyBuyerOfOrder({ from } as unknown as SupabaseClient, 'o-1', null)).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });
});
