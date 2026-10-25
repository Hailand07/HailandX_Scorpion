import { NextResponse } from 'next/server';
import { orderIdFromRef } from '@/lib/chapchappay';
import { djomyParse, djomyVerify } from '@/lib/djomy';
import { hasDjomy, payEnv, serviceClient } from '@/lib/payServer';
import { orderOfOperation, settle } from '@/lib/settlePayment';

/**
 * Webhook Djomy (à déclarer dans l'espace développeur Djomy) : signature `X-Webhook-Signature: v1:<HMAC du corps brut>`
 * vérifiée avec la clé secrète, puis statut appliqué à la commande. Envois répétés possibles : traitement idempotent.
 * Seul « payment.success » confirme, et la base revérifie le montant.
 */
export async function POST(req: Request) {
  const env = payEnv();
  if (!env || !hasDjomy(env)) return NextResponse.json({ error: 'paiement non configuré' }, { status: 503 });
  const raw = await req.text(); // signature calculée sur les octets exacts : on lit le corps brut avant tout JSON
  if (!djomyVerify(env.djomySecret, raw, req.headers.get('x-webhook-signature'))) return NextResponse.json({ error: 'signature invalide' }, { status: 401 });

  const r = djomyParse(raw);
  // Événements sans effet sur une commande (remboursement, transfert sortant…) : accusés, rien à faire.
  if (!r) return NextResponse.json({ ok: true, state: 'ignore' });
  const sb = serviceClient(env);
  const orderId = (await orderOfOperation(sb, r.operationId)) ?? orderIdFromRef(r.orderRef);
  if (!orderId) return NextResponse.json({ error: 'commande inconnue' }, { status: 404 });
  const out = await settle(sb, orderId, r);
  if (!out.ok) return NextResponse.json({ error: out.error ?? out.state }, { status: 422 });
  return NextResponse.json({ ok: true, state: out.state });
}
