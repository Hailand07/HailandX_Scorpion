import { describe, expect, it } from 'vitest';
import { maskAccount, payoutMethodLabel } from './payout';

describe('moyens de versement', () => {
  it('libellés et numéros masqués', () => {
    expect(payoutMethodLabel('kulu')).toBe('Kulu');
    expect(payoutMethodLabel('autre')).toBe('Moyen inconnu');
    expect(maskAccount('orange_money', '224620000009')).toBe('620 •• •• 09');
    expect(maskAccount('banque', 'GN12 0001 0002 3456')).toBe('•••• 3456');
  });
});
