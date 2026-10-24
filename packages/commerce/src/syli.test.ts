import { describe, expect, it } from 'vitest';
import { formatGnf } from './money';
import { formatSyli, MOVEMENT_LABEL, phoneFromQr, receiveQr, topupRemaining } from './syli';

describe('Syli', () => {
  it('s’écrit comme les GNF, suivi de « Syli »', () => {
    expect(formatSyli(1190000)).toBe(`${formatGnf(1190000, false)} Syli`);
    expect(formatSyli(250000, false)).toBe(formatGnf(250000, false));
    expect(formatSyli(1190000).replace(/\s/g, ' ')).toBe('1 190 000 Syli');
  });
  it('reste à recharger, jamais négatif', () => {
    expect(topupRemaining(10_000_000)).toBe(40_000_000);
    expect(topupRemaining(60_000_000)).toBe(0);
  });
  it('QR de réception : aller-retour, et refus de tout autre contenu', () => {
    expect(phoneFromQr(receiveQr('+224 623 77 01 66'))).toBe('224623770166');
    expect(phoneFromQr('HX1.colis.xyz')).toBeNull();
  });
  it('chaque type de mouvement a un libellé', () => {
    expect(Object.keys(MOVEMENT_LABEL)).toHaveLength(13);
  });
});
