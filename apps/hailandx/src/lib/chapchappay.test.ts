import { describe, expect, it, vi } from 'vitest';
import { ccpCreate, ccpSign, ccpStatus, ccpVerify, normalizeStatus, orderIdFromRef, orderRefFor, parseResult, sameSecret } from './chapchappay';

const KEY = 'cle-d-encryptage-de-test';
const ORDER = '11111111-1111-4111-8111-111111111111';
// Exemple de notification de la Référence API Chap Chap Pay (E-Commerce, callback_url)
const callback = JSON.stringify({
  order_id: `${ORDER}-lx1`, operation_id: '2db401d7-cad3-449f-9e3e-ec2cf9e48472', amount: 10000.0, description: 'Achat',
  status: { code: 'success', description: 'Transaction terminée avec succès' },
  transaction: { payment_method: 'orange_money', payment_method_reference: 'PAY12345', payer_info: 'Mohamed Diallo', payment_reference: 'REF12345', transaction_date: '16/12/2024 11:00:00' },
});

describe('signature Chap Chap Pay', () => {
  it('HMAC-SHA256 hexadécimal minuscule du corps brut (comme l’exemple de la Référence)', () => {
    // openssl dgst -sha256 -hmac "votre_encryption_password" sur '{"amount":10000,"account_number":"224620000000"}'
    const body = '{"amount":10000,"account_number":"224620000000"}';
    expect(ccpSign('votre_encryption_password', body)).toMatch(/^[0-9a-f]{64}$/);
    expect(ccpVerify(KEY, callback, ccpSign(KEY, callback))).toBe(true);
    expect(ccpVerify(KEY, callback, ccpSign(KEY, callback).toUpperCase())).toBe(true);
  });
  it('refuse un corps modifié, une autre clé, une signature absente ou mal formée', () => {
    const sig = ccpSign(KEY, callback);
    expect(ccpVerify(KEY, callback.replace('"amount":10000', '"amount":1'), sig)).toBe(false);
    expect(ccpVerify('autre', callback, sig)).toBe(false);
    expect(ccpVerify(KEY, callback, null)).toBe(false);
    expect(ccpVerify(KEY, callback, 'zz')).toBe(false);
    expect(ccpVerify(undefined, callback, sig)).toBe(false);
    expect(sameSecret('abc', 'abc')).toBe(true);
    expect(sameSecret('abc', 'abd')).toBe(false);
    expect(sameSecret(undefined, 'abc')).toBe(false);
  });
});

describe('notification et statut', () => {
  it('lit la notification : opération, montant, statut, moyen, référence', () => {
    expect(parseResult(callback)).toEqual({ orderRef: `${ORDER}-lx1`, operationId: '2db401d7-cad3-449f-9e3e-ec2cf9e48472', amountGnf: 10000, status: 'success', method: 'orange_money', reference: 'REF12345' });
    expect(parseResult('pas du json')).toBeNull();
    expect(parseResult(JSON.stringify({ operation_id: 'x', amount: 5, status: { code: 'bizarre' } }))).toBeNull();
    expect(normalizeStatus('completed')).toBe('success');
    expect(normalizeStatus('EXPIRED')).toBe('expired');
  });
  it('référence de commande : identifiant HailandX + suffixe, et retour', () => {
    const ref = orderRefFor(ORDER, 1_800_000_000_000);
    expect(ref.length).toBeLessThanOrEqual(64);
    expect(/^[A-Za-z0-9_-]{4,64}$/.test(ref)).toBe(true);
    expect(orderIdFromRef(ref)).toBe(ORDER);
    expect(orderIdFromRef('ORD12345')).toBeNull();
  });
});

describe('appels à l’API', () => {
  it('crée l’opération avec la clé API et la signature du corps exact, renvoie le lien', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ operation_id: 'op-1', payment_url: 'https://chapchappay.com/pay/op-1' }), { status: 201 }));
    const r = await ccpCreate('cle-api', KEY, { amount: 239000, orderRef: `${ORDER}-a`, description: 'Commande HailandX', returnUrl: 'https://x/r', cancelUrl: 'https://x/c', callbackUrl: 'https://x/n' }, f as unknown as typeof fetch);
    expect(r).toEqual({ operationId: 'op-1', paymentUrl: 'https://chapchappay.com/pay/op-1' });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://chapchappay.com/api/ecommerce/create');
    const h = init.headers as Record<string, string>;
    expect(h['CCP-Api-Key']).toBe('cle-api');
    expect(h['CCP-HMAC-Signature']).toBe(ccpSign(KEY, String(init.body)));
    expect(JSON.parse(String(init.body))).toMatchObject({ amount: 239000, callback_url: 'https://x/n', fee_handling: 'deduct' });
  });
  it('erreur de l’API : message clair ; statut « completed » lu comme réussi', async () => {
    const bad = vi.fn(async () => new Response(JSON.stringify({ message: 'Clé invalide' }), { status: 401 }));
    await expect(ccpCreate('x', KEY, { amount: 1, orderRef: 'abcd', description: '', returnUrl: '', cancelUrl: '', callbackUrl: '' }, bad as unknown as typeof fetch)).rejects.toThrow('Clé invalide');
    const ok = vi.fn(async () => new Response(JSON.stringify({ operation_id: 'op-1', amount: 239000, order_id: `${ORDER}-a`, status: { code: 'completed', payment_method: 'paycard' } }), { status: 200 }));
    expect(await ccpStatus('x', 'op-1', ok as unknown as typeof fetch)).toMatchObject({ status: 'success', amountGnf: 239000, method: 'paycard' });
  });
});
