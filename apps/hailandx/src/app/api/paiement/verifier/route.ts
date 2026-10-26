import { NextResponse } from 'next/server';
import { ccpStatus } from '@/lib/chapchappay';
import { djomyGetStatus } from '@/lib/djomy';
import { buyerClient, hasCcp, hasDjomy, payEnv, serviceClient } from '@/lib/payServer';
import { settle } from '@/lib/settlePayment';

/**
 * Retour de l'acheteur après la page de paiement : on demande le statut au fournisseur du paiement (au cas où la
 * notification tarde ou s'est perdue) et on l'applique. Ne crée jamais de second paiement.
 */
export async function POST(req: Request) {
  const env = payEnv();
  if (!env) return NextResponse.json({ error: 'paiement non configuré' }, { status: 503 });
  const buyer = buyerClient(env, req);
  if (!buyer) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 });
  const { order } = (await req.json().catch(() => ({}))) as { order?: string };
  if (!order) return NextResponse.json({ error: 'Commande invalide.' }, { status: 400 });
  // La règle de lecture de la base ne montre la commande qu'à son acheteur (ou à l'équipe).
  const mine = await buyer.from('orders').select('id,payment_status').eq('id', order).maybeSingle();
  if (!mine.data) return NextResponse.json({ error: 'Commande introuvable.' }, { status: 404 });
  if ((mine.data as { payment_status: string }).payment_status !== 'en_attente') return NextResponse.json({ state: (mine.data as { payment_status: string }).payment_status });

  const sb = serviceClient(env);
  const pay = await sb.from('payments').select('operation_id,provider_status,provider,provider_test').eq('order_id', order).maybeSingle();
  const p = pay.data as { operation_id: string | null; provider_status: string | null; provider: string; provider_test: boolean } | null;
  if (!p?.operation_id) return NextResponse.json({ state: p?.provider_status ?? 'aucun' });
  const r = p.provider === 'djomy'
    ? (hasDjomy(env) ? await djomyGetStatus({ clientId: env.djomyId, clientSecret: env.djomySecret, live: !p.provider_test }, p.operation_id).catch(() => null) : null)
    : (hasCcp(env) ? await ccpStatus(env.ccpKey, p.operation_id) : null);
  if (!r) return NextResponse.json({ state: 'inconnu' });
  const out = await settle(sb, order, r);
  return NextResponse.json({ state: out.state });
}
