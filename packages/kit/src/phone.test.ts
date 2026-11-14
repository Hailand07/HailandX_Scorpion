import { describe, expect, it } from 'vitest';
import { groupPhone } from './phone';

describe('saisie du numéro de connexion', () => {
  it('groupe les chiffres comme on les dicte en Guinée', () => {
    expect(groupPhone('621000000')).toBe('621 00 00 00');
    expect(groupPhone('6210')).toBe('621 0');
    expect(groupPhone('621-00 00.00 99')).toBe('621 00 00 00');
  });
  it('laisse un numéro saisi avec son indicatif', () => {
    expect(groupPhone('+224 621 00 00 00')).toBe('+224621000000');
  });
});
