import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { settle } from './settlePayment';

const fake = (confirmError: string | null = null) => {
  const rpc = vi.fn(async (fn: string) => ({ data: null, error: fn === 'fn_payment_confirm' && confirmError ? { message: confirmError } : null }));
  return { sb: { rpc } as unknown as SupabaseClient, rpc };
};
const r = (status: 'success' | 'failed' | 'canceled') => ({ orderRef: 'x', operationId: 'op-1', amountGnf: 239000, status, method: 'orange_money', reference: 'REF-1' });

describe('résultat Chap Chap Pay appliqué à la commande', () => {
  it('« success » : statut noté puis confirmation avec le montant et la référence', async () => {
    const { sb, rpc } = fake();
    expect(await settle(sb, 'o-1', r('success'))).toEqual({ ok: true, state: 'bloque' });
    expect(rpc.mock.calls).toEqual([
      ['fn_pay_provider_status', { p_order: 'o-1', p_status: 'success', p_method: 'orange_money' }],
      ['fn_payment_confirm', { p_order: 'o-1', p_ref: 'REF-1', p_amount: 239000 }],
    ]);
  });
  it('échec ou annulation : noté, jamais confirmé ; notification répétée : acceptée sans double paiement', async () => {
    const a = fake();
    expect(await settle(a.sb, 'o-1', r('failed'))).toEqual({ ok: true, state: 'failed' });
    expect(a.rpc).toHaveBeenCalledTimes(1);
    const b = fake('cette commande est déjà payée ou remboursée');
    expect(await settle(b.sb, 'o-1', r('success'))).toEqual({ ok: true, state: 'deja_paye' });
    const c = fake('montant incorrect : 1 au lieu de 239000');
    expect((await settle(c.sb, 'o-1', r('success'))).ok).toBe(false);
  });
});
