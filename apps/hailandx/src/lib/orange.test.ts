import { describe, expect, it } from 'vitest';
import { parseNotice, signBody, verifySignature } from './orange';

describe('notification de paiement', () => {
  const secret = 'secret-de-test';
  const body = JSON.stringify({ order_id: '11111111-1111-4111-8111-111111111111', amount: 213000, status: 'success', txnid: 'MP123' });

  it('accepte une signature valide, refuse les autres', () => {
    const sig = signBody(secret, body);
    expect(verifySignature(secret, body, sig)).toBe(true);
    expect(verifySignature(secret, body, `sha256=${sig}`)).toBe(true);
    expect(verifySignature(secret, body + ' ', sig)).toBe(false);
    expect(verifySignature('autre', body, sig)).toBe(false);
    expect(verifySignature(secret, body, null)).toBe(false);
    expect(verifySignature(secret, body, 'zz')).toBe(false);
    expect(verifySignature(undefined, body, sig)).toBe(false);
    expect(verifySignature('', body, sig)).toBe(false);
  });

  it('lit un avis de paiement et refuse un corps invalide', () => {
    expect(parseNotice(body)).toEqual({ orderId: '11111111-1111-4111-8111-111111111111', reference: 'MP123', amountGnf: 213000, status: 'SUCCESS' });
    expect(parseNotice('pas du json')).toBeNull();
    expect(parseNotice(JSON.stringify({ order_id: 'x', amount: 1, status: 'success' }))).toBeNull();
    expect(parseNotice(JSON.stringify({ order_id: '11111111-1111-4111-8111-111111111111', amount: -5, status: 'success' }))).toBeNull();
    expect(parseNotice(JSON.stringify({ order_id: '11111111-1111-4111-8111-111111111111', amount: 5, status: 'bizarre' }))).toBeNull();
  });
});
