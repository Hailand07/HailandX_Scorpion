import { NextResponse } from 'next/server';
import { ccpVerify, orderIdFromRef, parseResult, sameSecret } from '@/lib/chapchappay';
import { hasCcp, payEnv, serviceClient } from '@/lib/payServer';
import { orderOfOperation, settle } from '@/lib/settlePayment';

/**
 * Notification Chap Chap Pay (callback_url) : signature HMAC du corps brut + clé API, puis statut appliqué à la commande.
 * Réponse 2xx dans les 20 s ; Chap Chap Pay peut l'envoyer plusieurs fois (traitement idempotent). Seul « success » est définitif.
 */
export async function POST(req: Request) {
  const env = payEnv();
  if (!env || !hasCcp(env)) return NextResponse.json({ error: 'paiement non configuré' }, { status: 503 });
  const raw = await req.text(); // signature calculée sur les octets exacts : on lit le corps brut avant tout JSON
  if (!ccpVerify(env.ccpEnc, raw, req.headers.get('ccp-hmac-signature'))) return NextResponse.json({ error: 'signature invalide' }, { status: 401 });
  if (!sameSecret(env.ccpKey, req.headers.get('ccp-api-key'))) return NextResponse.json({ error: 'clé invalide' }, { status: 401 });

  const r = parseResult(raw);
  if (!r) return NextResponse.json({ error: 'notification illisible' }, { status: 400 });
  const sb = serviceClient(env);
  const orderId = (await orderOfOperation(sb, r.operationId)) ?? orderIdFromRef(r.orderRef);
  if (!orderId) return NextResponse.json({ error: 'commande inconnue' }, { status: 404 });

  const out = await settle(sb, orderId, r);
  // Refus métier (montant faux…) : consigné dans le tableau de bord Chap Chap Pay, à traiter par l'équipe.
  if (!out.ok) return NextResponse.json({ error: out.error ?? out.state }, { status: 422 });
  return NextResponse.json({ ok: true, state: out.state });
}
