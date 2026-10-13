import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Notification de paiement du fournisseur (Orange Money) : signature HMAC-SHA256 du corps brut, comparée en temps constant.
 * ⚠️ Le format exact (en-tête, algorithme) dépend du contrat Orange : à confirmer à l'ouverture du compte marchand ; ce module le centralise.
 */
export function signBody(secret: string, rawBody: string): string {
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}

export function verifySignature(secret: string | undefined, rawBody: string, signature: string | null): boolean {
  if (!secret || !signature) return false;
  const a = Buffer.from(signBody(secret, rawBody), 'hex');
  let b: Buffer;
  try { b = Buffer.from(signature.trim().replace(/^sha256=/i, ''), 'hex'); } catch { return false; }
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface PaymentNotice { orderId: string; reference: string; amountGnf: number; status: 'SUCCESS' | 'FAILED' | 'PENDING' }

/** Lit le corps d'une notification ; renvoie null si le format n'est pas celui attendu. */
export function parseNotice(raw: string): PaymentNotice | null {
  try {
    const j = JSON.parse(raw) as Record<string, unknown>;
    const orderId = String(j.order_id ?? '');
    const amount = Number(j.amount);
    const status = String(j.status ?? '').toUpperCase();
    if (!/^[0-9a-f-]{36}$/i.test(orderId) || !Number.isInteger(amount) || amount <= 0) return null;
    if (status !== 'SUCCESS' && status !== 'FAILED' && status !== 'PENDING') return null;
    return { orderId, reference: String(j.txnid ?? j.reference ?? ''), amountGnf: amount, status };
  } catch { return null; }
}
