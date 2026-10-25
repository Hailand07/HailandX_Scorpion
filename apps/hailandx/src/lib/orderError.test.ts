import { describe, expect, it } from 'vitest';
import { explainOrderError } from './orderError';

describe('erreur de commande lisible', () => {
  const lines = [{ offerId: '2ec30704-90c6-4bbe-a39a-41f8e99e06a6', name: 'Canapé 3 places en bois massif et coussins', variantLabel: 'Blanc cassé', shopName: 'Djigo Shop' }];
  it('rupture de stock : nom du produit et de la boutique au lieu de l’identifiant', () => {
    expect(explainOrderError('stock insuffisant pour 2ec30704-90c6-4bbe-a39a-41f8e99e06a6 (Blanc cassé)', lines))
      .toBe('« Canapé 3 places en bois massif et coussins (Blanc cassé) » chez Djigo Shop n’est plus en stock en quantité suffisante. Réduisez la quantité ou retirez-le du panier, puis recommandez.');
    expect(explainOrderError('stock insuffisant pour 11111111-1111-4111-8111-111111111111 (Standard)', lines)).toMatch(/^Un article de votre panier n’est plus en stock/);
  });
  it('les autres messages restent tels quels', () => {
    expect(explainOrderError('adresse invalide', lines)).toBe('adresse invalide');
  });
});
