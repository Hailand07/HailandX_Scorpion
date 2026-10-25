import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Chap Chap Pay (HAILANDX.md §43) — passerelle guinéenne : Orange Money, MTN MoMo, PayCard, cartes… sur une page de paiement.
 * Référence API lue par le fondateur (tableau de bord) : en-tête `CCP-Api-Key` ; POST signés par `CCP-HMAC-Signature`
 * = HMAC-SHA256 du corps JSON brut avec la clé d'encryptage, en hexadécimal minuscule ; la notification (`callback_url`)
 * est signée de la même façon sur son corps brut. Clés : variables serveur CCP_API_KEY et CCP_ENCRYPTION_KEY (jamais dans le dépôt).
 */
export const CCP_API = (process.env.CCP_API_URL ?? 'https://chapchappay.com/api').replace(/\/$/, '');

export function ccpSign(encryptionKey: string, rawBody: string): string {
  return createHmac('sha256', encryptionKey).update(rawBody).digest('hex');
}

/** Signature reçue = signature attendue, comparées en temps constant. */
export function ccpVerify(encryptionKey: string | undefined, rawBody: string, signature: string | null): boolean {
  if (!encryptionKey || !signature || !/^[0-9a-f]+$/i.test(signature.trim())) return false;
  const a = Buffer.from(ccpSign(encryptionKey, rawBody), 'hex');
  const b = Buffer.from(signature.trim().toLowerCase(), 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** La notification porte aussi notre clé API : on la compare en temps constant. */
export function sameSecret(expected: string | undefined, received: string | null): boolean {
  if (!expected || !received) return false;
  const a = Buffer.from(expected); const b = Buffer.from(received.trim());
  return a.length === b.length && timingSafeEqual(a, b);
}

export type CcpStatus = 'new' | 'pending' | 'success' | 'failed' | 'canceled' | 'error' | 'expired';
const STATUSES: CcpStatus[] = ['new', 'pending', 'success', 'failed', 'canceled', 'error', 'expired'];
/** Statut normalisé ; la vérification de statut répond parfois « completed » pour un paiement réussi. */
export function normalizeStatus(code: unknown): CcpStatus | null {
  const c = String(code ?? '').toLowerCase();
  if (c === 'completed') return 'success';
  return (STATUSES as string[]).includes(c) ? (c as CcpStatus) : null;
}

export interface CcpResult { orderRef: string; operationId: string; amountGnf: number; status: CcpStatus; method: string | null; reference: string | null }

/** Corps d'une notification ou d'une vérification de statut E-Commerce ; null si illisible. */
export function parseResult(input: string | Record<string, unknown>): CcpResult | null {
  let j: Record<string, unknown>;
  try { j = typeof input === 'string' ? (JSON.parse(input) as Record<string, unknown>) : input; } catch { return null; }
  if (!j || typeof j !== 'object') return null;
  const st = j.status as Record<string, unknown> | string | undefined;
  const status = normalizeStatus(typeof st === 'object' && st ? st.code : st);
  const amount = Number(j.amount);
  const operationId = String(j.operation_id ?? '');
  if (!status || !operationId || !Number.isFinite(amount) || amount <= 0) return null;
  const tr = (j.transaction ?? {}) as Record<string, unknown>;
  const method = (tr.payment_method ?? (typeof st === 'object' && st ? st.payment_method : null)) as string | null;
  const reference = (tr.payment_reference ?? tr.payment_method_reference ?? null) as string | null;
  return { orderRef: String(j.order_id ?? ''), operationId, amountGnf: Math.round(amount), status, method: method ? String(method) : null, reference: reference ? String(reference) : null };
}

/** Référence de commande envoyée à Chap Chap Pay : l'identifiant HailandX + un suffixe (un nouveau lien après expiration). */
export function orderRefFor(orderId: string, now = Date.now()): string { return `${orderId}-${now.toString(36)}`; }
/** Identifiant de commande HailandX retrouvé dans la référence (repli si l'opération est inconnue). */
export function orderIdFromRef(ref: string): string | null {
  const m = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:-[0-9a-z]+)?$/i.exec(ref.trim());
  return m ? m[1].toLowerCase() : null;
}

export interface CcpCreate { amount: number; orderRef: string; description: string; returnUrl: string; cancelUrl: string; callbackUrl: string }

/** Nouvelle opération de paiement (POST /ecommerce/create) → lien de paiement. Frais déduits côté marchand (par défaut). */
export async function ccpCreate(apiKey: string, encryptionKey: string, c: CcpCreate, fetchImpl: typeof fetch = fetch): Promise<{ operationId: string; paymentUrl: string }> {
  const body = JSON.stringify({ amount: c.amount, order_id: c.orderRef, description: c.description.slice(0, 200), return_url: c.returnUrl, cancel_url: c.cancelUrl, callback_url: c.callbackUrl, fee_handling: 'deduct' });
  const res = await fetchImpl(`${CCP_API}/ecommerce/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CCP-Api-Key': apiKey, 'CCP-HMAC-Signature': ccpSign(encryptionKey, body) },
    body,
  });
  const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (res.status !== 201 && res.status !== 200) throw new Error(String(j.message ?? `Chap Chap Pay a répondu ${res.status}`));
  const operationId = String(j.operation_id ?? ''); const paymentUrl = String(j.payment_url ?? '');
  if (!operationId || !/^https:\/\//.test(paymentUrl)) throw new Error('réponse de Chap Chap Pay incomplète');
  return { operationId, paymentUrl };
}

/** Statut d'une opération (GET /ecommerce/{operation_id}). */
export async function ccpStatus(apiKey: string, operationId: string, fetchImpl: typeof fetch = fetch): Promise<CcpResult | null> {
  const res = await fetchImpl(`${CCP_API}/ecommerce/${encodeURIComponent(operationId)}`, { headers: { 'CCP-Api-Key': apiKey } });
  if (!res.ok) return null;
  return parseResult((await res.json()) as Record<string, unknown>);
}
