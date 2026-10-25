import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { djomyApiKey, djomyCreate, djomyGetStatus, djomyParse, djomyPhone, djomyStatus, djomyVerify } from './djomy';

const ID = 'djomy-client-test'; const SECRET = 'secret-de-test';
const ORDER = '11111111-1111-4111-8111-111111111111';
// Exemple « V1 - Paiement réussi » de la documentation Djomy (webhook)
const webhook = JSON.stringify({
  message: 'Statut du paiement', eventType: 'payment.success', eventId: '8bfd5709-737c-4254-99a7-57a3d630b349',
  data: { transactionId: '123e4567-e89b-12d3-a456-426614174000', status: 'SUCCESS', paidAmount: 10000, receivedAmount: 9000, fees: 1000, paymentMethod: 'OM', merchantPaymentReference: `${ORDER}-lx1`, payerIdentifier: '00224623000001', currency: 'GNF', createdAt: '2025-07-13T10:30:00.000Z' },
  paymentLinkReference: 'LINK-REF', timestamp: '2025-07-13T10:31:00.000Z',
});
const sign = (body: string, s = SECRET) => `v1:${createHmac('sha256', s).update(body).digest('hex')}`;

describe('authentification et signature Djomy', () => {
  it('X-API-KEY = clientId:HMAC-SHA256(clientId, secret) en hexadécimal', () => {
    expect(djomyApiKey(ID, SECRET)).toBe(`${ID}:${createHmac('sha256', SECRET).update(ID).digest('hex')}`);
  });
  it('webhook : « v1:<hex> » du corps brut ; refuse un corps modifié, un autre secret, une signature absente', () => {
    expect(djomyVerify(SECRET, webhook, sign(webhook))).toBe(true);
    expect(djomyVerify(SECRET, webhook, sign(webhook).slice(3))).toBe(true); // sans préfixe
    expect(djomyVerify(SECRET, webhook.replace('10000', '1'), sign(webhook))).toBe(false);
    expect(djomyVerify(SECRET, webhook, sign(webhook, 'autre'))).toBe(false);
    expect(djomyVerify(SECRET, webhook, null)).toBe(false);
    expect(djomyVerify(undefined, webhook, sign(webhook))).toBe(false);
  });
});

describe('lecture des paiements Djomy', () => {
  it('webhook V1 : montant payé, frais, moyen, référence de commande', () => {
    expect(djomyParse(webhook)).toEqual({ orderRef: `${ORDER}-lx1`, operationId: '123e4567-e89b-12d3-a456-426614174000', amountGnf: 10000, status: 'success', method: 'om', reference: '123e4567-e89b-12d3-a456-426614174000', feesGnf: 1000 });
  });
  it('webhook V2 (data.payment) et statuts ramenés à ceux de la base', () => {
    const v2 = JSON.parse(webhook) as { data: Record<string, unknown> };
    expect(djomyParse({ ...v2, eventType: 'payment.failed', data: { payment: { ...v2.data, status: 'FAILED' } } })?.status).toBe('failed');
    expect(djomyStatus('TIMEOUT')).toBe('expired');
    expect(djomyStatus('CANCELLED')).toBe('canceled');
    expect(djomyStatus('REDIRECTED')).toBe('new');
    expect(djomyStatus('REFUNDED')).toBeNull();
    expect(djomyParse('pas du json')).toBeNull();
  });
  it('numéro du payeur au format 00224…', () => {
    expect(djomyPhone('+224 620 00 00 00')).toBe('00224620000000');
    expect(djomyPhone('620000000')).toBe('00224620000000');
    expect(djomyPhone('00224620000000')).toBe('00224620000000');
    expect(djomyPhone('12')).toBeNull();
  });
});

describe('appels à l’API Djomy (simulés)', () => {
  it('jeton puis paiement avec redirection : en-têtes, corps, lien', async () => {
    const f = vi.fn(async (url: string) => url.endsWith('/v1/auth')
      ? new Response(JSON.stringify({ success: true, data: { accessToken: 'jwt-1' } }), { status: 201 })
      : new Response(JSON.stringify({ success: true, data: { transactionId: 'tx-1', redirectUrl: 'https://pay.djomy.africa/tx-1' } }), { status: 201 }));
    const r = await djomyCreate({ clientId: ID, clientSecret: SECRET, live: false }, { amount: 64000, payerNumber: '00224620000000', orderId: ORDER, orderRef: `${ORDER}-x`, description: 'Commande', returnUrl: 'https://h.app/r', cancelUrl: 'https://h.app/c' }, f as unknown as typeof fetch);
    expect(r).toEqual({ operationId: 'tx-1', paymentUrl: 'https://pay.djomy.africa/tx-1' });
    const [authUrl, authInit] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(authUrl).toBe('https://sandbox-api.djomy.africa/v1/auth');
    expect((authInit.headers as Record<string, string>)['X-API-KEY']).toBe(djomyApiKey(ID, SECRET));
    const [payUrl, payInit] = f.mock.calls[1] as unknown as [string, RequestInit];
    expect(payUrl).toBe('https://sandbox-api.djomy.africa/v1/payments/gateway');
    expect((payInit.headers as Record<string, string>).Authorization).toBe('Bearer jwt-1');
    expect(JSON.parse(String(payInit.body))).toMatchObject({ amount: 64000, countryCode: 'GN', payerNumber: '00224620000000', merchantPaymentReference: `${ORDER}-x`, metadata: { order_id: ORDER } });
  });
  it('production : autre adresse ; statut lu ; erreur lisible', async () => {
    const f = vi.fn(async (url: string) => url.endsWith('/v1/auth')
      ? new Response(JSON.stringify({ data: { accessToken: 'jwt-2' } }), { status: 201 })
      : new Response(JSON.stringify({ data: { transactionId: 'tx-2', status: 'PENDING', paidAmount: 64000 } }), { status: 200 }));
    const s = await djomyGetStatus({ clientId: ID, clientSecret: SECRET, live: true }, 'tx-2', f as unknown as typeof fetch);
    expect(s?.status).toBe('pending');
    expect((f.mock.calls[1] as unknown as [string])[0]).toBe('https://api.djomy.africa/v1/payments/tx-2/status');
    const bad = vi.fn(async () => new Response(JSON.stringify({ success: false, error: { message: 'Identifiants invalides' } }), { status: 401 }));
    await expect(djomyCreate({ clientId: ID, clientSecret: 'faux', live: false }, { amount: 1, payerNumber: '00224620000000', orderId: ORDER, orderRef: ORDER, description: '', returnUrl: 'https://h/r', cancelUrl: 'https://h/c' }, bad as unknown as typeof fetch)).rejects.toThrow('Identifiants invalides');
  });
});
