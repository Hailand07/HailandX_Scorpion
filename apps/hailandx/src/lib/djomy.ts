import { createHmac, timingSafeEqual } from 'node:crypto';
import type { CcpResult, CcpStatus } from './chapchappay';

/**
 * Djomy (HAILANDX.md §47) — passerelle guinéenne : Orange Money, MTN MoMo, Soutra Money, PayCard, cartes Visa/Mastercard sur
 * le portail Djomy. Documentation copiée par le fondateur (API v1.0) + plugin Odoo officiel (djoomy/djomy-odoo-plugin) :
 * - chaque requête porte `X-API-KEY: <clientId>:<HMAC-SHA256(clientId, clientSecret) en hexadécimal>` ;
 * - `POST /v1/auth` (corps `{}`) → jeton `data.accessToken`, envoyé ensuite en `Authorization: Bearer` ;
 * - `POST /v1/payments/gateway` → `data.redirectUrl` + `data.transactionId` ; `GET /v1/payments/{id}/status` ;
 * - webhook signé : `X-Webhook-Signature: v1:<HMAC-SHA256(corps brut, clientSecret)>`.
 * Clés : variables serveur DJOMY_CLIENT_ID et DJOMY_CLIENT_SECRET (jamais dans le dépôt). Sandbox et production sont deux
 * comptes séparés : le mode `djomy_test` vise le sandbox, `djomy` la production.
 */
export const DJOMY_API = { test: 'https://sandbox-api.djomy.africa', live: 'https://api.djomy.africa' } as const;
export const djomyBase = (live: boolean) => (process.env.DJOMY_API_URL ?? (live ? DJOMY_API.live : DJOMY_API.test)).replace(/\/$/, '');

const hmacHex = (secret: string, data: string) => createHmac('sha256', secret).update(data).digest('hex');
/** En-tête X-API-KEY : identifiant + sa signature par la clé secrète. */
export const djomyApiKey = (clientId: string, clientSecret: string) => `${clientId}:${hmacHex(clientSecret, clientId)}`;

/** Signature du webhook (« v1:<hex> », préfixe facultatif) comparée en temps constant à HMAC-SHA256(corps brut, secret). */
export function djomyVerify(clientSecret: string | undefined, rawBody: string, header: string | null): boolean {
  if (!clientSecret || !header) return false;
  const sig = header.trim().replace(/^v\d+:/i, '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(sig)) return false;
  const a = Buffer.from(hmacHex(clientSecret, rawBody), 'hex'); const b = Buffer.from(sig, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Statuts Djomy ramenés à ceux que la base connaît ; « REFUNDED » et les inconnus ne changent rien (null). */
export function djomyStatus(s: unknown): CcpStatus | null {
  switch (String(s ?? '').toUpperCase()) {
    case 'CREATED': case 'REDIRECTED': return 'new';
    case 'PENDING': case 'INITIATED': case 'PROCESSING': return 'pending';
    case 'SUCCESS': case 'SUCCESSFUL': return 'success';
    case 'FAILED': return 'failed';
    case 'ERROR': return 'error';
    case 'CANCELLED': case 'CANCELED': return 'canceled';
    case 'TIMEOUT': case 'EXPIRED': return 'expired';
    default: return null;
  }
}

export interface DjomyResult extends CcpResult { feesGnf: number | null }

/** Données d'un paiement Djomy (statut ou webhook V1 `data`, V2 `data.payment`) ; null si illisible. */
export function djomyParse(input: string | Record<string, unknown>): DjomyResult | null {
  let j: Record<string, unknown>;
  try { j = typeof input === 'string' ? (JSON.parse(input) as Record<string, unknown>) : input; } catch { return null; }
  if (!j || typeof j !== 'object') return null;
  const env = j as { data?: Record<string, unknown>; eventType?: string; metadata?: Record<string, unknown> };
  const d0 = (env.data && typeof env.data === 'object' ? env.data : j) as Record<string, unknown>;
  const d = (d0.payment && typeof d0.payment === 'object' ? d0.payment : d0) as Record<string, unknown>;
  const fromEvent = typeof env.eventType === 'string' && env.eventType.startsWith('payment.') ? env.eventType.slice(8) : null;
  const status = djomyStatus(d.status ?? fromEvent);
  const operationId = String(d.transactionId ?? '');
  const amount = Number(d.paidAmount ?? d.amount);
  if (!status || !operationId || !Number.isFinite(amount) || amount <= 0) return null;
  const meta = (d.metadata ?? env.metadata ?? {}) as Record<string, unknown>;
  const fees = Number(d.fees);
  return {
    orderRef: String(d.merchantPaymentReference ?? meta.order_ref ?? meta.order_id ?? ''), operationId, amountGnf: Math.round(amount), status,
    method: d.paymentMethod ? String(d.paymentMethod).toLowerCase() : null, reference: operationId, feesGnf: Number.isFinite(fees) && fees >= 0 ? Math.round(fees) : null,
  };
}

/** Numéro guinéen au format international demandé par Djomy (00224…) ; null s'il n'est pas reconnu. */
export function djomyPhone(raw: string | null | undefined): string | null {
  let d = String(raw ?? '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 9) d = `224${d}`;
  return /^224\d{9}$/.test(d) ? `00${d}` : null;
}

export interface DjomyCreds { clientId: string; clientSecret: string; live: boolean }
type Fetch = typeof fetch;
const json = async (res: Response) => (await res.json().catch(() => ({}))) as Record<string, unknown>;
const dataOf = (j: Record<string, unknown>) => ((j.data && typeof j.data === 'object' ? j.data : j) as Record<string, unknown>);
const errText = (j: Record<string, unknown>, status: number) => String((j.error as { message?: string } | undefined)?.message ?? j.message ?? `Djomy a répondu ${status}`);

/** Jeton d'accès (Bearer). */
export async function djomyToken(c: DjomyCreds, fetchImpl: Fetch = fetch): Promise<string> {
  const res = await fetchImpl(`${djomyBase(c.live)}/v1/auth`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-KEY': djomyApiKey(c.clientId, c.clientSecret) }, body: '{}' });
  const j = await json(res); const d = dataOf(j);
  const token = String(d.accessToken ?? d.access_token ?? d.token ?? j.accessToken ?? j.access_token ?? '');
  if (!res.ok || !token) throw new Error(errText(j, res.status));
  return token;
}

const authHeaders = (c: DjomyCreds, token: string) => ({ 'Content-Type': 'application/json', 'X-API-KEY': djomyApiKey(c.clientId, c.clientSecret), Authorization: `Bearer ${token}` });

export interface DjomyCreate { amount: number; payerNumber: string; orderId: string; orderRef: string; description: string; returnUrl: string; cancelUrl: string }

/** Paiement avec redirection vers le portail Djomy (tous moyens, cartes comprises) → lien + identifiant de transaction. */
export async function djomyCreate(c: DjomyCreds, p: DjomyCreate, fetchImpl: Fetch = fetch): Promise<{ operationId: string; paymentUrl: string }> {
  const token = await djomyToken(c, fetchImpl);
  const body = JSON.stringify({
    amount: Math.round(p.amount), countryCode: 'GN', payerNumber: p.payerNumber, description: p.description.slice(0, 255),
    merchantPaymentReference: p.orderRef, returnUrl: p.returnUrl, cancelUrl: p.cancelUrl, metadata: { order_id: p.orderId, order_ref: p.orderRef },
  });
  const res = await fetchImpl(`${djomyBase(c.live)}/v1/payments/gateway`, { method: 'POST', headers: authHeaders(c, token), body });
  const j = await json(res); const d = dataOf(j);
  if (res.status !== 201 && res.status !== 200) throw new Error(errText(j, res.status));
  const operationId = String(d.transactionId ?? ''); const paymentUrl = String(d.redirectUrl ?? d.link ?? '');
  if (!operationId || !/^https:\/\//.test(paymentUrl)) throw new Error('réponse de Djomy incomplète');
  return { operationId, paymentUrl };
}

/** Statut d'un paiement (GET /v1/payments/{transactionId}/status). */
export async function djomyGetStatus(c: DjomyCreds, transactionId: string, fetchImpl: Fetch = fetch): Promise<DjomyResult | null> {
  const token = await djomyToken(c, fetchImpl);
  const res = await fetchImpl(`${djomyBase(c.live)}/v1/payments/${encodeURIComponent(transactionId)}/status`, { headers: authHeaders(c, token) });
  if (!res.ok) return null;
  const r = djomyParse(await json(res));
  return r ? { ...r, operationId: r.operationId || transactionId } : null;
}
