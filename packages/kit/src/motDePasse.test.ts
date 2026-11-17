import { describe, expect, it } from 'vitest';
import { emailValide, erreurCompte, forceMotDePasse, problemeMotDePasse } from './motDePasse';

describe('mot de passe (§59)', () => {
  it('refuse trop court, sans chiffre ou sans lettre', () => {
    expect(problemeMotDePasse('abc12')).toMatch(/8 caractères/);
    expect(problemeMotDePasse('abcdefghij')).toMatch(/lettres et des chiffres/);
    expect(problemeMotDePasse('1234567890')).toMatch(/lettres et des chiffres/);
  });
  it('refuse le numéro de téléphone et les mots de passe courants', () => {
    expect(problemeMotDePasse('a621000000', '+224621000000')).toMatch(/numéro/);
    expect(problemeMotDePasse('Azerty123')).toMatch(/deviner/);
  });
  it('accepte un mot de passe correct et mesure sa force', () => {
    expect(problemeMotDePasse('Kipé2026soleil', '+224621000000')).toBeNull();
    expect(forceMotDePasse('mango2026')).toBe(1);
    expect(forceMotDePasse('Mango-du-soir-2026')).toBe(3);
    expect(forceMotDePasse('court1')).toBe(0);
  });
  it('vérifie une adresse e-mail et traduit les erreurs', () => {
    expect(emailValide('awa@exemple.com')).toBe(true);
    expect(emailValide('awa@exemple')).toBe(false);
    expect(erreurCompte('Invalid login credentials')).toMatch(/incorrect/);
    expect(erreurCompte('User already registered')).toMatch(/déjà un compte/);
  });
});
