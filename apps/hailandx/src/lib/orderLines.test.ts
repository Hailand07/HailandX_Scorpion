import { describe, expect, it } from 'vitest';
import { groupLines } from './orderLines';

describe('groupLines', () => {
  it('regroupe un même produit en une ligne avec la quantité et le total', () => {
    const l = groupLines([
      { offer_id: 'a', name_snapshot: 'Souris', quantity: 1, price_gnf_snapshot: 25000 },
      { offer_id: 'a', name_snapshot: 'Souris', quantity: 2, price_gnf_snapshot: 25000, photo: 'x.jpg' },
      { offer_id: 'b', name_snapshot: 'iPhone 7', quantity: 1, price_gnf_snapshot: 400000 },
    ]);
    expect(l).toHaveLength(2);
    expect(l[0]).toMatchObject({ name: 'Souris', quantity: 3, unitGnf: 25000, totalGnf: 75000, photo: 'x.jpg' });
  });
  it('garde séparées deux variantes du même produit', () => {
    expect(groupLines([
      { offer_id: 'a', name_snapshot: 'T-shirt', variant_label: 'M', quantity: 1, price_gnf_snapshot: 1 },
      { offer_id: 'a', name_snapshot: 'T-shirt', variant_label: 'L', quantity: 1, price_gnf_snapshot: 1 },
    ])).toHaveLength(2);
  });
});
